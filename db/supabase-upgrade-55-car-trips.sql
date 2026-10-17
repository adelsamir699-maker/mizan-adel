-- ============================================================================
-- ترحيل ٥٥ — «سيارات مناديب المبيعات» (بناء 178)
-- ----------------------------------------------------------------------------
-- حاجتان:
--   (أ) عمود جديد organizations.cars (jsonb) = سجل سيارات المناديب اللي المالك بيكتبها
--       («رقم/اسم السيارة» + is_active). نفس نمط ترحيل ٣٣ (invoice_fields): العمود
--       بيتحفظ عبر فرع جديد جوه mizan_client_sett_save، والقراءة مش محتاجة تغيير لأن
--       mizan_client_sett() بترجع to_jsonb(سطر الشركة) فالعمود بييجي لوحده (جوه org).
--   (ب) جدول public.car_trips — رحلة سيارة يوم: تحميل من المخزن + بيع + مصروفات + تصفية.
--       نفس نمط ترحيل ٥٤ (cashier_shifts): id uuid pk + org_id (عزل current_org()) + local_id.
--       مفتاح السطر السحابي = detUuid('car_trips', local_id) في طبقة المزامنة (cloud.js).
--
-- public.car_trips — رحلة سيارة مندوب مبيعات:
--   car_name                 : رقم/اسم السيارة (من organizations.cars)
--   rep_name / rep_user / rep_full : هوية مندوب البيع المكلّف بالرحلة
--   trip_date                : تاريخ الرحلة (ISO محلي)
--   status                   : 'open' مفتوحة / 'settled' مسوّاة
--   loaded                   : jsonb — [{productId, name, qty, unit, cost, salePrice}]
--   expenses                 : jsonb — [{id, cat, amount, note, date, jrnId}]
--   load_warehouse           : المخزن اللي اتحمّلت منه السيارة
--   opened_at / opened_by    : وقت ومين فتح التحميل
--   settled_at / settled_by  : وقت ومين صفّى الرحلة
--   expected_cash / counted_cash / difference : المتوقّع (كاش المبيعات − المصروفات) / المعدود / الفرق
--   treasury_id              : الخزينة المستلَم إليها في التصفية
--   settle_warehouse         : المخزن اللي رجع له الباقي
--   notes / deleted / created_at / updated_at
--
-- لا يمسّ أي جدول/سياسة قائمة (بس بيعيد تعريف دالة الحفظ بإضافة فرع cars).
-- تنفيذ هذا الملف آمن للتكرار (IF NOT EXISTS / create or replace).
--
-- ⚠️ ملاحظة النسخ الاحتياطي السحابي (مؤجَّل عمدًا): car_trips **لسه مش** داخل دوال النسخ
--    الأربعة ولا FULL_RESTORE_TABLES في الواجهة — نفس وضع cashier_shifts (ترحيل ٥٤).
--    اللحظة اللي تُطلب فيها إضافته للنسخ تُكتب ترقية منفصلة (نمط ٣٨).
--
-- ----------------------------------------------------------------------------
-- ✅ الحالة: كُتب ولم يُنفَّذ بعد. يُنفَّذ على السحابة بأمر المالك الصريح فقط.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) عمود سجل السيارات على الشركة (organizations.cars)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists cars jsonb not null default '[]'::jsonb;

update public.organizations
   set cars = '[]'::jsonb
 where cars is null
    or cars = 'null'::jsonb
    or jsonb_typeof(cars) <> 'array';

-- ---------------------------------------------------------------------------
-- 2) جدول رحلات سيارات المناديب
-- ---------------------------------------------------------------------------
create table if not exists public.car_trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  local_id bigint,
  car_name text default '',
  rep_name text default '',
  rep_user text default '',
  rep_full text default '',
  trip_date text default '',
  status text not null default 'open'
    constraint car_trips_status_ok
    check (status in ('open','settled')),
  loaded jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  load_warehouse text default '',
  opened_at text default '',
  opened_by text default '',
  settled_at text,
  settled_by text,
  expected_cash numeric(14,2),
  counted_cash numeric(14,2),
  difference numeric(14,2),
  treasury_id bigint,
  settle_warehouse text default '',
  notes text default '',
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_car_trips_org on public.car_trips (org_id);
create index if not exists idx_car_trips_status on public.car_trips (org_id, status);
create unique index if not exists uq_car_trips_orglocal on public.car_trips (org_id, local_id) where local_id is not null;

