-- ═══════════════════════════════════════════════════════════════════════════════
-- ترقية ٧٠ — «دفعات الفاتورة تفضل معاها + عدّاد أرقام السندات ما يتمسحش»
-- ✅ **اتنفذت على السحابة ٢٥/١٠ ≈00:45** بأمر المالك الحرفي («و نفذ على السحابه» ← «كل ما سبق»)
--    عبر guardedRun (معاملة واحدة + فحوص ⇒ COMMIT): المخطط ثابت 442 عمود/92 قيد/72 دالة/116 سياسة/108 فهرس
--    · ٤٨١٦ سطرًا ثابتة · ٦٩ دالة تانية بايت-بايت · صفر منح anon جديدة · دليل ميزان بنفس البصمة.
--    الأثر المقاس: ٤ فواتير اتصلحت (220261020001 آجل ⇒ آجل 100 · 220261024001 ⇒ مدفوع 600 ·
--    220261024003 ⇒ 314 · 220261024004 ⇒ 320) وصفر فاتورة بإجمالي ومدفوع/آجل صفر.
--    التحقق بعدها: verify_mig70.js = ١٨ ✓ / ٠ ✗ (فيها سلوكي داخل معاملة اترجعت: others فضل بعد حفظ إعدادات).
--    الباك أب: pre-mig70-20261025-004459 · post-mig70-20261025-004519. ⛔ ممنوع إعادة تشغيله (البوابات ترفض).
--
-- ليه:
--  (أ) mizan_client_sett_save كانت بتعيد بناء settings.idFloors بأربعة مفاتيح بس
--      (vouchers/journal/txs/supplierTxs) ⇒ others (١٤ عدّاد: فواتير/شيكات/ورديات/…)
--      كان بيتمسح من السحابة عند أي حفظ إعدادات، والعدادات ترجع من الصفر على أي جهاز.
--      الحل: دمج كل مفاتيح الطرفين مع max للأرقام (ما تنقص أبدًا)، وأي مفتاح غير رقمي
--      بيتاخد من الحمولة لو موجود وإلا من المحفوظ (صفر فقدان).
--  (ب) mizan_client_restore و mizan_admin_restore_one كانوا بيدخلوا فواتير البيع/الشراء
--      بأعمدة قديمة من غير paid_amount/due_amount/payments ⇒ أي استعادة بترجّع الفواتير
--      «مدفوعها وآجلها صفر» (اتقاس: ٤ فواتير كده). الحل: الأعمدة الثلاثة اتضافت، ولو
--      النسخة القديمة مش فيها القيمة ⇒ نفس قاعدة ترقية ٦٥ (آجل ⇒ الآجل = الإجمالي، وإلا المدفوع).
--
-- الضمانات:
--   · صفر عمود/جدول جديد (٣ دوال فقط + تصحيح صفوف الفواتير اللي اتأثرت بالاستعادة).
--   · باقي الدوال حرفيًا زي ما هي (يتأكد منه guardedRun).
--   · صفر منح جديدة لـ anon — الدوال محتفظة بمنح authenticated.
--   · الفحص الذاتي في الآخر بيرفض لو أي شرط مش متحقق (ROLLBACK كامل).
-- ═══════════════════════════════════════════════════════════════════════════════

-- بوابة: ترقية ٦٥ لازم تكون منفّذة (الأعمدة الثلاثة موجودة)
do $$
declare n_sales int; n_pur int;
begin
  select count(*) into n_sales from information_schema.columns
   where table_schema='public' and table_name='sales'
     and column_name in ('paid_amount','due_amount','payments');
  select count(*) into n_pur from information_schema.columns
   where table_schema='public' and table_name='purchases'
     and column_name in ('paid_amount','due_amount','payments');
  if n_sales <> 3 or n_pur <> 3 then
    raise exception 'ترقية ٧٠ محتاجة ترقية ٦٥ قبلها (sales=%, purchases=%)', n_sales, n_pur;
  end if;
end $$;

