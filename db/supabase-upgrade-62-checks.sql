-- ترقية ٦٢ — الشيكات (أوراق القبض) + نوع الخزينة «إنستا باي» + حساب «شيكات لدى العملاء».
-- المرجع: طلب المالك (19/10): بيع/تحصيل بالشيكات، تبويب شيكات بفرز حر، ورصيد مستقل للشيكات
-- وانستا باي في لوحة التحكم، وافتراضي محفظة واحدة برقم 000000 + انستا باي للشركة الجديدة.
--
-- ⚠️ لا تُشغّل قبل أمر المالك الصريح.
--
-- اللي بتعمله:
--   (١) جدول public.checks — شيكات العملاء (قبض) بتاريخ استحقاق وحالة.
--   (٢) بذر حساب «1.1.7 شيكات لدى العملاء (أوراق قبض)» لكل شركة موجودة (فقط لو ناقص).
--   (٣) إعادة تعريف دالّتَي إنشاء الشركة (create_org_and_profile / mizan_admin_create_org)
--       لتزرع: 23 حسابًا (+1.1.7) + ٣ خزائن (الصندوق الرئيسي نقدي · المحفظة wallet برقم 000000 ·
--       إنستا باي instapay). الرقم 000000 قابل للتعديل ولا يؤثر على الرصيد.
--
-- ملاحظة النسخ الاحتياطي السحابي (مؤجَّل عمدًا): checks **لسه مش** داخل دوال النسخ
-- (نمط car_trips/cashier_shifts) — إدخاله في النسخ ترقية منفصلة عند الطلب.

-- ============================================================
-- (١) جدول الشيكات
-- ============================================================
create table if not exists public.checks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  local_id      bigint,
  direction     text not null default 'in',        -- in = شيك وارد (لدى العملاء) · out = شيك صادر (للموردين)
  party_kind    text not null default 'customer',  -- customer | supplier
  customer_id   text,
  customer_name text,
  bank_name     text,
  check_no      text,
  due_date      date,
  amount        numeric not null default 0,
  status        text not null default 'pending',   -- pending | collected | returned | cancelled
  treasury_id   text,
  collected_at  timestamptz,
  notes         text,
  ref_type      text,
  ref_id        text,
  created_at    timestamptz default now(),
  deleted       boolean default false,
  constraint checks_direction_ok check (direction in ('in', 'out')),
  constraint checks_party_ok check (party_kind in ('customer', 'supplier')),
  constraint checks_status_ok check (status in ('pending', 'collected', 'returned', 'cancelled'))
);

create index if not exists idx_checks_org on public.checks (org_id);
create index if not exists idx_checks_due on public.checks (org_id, status, due_date);
create unique index if not exists uq_checks_orglocal on public.checks (org_id, local_id) where local_id is not null;

alter table public.checks enable row level security;

drop policy if exists checks_select on public.checks;
drop policy if exists checks_insert on public.checks;
drop policy if exists checks_update on public.checks;
drop policy if exists checks_delete on public.checks;
create policy checks_select on public.checks for select using (org_id = public.current_org());
create policy checks_insert on public.checks for insert with check (org_id = public.current_org());
create policy checks_update on public.checks for update using (org_id = public.current_org());
create policy checks_delete on public.checks for delete using (org_id = public.current_org());

revoke all on public.checks from anon;
revoke all on public.checks from public;
grant select, insert, update, delete on public.checks to authenticated;

comment on table public.checks is
  'الشيكات (أوراق القبض) — ترقية ٦٢. الشيك الوارد يخصم مديونية العميل فورًا ويقف هنا بتاريخ الاستحقاق حتى التحصيل/الارتجاع.';

-- ============================================================
-- (٢) بذر حساب «1.1.7 شيكات لدى العملاء» للشركات الموجودة
-- ============================================================
insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active)
select o.id,
       coalesce((select max(a.local_id) from public.accounts a where a.org_id = o.id), 0) + 1,
       '1.1.7', 'شيكات لدى العملاء', 'asset', null, 0, 0, true
from public.organizations o
where not exists (select 1 from public.accounts a where a.org_id = o.id and a.code = '1.1.7');

