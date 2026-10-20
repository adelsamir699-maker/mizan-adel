-- ترقية ٦٦ — حصانة الشيكات وورديات الكاشير ورحلات السيارات في النسخ الاحتياطي
-- التاريخ: 20/10/2026 · بناء 209
-- الغرض: الجداول الثلاثة (checks / cashier_shifts / car_trips) كانت خارج دوال النسخ
--        والاستعادة الكاملة (backup_full/restore_full) وخارج تصدير/استعادة شركة واحدة.
--        الترقية تُعيد تعريف الدوال الأربعة بنفس الحيّة حرفيًا + إضافة الجداول الثلاثة فقط.
--        لا تعديل على أي جدول أو بيانات موجودة.
-- آمنة للتكرار (idempotent) — بلا begin/commit (نمط ٢٤/٢٨/٢٩).

CREATE OR REPLACE FUNCTION public.mizan_admin_backup_full()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  t text;
  rows jsonb;
  out jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_superadmin is true) then
    raise exception 'مسموح للمالك فقط';
  end if;

  out := jsonb_set(out, '{_meta}',
        jsonb_build_object('at', now()::text, 'app', 'mizan', 'source', 'mizan_admin_backup_full'));

  -- حسابات الدخول (كل الأعمدة؛ تشمل encrypted_password)
  select coalesce(jsonb_agg(to_json(u) order by u.created_at), '[]'::jsonb) into rows from auth.users u;
  out := jsonb_set(out, '{_auth_users}', rows);
  select coalesce(jsonb_agg(to_json(i)), '[]'::jsonb) into rows from auth.identities i;
  out := jsonb_set(out, '{_auth_identities}', rows);

  foreach t in array array[
    'organizations','profiles',
    'accounts','audit_logs','categories','customer_txs','customers',
    'journal_entries','journal_lines','mizan_created_accounts','mizan_invoice_seq',
    'mizan_pw_store','owners','password_changes','presence','products',
    'purchase_items','purchases','sale_items','sales','supplier_txs','suppliers',
'treasury','units','vouchers','warehouses',
    'sale_returns','sale_return_items','purchase_returns','purchase_return_items',
    'mizan_documents','mizan_retired_codes',
    'fixed_assets',   -- ترقية ٣٨: الأصول الثابتة (الحضور: أُزيل في ٥٣)
    'checks','cashier_shifts','car_trips'   -- ترقية ٦٦: الشيكات وورديات الكاشير ورحلات السيارات
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_json(x)), ''[]''::jsonb) from public.%I x', t
    ) into rows;
    out := jsonb_set(out, array[t], rows);
  end loop;

  return out;
end $function$;

