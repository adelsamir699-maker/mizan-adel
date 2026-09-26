-- ترقية: عمود الرقم المحلي + جدول سندات العملاء
alter table public.customers       add column if not exists local_id bigint;
alter table public.suppliers       add column if not exists local_id bigint;
alter table public.products        add column if not exists local_id bigint;
alter table public.sales           add column if not exists local_id bigint;
alter table public.sale_items      add column if not exists local_id bigint;
alter table public.purchases       add column if not exists local_id bigint;
alter table public.purchase_items  add column if not exists local_id bigint;
alter table public.supplier_txs    add column if not exists local_id bigint;
alter table public.treasury        add column if not exists local_id bigint;
alter table public.vouchers        add column if not exists local_id bigint;
alter table public.accounts        add column if not exists local_id bigint;
alter table public.journal_entries add column if not exists local_id bigint;
alter table public.journal_lines   add column if not exists local_id bigint;
alter table public.audit_logs      add column if not exists local_id bigint;

create unique index if not exists uq_customers_orglocal on public.customers (org_id, local_id);
create unique index if not exists uq_suppliers_orglocal on public.suppliers (org_id, local_id);
create unique index if not exists uq_products_orglocal on public.products (org_id, local_id);
create unique index if not exists uq_sales_orglocal on public.sales (org_id, local_id);
create unique index if not exists uq_sale_items_orglocal on public.sale_items (org_id, local_id);
create unique index if not exists uq_purchases_orglocal on public.purchases (org_id, local_id);
create unique index if not exists uq_purchase_items_orglocal on public.purchase_items (org_id, local_id);
create unique index if not exists uq_supplier_txs_orglocal on public.supplier_txs (org_id, local_id);
create unique index if not exists uq_treasury_orglocal on public.treasury (org_id, local_id);
create unique index if not exists uq_vouchers_orglocal on public.vouchers (org_id, local_id);
create unique index if not exists uq_accounts_orglocal on public.accounts (org_id, local_id);
create unique index if not exists uq_journal_orglocal on public.journal_entries (org_id, local_id);
create unique index if not exists uq_jrn_lines_orglocal on public.journal_lines (org_id, local_id);
create unique index if not exists uq_audit_orglocal on public.audit_logs (org_id, local_id);

-- سندات العملاء (كشف حساب كل عميل) للربط
create table if not exists public.customer_txs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  customer_id text, doc_date date, description text,
  debit numeric default 0, credit numeric default 0,
  local_id bigint
);
create index if not exists idx_customer_txs_org on public.customer_txs (org_id);
create unique index if not exists uq_customer_txs_orglocal on public.customer_txs (org_id, local_id);
alter table public.customer_txs enable row level security;
drop policy if exists customer_txs_select on public.customer_txs;
drop policy if exists customer_txs_insert on public.customer_txs;
drop policy if exists customer_txs_update on public.customer_txs;
drop policy if exists customer_txs_delete on public.customer_txs;
create policy customer_txs_select on public.customer_txs for select using (org_id = public.current_org());
create policy customer_txs_insert on public.customer_txs for insert with check (org_id = public.current_org());
create policy customer_txs_update on public.customer_txs for update using (org_id = public.current_org());
create policy customer_txs_delete on public.customer_txs for delete using (org_id = public.current_org());