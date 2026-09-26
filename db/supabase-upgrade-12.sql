-- ==============================================================
-- ترقية 12: المالك يختار الشركة عند النسخ والاستعادة
--  1) mizan_admin_export_one(org_id)   : نسخة شركة واحدة (نفس شكل نسخة العميل)
--  2) mizan_admin_restore_one(org,payload): استعادة نسخة في شركة محددة (بدون باسورد — للمالك فقط)
--  3) mizan_admin_restore_all(payload)  : استعادة النسخة الشاملة (كل الشركات)
--  4) تحديث mizan_admin_export_all      : تضمين التصنيفات/الوحدات/المستودعات/أصحاب المنشأة
-- ==============================================================

-- مساعد: استخراج صفوف جدول معيّن من حمولة (يدعم شكلين: الشامل وشركة واحدة)
drop function if exists public.mizan_org_rows(jsonb, text, text);
create or replace function public.mizan_org_rows(p_payload jsonb, p_key text, p_org text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare v_out jsonb;
begin
  if p_payload->'organizations' is not null then
    select coalesce(jsonb_agg(e), '[]'::jsonb) into v_out
    from jsonb_array_elements(coalesce(p_payload->p_key, '[]'::jsonb)) e
    where e->>'org_id' = p_org;
  else
    select coalesce(jsonb_agg(e), '[]'::jsonb) into v_out
    from jsonb_array_elements(coalesce(p_payload->p_key, '[]'::jsonb)) e;
  end if;
  return v_out;
end $$;

grant execute on function public.mizan_org_rows(jsonb, text, text) to authenticated;

-- 1) نسخة احتياطية لشركة واحدة فحسب (للمالك: كل جداول الشركة بنفس شكل نسخة العميل)
drop function if exists public.mizan_admin_export_one(uuid);
create or replace function public.mizan_admin_export_one(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'الشركة غير موجودة';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'org',            (select to_jsonb(o) from public.organizations o where o.id = p_org_id),
    'customers',      coalesce((select jsonb_agg(to_jsonb(t)) from public.customers t where t.org_id = p_org_id), '[]'::jsonb),
    'suppliers',      coalesce((select jsonb_agg(to_jsonb(t)) from public.suppliers t where t.org_id = p_org_id), '[]'::jsonb),
    'products',       coalesce((select jsonb_agg(to_jsonb(t)) from public.products t where t.org_id = p_org_id), '[]'::jsonb),
    'treasury',       coalesce((select jsonb_agg(to_jsonb(t)) from public.treasury t where t.org_id = p_org_id), '[]'::jsonb),
    'accounts',       coalesce((select jsonb_agg(to_jsonb(t)) from public.accounts t where t.org_id = p_org_id), '[]'::jsonb),
    'categories',     coalesce((select jsonb_agg(to_jsonb(t)) from public.categories t where t.org_id = p_org_id), '[]'::jsonb),
    'units',          coalesce((select jsonb_agg(to_jsonb(t)) from public.units t where t.org_id = p_org_id), '[]'::jsonb),
    'warehouses',     coalesce((select jsonb_agg(to_jsonb(t)) from public.warehouses t where t.org_id = p_org_id), '[]'::jsonb),
    'owners',         coalesce((select jsonb_agg(to_jsonb(t)) from public.owners t where t.org_id = p_org_id), '[]'::jsonb),
    'sales',          coalesce((select jsonb_agg(to_jsonb(t)) from public.sales t where t.org_id = p_org_id), '[]'::jsonb),
    'sale_items',     coalesce((select jsonb_agg(to_jsonb(t)) from public.sale_items t where t.org_id = p_org_id), '[]'::jsonb),
    'purchases',      coalesce((select jsonb_agg(to_jsonb(t)) from public.purchases t where t.org_id = p_org_id), '[]'::jsonb),
    'purchase_items', coalesce((select jsonb_agg(to_jsonb(t)) from public.purchase_items t where t.org_id = p_org_id), '[]'::jsonb),
    'supplier_txs',   coalesce((select jsonb_agg(to_jsonb(t)) from public.supplier_txs t where t.org_id = p_org_id), '[]'::jsonb),
    'customer_txs',   coalesce((select jsonb_agg(to_jsonb(t)) from public.customer_txs t where t.org_id = p_org_id), '[]'::jsonb),
    'vouchers',       coalesce((select jsonb_agg(to_jsonb(t)) from public.vouchers t where t.org_id = p_org_id), '[]'::jsonb),
    'journal_entries',coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_entries t where t.org_id = p_org_id), '[]'::jsonb),
    'journal_lines',  coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_lines t where t.org_id = p_org_id), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

