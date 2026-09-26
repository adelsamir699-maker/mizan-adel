-- ==============================================================
-- ميزان - نظام المحاسبة الأونلاين (متعدد الشركات)
-- شغّل هذا الملف مرة واحدة:
--   Supabase > SQL Editor > New query > الصق الكل > Run
-- ==============================================================

-- 1) جدول الشركات (كل شركة/مؤسسة مشترك)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  address text,
  tax_number text,
  business_type text,
  plan text default 'free',
  plan_start date,
  plan_end date,
  plan_status text default 'active',
  locked boolean default false,
  features jsonb default '{}'::jsonb,
  owner_id uuid references auth.users on delete set null,
  publish_url text,
  tax_enabled boolean default false,
  tax_rate numeric default 0,
  invite_code text unique,
  created_at timestamptz default now()
);

-- 2) ملفات المستخدمين (مرتبطة بحسابات تسجيل الدخول auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  org_id uuid not null references public.organizations on delete cascade,
  full_name text,
  role text default 'member',
  branch text,
  is_active boolean default true,
  blocked boolean default false,
  is_superadmin boolean default false,
  created_at timestamptz default now()
);

-- 3) جداول بيانات الشغل لكل شركة (عميل/مورد/صنف/فواتير/خزائن/قيود...)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  code text, name_ar text, name_en text, phone text, address text,
  opening_balance numeric default 0, credit_limit numeric default 0,
  is_active boolean default true, deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  code text, name_ar text, phone text, address text,
  opening_balance numeric default 0, current_balance numeric default 0,
  is_active boolean default true, deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  code text, name_ar text, name_en text, barcode text, category text,
  purchase_price numeric default 0, sale_price numeric default 0,
  stock_qty numeric default 0, min_stock numeric default 0,
  is_active boolean default true, deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  invoice_no text, doc_date date, customer text, payment_method text,
  treasury_id text, store text, notes text,
  discount numeric default 0, tax numeric default 0, grand_total numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  sale_id uuid not null, product_id text, product_name text,
  qty numeric default 0, price numeric default 0, total numeric default 0
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  invoice_no text, doc_date date, supplier text, payment_method text,
  treasury_id text, store text, notes text,
  discount numeric default 0, tax numeric default 0, grand_total numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  purchase_id uuid not null, product_id text, product_name text,
  qty numeric default 0, price numeric default 0, total numeric default 0
);

create table if not exists public.supplier_txs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  supplier_id text, doc_date date, type text, amount numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.treasury (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  name text, type text, account_no text,
  opening_balance numeric default 0, balance numeric default 0,
  is_active boolean default true, deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  no text, doc_date date, kind text, treasury_id text, account_id text,
  amount numeric default 0, notes text,
  created_at timestamptz default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  code text, name_ar text, type text, parent_id numeric default 0,
  opening_debit numeric default 0, opening_credit numeric default 0,
  balance numeric default 0, is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  jrn_no text, doc_date date, ref_type text, ref_id text, description text,
  created_at timestamptz default now()
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  entry_id uuid not null, account_id text, account_name text,
  debit numeric default 0, credit numeric default 0
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  ts timestamptz default now(), user_name text, action text, detail text
);

-- 4) فهارس للسرعة
create index if not exists idx_customers_org on public.customers (org_id);
create index if not exists idx_suppliers_org on public.suppliers (org_id);
create index if not exists idx_products_org on public.products (org_id);
create index if not exists idx_sales_org on public.sales (org_id);
create index if not exists idx_sale_items_org on public.sale_items (org_id);
create index if not exists idx_purchases_org on public.purchases (org_id);
create index if not exists idx_purchase_items_org on public.purchase_items (org_id);
create index if not exists idx_supplier_txs_org on public.supplier_txs (org_id);
create index if not exists idx_treasury_org on public.treasury (org_id);
create index if not exists idx_vouchers_org on public.vouchers (org_id);
create index if not exists idx_accounts_org on public.accounts (org_id);
create index if not exists idx_journal_org on public.journal_entries (org_id);
create index if not exists idx_jrn_lines_org on public.journal_lines (org_id);
create index if not exists idx_audit_org on public.audit_logs (org_id);

