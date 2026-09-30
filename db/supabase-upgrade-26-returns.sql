-- ============================================================
-- Mizan — ترقية 26: المرتجعات (بناء 108)
--
-- الغرض:
--   العميل يرجّع صنف واحد أو أكتر من فاتورة (بدل حذف الفاتورة كلها)،
--   والمورد كمان. كل مرتجع ليه رقم مستقل، وكل مرتجع له أصنافه.
--
-- القرارات المعمارية المعتمدة من المستخدم:
--   1) جداول مستقلة (sale_returns / purchase_returns) — الفاتورة الأصلية ما تتغيرش.
--   2) التسوية نوعين وقت التسجيل: «خصم من الرصيد» أو «رد نقدية» (خزينة/بنك/محفظة).
--   3) رقم المرتجع بيأخده نفس عدّاد أرقام الفواتير على السحابة (kind جديد).
--
-- عزل الشركات: نفس نمط الفواتير بالظبط — RLS على current_org() + unique (org_id, local_id).
-- الترحيل idempotent: يتكرر بأمان.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) عدّاد الأرقام: أنواع جديدة للمرتجعات
--    كان مقبول sale / purchase فقط؛ بقى sale_return / purchase_return كمان.
-- ------------------------------------------------------------
alter table public.mizan_invoice_seq
  drop constraint if exists mizan_invoice_seq_kind_check;
alter table public.mizan_invoice_seq
  add constraint mizan_invoice_seq_kind_check
  check (kind in ('sale', 'purchase', 'sale_return', 'purchase_return'));

-- ------------------------------------------------------------
-- 2) مرتجعات البيع
-- ------------------------------------------------------------
create table if not exists public.sale_returns (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations on delete cascade,
  local_id       bigint not null,
  return_no      text,
  doc_date       date,
  sale_local_id  bigint,                 -- رقم الفاتورة الأصلية المحلي (sales.local_id)
  customer       text,
  customer_id    text,
  settlement     text,                   -- 'balance' خصم من الرصيد | 'refund' رد نقدية
  payment_method text,                   -- نقدي / بنك / محفظة (للتسوية النقدية)
  treasury_id    text,
  store          text,
  notes          text,
  grand_total    numeric default 0,
  created_at     timestamptz default now(),
  unique (org_id, local_id)
);

create table if not exists public.sale_return_items (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations on delete cascade,
  local_id     bigint not null,          -- return_local_id * 1000 + item_index
  return_id    uuid not null,
  product_id   text,
  product_name text,
  qty          numeric default 0,
  price        numeric default 0,
  total        numeric default 0,
  unique (org_id, local_id)
);

-- ------------------------------------------------------------
-- 3) مرتجعات الشراء
-- ------------------------------------------------------------
create table if not exists public.purchase_returns (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations on delete cascade,
  local_id       bigint not null,
  return_no      text,
  doc_date       date,
  purchase_local_id bigint,              -- رقم فاتورة الشراء الأصلية المحلية
  supplier       text,
  supplier_id    text,
  settlement     text,                   -- 'balance' خصم من رصيد المورد | 'refund' استرداد نقدية
  payment_method text,
  treasury_id    text,
  store          text,
  notes          text,
  grand_total    numeric default 0,
  created_at     timestamptz default now(),
  unique (org_id, local_id)
);

create table if not exists public.purchase_return_items (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations on delete cascade,
  local_id     bigint not null,
  return_id    uuid not null,
  product_id   text,
  product_name text,
  qty          numeric default 0,
  price        numeric default 0,
  total        numeric default 0,
  unique (org_id, local_id)
);

-- ------------------------------------------------------------
-- 4) فهارس
-- ------------------------------------------------------------
create index if not exists idx_sale_returns_org      on public.sale_returns (org_id);
create index if not exists idx_sale_returns_sale     on public.sale_returns (org_id, sale_local_id);
create index if not exists idx_sale_ret_items_org    on public.sale_return_items (org_id);
create index if not exists idx_sale_ret_items_ret    on public.sale_return_items (return_id);

create index if not exists idx_purch_returns_org     on public.purchase_returns (org_id);
create index if not exists idx_purch_returns_pur     on public.purchase_returns (org_id, purchase_local_id);
create index if not exists idx_purch_ret_items_org   on public.purchase_return_items (org_id);
create index if not exists idx_purch_ret_items_ret   on public.purchase_return_items (return_id);

-- ------------------------------------------------------------
-- 5) سياسات العزل (نفس نمط الفواتير حرفيًا)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sale_returns','sale_return_items','purchase_returns','purchase_return_items']
  loop
    execute format('alter table public.%I enable row level security;', t);
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

commit;

-- ============================================================
-- فحص التطبيق السريع:
--   select count(*) from information_schema.tables where table_name in
--     ('sale_returns','sale_return_items','purchase_returns','purchase_return_items');  -- = 4
--   select pg_get_constraintdef(oid) from pg_constraint
--     where conrelid='public.mizan_invoice_seq'::regclass and contype='c';
-- ============================================================