grant execute on function public.mizan_admin_export_one(uuid) to authenticated;

-- 3) استعادة نسخة شاملة (كل الشركات) — المالك فقط، بدون كلمة مرور
drop function if exists public.mizan_admin_restore_all(jsonb);
create or replace function public.mizan_admin_restore_all(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if p_payload->'organizations' is null or (p_payload->'organizations') = '[]'::jsonb then
    raise exception 'هذا الملف ليس نسخة شاملة (كل العملاء)';
  end if;
  for r in select * from jsonb_array_elements(p_payload->'organizations')
  loop
    perform public.mizan_admin_restore_one(coalesce((r->>'id')::uuid, gen_random_uuid()), p_payload);
  end loop;
end $$;

grant execute on function public.mizan_admin_restore_all(jsonb) to authenticated;

-- 2) استعادة نسخة في شركة محددة — المالك فقط، بدون كلمة مرور
drop function if exists public.mizan_admin_restore_one(uuid, jsonb);
create or replace function public.mizan_admin_restore_one(p_org_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_id uuid;
  v_org jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;

  -- تحديد كائن الشركة: من قائمة الشركات (شامل) أو من مفتاح org (نسخة شركة واحدة)
  if p_payload->'organizations' is not null then
    select e into v_org from jsonb_array_elements(p_payload->'organizations') e
    where e->>'id' = p_org_id::text limit 1;
  else
    v_org := p_payload->'org';
  end if;

  -- تحديث / إدراج الشركة نفسها
  if v_org is not null then
    if exists (select 1 from public.organizations where id = p_org_id) then
      if (v_org->>'name') is not null then update public.organizations set name = v_org->>'name' where id = p_org_id; end if;
      if (v_org->>'phone') is not null then update public.organizations set phone = v_org->>'phone' where id = p_org_id; end if;
      if (v_org->>'address') is not null then update public.organizations set address = v_org->>'address' where id = p_org_id; end if;
      if (v_org->>'tax_number') is not null then update public.organizations set tax_number = v_org->>'tax_number' where id = p_org_id; end if;
      if (v_org->>'tax_enabled') is not null then update public.organizations set tax_enabled = (v_org->>'tax_enabled')::boolean where id = p_org_id; end if;
      if (v_org->>'tax_rate') is not null then update public.organizations set tax_rate = (v_org->>'tax_rate')::numeric where id = p_org_id; end if;
      if (v_org->>'tax_title') is not null then update public.organizations set tax_title = v_org->>'tax_title' where id = p_org_id; end if;
      if (v_org->>'paper_size') is not null then update public.organizations set paper_size = v_org->>'paper_size' where id = p_org_id; end if;
      if (v_org->>'warranty_terms') is not null then update public.organizations set warranty_terms = v_org->>'warranty_terms' where id = p_org_id; end if;
      if (v_org->>'org_note') is not null then update public.organizations set org_note = v_org->>'org_note' where id = p_org_id; end if;
      if (v_org->>'plan') is not null then update public.organizations set plan = v_org->>'plan' where id = p_org_id; end if;
      if (v_org->>'plan_start') is not null then update public.organizations set plan_start = (v_org->>'plan_start')::date where id = p_org_id; end if;
      if (v_org->>'plan_end') is not null then update public.organizations set plan_end = (v_org->>'plan_end')::date where id = p_org_id; end if;
      if (v_org->>'business_type') is not null then update public.organizations set business_type = v_org->>'business_type' where id = p_org_id; end if;
    else
      insert into public.organizations (id, name, phone, address, tax_number, business_type, plan, plan_start, plan_end,
        tax_enabled, tax_rate, tax_title, paper_size, warranty_terms, org_note, invite_code, created_at)
      values (p_org_id, v_org->>'name', v_org->>'phone', v_org->>'address', v_org->>'tax_number', v_org->>'business_type',
        coalesce(v_org->>'plan','free'), (v_org->>'plan_start')::date, (v_org->>'plan_end')::date,
        coalesce((v_org->>'tax_enabled')::boolean,false), coalesce((v_org->>'tax_rate')::numeric,0),
        v_org->>'tax_title', coalesce(v_org->>'paper_size','A4'), v_org->>'warranty_terms', v_org->>'org_note',
        v_org->>'invite_code', coalesce((v_org->>'created_at')::timestamptz, now()));
    end if;
  end if;

  -- مسح بيانات الشركة الحالية
  delete from public.sale_items where org_id = p_org_id;
  delete from public.sales where org_id = p_org_id;
  delete from public.purchase_items where org_id = p_org_id;
  delete from public.purchases where org_id = p_org_id;
  delete from public.supplier_txs where org_id = p_org_id;
  delete from public.customer_txs where org_id = p_org_id;
  delete from public.vouchers where org_id = p_org_id;
  delete from public.journal_lines where org_id = p_org_id;
  delete from public.journal_entries where org_id = p_org_id;
  delete from public.audit_logs where org_id = p_org_id;
  delete from public.treasury where org_id = p_org_id;
  delete from public.accounts where org_id = p_org_id;
  delete from public.owners where org_id = p_org_id;
  delete from public.warehouses where org_id = p_org_id;
  delete from public.units where org_id = p_org_id;
  delete from public.categories where org_id = p_org_id;
  delete from public.customers where org_id = p_org_id;
  delete from public.suppliers where org_id = p_org_id;
  delete from public.products where org_id = p_org_id;

  -- إعادة الإدراج (يُستخدم مساعد mizan_org_rows ليدعم الشامل ونسخة الشركة الواحدة)
  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'customers', p_org_id::text))
  loop
    insert into public.customers (id, org_id, local_id, code, name_ar, name_en, phone, address, opening_balance, credit_limit, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'name_en', r->>'phone', r->>'address',
            coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'credit_limit')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'suppliers', p_org_id::text))
  loop
    insert into public.suppliers (id, org_id, local_id, code, name_ar, phone, address, opening_balance, current_balance, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'phone', r->>'address',
            coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'current_balance')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'products', p_org_id::text))
  loop
    insert into public.products (id, org_id, local_id, code, name_ar, name_en, barcode, category, purchase_price, sale_price, stock_qty, min_stock, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'name_en', r->>'barcode', r->>'category',
            coalesce((r->>'purchase_price')::numeric, 0), coalesce((r->>'sale_price')::numeric, 0),
            coalesce((r->>'stock_qty')::numeric, 0), coalesce((r->>'min_stock')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'treasury', p_org_id::text))
  loop
    insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'name', coalesce(r->>'type','cash'), r->>'account_no',
            coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'accounts', p_org_id::text))
  loop
    insert into public.accounts (id, org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, balance, is_active, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'type', coalesce((r->>'parent_id')::numeric, 0),
            coalesce((r->>'opening_debit')::numeric, 0), coalesce((r->>'opening_credit')::numeric, 0), coalesce((r->>'balance')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'categories', p_org_id::text))
  loop
    insert into public.categories (id, org_id, name, description, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'name', r->>'description', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'units', p_org_id::text))
  loop
    insert into public.units (id, org_id, name, symbol, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'name', r->>'symbol', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'warehouses', p_org_id::text))
  loop
    insert into public.warehouses (id, org_id, code, name, address, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'code', r->>'name', r->>'address', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'owners', p_org_id::text))
  loop
    insert into public.owners (id, org_id, name, phone, capital, withdrawals, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'name', r->>'phone', coalesce((r->>'capital')::numeric, 0), coalesce((r->>'withdrawals')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'sales', p_org_id::text))
  loop
    insert into public.sales (id, org_id, local_id, invoice_no, doc_date, customer, payment_method, treasury_id, store, notes, discount, tax, grand_total, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'customer', r->>'payment_method',
            (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'sale_items', p_org_id::text))
  loop
    insert into public.sale_items (id, org_id, local_id, sale_id, product_id, product_name, qty, price, total)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, coalesce((r->>'sale_id')::uuid, gen_random_uuid()), (r->>'product_id')::text, r->>'product_name',
            coalesce((r->>'qty')::numeric, 0), coalesce((r->>'price')::numeric, 0), coalesce((r->>'total')::numeric, 0));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'purchases', p_org_id::text))
  loop
    insert into public.purchases (id, org_id, local_id, invoice_no, doc_date, supplier, payment_method, treasury_id, store, notes, discount, tax, grand_total, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'supplier', r->>'payment_method',
            (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'purchase_items', p_org_id::text))
  loop
    insert into public.purchase_items (id, org_id, local_id, purchase_id, product_id, product_name, qty, price, total)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, coalesce((r->>'purchase_id')::uuid, gen_random_uuid()), (r->>'product_id')::text, r->>'product_name',
            coalesce((r->>'qty')::numeric, 0), coalesce((r->>'price')::numeric, 0), coalesce((r->>'total')::numeric, 0));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'supplier_txs', p_org_id::text))
  loop
    insert into public.supplier_txs (id, org_id, local_id, supplier_id, doc_date, type, amount, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, (r->>'supplier_id')::text, coalesce((r->>'doc_date')::date, now()::date), r->>'type', coalesce((r->>'amount')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'customer_txs', p_org_id::text))
  loop
    insert into public.customer_txs (id, org_id, local_id, customer_id, doc_date, description, debit, credit, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, (r->>'customer_id')::text, coalesce((r->>'doc_date')::date, now()::date), r->>'description', coalesce((r->>'debit')::numeric, 0), coalesce((r->>'credit')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'vouchers', p_org_id::text))
  loop
    insert into public.vouchers (id, org_id, local_id, no, doc_date, kind, treasury_id, account_id, amount, notes, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'no', coalesce((r->>'doc_date')::date, now()::date), r->>'kind', (r->>'treasury_id')::text, (r->>'account_id')::text, coalesce((r->>'amount')::numeric, 0), r->>'notes', coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'journal_entries', p_org_id::text))
  loop
    insert into public.journal_entries (id, org_id, local_id, jrn_no, doc_date, ref_type, ref_id, description, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'jrn_no', coalesce((r->>'doc_date')::date, now()::date), r->>'ref_type', (r->>'ref_id')::text, r->>'description', coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'journal_lines', p_org_id::text))
  loop
    insert into public.journal_lines (id, org_id, local_id, entry_id, account_id, account_name, debit, credit)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, coalesce((r->>'entry_id')::uuid, gen_random_uuid()), (r->>'account_id')::text, r->>'account_name', coalesce((r->>'debit')::numeric, 0), coalesce((r->>'credit')::numeric, 0));
  end loop;