-- 5) دوال مساعدة
-- الشركة الخاصة بالمستخدم الحالي (الأمان في كل الجداول)
-- security definer لتفادي الدوران المتكرر داخل سياسات profiles
create or replace function public.current_org()
returns uuid language sql stable security definer set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- حالة وصول المستخدم + بيانات الإدارة (الوقت/القفل/الأعضاء/المزايا) للتطبيق
drop function if exists public.mizan_access();
create or replace function public.mizan_access()
returns table (
  allowed boolean,
  reason text,
  role text,
  org_id uuid,
  org_name text,
  plan_start date,
  plan_end date,
  locked boolean,
  blocked boolean,
  is_superadmin boolean,
  features jsonb
) language sql stable security definer set search_path = public
as $$
  select
    case when p.id is not null and p.blocked is not true
           and o.id is not null and o.locked is not true
           and o.plan_status = 'active'
           and (o.plan_end is null or o.plan_end >= current_date)
         then true else false end,
    case when p.id is null then 'noprofile'
         when p.blocked then 'blocked'
         when o.id is null then 'noorganization'
         when o.locked then 'locked'
         when o.plan_status <> 'active' or (o.plan_end is not null and o.plan_end < current_date) then 'plan'
         else 'ok' end,
    p.role, o.id, o.name, o.plan_start, o.plan_end, o.locked, p.blocked, p.is_superadmin,
    coalesce(o.features, '{}'::jsonb)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.organizations o on o.id = p.org_id
  where u.id = auth.uid();
$$;

