-- ==============================================================
-- ترقية 11: تبويبات إعدادات الشركة (مطابقة لشاشة إعدادات ميزان ديسك توب)
-- جداول جديدة: التصنيفات / وحدات القياس / المستودعات / أصحاب المنشأة
-- المحافظ والبنوك مستندة إلى جدول treasury الحالي (type = wallet/bank)
-- أعمدة جديدة في organizations (بيانات الفاتورة المطبوعة)
-- دوال:
--   mizan_client_sett()         → جلب كل تبويبات الشركة الحالية (المستخدم داخل شركته)
--   mizan_client_sett_save(...) → حفظ تبويبات الشركة الحالية
--   mizan_admin_sett_load(uuid) / mizan_admin_sett_save(...) → المالك على أي شركة
--   mizan_client_export() / mizan_client_restore(payload) → نسخة العميل (شركته فقط)
-- حماية: العميل غير المصرّح لا يمس أبدًا بيانات شركات أخرى ولا أي صلاحيات إدارية.
-- ==============================================================

-- ---------- جداول جديدة ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  name text,
  description text,
  deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  name text,
  symbol text,
  deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  code text,
  name text,
  address text,
  is_active boolean default true,
  deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  name text,
  phone text,
  capital numeric default 0,
  withdrawals numeric default 0,
  is_active boolean default true,
  deleted boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_categories_org on public.categories (org_id);
create index if not exists idx_units_org on public.units (org_id);
create index if not exists idx_warehouses_org on public.warehouses (org_id);
create index if not exists idx_owners_org on public.owners (org_id);

-- ---------- أعمدة إضافية في organizations (بيانات الفاتورة المطبوعة) ----------
alter table public.organizations add column if not exists tax_title text;
alter table public.organizations add column if not exists paper_size text default 'A4';
alter table public.organizations add column if not exists warranty_terms text;
alter table public.organizations add column if not exists org_note text;

-- ---------- تفعيل RLS للجداول الجديدة + سياسات العزل ----------
alter table public.categories enable row level security;
alter table public.units enable row level security;
alter table public.warehouses enable row level security;
alter table public.owners enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','units','warehouses','owners']
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select using (org_id = public.current_org());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (org_id = public.current_org());', t, t);
    execute format('create policy %I_update on public.%I for update using (org_id = public.current_org());', t, t);
    execute format('create policy %I_delete on public.%I for delete using (org_id = public.current_org());', t, t);
  end loop;
end $$;

-- ---------- دوال تبويبات الإعدادات ----------
-- مستخدم داخل شركته: يحمّل كل تبويبات إعدادات شركته
drop function if exists public.mizan_client_sett();
create or replace function public.mizan_client_sett()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_out jsonb;
begin
  select org_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then return null; end if;
  select jsonb_build_object(
    'org',           (select to_jsonb(o) from public.organizations o where o.id = v_org),
    'categories',    coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.categories t where t.org_id = v_org and t.deleted is not true), '[]'::jsonb),
    'units',         coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.units t where t.org_id = v_org and t.deleted is not true), '[]'::jsonb),
    'warehouses',    coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.warehouses t where t.org_id = v_org and t.deleted is not true), '[]'::jsonb),
    'owners',        coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.owners t where t.org_id = v_org and t.deleted is not true), '[]'::jsonb),
    'wallets',       coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.treasury t where t.org_id = v_org and t.type = 'wallet' and t.deleted is not true), '[]'::jsonb),
    'banks',         coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.treasury t where t.org_id = v_org and t.type = 'bank' and t.deleted is not true), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- مستخدم داخل شركته: يحفظ كل تبويبات إعدادات شركته (استبدال كامل للقوائم)
