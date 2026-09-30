-- =====================================================================
-- ترحيل ٣٤: هوية الخزائن (local_id) — إصلاح سبب تكرار المحافظ/البنوك
-- =====================================================================
-- المشكلة اللي تم إثباتها على البيانات الحيّة (2026-09-30):
--   دالتا الإعدادات mizan_client_sett_save و mizan_admin_sett_save بتمسح كل
--   أسطر الخزائن من نوع wallet / bank وبعدين تعيد إدراجها من الحمولة (payload)،
--   لكن قائمة الأعمدة في الإدراج كانت **بدون local_id**.
--
--   النتيجة: كل حفظ من شاشة الضبط كان بيسرق هوية المحفظة/البنك:
--     ١) السطر يفضل موجود بنفس الـ uuid لكن local_id = NULL.
--     ٢) الفهرس الفريد uq_treasury_orglocal (org_id, local_id) ما يمنعش التكرار
--        لأن NULL ≠ NULL في بوستجرس — فمافيش أي حماية من التكرار.
--     ٣) التطبيق (cloud.js → assignLocalIds) بيترقم السطر المجهول من جديد في كل
--        تحميل، فيدفع سطر إضافي بالرقم الجديد ⇒ زوج مكرر جديد كل جلسة
--        (اللي حصل فعلًا في «المجد»: ٧ بنوك و٧ محافظ بنفس الاسم).
--     ٤) upsert بتاع التطبيق بيستخدم on conflict (org_id, local_id) فما يلاقيش
--        السطر المجهول ⇒ يحاول INSERT بنفس الـ uuid ⇒ خطأ 23505 على treasury_pkey
--        ⇒ الدفعة كلها تفشل ⇒ رسالة «رفع «الخزائن» للسحابة مكملش دلوقتي»
--        (كانت بتظهر عند تسجيل مرتجع لأن المرتجع بيحرّك رصيد الخزينة).
--
-- الحل في الترحيل ده (٣ حاجات، كلها في اتجاه واحد: مافيش سطر خزينة من غير هوية):
--   أ) إدراج local_id في الدالتين (من الحمولة نفسها — mizan_client_sett بيرجّعها).
--   ب) دالة مساعدة mizan_treasury_next_local: لو الحمولة ما جابتش local_id
--      (سطر جديد اتضاف من شاشة الضبط) نستخرجه من ذيل الـ uuid لو هو detUuid،
--      وإلا نديله max+1 — **مستحيل** يتولد سطر بـ local_id NULL بعد كده.
--   ج) حماية من التصادم: لو الرقم مطلوب لسطر تاني في نفس الشركة ⇒ نرقّم من جديد.
--
-- ملاحظة أمان: الدالتين SECURITY DEFINER ومعاهم نفس فحوصات الصلاحيات بالظبط
-- (ما اتغيّرش أي شرط إذن) — التعديل في أعمدة الإدراج بس.
-- =====================================================================

-- ---------- (ب) الدالة المساعدة: ترقيم محلي مضمون لسطر خزينة ----------
create or replace function public.mizan_treasury_next_local(p_org uuid, p_id uuid)
returns bigint
language plpgsql
set search_path to public
as $$
declare
  v_tail  text;
  v_local bigint;
  v_max   bigint;
begin
  -- ١) لو الـ id جاي من detUuid بتاع التطبيق: آخر ١٢ hex = الرقم المحلي نفسه
  v_tail := lower(right(coalesce(p_id::text, ''), 12));
  if v_tail ~ '^[0-9a-f]{12}$' then
    begin
      v_local := ('x' || v_tail)::bit(48)::bigint;
    exception when others then
      v_local := null;
    end;
    if v_local is not null and v_local > 0 and v_local <= 1000000
       and not exists (select 1 from public.treasury t
                        where t.org_id = p_org and t.local_id = v_local) then
      return v_local;
    end if;
  end if;

  -- ٢) غير كده: أول رقم فاضي بعد أكبر رقم موجود في الشركة
  select coalesce(max(local_id), 0) + 1 into v_max
    from public.treasury where org_id = p_org;
  return v_max;
end
$$;