-- ======== دوال المالك (سوبر أدمن) ========
-- ضبط وقت الشركة وحالة قفلها
drop function if exists public.mizan_admin_set_org(uuid, date, date, boolean, jsonb);
create or replace function public.mizan_admin_set_org(
  p_org_id uuid, p_plan_start date, p_plan_end date, p_locked boolean, p_features jsonb
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  then raise exception 'غير مصرح'; end if;
  update public.organizations set
    plan_start = coalesce(p_plan_start, plan_start),
    plan_end   = p_plan_end,
    plan_status = case when p_plan_end is null then 'active'
                       when p_plan_end < current_date then 'expired' else 'active' end,
    locked     = coalesce(p_locked, locked),
    features   = coalesce(p_features, features)
  where id = p_org_id;
end $$;

-- منع / إلغاء منع عضو داخل شركة معينة
drop function if exists public.mizan_admin_set_user(uuid, boolean);
create or replace function public.mizan_admin_set_user(p_user_id uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  then raise exception 'غير مصرح'; end if;
  update public.profiles set blocked = coalesce(p_blocked, blocked) where id = p_user_id;
end $$;

-- سحب ملف جميع الشركات + عدد أعضائها (لوحة التحكم)
drop function if exists public.mizan_admin_orgs();
create or replace function public.mizan_admin_orgs()
returns table (org_id uuid, org_name text, plan_start date, plan_end date,
               plan_status text, locked boolean, owner_name text, members bigint,
               owner_id uuid, protected boolean)
language sql security definer set search_path = public
as $$
  select o.id, o.name, o.plan_start, o.plan_end, o.plan_status, o.locked,
         (select p.full_name from public.profiles p where p.org_id = o.id and p.role = 'admin' limit 1),
         (select count(*) from public.profiles p where p.org_id = o.id),
         o.owner_id,
         (o.owner_id is not null
           and exists (select 1 from public.profiles p where p.id = o.owner_id and p.is_superadmin is true))
  from public.organizations o
  where exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by o.created_at desc;
$$;

-- أعضاء شركة معينة (لوحة التحكم)
drop function if exists public.mizan_admin_members(uuid);
create or replace function public.mizan_admin_members(p_org_id uuid)
returns table (user_id uuid, full_name text, role text, blocked boolean, created_at timestamptz)
language sql security definer set search_path = public
as $$
  select p.id, p.full_name, p.role, p.blocked, p.created_at
  from public.profiles p
  where p.org_id = p_org_id
    and exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by p.created_at;
$$;

-- إنشاء شركة جديدة لصاحب الحساب الجديد مع كود دعوة + بيانات أولية (حسابات + خزينة)
-- (النسخة الكاملة الحديثة مطابقة لـ supabase-upgrade-2.sql وsupabase-upgrade-4.sql)

  -- شجرة الحسابات الافتراضية (الـ local_id مطابقة لبيانات التطبيق التجريبية)
  -- انظر supabase-upgrade-2.sql لتحديث هذه في قاعدة بيانات حية بدون إعادة إنشاء
  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'asset', 0, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'asset', 1, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', 2, 25000, 0, true),
    (v_org, 4, '1.1.2', 'البنوك والحسابات البنكية', 'asset', 2, 50000, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', 2, 10000, 0, true),
    (v_org, 6, '1.1.4', 'المخزون (بضاعة)', 'asset', 2, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', 2, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'asset', 1, 0, 0, true),
    (v_org, 9, '1.3.1', 'المباني والمعدات', 'asset', 8, 0, 0, true),
    (v_org, 10, '2', 'الالتزامات', 'liability', 0, 0, 0, true),
    (v_org, 11, '2.1', 'الالتزامات المتداولة', 'liability', 10, 0, 0, true),
    (v_org, 12, '2.1.1', 'مستحقات الموردين', 'liability', 11, 0, 0, true),
    (v_org, 13, '2.1.2', 'ضريبة المبيعات المستحقة', 'liability', 11, 0, 0, true),
    (v_org, 14, '3', 'حقوق الملكية', 'equity', 0, 0, 0, true),
    (v_org, 15, '3.1', 'رأس المال', 'equity', 14, 100000, 0, true),
    (v_org, 16, '3.2', 'الأرباح المحتجزة', 'equity', 14, 0, 0, true),
    (v_org, 17, '4', 'الإيرادات', 'revenue', 0, 0, 0, true),
    (v_org, 18, '4.1', 'إيرادات المبيعات', 'revenue', 17, 0, 0, true),
    (v_org, 19, '5', 'المصروفات', 'expense', 0, 0, 0, true),
    (v_org, 20, '5.1', 'مصروفات عمومية وإدارية', 'expense', 19, 0, 0, true),
    (v_org, 21, '5.2', 'إيجارات وما شابه', 'expense', 19, 0, 0, true);

  -- الخزن الافتراضية (الـ local_id مطابقة لبيانات التطبيق التجريبية)
  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي (نقدي)', 'cash', 25000, 25000, true),
    (v_org, 2, 'البنك الأهلي المصري (1234567890)', 'bank', 50000, 50000, true),
    (v_org, 3, 'محفظة فودافون كاش (01002655282)', 'wallet', 10000, 10000, true);

  return v_org;
end $$;

-- الانضمام لشركة موجودة بالفعل عبر كود الدعوة
create or replace function public.join_org(p_code text, p_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_org uuid;
begin
  select id into v_org from public.organizations
  where upper(invite_code) = upper(p_code) and plan_status = 'active';
  if v_org is null then raise exception 'رمز الدعوة غير صحيح أو الشركة غير نشطة'; end if;
  insert into public.profiles (id, org_id, full_name, role)
  values (auth.uid(), v_org, coalesce(nullif(p_name,''), split_part(auth.email(),'@',1)), 'member');
  return v_org;
end $$;

-- 6) تفعيل RLS (عزل كامل: كل شركة ترى بياناتها فقط)
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_txs enable row level security;
alter table public.treasury enable row level security;
alter table public.vouchers enable row level security;
alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.audit_logs enable row level security;

-- 7) سياسات الأمان
drop policy if exists org_select on public.organizations;
drop policy if exists org_update on public.organizations;
create policy org_select on public.organizations
  for select using (id = public.current_org());
create policy org_update on public.organizations
  for update using (id = public.current_org());

drop policy if exists prof_select on public.profiles;
drop policy if exists prof_update on public.profiles;
drop policy if exists prof_delete on public.profiles;
create policy prof_select on public.profiles
  for select using (org_id = public.current_org());
create policy prof_update on public.profiles
  for update using (org_id = public.current_org());
create policy prof_delete on public.profiles
  for delete using (org_id = public.current_org());

do $$
declare t text;
begin
  foreach t in array array[
    'customers','suppliers','products','sales','sale_items',
    'purchases','purchase_items','supplier_txs','treasury',
    'vouchers','accounts','journal_entries','journal_lines','audit_logs']
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

-- 8) بيانات أولية مشتركة: شجرة الحسابات تُنشأ تلقائيًا عند أول تسجيل دخول
-- (لتفعيلها أضفها كإجراء داخل RPC المرتبط بحدوث إنشاء الشركة)