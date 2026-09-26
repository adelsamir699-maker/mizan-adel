-- ==============================================================
-- ترقية 17: الرصيد... (ميزة: كل شركة تدير حساباتها الفرعية)
--  1) عمود features (الصلاحيات) على مستوى كل حساب في profiles
--     (يسمح بتعيين صلاحيات مختلفة لكل يوزر تابع للشركة)
--  2) mizan_access: إضافة org_max_members + org_members_count لتُعرض
--     في شاشة «حسابات شركتي» عدد المسموح به
--  3) mizan_org_info(): معلومات شاشة الحسابات لمدير الشركة
--  4) mizan_org_members(uuid): قائمة حسابات شركة معينة (للمدير أو السوبر أدمن)
--  5) mizan_org_add_member(): إضافة حساب فرعي بصلاحيات ضمن حد max_members
--  6) mizan_org_set_features(): تعديل صلاحيات حساب فرعي
--  7) mizan_org_delete_member(uuid): حذف حساب فرعي (يبحث عنه مالك الشركة/السوبر أدمن)
-- ==============================================================

-- 1) صلاحيات كل حساب (features لكل يوزر داخل الشركة)
alter table public.profiles add column if not exists features jsonb default '{}'::jsonb;

-- 2) تحديث mizan_access ليُرجع حد الأعضاء والعدد الحالي (نفس التوقيع الأساسي + حقول إضافية)
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
  features jsonb,
  org_max_members int,
  org_members_count bigint
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
    coalesce(p.features, '{}'::jsonb) || coalesce(o.features, '{}'::jsonb),
    coalesce(o.max_members, 5),
    (select count(*) from public.profiles pc where pc.org_id = p.org_id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.organizations o on o.id = p.org_id
  where u.id = auth.uid();
$$;

grant execute on function public.mizan_access() to authenticated;

-- 3) معلومات شاشة حسابات الشركة (للمدير أو السوبر أدمن)
drop function if exists public.mizan_org_info();
create or replace function public.mizan_org_info()
returns table (
  org_id uuid,
  org_name text,
  role text,
  is_org_admin boolean,
  is_superadmin boolean,
  max_members int,
  members_count bigint,
  locked boolean
)
language sql stable security definer set search_path = public
as $$
  select o.id, o.name, p.role,
         p.role = 'admin',
         p.is_superadmin,
         coalesce(o.max_members, 5),
         (select count(*) from public.profiles pc where pc.org_id = p.org_id),
         o.locked
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid();
$$;

grant execute on function public.mizan_org_info() to authenticated;

-- 4) قائمة حسابات الشركة (الفرعية + مديرها)
--    يُسمح بسحبها: لمدير الشركة نفسه، أو للسوبر أدمن (لأي شركة)
drop function if exists public.mizan_org_members(uuid);
create or replace function public.mizan_org_members(p_org_id uuid)
returns table (
  user_id uuid,
  username text,
  full_name text,
  role text,
  blocked boolean,
  features jsonb,
  created_at timestamptz
)
language sql stable security definer set search_path = public, auth
as $$
  select p.id,
         split_part(au.email, '@', 1),
         p.full_name,
         p.role,
         p.blocked,
         coalesce(p.features, '{}'::jsonb),
         p.created_at
  from public.profiles p
  join auth.users au on au.id = p.id
  where p.org_id = p_org_id
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and (me.is_superadmin is true
             or (me.org_id = p_org_id and me.role = 'admin'))
    )
  order by p.created_at;
$$;

grant execute on function public.mizan_org_members(uuid) to authenticated;