-- ============================================================
-- (٣) إعادة تعريف دوال إنشاء الشركة لتشمل 1.1.7 + المحفظة الافتراضية + إنستا باي
-- ============================================================
create or replace function public.create_org_and_profile(p_org_name text, p_name text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'لا توجد جلسة دخول. أعد تسجيل الدخول ثم أعد المحاولة.';
  end if;

  if not public.mizan_invite_manager() then
    raise exception 'الانضمام لبرنامج ميزان بيتم برمز دعوة من إدارة البرنامج. مافيش إنشاء شركة من داخل البرنامج.';
  end if;

  insert into public.organizations (name, plan, plan_status, plan_start, owner_id, invite_code)
  values (
    coalesce(nullif(trim(p_org_name), ''), 'شركة'),
    'free',
    'active',
    current_date,
    v_uid,
    upper(substr(md5(random()::text), 1, 8))
  )
  returning id into v_org;

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org, coalesce(nullif(p_name,''), split_part(auth.email(),'@',1)), 'admin');

  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'group', NULL, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '1.1.2', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '1.1.4', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 23, '1.1.7', 'شيكات لدى العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '2', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '2.1', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '2.1.1', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '2.1.2', 'ضريبة القيمة المضافة المحصلة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '2.1.3', 'ضريبة القيمة المضافة المدفوعة', 'liability', NULL, 0, 0, true),
    (v_org, 14, '3', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 15, '3.1', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 16, '3.2', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 17, '4', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 18, '4.1', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '4.2', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 20, '5', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 21, '5.1', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 22, '5.2', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  insert into public.treasury (org_id, local_id, name, type, account_no, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', NULL, 0, 0, true),
    (v_org, 2, 'المحفظة', 'wallet', '000000', 0, 0, true),
    (v_org, 3, 'إنستا باي', 'instapay', NULL, 0, 0, true);

  return v_org;
end $function$;

create or replace function public.mizan_admin_create_org(p_org_name text, p_admin_username text, p_admin_password text, p_max_members integer)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid;
  v_uid uuid;
  v_email text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if nullif(trim(p_org_name), '') is null or nullif(trim(p_admin_username), '') is null or nullif(p_admin_password, '') is null then
    raise exception 'بيانات ناقصة';
  end if;
  v_email := lower(regexp_replace(trim(p_admin_username), '[^a-z0-9._-]', '', 'g')) || '@mizan.app';
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'اسم المستخدم محجوز بالفعل';
  end if;

  insert into public.organizations (name, plan, plan_status, plan_start, owner_id, invite_code, max_members)
  values (trim(p_org_name), 'active', 'active', current_date, auth.uid(),
          upper(substr(md5(random()::text), 1, 8)),
          coalesce(p_max_members, 5))
  returning id into v_org;

  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_admin_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"email_confirmed":true}'::jsonb,
    jsonb_build_object('sub', v_uid, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    now(), now(), '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
  ) values (
    v_email, v_uid, jsonb_build_object('sub', v_uid, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    'email', now(), now(), now(), gen_random_uuid()
  );

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org, coalesce(nullif(trim(p_admin_username),''), 'مدير الشركة'), 'admin');

  insert into public.mizan_pw_store (user_id, plain_password) values (v_uid, p_admin_password)
  on conflict (user_id) do update set plain_password = excluded.plain_password, updated_at = now();

  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'group', NULL, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '1.1.2', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '1.1.4', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 23, '1.1.7', 'شيكات لدى العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '2', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '2.1', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '2.1.1', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '2.1.2', 'ضريبة القيمة المضافة المحصلة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '2.1.3', 'ضريبة القيمة المضافة المدفوعة', 'liability', NULL, 0, 0, true),
    (v_org, 14, '3', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 15, '3.1', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 16, '3.2', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 17, '4', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 18, '4.1', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '4.2', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 20, '5', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 21, '5.1', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 22, '5.2', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  insert into public.treasury (org_id, local_id, name, type, account_no, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', NULL, 0, 0, true),
    (v_org, 2, 'المحفظة', 'wallet', '000000', 0, 0, true),
    (v_org, 3, 'إنستا باي', 'instapay', NULL, 0, 0, true);

  return v_org;
end $function$;

revoke all on function public.create_org_and_profile(text, text) from public, anon;
grant execute on function public.create_org_and_profile(text, text) to authenticated;
revoke all on function public.mizan_admin_create_org(text, text, text, integer) from public, anon;
grant execute on function public.mizan_admin_create_org(text, text, text, integer) to authenticated;

-- ============================================================
-- (٤) فحص ذاتي
-- ============================================================
do $$
begin
  if (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'checks') <> 1 then
    raise exception 'ترحيل ٦٢ فشل: جدول checks لم يُنشأ';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'checks') <> 4 then
    raise exception 'ترحيل ٦٢ فشل: سياسات RLS على checks مش ٤';
  end if;
  if (select count(*) from public.accounts where code = '1.1.7') < 1 then
    raise exception 'ترحيل ٦٢ فشل: حساب 1.1.7 لم يُبذر';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'create_org_and_profile') <> 1 then
    raise exception 'ترحيل ٦٢ فشل: دالة إنشاء الشركة مش موجودة';
  end if;
end $$;

notify pgrst, 'reload schema';