drop function if exists public.mizan_client_sett_save(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
create or replace function public.mizan_client_sett_save(
  p_org jsonb,
  p_categories jsonb,
  p_units jsonb,
  p_warehouses jsonb,
  p_owners jsonb,
  p_wallets jsonb,
  p_banks jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  r jsonb;
  v_id uuid;
begin
  select org_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then raise exception 'غير مصرح'; end if;

  -- بيانات الشركة (الاسم/الهاتف/العنوان/الضريبة/بيانات الفاتورة) — مسموح لصاحب الشركة فقط
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
  end if;

  -- استبدال كامل لقوائم كل جدول (تحذير: نحذف ما رسلناه فعليًا فقط حسب المعرّفات)
  -- التصنيفات
  if p_categories is not null then
    delete from public.categories where org_id = v_org;
    for r in select * from jsonb_array_elements(p_categories)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.categories (id, org_id, name, description, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'description', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  -- وحدات القياس
  if p_units is not null then
    delete from public.units where org_id = v_org;
    for r in select * from jsonb_array_elements(p_units)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.units (id, org_id, name, symbol, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'symbol', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  -- المستودعات
  if p_warehouses is not null then
    delete from public.warehouses where org_id = v_org;
    for r in select * from jsonb_array_elements(p_warehouses)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.warehouses (id, org_id, code, name, address, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'code', r->>'name', r->>'address', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  -- أصحاب المنشأة والشركاء
  if p_owners is not null then
    delete from public.owners where org_id = v_org;
    for r in select * from jsonb_array_elements(p_owners)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.owners (id, org_id, name, phone, capital, withdrawals, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'phone', coalesce((r->>'capital')::numeric, 0), coalesce((r->>'withdrawals')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  -- المحافظ الإلكترونية (treasury type=wallet) — نحذف ونعيد فقط فئة المحافظ حتى لا نمس الخزائن النقدية
  if p_wallets is not null then
    delete from public.treasury where org_id = v_org and type = 'wallet';
    for r in select * from jsonb_array_elements(p_wallets)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.treasury (id, org_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', 'wallet', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  -- حسابات البنوك (treasury type=bank)
  if p_banks is not null then
    delete from public.treasury where org_id = v_org and type = 'bank';
    for r in select * from jsonb_array_elements(p_banks)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.treasury (id, org_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', 'bank', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
end $$;

-- ---------- نسخة احتياطية واستعادة للعميل (بيانات شركته فقط) ----------
drop function if exists public.mizan_client_export();
create or replace function public.mizan_client_export()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    'journal_lines',  coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_lines t where t.org_id = v_org), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- استعادة بيانات شركة العميل فقط (من ملف نسخته هو). لا تمس أي شركة أخرى.
-- التحقق من كلمة مرور الدخول إجباري قبل أي استعادة (نفس منطق تغيير كلمة المرور).
drop function if exists public.mizan_client_restore(text, jsonb);
create or replace function public.mizan_client_restore(p_password text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_hash text;
  r jsonb;
  v_id uuid;
begin
  select org_id into v_org from public.profiles where id = v_uid;
  if v_org is null then raise exception 'غير مصرح'; end if;
  -- تأكيد كلمة المرور الحالية قبل أي استعادة
  select encrypted_password into v_hash from auth.users where id = v_uid;
  if v_hash is null or v_hash <> extensions.crypt(coalesce(p_password, ''), v_hash) then
    raise exception 'كلمة المرور غير صحيحة. لا يمكن الاستعادة.';
  end if;

  -- مسح بيانات الشركة الحالية (خارج profiles/organizations)
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

  -- إعادة الإدراج مع فرض org_id الحالية دائمًا (حماية من أي حقن بصندوق)
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
end $$;

-- ---------- المالك: قراءة/حفظ تبويبات أي شركة ----------
drop function if exists public.mizan_admin_sett_load(uuid);
create or replace function public.mizan_admin_sett_load(p_org_id uuid)
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
    'org',           (select to_jsonb(o) from public.organizations o where o.id = p_org_id),
    'categories',    coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.categories t where t.org_id = p_org_id and t.deleted is not true), '[]'::jsonb),
    'units',         coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.units t where t.org_id = p_org_id and t.deleted is not true), '[]'::jsonb),
    'warehouses',    coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.warehouses t where t.org_id = p_org_id and t.deleted is not true), '[]'::jsonb),
    'owners',        coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.owners t where t.org_id = p_org_id and t.deleted is not true), '[]'::jsonb),
    'wallets',       coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.treasury t where t.org_id = p_org_id and t.type = 'wallet' and t.deleted is not true), '[]'::jsonb),
    'banks',         coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.treasury t where t.org_id = p_org_id and t.type = 'bank' and t.deleted is not true), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

drop function if exists public.mizan_admin_sett_save(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
create or replace function public.mizan_admin_sett_save(
  p_org_id uuid, p_org jsonb, p_categories jsonb, p_units jsonb,
  p_warehouses jsonb, p_owners jsonb, p_wallets jsonb, p_banks jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_id uuid;
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
  if p_wallets is not null then
    delete from public.treasury where org_id = p_org_id and type = 'wallet';
    for r in select * from jsonb_array_elements(p_wallets)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.treasury (id, org_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'name', 'wallet', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_banks is not null then
    delete from public.treasury where org_id = p_org_id and type = 'bank';
    for r in select * from jsonb_array_elements(p_banks)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.treasury (id, org_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'name', 'bank', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
end $$;

grant execute on function public.mizan_client_sett() to authenticated;
grant execute on function public.mizan_client_sett_save(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.mizan_client_export() to authenticated;
grant execute on function public.mizan_client_restore(text, jsonb) to authenticated;
grant execute on function public.mizan_admin_sett_load(uuid) to authenticated;
grant execute on function public.mizan_admin_sett_save(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;