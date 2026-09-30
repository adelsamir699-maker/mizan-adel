-- ============================================================================
-- ترحيل ٣٦ — إدخال «الحضور والانصراف» في دوال النسخ الاحتياطي (بناء 115)
-- ----------------------------------------------------------------------------
-- الدوال الأربعة (نسخ/استعادة المالك + نسخ/استعادة العميل) بَتعداد جداوله
-- في مصفوفات نصية ثابتة آخرها ترقية ٣٢ (المرتجعات). الترحيل ده بيولّد كل
-- دالة من تعريفها الحيّ المأخوذ من القاعدة (pg_get_functiondef) وبيضيف
-- الجدلات التلاتة الجديدة بس — أي سلوك قديم متغيرش:
--   employees  (الموظفون)   · attendance (سجل الحضور)   · att_settings (مدة العمل)
--
-- 1) mizan_admin_backup_full  — مصفوفة foreach += الجدلات التلاتة
-- 2) mizan_admin_restore_full — tables text[] += التلاتة (الـ TRUNCATE والزرع بيغطوهم تلقائيًا)
-- 3) mizan_client_export      — jsonb_build_object += التلاتة بفلتر org_id
-- 4) mizan_client_restore     — حذف مشروط بوجود المفتاح في الملف (نفس نمط المرتجعات
--      عشان ملف قديم ما يمسخش بيانات موجودة) + زرع تكيّفي عبر mizan_adaptive_insert
--
-- آمن للتكرار (CREATE OR REPLACE). لا يمسّ أي جدول/سياسة/دالة أخرى.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) نسخة المالك الكاملة
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mizan_admin_backup_full()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
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
    'employees','attendance','att_settings'          -- 🆕 ترقية ٣٦: الحضور والانصراف
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_json(x)), ''[]''::jsonb) from public.%I x', t
    ) into rows;
    out := jsonb_set(out, array[t], rows);
  end loop;

  return out;
end $function$;

-- ---------------------------------------------------------------------------
-- 2) استعادة المالك الكاملة (TRUNCATE ثم زرع — المصفوفة بتغطى الحذف والزرع)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mizan_admin_restore_full(p_payload jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
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
    'employees','attendance','att_settings'          -- 🆕 ترقية ٣٦: الحضور والانصراف
  ];
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_superadmin is true) then
    raise exception 'مسموح للمالك فقط';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'ملف النسخة غير صالح';
  end if;
  if not (p_payload ? 'organizations') or jsonb_typeof(p_payload->'organizations') <> 'array' then
    raise exception 'الملف ما فيهوش قائمة organizations — مش نسخة ميزان كاملة';
  end if;

  -- 1) تفريغ كل الجداول العامة دفعة واحدة (TRUNCATE يتخطى ترتيب الـ FK)
  execute format('truncate table %s',
    (select string_agg(format('public.%I', x), ', ')
       from unnest(array['organizations','profiles'] || tables) x));

  -- 2) حسابات الدخول: تحديث الموجود (نفس الـ id) وإدراج الجديد
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

