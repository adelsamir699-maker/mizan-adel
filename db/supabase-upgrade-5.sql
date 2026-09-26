-- ==============================================================
-- ترقية 5: نظام التحكم الكامل بالحسابات من المالك
-- المالك ينشئ الشركات والأعضاء باليوزر/الباسورد، العميل فقط يغير كلمته
-- ==============================================================

-- 1) عمود الحد الأقصى لأعضاء الشركة
alter table public.organizations add column if not exists max_members int not null default 5;

-- 2) جدول سجل تغيير كلمات المرور (تنبيهات فقط، بلا نص الكلمة)
create table if not exists public.password_changes (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  username text,
  org_id uuid references public.organizations(id) on delete cascade,
  org_name text,
  changed_at timestamptz default now()
);
alter table public.password_changes enable row level security;

drop policy if exists pw_log_admin on public.password_changes;
create policy pw_log_admin on public.password_changes
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  );

-- 3) إنشاء شركة + حساب مديرها (المالك فقط) من لوحة الإدارة
drop function if exists public.mizan_admin_create_org(text, text, text, int);
create or replace function public.mizan_admin_create_org(
  p_org_name text,
  p_admin_username text,
  p_admin_password text,
  p_max_members int
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_uid uuid;
  v_email text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if nullif(trim(p_org_name), '') is null or nullif(trim(p_admin_username), '') is null or nullif(p_admin_password, '') is null then
    raise exception 'بيانات ناقصة';
  end if;
  v_email := lower(regexp_replace(trim(p_admin_username), '[^a-z0-9._-]', '', 'g')) || '@mizan.app';
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'اسم المستخدم محجوز بالفعل';
  end if;

  insert into public.organizations (name, plan, plan_status, plan_start, owner_id, invite_code, max_members)
  values (trim(p_org_name), 'active', 'active', current_date, auth.uid(),
          upper(substr(md5(random()::text), 1, 8)),
          coalesce(p_max_members, 5))
  returning id into v_org;

  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_admin_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"email_confirmed":true}'::jsonb,
    jsonb_build_object('sub', v_uid, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    now(), now(), '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
  ) values (
    v_email, v_uid, jsonb_build_object('sub', v_uid, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    'email', now(), now(), now(), gen_random_uuid()
  );

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org, coalesce(nullif(trim(p_admin_username),''), 'مدير الشركة'), 'admin');

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

-- 4) إنشاء عضو داخل شركة موجودة (المالك فقط) مع منع تجاوز الحد الأقصى
drop function if exists public.mizan_admin_create_user(uuid, text, text, text, text);
create or replace function public.mizan_admin_create_user(
  p_org_id uuid,
  p_username text,
  p_password text,
  p_full_name text default null,
  p_role text default 'member'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text;
  v_max int;
  v_count bigint;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if nullif(trim(p_username), '') is null or nullif(p_password, '') is null then
    raise exception 'بيانات ناقصة';
  end if;
  v_email := lower(regexp_replace(trim(p_username), '[^a-z0-9._-]', '', 'g')) || '@mizan.app';
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'اسم المستخدم محجوز بالفعل';
  end if;

  select max_members into v_max from public.organizations where id = p_org_id;
  if v_max is null then raise exception 'الشركة غير موجودة'; end if;
  select count(*) into v_count from public.profiles where org_id = p_org_id;
  if v_count >= v_max then
    raise exception 'وصلت الشركة للحد الأقصى من الأعضاء (%)', v_max;
  end if;

  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"email_confirmed":true}'::jsonb,
    jsonb_build_object('sub', v_uid, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    now(), now(), '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
  ) values (
    v_email, v_uid, jsonb_build_object('sub', v_uid, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    'email', now(), now(), now(), gen_random_uuid()
  );

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, p_org_id, coalesce(nullif(trim(p_full_name),''), nullif(trim(p_username),'')), coalesce(nullif(p_role,''), 'member'));

  return v_uid;
end $$;

-- 5) العميل يغير كلمته (يعرف القديم) ويُسجّل التنبيه تلقائيًا
drop function if exists public.mizan_change_my_password(text, text);
create or replace function public.mizan_change_my_password(
  p_old_password text,
  p_new_password text
) returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_pf record;
begin
  if v_uid is null then raise exception 'لا توجد جلسة'; end if;
  select encrypted_password into v_hash from auth.users where id = v_uid;
  if v_hash is null or v_hash <> extensions.crypt(coalesce(p_old_password, ''), v_hash) then
    raise exception 'كلمة المرور الحالية غير صحيحة';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now() where id = v_uid;

  select p.org_id, o.name into v_pf
  from public.profiles p left join public.organizations o on o.id = p.org_id
  where p.id = v_uid;
  insert into public.password_changes (user_id, username, org_id, org_name, changed_at)
  values (v_uid, split_part(coalesce((select email from auth.users where id = v_uid),''), '@', 1),
          v_pf.org_id, v_pf.name, now());
  return true;
end $$;

-- 6) المالك يغيّر كلمة أي مستخدم (إعادة تعيين) مع تسجيل
drop function if exists public.mizan_admin_reset_password(uuid, text);
create or replace function public.mizan_admin_reset_password(p_user_id uuid, p_new_password text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_org_id uuid;
  v_org_name text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if nullif(p_new_password, '') is null then raise exception 'كلمة المرور فارغة'; end if;
  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then raise exception 'المستخدم غير موجود'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user_id;

  select p.org_id, o.name into v_org_id, v_org_name
  from public.profiles p left join public.organizations o on o.id = p.org_id
  where p.id = p_user_id;
  insert into public.password_changes (user_id, username, org_id, org_name, changed_at)
  values (p_user_id, split_part(v_email, '@', 1), v_org_id, v_org_name, now());
  return v_email;
end $$;

-- 7) المالك يقرأ سجل التغييرات
drop function if exists public.mizan_admin_password_log();
create or replace function public.mizan_admin_password_log()
returns table (username text, org_name text, changed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.username, l.org_name, l.changed_at
  from public.password_changes l
  where exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by l.changed_at desc;
$$;

-- 8) تطوير admin_orgs ليشمل max_members
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
  members bigint,
  max_members int
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.plan_start, o.plan_end, o.plan_status, o.locked,
         (select p.full_name from public.profiles p where p.org_id = o.id and p.role = 'admin' limit 1),
         (select count(*) from public.profiles p where p.org_id = o.id),
         o.max_members
  from public.organizations o
  where exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by o.created_at desc;
$$;

grant execute on function public.mizan_admin_create_org(text, text, text, int) to authenticated;
grant execute on function public.mizan_admin_create_user(uuid, text, text, text, text) to authenticated;
grant execute on function public.mizan_change_my_password(text, text) to authenticated;
grant execute on function public.mizan_admin_reset_password(uuid, text) to authenticated;
grant execute on function public.mizan_admin_password_log() to authenticated;
grant execute on function public.mizan_admin_orgs() to authenticated;
grant execute on function public.mizan_admin_members(uuid) to authenticated;
grant execute on function public.mizan_admin_set_org(uuid, date, date, boolean, jsonb) to authenticated;
grant execute on function public.mizan_admin_set_user(uuid, boolean) to authenticated;