-- (١) حفظ إعدادات العميل: دمج idFloors (others وغيره) بأقصى قيمة — صفر مسح
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
    -- ترحيل ٦٤: إعدادات المنظمة (jsonb) — دمج عام + max لأرضيات الأرقام (لا تنقص أبدًا)
    if (p_org ? 'settings') and jsonb_typeof(p_org->'settings') = 'object' then
      update public.organizations o
         set settings = coalesce(settings, '{}'::jsonb) || (p_org->'settings')
           || case
                when (p_org->'settings') ? 'idFloors'
                 and jsonb_typeof(p_org->'settings'->'idFloors') = 'object'
                then jsonb_build_object('idFloors', (
                  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                    from (
                      select k,
                             case
                               when (o.settings->'idFloors'->>k) ~ '^[0-9]{1,19}$'
                                 or (p_org->'settings'->'idFloors'->>k) ~ '^[0-9]{1,19}$'
                               then to_jsonb(greatest(
                                      case when (o.settings->'idFloors'->>k) ~ '^[0-9]{1,19}$' then (o.settings->'idFloors'->>k)::bigint else 0 end,
                                      case when (p_org->'settings'->'idFloors'->>k) ~ '^[0-9]{1,19}$' then (p_org->'settings'->'idFloors'->>k)::bigint else 0 end))
                               when (p_org->'settings'->'idFloors') ? k then p_org->'settings'->'idFloors'->k
                               else o.settings->'idFloors'->k
                             end as v
                        from jsonb_object_keys(
                               (case when jsonb_typeof(o.settings->'idFloors') = 'object' then o.settings->'idFloors' else '{}'::jsonb end)
                               || (p_org->'settings'->'idFloors')
                             ) as k
                    ) s
                ))
                else '{}'::jsonb
              end
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
-- (٢) استعادة نسخة العميل: الفواتير بمدفوعها وآجلها وسطور سدادها
CREATE OR REPLACE FUNCTION public.mizan_client_restore(p_password text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
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

  -- الأصول الثابتة — نفس شرط ٣٢/٣٦ (الملف القديم ما يمسخش الجديد).
  if p_payload ? 'fixed_assets' then
    delete from public.fixed_assets where org_id = v_org;
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
      insert into public.sales (id, org_id, local_id, invoice_no, doc_date, customer, payment_method, treasury_id, store, notes, discount, tax, grand_total, paid_amount, due_amount, payments, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'customer', r->>'payment_method',
              (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0),
            coalesce(nullif(r->>'paid_amount','')::numeric, case when btrim(coalesce(r->>'payment_method','')) = 'آجل' then 0 else coalesce((r->>'grand_total')::numeric, 0) end),
            coalesce(nullif(r->>'due_amount','')::numeric,  case when btrim(coalesce(r->>'payment_method','')) = 'آجل' then coalesce((r->>'grand_total')::numeric, 0) else 0 end),
            coalesce(case when jsonb_typeof(r->'payments') = 'array' then r->'payments' else '[]'::jsonb end, '[]'::jsonb),
            coalesce((r->>'created_at')::timestamptz, now()));
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
      insert into public.purchases (id, org_id, local_id, invoice_no, doc_date, supplier, payment_method, treasury_id, store, notes, discount, tax, grand_total, paid_amount, due_amount, payments, created_at)
      values (coalesce((r->>'id')::uuid, gen_random_uuid()), v_org, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'supplier', r->>'payment_method',
              (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0),
            coalesce(nullif(r->>'paid_amount','')::numeric, case when btrim(coalesce(r->>'payment_method','')) = 'آجل' then 0 else coalesce((r->>'grand_total')::numeric, 0) end),
            coalesce(nullif(r->>'due_amount','')::numeric,  case when btrim(coalesce(r->>'payment_method','')) = 'آجل' then coalesce((r->>'grand_total')::numeric, 0) else 0 end),
            coalesce(case when jsonb_typeof(r->'payments') = 'array' then r->'payments' else '[]'::jsonb end, '[]'::jsonb),
            coalesce((r->>'created_at')::timestamptz, now()));
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
  -- الأصول الثابتة: زرع تكيّفي بنفس النمط (الحضور: أُزيل في ٥٣)
  foreach t in array array['fixed_assets'] loop
    if p_payload ? t and jsonb_typeof(p_payload->t) = 'array' then
      for r in select * from jsonb_array_elements(p_payload->t)
      loop
        perform public.mizan_adaptive_insert('public', t, r);
      end loop;
    end if;
  end loop;
end $function$;
-- (٣) استعادة الأدمن لشركة: نفس التصحيح
CREATE OR REPLACE FUNCTION public.mizan_admin_restore_one(p_org_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
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
    insert into public.sales (id, org_id, local_id, invoice_no, doc_date, customer, payment_method, treasury_id, store, notes, discount, tax, grand_total, paid_amount, due_amount, payments, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'customer', r->>'payment_method',
            (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0),
            coalesce(nullif(r->>'paid_amount','')::numeric, case when btrim(coalesce(r->>'payment_method','')) = 'آجل' then 0 else coalesce((r->>'grand_total')::numeric, 0) end),
            coalesce(nullif(r->>'due_amount','')::numeric,  case when btrim(coalesce(r->>'payment_method','')) = 'آجل' then coalesce((r->>'grand_total')::numeric, 0) else 0 end),
            coalesce(case when jsonb_typeof(r->'payments') = 'array' then r->'payments' else '[]'::jsonb end, '[]'::jsonb),
            coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'sale_items', p_org_id::text))
  loop
    insert into public.sale_items (id, org_id, local_id, sale_id, product_id, product_name, qty, price, total)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, coalesce((r->>'sale_id')::uuid, gen_random_uuid()), (r->>'product_id')::text, r->>'product_name',
            coalesce((r->>'qty')::numeric, 0), coalesce((r->>'price')::numeric, 0), coalesce((r->>'total')::numeric, 0));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'purchases', p_org_id::text))
  loop
    insert into public.purchases (id, org_id, local_id, invoice_no, doc_date, supplier, payment_method, treasury_id, store, notes, discount, tax, grand_total, paid_amount, due_amount, payments, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'supplier', r->>'payment_method',
            (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0),
            coalesce(nullif(r->>'paid_amount','')::numeric, case when btrim(coalesce(r->>'payment_method','')) = 'آجل' then 0 else coalesce((r->>'grand_total')::numeric, 0) end),
            coalesce(nullif(r->>'due_amount','')::numeric,  case when btrim(coalesce(r->>'payment_method','')) = 'آجل' then coalesce((r->>'grand_total')::numeric, 0) else 0 end),
            coalesce(case when jsonb_typeof(r->'payments') = 'array' then r->'payments' else '[]'::jsonb end, '[]'::jsonb),
            coalesce((r->>'created_at')::timestamptz, now()));
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
-- (٤) تصحيح الفواتير اللي راحت منها القيم بسبب الاستعادة القديمة (المدفوع/الآجل/السطور كلهم صفر)
update public.sales
   set due_amount  = case when btrim(coalesce(payment_method,'')) = 'آجل' then coalesce(grand_total,0) else 0 end,
       paid_amount = case when btrim(coalesce(payment_method,'')) = 'آجل' then 0 else coalesce(grand_total,0) end
 where coalesce(grand_total,0) > 0
   and coalesce(paid_amount,0) = 0 and coalesce(due_amount,0) = 0
   and coalesce(jsonb_array_length(payments), 0) = 0;