-- ---------------------------------------------------------------------------
-- 3) نسخة العميل (شركته فقط)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mizan_client_export()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_out jsonb;
begin
  select org_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then raise exception 'غير مصرح'; end if;
  select jsonb_build_object(
    'exported_at', now(),
    'org',            (select to_jsonb(o) from public.organizations o where o.id = v_org),
    'customers',      coalesce((select jsonb_agg(to_jsonb(t)) from public.customers t where t.org_id = v_org), '[]'::jsonb),
    'suppliers',      coalesce((select jsonb_agg(to_jsonb(t)) from public.suppliers t where t.org_id = v_org), '[]'::jsonb),
    'products',       coalesce((select jsonb_agg(to_jsonb(t)) from public.products t where t.org_id = v_org), '[]'::jsonb),
    'treasury',       coalesce((select jsonb_agg(to_jsonb(t)) from public.treasury t where t.org_id = v_org), '[]'::jsonb),
    'accounts',       coalesce((select jsonb_agg(to_jsonb(t)) from public.accounts t where t.org_id = v_org), '[]'::jsonb),
    'categories',     coalesce((select jsonb_agg(to_jsonb(t)) from public.categories t where t.org_id = v_org), '[]'::jsonb),
    'units',          coalesce((select jsonb_agg(to_jsonb(t)) from public.units t where t.org_id = v_org), '[]'::jsonb),
    'warehouses',     coalesce((select jsonb_agg(to_jsonb(t)) from public.warehouses t where t.org_id = v_org), '[]'::jsonb),
    'owners',         coalesce((select jsonb_agg(to_jsonb(t)) from public.owners t where t.org_id = v_org), '[]'::jsonb),
    'sales',          coalesce((select jsonb_agg(to_jsonb(t)) from public.sales t where t.org_id = v_org), '[]'::jsonb),
    'sale_items',     coalesce((select jsonb_agg(to_jsonb(t)) from public.sale_items t where t.org_id = v_org), '[]'::jsonb),
    'purchases',      coalesce((select jsonb_agg(to_jsonb(t)) from public.purchases t where t.org_id = v_org), '[]'::jsonb),
    'purchase_items', coalesce((select jsonb_agg(to_jsonb(t)) from public.purchase_items t where t.org_id = v_org), '[]'::jsonb),
    'supplier_txs',   coalesce((select jsonb_agg(to_jsonb(t)) from public.supplier_txs t where t.org_id = v_org), '[]'::jsonb),
    'customer_txs',   coalesce((select jsonb_agg(to_jsonb(t)) from public.customer_txs t where t.org_id = v_org), '[]'::jsonb),
    'vouchers',       coalesce((select jsonb_agg(to_jsonb(t)) from public.vouchers t where t.org_id = v_org), '[]'::jsonb),
    'journal_entries',coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_entries t where t.org_id = v_org), '[]'::jsonb),
    'journal_lines',  coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_lines t where t.org_id = v_org), '[]'::jsonb),
    'sale_returns',   coalesce((select jsonb_agg(to_jsonb(t)) from public.sale_returns t where t.org_id = v_org), '[]'::jsonb),
    'sale_return_items', coalesce((select jsonb_agg(to_jsonb(t)) from public.sale_return_items t where t.org_id = v_org), '[]'::jsonb),
    'purchase_returns',   coalesce((select jsonb_agg(to_jsonb(t)) from public.purchase_returns t where t.org_id = v_org), '[]'::jsonb),
    'purchase_return_items', coalesce((select jsonb_agg(to_jsonb(t)) from public.purchase_return_items t where t.org_id = v_org), '[]'::jsonb),
    'mizan_invoice_seq', coalesce((select jsonb_agg(to_jsonb(t)) from public.mizan_invoice_seq t where t.org_id = v_org), '[]'::jsonb),
    -- 🆕 ترقية ٣٦: الحضور والانصراف (بيانات الشركة — تدخل نسخة العميل)
    'employees',      coalesce((select jsonb_agg(to_jsonb(t)) from public.employees t where t.org_id = v_org), '[]'::jsonb),
    'attendance',     coalesce((select jsonb_agg(to_jsonb(t)) from public.attendance t where t.org_id = v_org), '[]'::jsonb),
    'att_settings',   coalesce((select jsonb_agg(to_jsonb(t)) from public.att_settings t where t.org_id = v_org), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $function$;

-- ---------------------------------------------------------------------------
-- 4) استعادة العميل — الحذف مشروط بوجود المفتاح في الملف (نفس نمط المرتجعات
--    في ترقية ٣٢): ملف نسخة قديم (قبل الحضور) ما يمسخش سجل حضور موجود.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mizan_client_restore(p_password text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_hash text;
  v_role text;
  v_super boolean;
  v_features jsonb;
  v_blocked boolean;
  r jsonb;
  t text;
  v_id uuid;
begin
  select org_id, coalesce(role,''), coalesce(is_superadmin,false), coalesce(features,'{}'::jsonb), coalesce(blocked,false)
    into v_org, v_role, v_super, v_features, v_blocked
  from public.profiles where id = v_uid;
  if v_org is null then raise exception 'غير مصرح'; end if;
  if v_blocked then raise exception 'حسابك محظور'; end if;
  if not (v_super or v_role = 'admin' or coalesce((v_features->>'clientSettings')::boolean, false)) then
    raise exception 'غير مصرح: ميزة «إعدادات مؤسستك» غير مفعّلة لحسابك';
  end if;
  select encrypted_password into v_hash from auth.users where id = v_uid;
  if v_hash is null or v_hash <> extensions.crypt(coalesce(p_password, ''), v_hash) then
    raise exception 'كلمة المرور غير صحيحة. لا يمكن الاستعادة.';
  end if;

  delete from public.sale_items where org_id = v_org;
  delete from public.sales where org_id = v_org;
  delete from public.purchase_items where org_id = v_org;
  delete from public.purchases where org_id = v_org;
  delete from public.supplier_txs where org_id = v_org;
  delete from public.customer_txs where org_id = v_org;
  delete from public.vouchers where org_id = v_org;
  delete from public.journal_lines where org_id = v_org;
  delete from public.journal_entries where org_id = v_org;
  delete from public.audit_logs where org_id = v_org;
  delete from public.treasury where org_id = v_org;
  delete from public.accounts where org_id = v_org;
  delete from public.owners where org_id = v_org;
  delete from public.warehouses where org_id = v_org;
  delete from public.units where org_id = v_org;
  delete from public.categories where org_id = v_org;
  delete from public.customers where org_id = v_org;
  delete from public.suppliers where org_id = v_org;
  delete from public.products where org_id = v_org;

  -- المرتجعات وعدّاد الأرقام: تُمسح فقط لو ملف النسخة يعرفها،
  -- عشان ملف قديم (قبل المرتجعات) ما يمسخش مرتجعات موجودة.
  if p_payload ? 'sale_returns' then
    delete from public.sale_return_items where org_id = v_org;
    delete from public.sale_returns      where org_id = v_org;
  end if;
  if p_payload ? 'purchase_returns' then
    delete from public.purchase_return_items where org_id = v_org;
    delete from public.purchase_returns      where org_id = v_org;
  end if;
  if p_payload ? 'mizan_invoice_seq' then
    delete from public.mizan_invoice_seq where org_id = v_org;
  end if;

  -- 🆕 ترقية ٣٦: الحضور والانصراف — نفس شرط ترقية ٣١/٣٢ (الملف القديم ما يمسخش الجديد).
  -- السجل يتحذف قبل الموظفين (تنظيمًا، حتى لو مفيش FK بينهم).
  if p_payload ? 'attendance' then
    delete from public.attendance where org_id = v_org;
  end if;
  if p_payload ? 'employees' then
    delete from public.employees where org_id = v_org;
  end if;
  if p_payload ? 'att_settings' then
    delete from public.att_settings where org_id = v_org;
  end if;

  if p_payload->'customers' is not null then
    for r in select * from jsonb_array_elements(p_payload->'customers')
    loop
      insert into public.customers (id, org_id, local_id, code, name_ar, name_en, phone, address, opening_balance, credit_limit, is_active, deleted, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'name_en', r->>'phone', r->>'address',
              coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'credit_limit')::numeric, 0),
              coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'suppliers' is not null then
    for r in select * from jsonb_array_elements(p_payload->'suppliers')
    loop
      insert into public.suppliers (id, org_id, local_id, code, name_ar, phone, address, opening_balance, current_balance, is_active, deleted, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'phone', r->>'address',
              coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'current_balance')::numeric, 0),
              coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'products' is not null then
    for r in select * from jsonb_array_elements(p_payload->'products')
    loop
      insert into public.products (id, org_id, local_id, code, name_ar, name_en, barcode, category, purchase_price, sale_price, stock_qty, min_stock, is_active, deleted, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'name_en', r->>'barcode', r->>'category',
              coalesce((r->>'purchase_price')::numeric, 0), coalesce((r->>'sale_price')::numeric, 0),
              coalesce((r->>'stock_qty')::numeric, 0), coalesce((r->>'min_stock')::numeric, 0),
              coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'treasury' is not null then
    for r in select * from jsonb_array_elements(p_payload->'treasury')
    loop
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'name', coalesce(r->>'type','cash'), r->>'account_no',
              coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0),
              coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'accounts' is not null then
    for r in select * from jsonb_array_elements(p_payload->'accounts')
    loop
      insert into public.accounts (id, org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, balance, is_active, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'type', coalesce((r->>'parent_id')::numeric, 0),
              coalesce((r->>'opening_debit')::numeric, 0), coalesce((r->>'opening_credit')::numeric, 0), coalesce((r->>'balance')::numeric, 0),
              coalesce((r->>'is_active')::boolean, true), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'categories' is not null then
    for r in select * from jsonb_array_elements(p_payload->'categories')
    loop
      insert into public.categories (id, org_id, name, description, deleted, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, r->>'name', r->>'description', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'units' is not null then
    for r in select * from jsonb_array_elements(p_payload->'units')
    loop
      insert into public.units (id, org_id, name, symbol, deleted, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, r->>'name', r->>'symbol', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'warehouses' is not null then
    for r in select * from jsonb_array_elements(p_payload->'warehouses')
    loop
      insert into public.warehouses (id, org_id, code, name, address, is_active, deleted, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, r->>'code', r->>'name', r->>'address', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'owners' is not null then
    for r in select * from jsonb_array_elements(p_payload->'owners')
    loop
      insert into public.owners (id, org_id, name, phone, capital, withdrawals, is_active, deleted, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, r->>'name', r->>'phone', coalesce((r->>'capital')::numeric, 0), coalesce((r->>'withdrawals')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'sales' is not null then
    for r in select * from jsonb_array_elements(p_payload->'sales')
    loop
      insert into public.sales (id, org_id, local_id, invoice_no, doc_date, customer, payment_method, treasury_id, store, notes, discount, tax, grand_total, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'customer', r->>'payment_method',
              (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'sale_items' is not null then
    for r in select * from jsonb_array_elements(p_payload->'sale_items')
    loop
      insert into public.sale_items (id, org_id, local_id, sale_id, product_id, product_name, qty, price, total)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, coalesce((r->>'sale_id')::uuid, gen_random_uuid()), (r->>'product_id')::text, r->>'product_name',
              coalesce((r->>'qty')::numeric, 0), coalesce((r->>'price')::numeric, 0), coalesce((r->>'total')::numeric, 0));
    end loop;
  end if;
  if p_payload->'purchases' is not null then
    for r in select * from jsonb_array_elements(p_payload->'purchases')
    loop
      insert into public.purchases (id, org_id, local_id, invoice_no, doc_date, supplier, payment_method, treasury_id, store, notes, discount, tax, grand_total, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'supplier', r->>'payment_method',
              (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'purchase_items' is not null then
    for r in select * from jsonb_array_elements(p_payload->'purchase_items')
    loop
      insert into public.purchase_items (id, org_id, local_id, purchase_id, product_id, product_name, qty, price, total)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, coalesce((r->>'purchase_id')::uuid, gen_random_uuid()), (r->>'product_id')::text, r->>'product_name',
              coalesce((r->>'qty')::numeric, 0), coalesce((r->>'price')::numeric, 0), coalesce((r->>'total')::numeric, 0));
    end loop;
  end if;
  if p_payload->'supplier_txs' is not null then
    for r in select * from jsonb_array_elements(p_payload->'supplier_txs')
    loop
      insert into public.supplier_txs (id, org_id, local_id, supplier_id, doc_date, type, amount, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, (r->>'supplier_id')::text, coalesce((r->>'doc_date')::date, now()::date), r->>'type', coalesce((r->>'amount')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'customer_txs' is not null then
    for r in select * from jsonb_array_elements(p_payload->'customer_txs')
    loop
      insert into public.customer_txs (id, org_id, local_id, customer_id, doc_date, description, debit, credit, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, (r->>'customer_id')::text, coalesce((r->>'doc_date')::date, now()::date), r->>'description', coalesce((r->>'debit')::numeric, 0), coalesce((r->>'credit')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'vouchers' is not null then
    for r in select * from jsonb_array_elements(p_payload->'vouchers')
    loop
      insert into public.vouchers (id, org_id, local_id, no, doc_date, kind, treasury_id, account_id, amount, notes, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'no', coalesce((r->>'doc_date')::date, now()::date), r->>'kind', (r->>'treasury_id')::text, (r->>'account_id')::text, coalesce((r->>'amount')::numeric, 0), r->>'notes', coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'journal_entries' is not null then
    for r in select * from jsonb_array_elements(p_payload->'journal_entries')
    loop
      insert into public.journal_entries (id, org_id, local_id, jrn_no, doc_date, ref_type, ref_id, description, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'jrn_no', coalesce((r->>'doc_date')::date, now()::date), r->>'ref_type', (r->>'ref_id')::text, r->>'description', coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_payload->'journal_lines' is not null then
    for r in select * from jsonb_array_elements(p_payload->'journal_lines')
    loop
      insert into public.journal_lines (id, org_id, local_id, entry_id, account_id, account_name, debit, credit)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, coalesce((r->>'entry_id')::uuid, gen_random_uuid()), (r->>'account_id')::text, r->>'account_name', coalesce((r->>'debit')::numeric, 0), coalesce((r->>'credit')::numeric, 0));
    end loop;
  end if;
  -- المرتجعات + عدّاد الأرقام: زرع تكيّفي بنفس الدالة الداخلية المستخدمة في نسخة المالك
  foreach t in array array['sale_returns','sale_return_items','purchase_returns','purchase_return_items','mizan_invoice_seq'] loop
    if p_payload ? t and jsonb_typeof(p_payload->t) = 'array' then
      for r in select * from jsonb_array_elements(p_payload->t)
      loop
        perform public.mizan_adaptive_insert('public', t, r);
      end loop;
    end if;
  end loop;
  -- 🆕 ترقية ٣٦: الحضور والانصراف — زرع تكيّفي بنفس النمط
  foreach t in array array['employees','attendance','att_settings'] loop
    if p_payload ? t and jsonb_typeof(p_payload->t) = 'array' then
      for r in select * from jsonb_array_elements(p_payload->t)
      loop
        perform public.mizan_adaptive_insert('public', t, r);
      end loop;
    end if;
  end loop;
end $function$;

-- ---------------------------------------------------------------------------
-- فحص ذاتي: التعريفات الحية دلوقتي فيها الجدلات التلاتة — وإلا فشل ظاهر
-- (الترجمة بتاعت pg_get_functiondef بتتشال الـ whitespace عشان المقارنة تبقى صلبة)
-- ---------------------------------------------------------------------------
do $$
declare
  fname text;
  def text;
begin
  foreach fname in array array[
    'mizan_admin_backup_full','mizan_admin_restore_full',
    'mizan_client_export','mizan_client_restore'
  ] loop
    select regexp_replace(coalesce(pg_get_functiondef(p.oid), ''), '\s', '', 'g') into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = fname;
    if def is null then
      raise exception 'ترحيل ٣٦ فشل: الدالة % مش موجودة', fname;
    end if;
    -- كل دالة لازم تذكر الجدلات التلاتة (backup/restore enumerations)
    if position('employees' in def) = 0 or position('attendance' in def) = 0
       or position('att_settings' in def) = 0 then
      raise exception 'ترحيل ٣٦ فشل: الدالة % لسه ما فيهاش جدلات الحضور', fname;
    end if;
  end loop;
end $$;