CREATE OR REPLACE FUNCTION public.mizan_admin_restore_full(p_payload jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  t text;
  r jsonb;
  uidcol text;
  n bigint := 0;
  tables text[] := array[
    'accounts','audit_logs','categories','customer_txs','customers',
    'journal_entries','journal_lines','mizan_created_accounts','mizan_invoice_seq',
    'mizan_pw_store','owners','password_changes','presence','products',
    'purchase_items','purchases','sale_items','sales','supplier_txs','suppliers',
'treasury','units','vouchers','warehouses',
    'sale_returns','sale_return_items','purchase_returns','purchase_return_items',
    'mizan_documents','mizan_retired_codes',
    'fixed_assets',   -- ترقية ٣٨: الأصول الثابتة (الحضور: أُزيل في ٥٣)
    'checks','cashier_shifts','car_trips'   -- ترقية ٦٦
  ];
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_superadmin is true) then
    raise exception 'مسموح للمالك فقط';
  end if;

  if p_payload ? '_auth_users' and jsonb_typeof(p_payload->'_auth_users') = 'array' then
    for r in select jsonb_array_elements(p_payload->'_auth_users') loop
      if exists (select 1 from auth.users au where au.id = (r->>'id')::uuid) then
        update auth.users
           set email               = coalesce(r->>'email', email),
               encrypted_password  = coalesce(r->>'encrypted_password', encrypted_password),
               raw_user_meta_data  = coalesce(r->'raw_user_meta_data', raw_user_meta_data),
               aud                 = coalesce(r->>'aud', aud),
               role                = coalesce(r->>'role', role),
               banned_until        = (r->>'banned_until')::timestamptz
         where id = (r->>'id')::uuid;
      else
        perform public.mizan_adaptive_insert('auth', 'users', r);
      end if;
      n := n + 1;
    end loop;
  end if;

  -- 3) الهويات: حذف القديمة لكل مستخدم في الملف ثم زرعها (تكيّف مع اسم العمود)
  select case when exists (
      select 1 from information_schema.columns
      where table_schema='auth' and table_name='identities' and column_name='auth_user_id'
    ) then 'auth_user_id' else 'user_id' end into uidcol;

  if p_payload ? '_auth_identities' and jsonb_typeof(p_payload->'_auth_identities') = 'array' then
    execute format(
      'delete from auth.identities where %I in (
         select (v->>''id'')::uuid from jsonb_array_elements(coalesce($1->''_auth_users'',''[]''::jsonb)) v)',
      uidcol) using p_payload;
    for r in select jsonb_array_elements(p_payload->'_auth_identities') loop
      if uidcol = 'auth_user_id' and r ? 'user_id' then
        r := (jsonb_set(r, '{auth_user_id}', r->'user_id')) - 'user_id';
      elsif uidcol = 'user_id' and r ? 'auth_user_id' then
        r := (jsonb_set(r, '{user_id}', r->'auth_user_id')) - 'auth_user_id';
      end if;
      perform public.mizan_adaptive_insert('auth', 'identities', r);
    end loop;
  end if;

  -- 4) الشركات ثم الملفات (FKs على الاتنين)
  for r in select jsonb_array_elements(p_payload->'organizations') loop
    insert into public.organizations select * from jsonb_populate_record(null::public.organizations, r);
  end loop;
  if p_payload ? 'profiles' and jsonb_typeof(p_payload->'profiles') = 'array' then
    for r in select jsonb_array_elements(p_payload->'profiles') loop
      insert into public.profiles select * from jsonb_populate_record(null::public.profiles, r);
    end loop;
  end if;

  -- 5) باقي الجداول
  foreach t in array tables loop
    if p_payload ? t and jsonb_typeof(p_payload->t) = 'array' then
      for r in select jsonb_array_elements(p_payload->t) loop
        execute format(
          'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1::jsonb)', t, t
        ) using r;
      end loop;
    end if;
  end loop;

  return format('تمت الاستعادة: %s حساب دخول، %s شركة',
    n, jsonb_array_length(p_payload->'organizations'));
end $function$;

