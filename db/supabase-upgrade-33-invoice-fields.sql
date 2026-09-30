-- ============================================================
-- ترحيل ٣٣: «بيانات تنزل على الفاتورة» لكل شركة
--   )1( organizations.invoice_fields (jsonb) = اختيار صاحب الشركة:
--       أي بيان من بيانات منشأته يُطبع على الفاتورة وأيه ما يُطبعش.
--       المفاتيح: name / address / phone / tax_number
--       الافتراضي = الأربعة منشورة، عشان أي شركة قديمة ما تلاقيش
--       فاتورتها ناقصة بعد الترقية.
--   )2( mizan_client_sett_save: فرع جديد يحفظ invoice_fields
--       (كائن jsonb سليم فقط) بنفس حماية الصلاحيات الموجودة.
-- القراءة مش محتاجة تغيير: mizan_client_sett بترجع
-- to_jsonb(سطر الشركة) فالعمود الجديد بييجي لوحده.
-- الدالة اتولّدت من تعريفها الحيّ في القاعدة، فسلوك قديم متغيرش.
-- ============================================================

-- (1) العمود
alter table public.organizations
  add column if not exists invoice_fields jsonb
  not null default '{"name":true,"address":true,"phone":true,"tax_number":true}'::jsonb;

update public.organizations
   set invoice_fields = '{"name":true,"address":true,"phone":true,"tax_number":true}'::jsonb
 where invoice_fields is null
    or invoice_fields = 'null'::jsonb
    or jsonb_typeof(invoice_fields) <> 'object';

-- (2) حفظ الاختيار مع باقي بيانات المنشأة
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
  if p_wallets is not null then
    delete from public.treasury where org_id = v_org and type = 'wallet';
    for r in select * from jsonb_array_elements(p_wallets)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.treasury (id, org_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', 'wallet', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_banks is not null then
    delete from public.treasury where org_id = v_org and type = 'bank';
    for r in select * from jsonb_array_elements(p_banks)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.treasury (id, org_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', 'bank', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
end $function$;