end $$;

grant execute on function public.mizan_admin_restore_one(uuid, jsonb) to authenticated;

-- 4) تحديث النسخة الشاملة: تضمين التصنيفات/الوحدات/المستودعات/أصحاب المنشأة
drop function if exists public.mizan_admin_export_all();
create or replace function public.mizan_admin_export_all()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'organizations',      coalesce((select jsonb_agg(to_jsonb(t)) from public.organizations t), '[]'::jsonb),
    'profiles',           coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t), '[]'::jsonb),
    'customers',          coalesce((select jsonb_agg(to_jsonb(t)) from public.customers t), '[]'::jsonb),
    'suppliers',          coalesce((select jsonb_agg(to_jsonb(t)) from public.suppliers t), '[]'::jsonb),
    'products',           coalesce((select jsonb_agg(to_jsonb(t)) from public.products t), '[]'::jsonb),
    'treasury',           coalesce((select jsonb_agg(to_jsonb(t)) from public.treasury t), '[]'::jsonb),
    'accounts',           coalesce((select jsonb_agg(to_jsonb(t)) from public.accounts t), '[]'::jsonb),
    'categories',         coalesce((select jsonb_agg(to_jsonb(t)) from public.categories t), '[]'::jsonb),
    'units',              coalesce((select jsonb_agg(to_jsonb(t)) from public.units t), '[]'::jsonb),
    'warehouses',         coalesce((select jsonb_agg(to_jsonb(t)) from public.warehouses t), '[]'::jsonb),
    'owners',             coalesce((select jsonb_agg(to_jsonb(t)) from public.owners t), '[]'::jsonb),
    'sales',              coalesce((select jsonb_agg(to_jsonb(t)) from public.sales t), '[]'::jsonb),
    'sale_items',         coalesce((select jsonb_agg(to_jsonb(t)) from public.sale_items t), '[]'::jsonb),
    'purchases',          coalesce((select jsonb_agg(to_jsonb(t)) from public.purchases t), '[]'::jsonb),
    'purchase_items',     coalesce((select jsonb_agg(to_jsonb(t)) from public.purchase_items t), '[]'::jsonb),
    'supplier_txs',       coalesce((select jsonb_agg(to_jsonb(t)) from public.supplier_txs t), '[]'::jsonb),
    'customer_txs',       coalesce((select jsonb_agg(to_jsonb(t)) from public.customer_txs t), '[]'::jsonb),
    'vouchers',           coalesce((select jsonb_agg(to_jsonb(t)) from public.vouchers t), '[]'::jsonb),
    'journal_entries',    coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_entries t), '[]'::jsonb),
    'journal_lines',      coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_lines t), '[]'::jsonb),
    'audit_logs',         coalesce((select jsonb_agg(to_jsonb(t)) from public.audit_logs t), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

grant execute on function public.mizan_admin_export_all() to authenticated;