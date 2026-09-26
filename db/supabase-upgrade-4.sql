-- ==============================================================
-- ترقية 4: نظام إدارة المالك (الوقت + القفل + الأعضاء + المزايا)
-- إضافة أعمدة للصلاحيات والوقت، ودوال إدارية، وحماية على مستوى القاعدة
-- ==============================================================

-- 1) أعمدة جديدة على الشركات
alter table public.organizations add column if not exists owner_id uuid references auth.users on delete set null;
alter table public.organizations add column if not exists locked boolean default false;
alter table public.organizations add column if not exists plan_start date;
alter table public.organizations add column if not exists features jsonb default '{}'::jsonb;

-- 2) أعمدة جديدة على الملفات
alter table public.profiles add column if not exists blocked boolean default false;
alter table public.profiles add column if not exists is_superadmin boolean default false;

-- 3) فحوصات صلاحية وصول الموظف نفسه + بياناتها (تُستدعى من التطبيق فورًا بعد الدخول)
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
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when
      p.id is not null
      and p.blocked is not true
      and o.id is not null
      and o.locked is not true
      and o.plan_status = 'active'
      and (o.plan_end is null or o.plan_end >= current_date)
    then true else false end,
    case
      when p.id is null then 'noprofile'
      when p.blocked then 'blocked'
      when o.id is null then 'noorganization'
      when o.locked then 'locked'
      when o.plan_status <> 'active' then 'plan'
      when o.plan_end is not null and o.plan_end < current_date then 'plan'
      else 'ok'
    end,
    p.role, o.id, o.name, o.plan_start, o.plan_end, o.locked, p.blocked, p.is_superadmin,
    coalesce(o.features, '{}'::jsonb)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.organizations o on o.id = p.org_id
  where u.id = auth.uid();
$$;

-- 4) دوال المالك (سوبر أدمن فقط — المستخدم صاحب النظام كله)
-- 4.1 ضبط وقت الشركة وحالة قفلها
drop function if exists public.mizan_admin_set_org(uuid, date, date, boolean, jsonb);
create or replace function public.mizan_admin_set_org(
  p_org_id uuid,
  p_plan_start date,
  p_plan_end date,
  p_locked boolean,
  p_features jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  update public.organizations set
    plan_start = coalesce(p_plan_start, plan_start),
    plan_end   = p_plan_end,
    plan_status = case when p_plan_end is null then 'active'
                       when p_plan_end < current_date then 'expired'
                       else 'active' end,
    locked     = coalesce(p_locked, locked),
    features   = coalesce(p_features, features)
  where id = p_org_id;
end $$;

-- 4.2 منع / إلغاء منع عضو داخل شركة معينة
drop function if exists public.mizan_admin_set_user(uuid, boolean);
create or replace function public.mizan_admin_set_user(p_user_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  update public.profiles set blocked = coalesce(p_blocked, blocked) where id = p_user_id;
end $$;

-- 4.3 سحب ملف جميع الشركات + عدد أعضائها (للوحة التحكم)
drop function if exists public.mizan_admin_orgs();
create or replace function public.mizan_admin_orgs()
returns table (
  org_id uuid,
  org_name text,
  plan_start date,
  plan_end date,
  plan_status text,
  locked boolean,
  owner_name text,
  members bigint
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.name, o.plan_start, o.plan_end, o.plan_status, o.locked,
         (select p.full_name from public.profiles p where p.org_id = o.id and p.role = 'admin' limit 1),
         (select count(*) from public.profiles p where p.org_id = o.id)
  from public.organizations o
  where exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by o.created_at desc;
$$;

-- 4.4 أعضاء شركة معينة (للوحة التحكم)
drop function if exists public.mizan_admin_members(uuid);
create or replace function public.mizan_admin_members(p_org_id uuid)
returns table (
  user_id uuid,
  full_name text,
  role text,
  blocked boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.blocked, p.created_at
  from public.profiles p
  where p.org_id = p_org_id
  and exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by p.created_at;
$$;

-- 5) عند إنشاء شركة جديدة: صاحبها هو المنشئ + بداية الاشتراك = اليوم
-- حماية إضافية: لو بدون جلسة (auth.uid() = null) نرفض برسالة واضحة بدل خطأ NULL constraint
create or replace function public.create_org_and_profile(p_org_name text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'لا توجد جلسة دخول. أعد تسجيل الدخول ثم أعد المحاولة.';
  end if;

  insert into public.organizations (name, plan, plan_status, plan_start, owner_id, invite_code)
  values (
    coalesce(nullif(trim(p_org_name), ''), 'شركة'),
    'free',
    'active',
    current_date,
    v_uid,
    upper(substr(md5(random()::text), 1, 8))
  )
  returning id into v_org;

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org, coalesce(nullif(p_name,''), split_part(auth.email(),'@',1)), 'admin');

  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'group', NULL, 0, 0, true),
    (v_org, 2, '11', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '111', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '112', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '113', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '114', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '115', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '12', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '13', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '131', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '132', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '133', 'ضريبة المبيعات المستحقة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '14', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 14, '141', 'رأس المال', 'equity', NULL, 100000, 0, true),
    (v_org, 15, '142', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 16, '2', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 17, '21', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 18, '22', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '3', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 20, '31', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 21, '32', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', 25000, 25000, true),
    (v_org, 2, 'البنك الأهلي المصري', 'bank', 50000, 50000, true),
    (v_org, 3, 'محفظة فودافون كاش', 'wallet', 10000, 10000, true);

  return v_org;
end $$;

-- 6) السماح بقراءة بيانات الشركة لأعضاء الشركة فقط
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations
  for select using (id = public.current_org() or
                    exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true));