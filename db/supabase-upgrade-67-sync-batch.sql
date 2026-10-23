-- ترقية 67: دفعة مزامنة موحّدة (RPC واحدة) لصفوف الفواتير/القيود/الأطراف والخزينة.
-- لا تُنفَّذ إلا بأمر المالك. آمنة لإعادة التشغيل (create or replace فقط).
-- الوظيفة security invoker: كل RLS وcurrent_org() تنطبق كما في الطلبات المباشرة.

create or replace function public.mizan_sync_batch(p_ops jsonb)
returns jsonb
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_org uuid := public.current_org();
  v_op jsonb;
  v_table text;
  v_rows jsonb;
  v_del jsonb;
  v_del_ids bigint[];
  v_row_ids bigint[];
  v_part jsonb;
  v_map jsonb := '{}'::jsonb;
  v_allowed text[] := array[
    'products','accounts','sales','sale_items','purchases','purchase_items',
    'sale_returns','sale_return_items','purchase_returns','purchase_return_items',
    'journal_entries','journal_lines','customer_txs','supplier_txs','vouchers','treasury'
  ];
begin
  if v_org is null then
    raise exception 'مزامنة الدفعة: لا توجد شركة للجلسة' using errcode = '42501';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    raise exception 'مزامنة الدفعة: p_ops يجب أن يكون مصفوفة' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ops) > 40 then
    raise exception 'مزامنة الدفعة: عدد الجداول أكبر من الحد' using errcode = '22023';
  end if;
  if pg_column_size(p_ops) > 2097152 then
    raise exception 'مزامنة الدفعة: الحجم أكبر من 2MB' using errcode = '22023';
  end if;

  for v_op in select value from jsonb_array_elements(p_ops)
  loop
    v_table := v_op->>'table';
    if v_table is null or not (v_table = any(v_allowed)) then
      raise exception 'مزامنة الدفعة: جدول غير مسموح %', coalesce(v_table, '(null)') using errcode = '22023';
    end if;

    v_rows := coalesce(v_op->'rows', '[]'::jsonb);
    v_del := coalesce(v_op->'deletes', '[]'::jsonb);
    if jsonb_typeof(v_rows) <> 'array' or jsonb_typeof(v_del) <> 'array' then
      raise exception 'مزامنة الدفعة: rows/deletes يجب أن تكون مصفوفة' using errcode = '22023';
    end if;
    if jsonb_array_length(v_rows) > 2000 then
      raise exception 'مزامنة الدفعة: صفوف كثيرة في %', v_table using errcode = '22023';
    end if;

    select coalesce(array_agg(value::bigint), '{}'::bigint[])
      into v_del_ids
      from jsonb_array_elements_text(v_del) as t(value)
      where value ~ '^[0-9]+$';
    if array_length(v_del_ids, 1) > 0 then
      execute format('delete from public.%I where org_id = $1 and local_id = any($2)', v_table)
        using v_org, v_del_ids;
    end if;

    select coalesce(array_agg((value->>'local_id')::bigint), '{}'::bigint[])
      into v_row_ids
      from jsonb_array_elements(v_rows) as t(value)
      where (value->>'local_id') ~ '^[0-9]+$';

    if jsonb_array_length(v_rows) > 0 then
      if v_table = 'products' then
        insert into public.products (
          id, org_id, code, name_ar, name_en, barcode, category, purchase_price,
          sale_price, stock_qty, min_stock, is_active, deleted, local_id, stock,
          unit, last_purchase_price, avg_purchase_price
        )
        select coalesce(e.id, x.id), v_org, x.code, x.name_ar, x.name_en, x.barcode,
          x.category, coalesce(x.purchase_price, 0), coalesce(x.sale_price, 0),
          coalesce(x.stock_qty, 0), coalesce(x.min_stock, 0), coalesce(x.is_active, true),
          coalesce(x.deleted, false), x.local_id, coalesce(x.stock, '{}'::jsonb),
          x.unit, x.last_purchase_price, x.avg_purchase_price
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, code text, name_ar text, name_en text, barcode text,
          category text, purchase_price numeric, sale_price numeric, stock_qty numeric,
          min_stock numeric, is_active boolean, deleted boolean, stock jsonb, unit text,
          last_purchase_price numeric, avg_purchase_price numeric
        )
        left join public.products e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          code = excluded.code, name_ar = excluded.name_ar, name_en = excluded.name_en,
          barcode = excluded.barcode, category = excluded.category,
          purchase_price = excluded.purchase_price, sale_price = excluded.sale_price,
          stock_qty = excluded.stock_qty, min_stock = excluded.min_stock,
          is_active = excluded.is_active, deleted = excluded.deleted, stock = excluded.stock,
          unit = coalesce(excluded.unit, public.products.unit),
          last_purchase_price = coalesce(excluded.last_purchase_price, public.products.last_purchase_price),
          avg_purchase_price = coalesce(excluded.avg_purchase_price, public.products.avg_purchase_price)
        where public.products.org_id = v_org;

      elsif v_table = 'accounts' then
        insert into public.accounts (
          id, org_id, code, name_ar, type, parent_id, opening_debit, opening_credit,
          balance, is_active, local_id
        )
        select coalesce(e.id, x.id), v_org, x.code, x.name_ar, x.type,
          coalesce(x.parent_id, 0), coalesce(x.opening_debit, 0), coalesce(x.opening_credit, 0),
          coalesce(x.balance, 0), coalesce(x.is_active, true), x.local_id
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, code text, name_ar text, type text, parent_id numeric,
          opening_debit numeric, opening_credit numeric, balance numeric, is_active boolean
        )
        left join public.accounts e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          code = excluded.code, name_ar = excluded.name_ar, type = excluded.type,
          parent_id = excluded.parent_id, opening_debit = excluded.opening_debit,
          opening_credit = excluded.opening_credit, balance = excluded.balance,
          is_active = excluded.is_active
        where public.accounts.org_id = v_org;

      elsif v_table = 'sales' then
        insert into public.sales (
          id, org_id, local_id, invoice_no, doc_date, customer, customer_id,
          payment_method, treasury_id, store, notes, discount, tax, grand_total,
          paid_amount, due_amount, payments
        )
        select coalesce(e.id, x.id), v_org, x.local_id, x.invoice_no, x.doc_date,
          x.customer, x.customer_id, x.payment_method, x.treasury_id, x.store, x.notes,
          coalesce(x.discount, 0), coalesce(x.tax, 0), coalesce(x.grand_total, 0),
          coalesce(x.paid_amount, 0), coalesce(x.due_amount, 0), coalesce(x.payments, '[]'::jsonb)
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, invoice_no text, doc_date date, customer text,
          customer_id text, payment_method text, treasury_id text, store text, notes text,
          discount numeric, tax numeric, grand_total numeric, paid_amount numeric,
          due_amount numeric, payments jsonb
        )
        left join public.sales e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          invoice_no = excluded.invoice_no, doc_date = excluded.doc_date,
          customer = excluded.customer, customer_id = excluded.customer_id,
          payment_method = excluded.payment_method, treasury_id = excluded.treasury_id,
          store = excluded.store, notes = excluded.notes, discount = excluded.discount,
          tax = excluded.tax, grand_total = excluded.grand_total,
          paid_amount = excluded.paid_amount, due_amount = excluded.due_amount,
          payments = excluded.payments
        where public.sales.org_id = v_org;

      elsif v_table = 'sale_items' then
        insert into public.sale_items (
          id, org_id, sale_id, product_id, product_name, qty, price, total, local_id,
          unit, code, discount, tax
        )
        select coalesce(e.id, x.id), v_org, coalesce(p.id, x.sale_id), x.product_id,
          x.product_name, coalesce(x.qty, 0), coalesce(x.price, 0), coalesce(x.total, 0),
          x.local_id, x.unit, x.code, coalesce(x.discount, 0), coalesce(x.tax, 0)
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, sale_id uuid, _parent_local_id bigint, product_id text,
          product_name text, qty numeric, price numeric, total numeric, unit text,
          code text, discount numeric, tax numeric
        )
        left join public.sale_items e on e.org_id = v_org and e.local_id = x.local_id
        left join public.sales p on p.org_id = v_org and p.local_id = x._parent_local_id
        on conflict (id) do update set
          sale_id = excluded.sale_id, product_id = excluded.product_id,
          product_name = excluded.product_name, qty = excluded.qty, price = excluded.price,
          total = excluded.total, unit = excluded.unit, code = excluded.code,
          discount = excluded.discount, tax = excluded.tax
        where public.sale_items.org_id = v_org;

      elsif v_table = 'purchases' then
        insert into public.purchases (
          id, org_id, local_id, invoice_no, doc_date, supplier, supplier_id,
          payment_method, treasury_id, store, notes, discount, tax, grand_total,
          paid_amount, due_amount, payments
        )
        select coalesce(e.id, x.id), v_org, x.local_id, x.invoice_no, x.doc_date,
          x.supplier, x.supplier_id, x.payment_method, x.treasury_id, x.store, x.notes,
          coalesce(x.discount, 0), coalesce(x.tax, 0), coalesce(x.grand_total, 0),
          coalesce(x.paid_amount, 0), coalesce(x.due_amount, 0), coalesce(x.payments, '[]'::jsonb)
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, invoice_no text, doc_date date, supplier text,
          supplier_id text, payment_method text, treasury_id text, store text, notes text,
          discount numeric, tax numeric, grand_total numeric, paid_amount numeric,
          due_amount numeric, payments jsonb
        )
        left join public.purchases e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          invoice_no = excluded.invoice_no, doc_date = excluded.doc_date,
          supplier = excluded.supplier, supplier_id = excluded.supplier_id,
          payment_method = excluded.payment_method, treasury_id = excluded.treasury_id,
          store = excluded.store, notes = excluded.notes, discount = excluded.discount,
          tax = excluded.tax, grand_total = excluded.grand_total,
          paid_amount = excluded.paid_amount, due_amount = excluded.due_amount,
          payments = excluded.payments
        where public.purchases.org_id = v_org;

      elsif v_table = 'purchase_items' then
        insert into public.purchase_items (
          id, org_id, purchase_id, product_id, product_name, qty, price, total, local_id,
          unit, code, discount, tax
        )
        select coalesce(e.id, x.id), v_org, coalesce(p.id, x.purchase_id), x.product_id,
          x.product_name, coalesce(x.qty, 0), coalesce(x.price, 0), coalesce(x.total, 0),
          x.local_id, x.unit, x.code, coalesce(x.discount, 0), coalesce(x.tax, 0)
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, purchase_id uuid, _parent_local_id bigint, product_id text,
          product_name text, qty numeric, price numeric, total numeric, unit text,
          code text, discount numeric, tax numeric
        )
        left join public.purchase_items e on e.org_id = v_org and e.local_id = x.local_id
        left join public.purchases p on p.org_id = v_org and p.local_id = x._parent_local_id
        on conflict (id) do update set
          purchase_id = excluded.purchase_id, product_id = excluded.product_id,
          product_name = excluded.product_name, qty = excluded.qty, price = excluded.price,
          total = excluded.total, unit = excluded.unit, code = excluded.code,
          discount = excluded.discount, tax = excluded.tax
        where public.purchase_items.org_id = v_org;

      elsif v_table = 'sale_returns' then
        insert into public.sale_returns (
          id, org_id, local_id, return_no, doc_date, sale_local_id, customer,
          customer_id, settlement, payment_method, treasury_id, store, notes, grand_total
        )
        select coalesce(e.id, x.id), v_org, x.local_id, x.return_no, x.doc_date,
          x.sale_local_id, x.customer, x.customer_id, x.settlement, x.payment_method,
          x.treasury_id, x.store, x.notes, coalesce(x.grand_total, 0)
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, return_no text, doc_date date, sale_local_id bigint,
          customer text, customer_id text, settlement text, payment_method text,
          treasury_id text, store text, notes text, grand_total numeric
        )
        left join public.sale_returns e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          return_no = excluded.return_no, doc_date = excluded.doc_date,
          sale_local_id = excluded.sale_local_id, customer = excluded.customer,
          customer_id = excluded.customer_id, settlement = excluded.settlement,
          payment_method = excluded.payment_method, treasury_id = excluded.treasury_id,
          store = excluded.store, notes = excluded.notes, grand_total = excluded.grand_total
        where public.sale_returns.org_id = v_org;

      elsif v_table = 'sale_return_items' then
        insert into public.sale_return_items (
          id, org_id, local_id, return_id, product_id, product_name, qty, price,
          total, unit, code, discount, tax
        )
        select coalesce(e.id, x.id), v_org, x.local_id, coalesce(p.id, x.return_id),
          x.product_id, x.product_name, coalesce(x.qty, 0), coalesce(x.price, 0),
          coalesce(x.total, 0), x.unit, x.code, coalesce(x.discount, 0), coalesce(x.tax, 0)
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, return_id uuid, _parent_local_id bigint, product_id text,
          product_name text, qty numeric, price numeric, total numeric, unit text,
          code text, discount numeric, tax numeric
        )
        left join public.sale_return_items e on e.org_id = v_org and e.local_id = x.local_id
        left join public.sale_returns p on p.org_id = v_org and p.local_id = x._parent_local_id
        on conflict (id) do update set
          return_id = excluded.return_id, product_id = excluded.product_id,
          product_name = excluded.product_name, qty = excluded.qty, price = excluded.price,
          total = excluded.total, unit = excluded.unit, code = excluded.code,
          discount = excluded.discount, tax = excluded.tax
        where public.sale_return_items.org_id = v_org;

      elsif v_table = 'purchase_returns' then
        insert into public.purchase_returns (
          id, org_id, local_id, return_no, doc_date, purchase_local_id, supplier,
          supplier_id, settlement, payment_method, treasury_id, store, notes, grand_total
        )
        select coalesce(e.id, x.id), v_org, x.local_id, x.return_no, x.doc_date,
          x.purchase_local_id, x.supplier, x.supplier_id, x.settlement, x.payment_method,
          x.treasury_id, x.store, x.notes, coalesce(x.grand_total, 0)
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, return_no text, doc_date date, purchase_local_id bigint,
          supplier text, supplier_id text, settlement text, payment_method text,
          treasury_id text, store text, notes text, grand_total numeric
        )
        left join public.purchase_returns e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          return_no = excluded.return_no, doc_date = excluded.doc_date,
          purchase_local_id = excluded.purchase_local_id, supplier = excluded.supplier,
          supplier_id = excluded.supplier_id, settlement = excluded.settlement,
          payment_method = excluded.payment_method, treasury_id = excluded.treasury_id,
          store = excluded.store, notes = excluded.notes, grand_total = excluded.grand_total
        where public.purchase_returns.org_id = v_org;

      elsif v_table = 'purchase_return_items' then
        insert into public.purchase_return_items (
          id, org_id, local_id, return_id, product_id, product_name, qty, price,
          total, unit, code, discount, tax
        )
        select coalesce(e.id, x.id), v_org, x.local_id, coalesce(p.id, x.return_id),
          x.product_id, x.product_name, coalesce(x.qty, 0), coalesce(x.price, 0),
          coalesce(x.total, 0), x.unit, x.code, coalesce(x.discount, 0), coalesce(x.tax, 0)
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, return_id uuid, _parent_local_id bigint, product_id text,
          product_name text, qty numeric, price numeric, total numeric, unit text,
          code text, discount numeric, tax numeric
        )
        left join public.purchase_return_items e on e.org_id = v_org and e.local_id = x.local_id
        left join public.purchase_returns p on p.org_id = v_org and p.local_id = x._parent_local_id
        on conflict (id) do update set
          return_id = excluded.return_id, product_id = excluded.product_id,
          product_name = excluded.product_name, qty = excluded.qty, price = excluded.price,
          total = excluded.total, unit = excluded.unit, code = excluded.code,
          discount = excluded.discount, tax = excluded.tax
        where public.purchase_return_items.org_id = v_org;

      elsif v_table = 'journal_entries' then
        insert into public.journal_entries (
          id, org_id, local_id, jrn_no, doc_date, ref_type, ref_id, description
        )
        select coalesce(e.id, x.id), v_org, x.local_id, coalesce(x.jrn_no, x.local_id::text),
          x.doc_date, x.ref_type, x.ref_id, x.description
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, jrn_no text, doc_date date, ref_type text,
          ref_id text, description text
        )
        left join public.journal_entries e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          jrn_no = excluded.jrn_no, doc_date = excluded.doc_date,
          ref_type = excluded.ref_type, ref_id = excluded.ref_id,
          description = excluded.description
        where public.journal_entries.org_id = v_org;

      elsif v_table = 'journal_lines' then
        insert into public.journal_lines (
          id, org_id, entry_id, account_id, account_name, debit, credit, local_id
        )
        select coalesce(e.id, x.id), v_org, coalesce(p.id, x.entry_id), x.account_id,
          x.account_name, coalesce(x.debit, 0), coalesce(x.credit, 0), x.local_id
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, entry_id uuid, _parent_local_id bigint, account_id text,
          account_name text, debit numeric, credit numeric
        )
        left join public.journal_lines e on e.org_id = v_org and e.local_id = x.local_id
        left join public.journal_entries p on p.org_id = v_org and p.local_id = x._parent_local_id
        on conflict (id) do update set
          entry_id = excluded.entry_id, account_id = excluded.account_id,
          account_name = excluded.account_name, debit = excluded.debit,
          credit = excluded.credit
        where public.journal_lines.org_id = v_org;

      elsif v_table = 'customer_txs' then
        insert into public.customer_txs (
          id, org_id, customer_id, doc_date, description, debit, credit, local_id,
          treasury_id, treasury_name, payment_method
        )
        select coalesce(e.id, x.id), v_org, x.customer_id, x.doc_date, x.description,
          coalesce(x.debit, 0), coalesce(x.credit, 0), x.local_id, x.treasury_id,
          x.treasury_name, x.payment_method
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, customer_id text, doc_date date, description text,
          debit numeric, credit numeric, treasury_id text, treasury_name text,
          payment_method text
        )
        left join public.customer_txs e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          customer_id = excluded.customer_id, doc_date = excluded.doc_date,
          description = excluded.description, debit = excluded.debit,
          credit = excluded.credit,
          treasury_id = coalesce(excluded.treasury_id, public.customer_txs.treasury_id),
          treasury_name = coalesce(excluded.treasury_name, public.customer_txs.treasury_name),
          payment_method = coalesce(excluded.payment_method, public.customer_txs.payment_method)
        where public.customer_txs.org_id = v_org;

      elsif v_table = 'supplier_txs' then
        insert into public.supplier_txs (
          id, org_id, supplier_id, doc_date, type, amount, description, debit, credit,
          local_id, treasury_id, treasury_name, payment_method
        )
        select coalesce(e.id, x.id), v_org, x.supplier_id, x.doc_date, x.type,
          coalesce(x.amount, 0), x.description, coalesce(x.debit, 0), coalesce(x.credit, 0),
          x.local_id, x.treasury_id, x.treasury_name, x.payment_method
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, supplier_id text, doc_date date, type text,
          amount numeric, description text, debit numeric, credit numeric,
          treasury_id text, treasury_name text, payment_method text
        )
        left join public.supplier_txs e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          supplier_id = excluded.supplier_id, doc_date = excluded.doc_date,
          type = excluded.type, amount = excluded.amount,
          description = excluded.description, debit = excluded.debit, credit = excluded.credit,
          treasury_id = coalesce(excluded.treasury_id, public.supplier_txs.treasury_id),
          treasury_name = coalesce(excluded.treasury_name, public.supplier_txs.treasury_name),
          payment_method = coalesce(excluded.payment_method, public.supplier_txs.payment_method)
        where public.supplier_txs.org_id = v_org;

      elsif v_table = 'vouchers' then
        insert into public.vouchers (
          id, org_id, no, doc_date, kind, treasury_id, account_id, amount, notes,
          local_id, ref_type, ref_id
        )
        select coalesce(e.id, x.id), v_org, x.no, x.doc_date, x.kind, x.treasury_id,
          x.account_id, coalesce(x.amount, 0), x.notes, x.local_id, x.ref_type, x.ref_id
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, no text, doc_date date, kind text, treasury_id text,
          account_id text, amount numeric, notes text, ref_type text, ref_id text
        )
        left join public.vouchers e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          no = excluded.no, doc_date = excluded.doc_date, kind = excluded.kind,
          treasury_id = excluded.treasury_id, account_id = excluded.account_id,
          amount = excluded.amount, notes = excluded.notes,
          ref_type = coalesce(excluded.ref_type, public.vouchers.ref_type),
          ref_id = coalesce(excluded.ref_id, public.vouchers.ref_id)
        where public.vouchers.org_id = v_org;

      elsif v_table = 'treasury' then
        insert into public.treasury (
          id, org_id, name, type, account_no, opening_balance, balance, is_active,
          deleted, local_id
        )
        select coalesce(e.id, x.id), v_org, x.name, x.type, x.account_no,
          coalesce(x.opening_balance, 0), coalesce(x.balance, 0), coalesce(x.is_active, true),
          coalesce(x.deleted, false), x.local_id
        from jsonb_to_recordset(v_rows) as x(
          id uuid, local_id bigint, name text, type text, account_no text,
          opening_balance numeric, balance numeric, is_active boolean, deleted boolean
        )
        left join public.treasury e on e.org_id = v_org and e.local_id = x.local_id
        on conflict (id) do update set
          name = excluded.name, type = excluded.type, account_no = excluded.account_no,
          balance = excluded.balance, is_active = excluded.is_active
        where public.treasury.org_id = v_org;
      end if;
    end if;

    if array_length(v_row_ids, 1) > 0 then
      execute format(
        'select coalesce(jsonb_agg(jsonb_build_object(''local_id'', local_id, ''id'', id)), ''[]''::jsonb) from public.%I where org_id = $1 and local_id = any($2)',
        v_table
      ) into v_part using v_org, v_row_ids;
    else
      v_part := '[]'::jsonb;
    end if;
    v_map := v_map || jsonb_build_object(v_table, v_part);
  end loop;

  return v_map;
end;
$fn$;

revoke all on function public.mizan_sync_batch(jsonb) from public, anon;
grant execute on function public.mizan_sync_batch(jsonb) to authenticated, service_role;

do $chk$
declare
  v_oid oid;
  v_sec boolean;
begin
  select p.oid, p.prosecdef into v_oid, v_sec
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mizan_sync_batch'
     and pg_get_function_identity_arguments(p.oid) = 'p_ops jsonb';
  if v_oid is null then
    raise exception 'ترقية 67: الدالة لم تُنشأ';
  end if;
  if v_sec then
    raise exception 'ترقية 67: الدالة يجب أن تكون security invoker';
  end if;
  if not has_function_privilege('authenticated', v_oid, 'execute') then
    raise exception 'ترقية 67: authenticated بلا صلاحية تنفيذ';
  end if;
  if has_function_privilege('anon', v_oid, 'execute') then
    raise exception 'ترقية 67: anon يملك تنفيذ الدالة';
  end if;
end;
$chk$;

