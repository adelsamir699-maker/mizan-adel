-- ============================================================================
-- ترقية ٦٤ — عمود إعدادات المنظمة `organizations.settings` (jsonb)
-- ----------------------------------------------------------------------------
-- البند: #13/٣ — «أرضية أرقام القيود/السندات/حركات الأطراف محفوظة في localStorage
--        بس ⇒ جهاز جديد/متصفح تاني يبدأ من ١ ويكتب فوق صفوف موجودة على السحابة».
-- القرار (المالك 19/10): نخزّنها داخل عمود `organizations.settings` (jsonb للمنظمة)
--        — بلا جدول جديد، والقراءة تلقائية لأن `mizan_client_sett()` ترجّع سطر
--        الشركة كاملًا (`to_jsonb`)، والكتابة عبر `mizan_client_sett_save` (p_org).
--
-- ماذا تفعل هذه الترقية:
--   ١) تضيف العمود `settings jsonb not null default '{}'` (لو مش موجود).
--   ٢) تُعيد تعريف `mizan_client_sett_save` بنسخة الحيّة حرفيًا + فرع واحد جديد:
--      `settings` — دمج عام + **max** لأرضيات `idFloors` (vouchers/journal/txs/supplierTxs)
--      لأن الأرقام أحادية الاتجاه (تزيد ولا تنقص) ⇒ جهازان ما يكتبوش فوق بعض.
--   ٣) إعادة التحصين: revoke من public/anon + grant authenticated + search_path.
--   ٤) فحص ذاتي يمنع أي نتيجة جزئية.
--
-- ملاحظات:
--   • الملف بلا `begin/commit` (نفس نمط ٢٤/٢٨/٥٤/٥٥/٥٦/٦২/٦٣) — المشغّل يفتح معاملة.
--   • لا يمسّ أي بيانات: العمود جديد افتراضي `{}` لكل الشركات.
--   • العميل: `idFloorsPush/Pull` في app.js (بناء ٢٠١) هي اللي بتبعت/تقرأ القيمة.
-- ============================================================================

-- (١) العمود
alter table public.organizations
  add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.organizations.settings is
  'إعدادات المنظمة العامة (jsonb) — ترقية ٦٤: أرضيات أرقام القيود/السندات/حركات الأطراف (idFloors) مع دمج max.';

-- (٢) دالة الحفظ — نسخة الحيّة + فرع settings
create or replace function public.mizan_client_sett_save(p_org jsonb, p_categories jsonb, p_units jsonb, p_warehouses jsonb, p_owners jsonb, p_wallets jsonb, p_banks jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
    -- ترحيل ٦٤: إعدادات المنظمة (jsonb) — دمج عام + max لأرضيات الأرقام (لا تنقص أبدًا)
    if (p_org ? 'settings') and jsonb_typeof(p_org->'settings') = 'object' then
      update public.organizations
         set settings = coalesce(settings, '{}'::jsonb) || (p_org->'settings')
           || case when (p_org->'settings') ? 'idFloors' then jsonb_build_object('idFloors', jsonb_build_object(
                'vouchers',    greatest(coalesce((settings->'idFloors'->>'vouchers')::bigint, 0),
                                        coalesce((p_org->'settings'->'idFloors'->>'vouchers')::bigint, 0)),
                'journal',     greatest(coalesce((settings->'idFloors'->>'journal')::bigint, 0),
                                        coalesce((p_org->'settings'->'idFloors'->>'journal')::bigint, 0)),
                'txs',         greatest(coalesce((settings->'idFloors'->>'txs')::bigint, 0),
                                        coalesce((p_org->'settings'->'idFloors'->>'txs')::bigint, 0)),
                'supplierTxs', greatest(coalesce((settings->'idFloors'->>'supplierTxs')::bigint, 0),
                                        coalesce((p_org->'settings'->'idFloors'->>'supplierTxs')::bigint, 0))
              )) else '{}'::jsonb end
       where id = v_org;
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

-- (٣) التحصين (نفس نمط ترقية ٥٥)
revoke all on function public.mizan_client_sett_save(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.mizan_client_sett_save(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- (٤) فحص ذاتي — أي نقص = استثناء (المعاملة كلها ترجع)
do $$
declare
  v_col int;
  v_def text;
  v_anon boolean;
begin
  select count(*) into v_col
  from information_schema.columns
  where table_schema = 'public' and table_name = 'organizations' and column_name = 'settings'
    and data_type = 'jsonb' and is_nullable = 'NO';
  if v_col <> 1 then
    raise exception 'ترحيل ٦٤ فشل: عمود organizations.settings غير موجود/غير مطابق';
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = 'mizan_client_sett_save';
  if v_def is null or position('idFloors' in v_def) = 0 or position('settings' in v_def) = 0 then
    raise exception 'ترحيل ٦٤ فشل: فرع settings/idFloors مش موجود في mizan_client_sett_save';
  end if;

  select has_function_privilege('anon',
    'public.mizan_client_sett_save(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)', 'execute')
  into v_anon;
  if v_anon then
    raise exception 'ترحيل ٦٤ فشل: anon لسه يقدر ينفّذ mizan_client_sett_save';
  end if;
end $$;