comment on function public.mizan_treasury_next_local(uuid, uuid) is
  'ترحيل ٣٤: يضمن إن كل سطر خزينة ياخد local_id فريد جوه شركته — يمنع التكرار وفشل الرفع';

-- ---------- (أ) دالة العميل: mizan_client_sett_save ----------
CREATE OR REPLACE FUNCTION public.mizan_client_sett_save(p_org jsonb, p_categories jsonb, p_units jsonb, p_warehouses jsonb, p_owners jsonb, p_wallets jsonb, p_banks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_role text;
  v_super boolean;
  v_features jsonb;
  v_blocked boolean;
  r jsonb;
  v_id uuid;
  v_local bigint;
begin
  select org_id, coalesce(role,''), coalesce(is_superadmin,false), coalesce(features,'{}'::jsonb), coalesce(blocked,false)
    into v_org, v_role, v_super, v_features, v_blocked
  from public.profiles where id = auth.uid();
  if v_org is null then raise exception 'غير مصرح'; end if;
  if v_blocked then raise exception 'حسابك محظور'; end if;
  if not (v_super or v_role = 'admin' or coalesce((v_features->>'clientSettings')::boolean, false)) then
    raise exception 'غير مصرح: ميزة «إعدادات مؤسستك» غير مفعّلة لحسابك';
  end if;

  if p_org is not null then
    if (p_org->>'name') is not null then update public.organizations set name = p_org->>'name' where id = v_org; end if;
    if (p_org->>'phone') is not null then update public.organizations set phone = p_org->>'phone' where id = v_org; end if;
    if (p_org->>'address') is not null then update public.organizations set address = p_org->>'address' where id = v_org; end if;
    if (p_org->>'tax_number') is not null then update public.organizations set tax_number = p_org->>'tax_number' where id = v_org; end if;
    if (p_org->>'tax_enabled') is not null then update public.organizations set tax_enabled = (p_org->>'tax_enabled')::boolean where id = v_org; end if;
    if (p_org->>'tax_rate') is not null then update public.organizations set tax_rate = (p_org->>'tax_rate')::numeric where id = v_org; end if;
    if (p_org->>'tax_title') is not null then update public.organizations set tax_title = p_org->>'tax_title' where id = v_org; end if;
    if (p_org->>'paper_size') is not null then update public.organizations set paper_size = p_org->>'paper_size' where id = v_org; end if;
    if (p_org->>'warranty_terms') is not null then update public.organizations set warranty_terms = p_org->>'warranty_terms' where id = v_org; end if;
    if (p_org->>'org_note') is not null then update public.organizations set org_note = p_org->>'org_note' where id = v_org; end if;
    -- ترحيل ٣٣: «انشر على الفاتورة» لكل بيان (اسم/عنوان/تليفون/رقم ضريبي)
    if (p_org ? 'invoice_fields') and jsonb_typeof(p_org->'invoice_fields') = 'object' then
      update public.organizations set invoice_fields = p_org->'invoice_fields' where id = v_org;
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
  -- ترحيل ٣٤: المحافظ — local_id بيرجع مع السطر (كان بيقع في كل حفظ ⇒ تكرار + فشل رفع)
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
  -- ترحيل ٣٤: البنوك — نفس الحماية
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

-- ---------- (أ) دالة المالك: mizan_admin_sett_save ----------
CREATE OR REPLACE FUNCTION public.mizan_admin_sett_save(p_org_id uuid, p_org jsonb, p_categories jsonb, p_units jsonb, p_warehouses jsonb, p_owners jsonb, p_wallets jsonb, p_banks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r jsonb;
  v_id uuid;
  v_local bigint;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;

  if p_org is not null then
    if (p_org->>'name') is not null then update public.organizations set name = p_org->>'name' where id = p_org_id; end if;
    if (p_org->>'phone') is not null then update public.organizations set phone = p_org->>'phone' where id = p_org_id; end if;
    if (p_org->>'address') is not null then update public.organizations set address = p_org->>'address' where id = p_org_id; end if;
    if (p_org->>'tax_number') is not null then update public.organizations set tax_number = p_org->>'tax_number' where id = p_org_id; end if;
    if (p_org->>'tax_enabled') is not null then update public.organizations set tax_enabled = (p_org->>'tax_enabled')::boolean where id = p_org_id; end if;
    if (p_org->>'tax_rate') is not null then update public.organizations set tax_rate = (p_org->>'tax_rate')::numeric where id = p_org_id; end if;
    if (p_org->>'tax_title') is not null then update public.organizations set tax_title = p_org->>'tax_title' where id = p_org_id; end if;
    if (p_org->>'paper_size') is not null then update public.organizations set paper_size = p_org->>'paper_size' where id = p_org_id; end if;
    if (p_org->>'warranty_terms') is not null then update public.organizations set warranty_terms = p_org->>'warranty_terms' where id = p_org_id; end if;
    if (p_org->>'org_note') is not null then update public.organizations set org_note = p_org->>'org_note' where id = p_org_id; end if;
  end if;

  if p_categories is not null then
    delete from public.categories where org_id = p_org_id;
    for r in select * from jsonb_array_elements(p_categories)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.categories (id, org_id, name, description, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'name', r->>'description', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_units is not null then
    delete from public.units where org_id = p_org_id;
    for r in select * from jsonb_array_elements(p_units)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.units (id, org_id, name, symbol, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'name', r->>'symbol', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_warehouses is not null then
    delete from public.warehouses where org_id = p_org_id;
    for r in select * from jsonb_array_elements(p_warehouses)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.warehouses (id, org_id, code, name, address, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'code', r->>'name', r->>'address', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_owners is not null then
    delete from public.owners where org_id = p_org_id;
    for r in select * from jsonb_array_elements(p_owners)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.owners (id, org_id, name, phone, capital, withdrawals, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'name', r->>'phone', coalesce((r->>'capital')::numeric, 0), coalesce((r->>'withdrawals')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  -- ترحيل ٣٤: المحافظ — local_id بيرجع مع السطر
  if p_wallets is not null then
    delete from public.treasury where org_id = p_org_id and type = 'wallet';
    for r in select * from jsonb_array_elements(p_wallets)
    loop
      v_id := (r->>'id')::uuid;
      v_local := (r->>'local_id')::bigint;
      if v_local is null or exists (
           select 1 from public.treasury t2
            where t2.org_id = p_org_id and t2.local_id = v_local and t2.id is distinct from v_id) then
        v_local := public.mizan_treasury_next_local(p_org_id, v_id);
      end if;
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, v_local, r->>'name', 'wallet', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  -- ترحيل ٣٤: البنوك — نفس الحماية
  if p_banks is not null then
    delete from public.treasury where org_id = p_org_id and type = 'bank';
    for r in select * from jsonb_array_elements(p_banks)
    loop
      v_id := (r->>'id')::uuid;
      v_local := (r->>'local_id')::bigint;
      if v_local is null or exists (
           select 1 from public.treasury t2
            where t2.org_id = p_org_id and t2.local_id = v_local and t2.id is distinct from v_id) then
        v_local := public.mizan_treasury_next_local(p_org_id, v_id);
      end if;
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, v_local, r->>'name', 'bank', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
end $function$;

-- =====================================================================
-- فحص ذاتي: يتأكد إن الدالتين بقت بتدرج local_id فعلًا (لو لأ ⇒ يوقف الترحيل)
-- =====================================================================
do $chk$
declare
  v_def text;
  v_bad text[] := '{}';
begin
  foreach v_def in array array['mizan_client_sett_save', 'mizan_admin_sett_save']
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_def and p.prokind = 'f';
    if v_def is null then
      raise exception 'ترحيل ٣٤: الدالة % مش موجودة', v_def;
    end if;
    if position('id, org_id, local_id, name, type, account_no' in v_def) = 0 then
      v_bad := array_append(v_bad, v_def);
    end if;
  end loop;
  if array_length(v_bad, 1) > 0 then
    raise exception 'ترحيل ٣٤ فشل: الدوال دي لسه ما بتدرجش local_id: %', array_to_string(v_bad, ', ');
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname='public' and p.proname='mizan_treasury_next_local') then
    raise exception 'ترحيل ٣٤ فشل: الدالة المساعدة mizan_treasury_next_local مش موجودة';
  end if;
  raise notice 'ترحيل ٣٤ تمام: الدالتين بتدرجوا local_id + الدالة المساعدة موجودة';
end
$chk$;