update public.purchases
   set due_amount  = case when btrim(coalesce(payment_method,'')) = 'آجل' then coalesce(grand_total,0) else 0 end,
       paid_amount = case when btrim(coalesce(payment_method,'')) = 'آجل' then 0 else coalesce(grand_total,0) end
 where coalesce(grand_total,0) > 0
   and coalesce(paid_amount,0) = 0 and coalesce(due_amount,0) = 0
   and coalesce(jsonb_array_length(payments), 0) = 0;

-- بعد: الفحص الذاتي — أي شرط مش متحقق ⇒ ROLLBACK كامل
-- ═══ فحص ذاتي: يفشل ⇒ ROLLBACK كامل ═══
do $$
declare
  d text; n int; bad int;
begin
  /* (١) حفظ الإعدادات بيدمج المفاتيح كلها */
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n2 on n2.oid=p.pronamespace
   where n2.nspname='public' and p.proname='mizan_client_sett_save' and p.prokind='f';
  if d is null then raise exception 'ميزان ٧٠: mizan_client_sett_save مش موجودة'; end if;
  if position('jsonb_object_keys' in d) = 0 then raise exception 'ميزان ٧٠: دمج idFloors مش متطبّق'; end if;
  if position('''supplierTxs'', greatest' in d) > 0 then raise exception 'ميزان ٧٠: النسخة القديمة (٤ مفاتيح) لسه'; end if;

  /* (٢) الاستعادتان بيدخلوا الأعمدة الثلاثة */
  for n in 1..2 loop
    if n = 1 then
      select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n2 on n2.oid=p.pronamespace
       where n2.nspname='public' and p.proname='mizan_client_restore' and p.prokind='f';
    else
      select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n2 on n2.oid=p.pronamespace
       where n2.nspname='public' and p.proname='mizan_admin_restore_one' and p.prokind='f';
    end if;
    if d is null then raise exception 'ميزان ٧٠: دالة الاستعادة رقم % مش موجودة', n; end if;
    if position('paid_amount, due_amount, payments' in d) = 0 then
      raise exception 'ميزان ٧٠: دالة الاستعادة رقم % ما بتدخلش المدفوع/الآجل', n;
    end if;
  end loop;

  /* (٣) صفر فاتورة بإجمالي ومدفوع/آجل صفر */
  select count(*) into bad from public.sales
   where coalesce(grand_total,0) > 0 and coalesce(paid_amount,0) = 0 and coalesce(due_amount,0) = 0
     and coalesce(jsonb_array_length(payments),0) = 0;
  if bad <> 0 then raise exception 'ميزان ٧٠: لسه % فاتورة بيع بلا مدفوع/آجل', bad; end if;
  select count(*) into bad from public.purchases
   where coalesce(grand_total,0) > 0 and coalesce(paid_amount,0) = 0 and coalesce(due_amount,0) = 0
     and coalesce(jsonb_array_length(payments),0) = 0;
  if bad <> 0 then raise exception 'ميزان ٧٠: لسه % فاتورة شراء بلا مدفوع/آجل', bad; end if;

  raise notice 'ترقية ٧٠ تمام: idFloors الكامل (مع others) + الاستعادة بالدفعات + صفر فاتورة ناقصة';
end $$;