CREATE OR REPLACE FUNCTION public.mizan_admin_export_one(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'journal_lines',  coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_lines t where t.org_id = p_org_id), '[]'::jsonb),
    'checks',         coalesce((select jsonb_agg(to_jsonb(t)) from public.checks t where t.org_id = p_org_id), '[]'::jsonb),
    'cashier_shifts', coalesce((select jsonb_agg(to_jsonb(t)) from public.cashier_shifts t where t.org_id = p_org_id), '[]'::jsonb),
    'car_trips',      coalesce((select jsonb_agg(to_jsonb(t)) from public.car_trips t where t.org_id = p_org_id), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $function$;

CREATE OR REPLACE FUNCTION public.mizan_admin_restore_one(p_org_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      if (v_org->>'tax_buy_enabled') is not null then update public.organizations set tax_buy_enabled = (v_org->>'tax_buy_enabled')::boolean where id = p_org_id; end if;
      if (v_org->>'tax_rate_buy') is not null then update public.organizations set tax_rate_buy = (v_org->>'tax_rate_buy')::numeric where id = p_org_id; end if;
      if (v_org->>'tax_title') is not null then update public.organizations set tax_title = v_org->>'tax_title' where id = p_org_id; end if;
      if (v_org->>'paper_size') is not null then update public.organizations set paper_size = v_org->>'paper_size' where id = p_org_id; end if;
      if (v_org->>'warranty_terms') is not null then update public.organizations set warranty_terms = v_org->>'warranty_terms' where id = p_org_id; end if;
      if (v_org->>'org_note') is not null then update public.organizations set org_note = v_org->>'org_note' where id = p_org_id; end if;
    else
      insert into public.organizations (id, name, phone, address, tax_number, tax_enabled, tax_rate, tax_buy_enabled, tax_rate_buy, tax_title, paper_size, warranty_terms, org_note)
      values (p_org_id, v_org->>'name', v_org->>'phone', v_org->>'address', v_org->>'tax_number',
              coalesce((v_org->>'tax_enabled')::boolean, false), coalesce((v_org->>'tax_rate')::numeric, 0),
              coalesce((v_org->>'tax_buy_enabled')::boolean, false), coalesce((v_org->>'tax_rate_buy')::numeric, 0),
              v_org->>'tax_title', v_org->>'paper_size', v_org->>'warranty_terms', v_org->>'org_note');
    end if;
  end if;

  delete from public.sale_items where org_id = p_org_id;
  delete from public.sales where org_id = p_org_id;
  delete from public.purchase_items where org_id = p_org_id;
  delete from public.purchases where org_id = p_org_id;
  delete from public.supplier_txs where org_id = p_org_id;
  delete from public.customer_txs where org_id = p_org_id;
  delete from public.vouchers where org_id = p_org_id;
  delete from public.journal_lines where org_id = p_org_id;
  delete from public.journal_entries where org_id = p_org_id;
  delete from public.treasury where org_id = p_org_id;
  delete from public.accounts where org_id = p_org_id;
  delete from public.owners where org_id = p_org_id;
  delete from public.warehouses where org_id = p_org_id;
  delete from public.units where org_id = p_org_id;
  delete from public.categories where org_id = p_org_id;
  delete from public.customers where org_id = p_org_id;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'customers', p_org_id::text))
  loop
    insert into public.customers (id, org_id, local_id, code, name_ar, phone, address, opening_balance, current_balance, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'phone', r->>'address',
            coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'current_balance')::numeric, 0),
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
    insert into public.products (id, org_id, local_id, code, name_ar, price, cost, qty, unit, category, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar',
            coalesce((r->>'price')::numeric, 0), coalesce((r->>'cost')::numeric, 0), coalesce((r->>'qty')::numeric, 0),
            r->>'unit', r->>'category', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
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
    insert into public.accounts (id, org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'type',
            (r->>'parent_id')::bigint, coalesce((r->>'opening_debit')::numeric, 0), coalesce((r->>'opening_credit')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'categories', p_org_id::text))
  loop
    insert into public.categories (id, org_id, name, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'name', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'units', p_org_id::text))
  loop
    insert into public.units (id, org_id, name, symbol, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'name', r->>'symbol', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
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

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'checks', p_org_id::text))
  loop
    insert into public.checks select * from jsonb_populate_record(null::public.checks, jsonb_set(r,'{org_id}',to_jsonb(p_org_id))) on conflict do nothing;
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'cashier_shifts', p_org_id::text))
  loop
    insert into public.cashier_shifts select * from jsonb_populate_record(null::public.cashier_shifts, jsonb_set(r,'{org_id}',to_jsonb(p_org_id))) on conflict do nothing;
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'car_trips', p_org_id::text))
  loop
    insert into public.car_trips select * from jsonb_populate_record(null::public.car_trips, jsonb_set(r,'{org_id}',to_jsonb(p_org_id))) on conflict do nothing;
  end loop;
end $function$;

-- تحصين المنح (نفس نمط الحيّة: سوبرأدمن فقط بالحارس الداخلي)
revoke all on function public.mizan_admin_backup_full() from anon, public;
revoke all on function public.mizan_admin_restore_full(jsonb) from anon, public;
revoke all on function public.mizan_admin_export_one(uuid) from anon, public;
revoke all on function public.mizan_admin_restore_one(uuid, jsonb) from anon, public;
grant execute on function public.mizan_admin_backup_full() to authenticated, service_role;
grant execute on function public.mizan_admin_restore_full(jsonb) to authenticated, service_role;
grant execute on function public.mizan_admin_export_one(uuid) to authenticated, service_role;
grant execute on function public.mizan_admin_restore_one(uuid, jsonb) to authenticated, service_role;

do $$
declare d text;
begin
  foreach d in array array['mizan_admin_backup_full','mizan_admin_restore_full','mizan_admin_export_one','mizan_admin_restore_one'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname=d and pg_get_functiondef(p.oid) like '%checks%') then
      raise exception 'ترقية ٦٦ فشلت: % لا تشمل checks', d;
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full','mizan_admin_export_one','mizan_admin_restore_one')) <> 4 then
    raise exception 'ترقية ٦٦ فشلت: عدد الدوال غير متوقع';
  end if;
end $$;