-- ---------------------------------------------------------------------------
-- 3) RLS: العزل الكامل — كل شركة ترى رحلاتها فقط (نفس سياسات بقية الجداول)
-- ---------------------------------------------------------------------------
alter table public.car_trips enable row level security;

drop policy if exists car_trips_select on public.car_trips;
drop policy if exists car_trips_insert on public.car_trips;
drop policy if exists car_trips_update on public.car_trips;
drop policy if exists car_trips_delete on public.car_trips;
create policy car_trips_select on public.car_trips for select using (org_id = public.current_org());
create policy car_trips_insert on public.car_trips for insert with check (org_id = public.current_org());
create policy car_trips_update on public.car_trips for update using (org_id = public.current_org());
create policy car_trips_delete on public.car_trips for delete using (org_id = public.current_org());

-- لا منح لـ anon إطلاقًا (درس ترقية 27: لا كتابة مباشرة مجهولة الهوية على القاعدة)
revoke all on public.car_trips from anon;
revoke all on public.car_trips from public;
grant select, insert, update, delete on public.car_trips to authenticated;

comment on table public.car_trips is
  'رحلات سيارات مناديب المبيعات (بناء 178) — تحميل سيارة يوم + بيع + مصروفات + تصفية آخر اليوم';

-- ---------------------------------------------------------------------------
-- 4) فرع حفظ سجل السيارات جوه دالة حفظ إعدادات العميل
--    (نسخة حيّة من mizan_client_sett_save بحسب ترحيل ٥٢ + سطر cars — بيتقرأ من p_org->'cars')
--    باقي الدالة زي ما هي حرفيًا؛ الإضافة الوحيدة سطر cars.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mizan_client_sett_save(p_org jsonb, p_categories jsonb, p_units jsonb, p_warehouses jsonb, p_owners jsonb, p_wallets jsonb, p_banks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
declare
  v_org uuid;
  r jsonb;
  v_id uuid;
  v_local bigint;
begin
  select org_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'غير مصرح';
  end if;

  if p_org is not null then
    if (p_org->>'name') is not null then update public.organizations set name = p_org->>'name' where id = v_org; end if;
    if (p_org->>'phone') is not null then update public.organizations set phone = p_org->>'phone' where id = v_org; end if;
    if (p_org->>'address') is not null then update public.organizations set address = p_org->>'address' where id = v_org; end if;
    if (p_org->>'tax_number') is not null then update public.organizations set tax_number = p_org->>'tax_number' where id = v_org; end if;
    if (p_org->>'tax_enabled') is not null then update public.organizations set tax_enabled = (p_org->>'tax_enabled')::boolean where id = v_org; end if;
    if (p_org->>'tax_rate') is not null then update public.organizations set tax_rate = (p_org->>'tax_rate')::numeric where id = v_org; end if;
    if (p_org->>'tax_buy_enabled') is not null then update public.organizations set tax_buy_enabled = (p_org->>'tax_buy_enabled')::boolean where id = v_org; end if;
    if (p_org->>'tax_rate_buy') is not null then update public.organizations set tax_rate_buy = (p_org->>'tax_rate_buy')::numeric where id = v_org; end if;
    if (p_org->>'tax_title') is not null then update public.organizations set tax_title = p_org->>'tax_title' where id = v_org; end if;
    if (p_org->>'paper_size') is not null then update public.organizations set paper_size = p_org->>'paper_size' where id = v_org; end if;
    if (p_org->>'warranty_terms') is not null then update public.organizations set warranty_terms = p_org->>'warranty_terms' where id = v_org; end if;
    if (p_org->>'org_note') is not null then update public.organizations set org_note = p_org->>'org_note' where id = v_org; end if;
    if (p_org ? 'invoice_fields') then update public.organizations set invoice_fields = p_org->'invoice_fields' where id = v_org; end if;
    -- ترحيل ٥٥: سجل سيارات مناديب المبيعات (مصفوفة jsonb فقط)
    if (p_org ? 'cars') and jsonb_typeof(p_org->'cars') = 'array' then
      update public.organizations set cars = p_org->'cars' where id = v_org;
    end if;
  end if;

  if p_categories is not null then
    delete from public.categories where org_id = v_org;
    for r in select * from jsonb_array_elements(p_categories)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.categories (id, org_id, name, description, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'description', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_units is not null then
    delete from public.units where org_id = v_org;
    for r in select * from jsonb_array_elements(p_units)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.units (id, org_id, name, symbol, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'symbol', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_warehouses is not null then
    delete from public.warehouses where org_id = v_org;
    for r in select * from jsonb_array_elements(p_warehouses)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.warehouses (id, org_id, code, name, address, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'code', r->>'name', r->>'address', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_owners is not null then
    delete from public.owners where org_id = v_org;
    for r in select * from jsonb_array_elements(p_owners)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.owners (id, org_id, name, phone, capital, withdrawals, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'phone', coalesce((r->>'capital')::numeric, 0), coalesce((r->>'withdrawals')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_wallets is not null then
    delete from public.treasury where org_id = v_org and type = 'wallet';
    for r in select * from jsonb_array_elements(p_wallets)
    loop
      v_id := (r->>'id')::uuid;
      v_local := (r->>'local_id')::bigint;
      if v_local is null or exists (
           select 1 from public.treasury t2
            where t2.org_id = v_org and t2.local_id = v_local and t2.id is distinct from v_id) then
        v_local := public.mizan_treasury_next_local(v_org, v_id);
      end if;
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, v_local, r->>'name', 'wallet', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_banks is not null then
    delete from public.treasury where org_id = v_org and type = 'bank';
    for r in select * from jsonb_array_elements(p_banks)
    loop
      v_id := (r->>'id')::uuid;
      v_local := (r->>'local_id')::bigint;
      if v_local is null or exists (
           select 1 from public.treasury t2
            where t2.org_id = v_org and t2.local_id = v_local and t2.id is distinct from v_id) then
        v_local := public.mizan_treasury_next_local(v_org, v_id);
      end if;
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, v_local, r->>'name', 'bank', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
end $function$;

-- ---------------------------------------------------------------------------
-- 5) فحص ذاتي: العمود والجدول والسياسات موجودين وشغّالين — وإلا فشل ظاهر
-- ---------------------------------------------------------------------------
do $$
begin
  if (select count(*) from information_schema.columns where table_schema='public'
        and table_name = 'organizations' and column_name = 'cars') <> 1 then
    raise exception 'ترحيل ٥٥ فشل: عمود organizations.cars لم يُنشأ';
  end if;
  if (select count(*) from information_schema.tables where table_schema='public'
        and table_name = 'car_trips') <> 1 then
    raise exception 'ترحيل ٥٥ فشل: جدول car_trips لم يُنشأ';
  end if;
  if (select count(*) from pg_policies where schemaname='public'
        and tablename = 'car_trips') <> 4 then
    raise exception 'ترحيل ٥٥ فشل: سياسات RLS غير مكتملة (المطلوب 4)';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public'
        and indexname = 'uq_car_trips_orglocal') then
    raise exception 'ترحيل ٥٥ فشل: فهرس الهوية (org_id, local_id) غير موجود';
  end if;
  if position('cars' in (select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='mizan_client_sett_save' limit 1)) = 0 then
    raise exception 'ترحيل ٥٥ فشل: فرع cars لم يُضَف إلى mizan_client_sett_save';
  end if;
end $$;
