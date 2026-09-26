-- ==============================================================
-- ترقية 6: عرض اليوزر نيم (شركة + أعضاء) + تعديل بيانات الشركة
-- من لوحة المالك: الضغط المزدوج على الشركة يفتح شاشة بياناتها
-- ==============================================================

-- 1) mizan_admin_orgs: إضافة admin_username (يوزر نيم حساب الشركة)
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
  max_members int,
  admin_username text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select o.id, o.name, o.plan_start, o.plan_end, o.plan_status, o.locked,
         (select p.full_name from public.profiles p where p.org_id = o.id and p.role = 'admin' limit 1),
         (select count(*) from public.profiles p where p.org_id = o.id),
         o.max_members,
         (select split_part(au.email, '@', 1)
          from public.profiles p2
          join auth.users au on au.id = p2.id
          where p2.org_id = o.id and p2.role = 'admin'
          limit 1)
  from public.organizations o
  where exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by o.created_at desc;
$$;

-- 2) mizan_admin_members: إضافة username (يوزر نيم كل عضو داخل الشركة)
drop function if exists public.mizan_admin_members(uuid);
create or replace function public.mizan_admin_members(p_org_id uuid)
returns table (
  user_id uuid,
  username text,
  full_name text,
  role text,
  blocked boolean,
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
         p.created_at
  from public.profiles p
  join auth.users au on au.id = p.id
  where p.org_id = p_org_id
  and exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by p.created_at;
$$;

-- 3) تعديل بيانات الشركة (الاسم + عدد الأعضاء الأقصى)
drop function if exists public.mizan_admin_edit_org(uuid, text, int);
create or replace function public.mizan_admin_edit_org(
  p_org_id uuid,
  p_org_name text,
  p_max_members int
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'الشركة غير موجودة';
  end if;
  update public.organizations set
    name = coalesce(nullif(trim(p_org_name), ''), name),
    max_members = coalesce(p_max_members, max_members)
  where id = p_org_id;
end $$;

-- 4) تغيير يوزر نيم المستخدم (الإيميل) — يستخدمه المالك عند الحاجة
drop function if exists public.mizan_admin_set_username(uuid, text);
create or replace function public.mizan_admin_set_username(p_user_id uuid, p_username text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_new_email text;
  v_old_email text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if nullif(trim(p_username), '') is null then raise exception 'اليوزر نيم فارغ'; end if;
  select email into v_old_email from auth.users where id = p_user_id;
  if v_old_email is null then raise exception 'المستخدم غير موجود'; end if;
  v_new_email := lower(regexp_replace(trim(p_username), '[^a-z0-9._-]', '', 'g')) || '@mizan.app';
  if v_new_email = v_old_email then return v_old_email; end if;
  if exists (select 1 from auth.users where lower(email) = v_new_email) then
    raise exception 'اليوزر نيم محجوز بالفعل';
  end if;
  update auth.users set email = v_new_email, updated_at = now() where id = p_user_id;
  update auth.identities set
    provider_id = v_new_email,
    identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new_email))
  where user_id = p_user_id and provider = 'email';
  update auth.users set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{email}', to_jsonb(v_new_email)) where id = p_user_id;
  -- تحديث الاسم المعروض إن كان يطابق القديم
  update public.profiles set full_name = split_part(v_new_email, '@', 1)
  where id = p_user_id and (full_name is null or full_name = split_part(v_old_email, '@', 1));
  return v_new_email;
end $$;

grant execute on function public.mizan_admin_orgs() to authenticated;
grant execute on function public.mizan_admin_members(uuid) to authenticated;
grant execute on function public.mizan_admin_edit_org(uuid, text, int) to authenticated;
grant execute on function public.mizan_admin_set_username(uuid, text) to authenticated;