-- 5) إضافة حساب فرعي للشركة (مدير الشركة فقط أو السوبر أدمن)
drop function if exists public.mizan_org_add_member(text, text, text, text, jsonb);
create or replace function public.mizan_org_add_member(
  p_username text,
  p_password text,
  p_full_name text default null,
  p_role text default 'member',
  p_features jsonb default null
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
  v_org uuid;
  v_org_name text;
  v_is_admin boolean;
  v_is_super boolean;
begin
  select org_id, (role = 'admin'), is_superadmin, name
    into v_org, v_is_admin, v_is_super, v_org_name
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid();
  if v_org is null then raise exception 'لا يوجد حساب مرتبط بشركة'; end if;
  if not (v_is_admin or v_is_super) then
    raise exception 'غير مصرح: فقط مدير الشركة أو المالك يمكنه إضافة حساب';
  end if;

  if nullif(trim(p_username), '') is null or nullif(p_password, '') is null then
    raise exception 'بيانات ناقصة';
  end if;
  v_email := lower(regexp_replace(trim(p_username), '[^a-z0-9._-]', '', 'g')) || '@mizan.app';
  if v_email = '@mizan.app' then
    raise exception 'اسم المستخدم يجب أن يحتوي حروفًا إنجليزية أو أرقامًا (بدون مسافات أو رموز)';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'اسم المستخدم محجوز بالفعل';
  end if;

  -- احترام حد الحسابات المسموح للشركة
  select max_members into v_max from public.organizations where id = v_org;
  select count(*) into v_count from public.profiles where org_id = v_org;
  if v_count >= v_max then
    raise exception 'وصلت الشركة (% / %) للحد الأقصى من الحسابات', v_count, v_max;
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

  insert into public.profiles (id, org_id, full_name, role, features)
  values (v_uid, v_org,
          coalesce(nullif(trim(p_full_name),''), nullif(trim(p_username),'')),
          coalesce(nullif(p_role,''), 'member'),
          coalesce(p_features, '{}'::jsonb));

  -- حفظ كلمة المرور للمالك (يطلع عليها عند الطلب)
  insert into public.mizan_pw_store (user_id, plain_password) values (v_uid, p_password)
  on conflict (user_id) do update set plain_password = excluded.plain_password, updated_at = now();

  insert into public.audit_logs (org_id, user_name, action, detail, local_id)
  values (v_org, split_part(auth.email(), '@', 1), 'add_member',
          'إضافة حساب "' || split_part(v_email, '@', 1) || '" ضمن شركة "' || v_org_name || '"',
          coalesce((select max(local_id) + 1 from public.audit_logs where org_id = v_org), 1));

  return v_uid;
end $$;

grant execute on function public.mizan_org_add_member(text, text, text, text, jsonb) to authenticated;

-- 6) تعديل صلاحيات حساب فرعي (مدير الشركة أو السوبر أدمن)
drop function if exists public.mizan_org_set_features(uuid, jsonb);
create or replace function public.mizan_org_set_features(p_user_id uuid, p_features jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_target_org uuid;
  v_role text;
begin
  select org_id, role into v_org, v_role
  from public.profiles where id = auth.uid();
  if v_org is null then raise exception 'لا يوجد حساب مرتبط بشركة'; end if;

  select org_id into v_target_org from public.profiles where id = p_user_id;
  if v_target_org is null then raise exception 'المستخدم غير موجود'; end if;
  if v_target_org <> v_org and v_role <> 'admin'
     and not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح: الحساب ليس ضمن شركتك';
  end if;

  update public.profiles set features = coalesce(p_features, '{}'::jsonb)
  where id = p_user_id;
end $$;

grant execute on function public.mizan_org_set_features(uuid, jsonb) to authenticated;

-- 7) حذف حساب فرعي (مدير الشركة أو السوبر أدمن) + فكّ اسم المستخدم بعد الحذف
drop function if exists public.mizan_org_delete_member(uuid);
create or replace function public.mizan_org_delete_member(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_role text;
  v_is_super boolean;
  v_target_org uuid;
  v_target_super boolean;
  v_uid uuid := auth.uid();
  v_org_name text;
begin
  select org_id, role, is_superadmin into v_org, v_role, v_is_super
  from public.profiles where id = v_uid;
  if v_org is null then raise exception 'لا يوجد حساب مرتبط بشركة'; end if;

  select org_id, is_superadmin into v_target_org, v_target_super
  from public.profiles where id = p_user_id;
  if v_target_org is null then raise exception 'المستخدم غير موجود'; end if;
  if v_target_super then raise exception 'لا يمكن حذف حسابات مالك/المشغّل'; end if;
  if p_user_id = v_uid then raise exception 'لا يمكنك حذف حسابك الحالي'; end if;

  if not (v_is_super or (v_role = 'admin' and v_target_org = v_org)) then
    raise exception 'غير مصرح: لا يمكنك حذف هذا الحساب';
  end if;

  select name into v_org_name from public.organizations where id = v_target_org;

  -- حذف الأثر أولاً ثم الحساب ليُعاد استخدام الاسم
  delete from public.presence where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;
  begin
    delete from auth.identities where user_id = p_user_id;
  exception when others then null; end;
  begin
    delete from auth.sessions where user_id = p_user_id;
  exception when others then null; end;
  begin
    delete from auth.users where id = p_user_id;
  exception when others then null; end;

  return v_org_name;
end $$;

grant execute on function public.mizan_org_delete_member(uuid) to authenticated;

-- 8) سجل نشاطات إدارة الحسابات (إضافة/حذف/تعديل)
insert into public.audit_logs (org_id, user_name, action, detail, local_id)
select o.id, 'system', 'sys_upgrade',
       'تفعيل ميزة إدارة الحسابات الفرعية للشركات (ترقية 17)',
       coalesce((select max(local_id) + 1 from public.audit_logs where org_id = o.id), 1)
from public.organizations o
where exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
limit 1;

-- 9) mizan_admin_members: إضافة عمود الصلاحيات (features) لكل حساب حتى يراها المالك
drop function if exists public.mizan_admin_members(uuid);
create or replace function public.mizan_admin_members(p_org_id uuid)
returns table (
  user_id uuid,
  username text,
  full_name text,
  role text,
  blocked boolean,
  features jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id,
         split_part(au.email, '@', 1),
         p.full_name,
         p.role,
         p.blocked,
         coalesce(p.features, '{}'::jsonb),
         p.created_at
  from public.profiles p
  join auth.users au on au.id = p.id
  where p.org_id = p_org_id
  and exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by p.created_at;
$$;

grant execute on function public.mizan_admin_members(uuid) to authenticated;