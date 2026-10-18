-- ترقية ٥٩ — حماية دور وهوية أعضاء الشركات
--
-- تمنع المستخدم العادي من تعديل role / is_superadmin / org_id مباشرةً عبر
-- profiles، وتحصر تحديث الملف في صاحبه أو مدير الشركة/مالك البرنامج.
-- مدير الشركة يظل قادرًا على تعديل دور عضو آخر في شركته؛ دوال الإدارة
-- SECURITY DEFINER الحالية (الميزات/الحظر/إضافة الحساب) تظل كما هي.
--
-- الترقية ٥٨ محجوزة لإزالة password_plain. هذه الترقية مستقلة ولا تغيّر نطاقها.
-- اتنفّذت على Supabase 18/10/2026 بعد نسخة موثّقة وأمر المالك الصريح بالنشر.
-- pre-publish193-20261018-202117: 36 جدول بيانات / 2,380 سطرًا + مخطط، وتم التحقق من الهاشات.
-- dry-run داخل معاملة ثم ROLLBACK: منع التصعيد والنقل وتعديل عضو آخر، مع نجاح مسارات ميزات
-- مدير الشركة والمالك؛ بعد COMMIT: الحارس والسياسة موجودان، وبيانات profiles قبل=بعد.

begin;

alter table public.profiles
  add column if not exists features jsonb default '{}'::jsonb;

create or replace function public.can_manage_org_profiles()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and (actor.is_superadmin is true or actor.role = 'admin')
  )
$$;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_super boolean;
begin
  if new.org_id is not distinct from old.org_id
     and new.role is not distinct from old.role
     and new.is_superadmin is not distinct from old.is_superadmin
     and new.blocked is not distinct from old.blocked
     and new.is_active is not distinct from old.is_active
     and new.features is not distinct from old.features then
    return new;
  end if;

  if v_uid is null then return new; end if;

  select org_id, role, is_superadmin
    into v_org, v_role, v_super
    from public.profiles
    where id = v_uid;

  if coalesce(v_super, false) then return new; end if;

  if new.org_id is distinct from old.org_id
     or new.is_superadmin is distinct from old.is_superadmin then
    raise exception 'غير مصرح بتغيير شركة الحساب أو صفة مالك البرنامج';
  end if;

  if new.blocked is distinct from old.blocked
     and not (
       v_role = 'admin'
       and v_org = old.org_id
       and old.id <> v_uid
       and old.is_superadmin is not true
     ) then
    raise exception 'غير مصرح بتغيير حالة هذا الحساب';
  end if;

  if new.is_active is distinct from old.is_active
     and not (
       v_role = 'admin'
       and v_org = old.org_id
       and old.id <> v_uid
       and old.is_superadmin is not true
     ) then
    raise exception 'غير مصرح بتغيير حالة هذا الحساب';
  end if;

  if new.features is distinct from old.features
     and not (
       v_role = 'admin'
       and v_org = old.org_id
       and old.is_superadmin is not true
     ) then
    raise exception 'غير مصرح بتغيير صلاحيات هذا الحساب';
  end if;

  if new.role is distinct from old.role
     and not (
       v_role = 'admin'
       and v_org = old.org_id
       and old.id <> v_uid
       and old.is_superadmin is not true
     ) then
    raise exception 'غير مصرح بتغيير دور هذا الحساب';
  end if;

  return new;
end $$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

drop policy if exists prof_update on public.profiles;
create policy prof_update on public.profiles
  for update
  using (org_id = public.current_org() and (id = auth.uid() or public.can_manage_org_profiles()))
  with check (org_id = public.current_org() and (id = auth.uid() or public.can_manage_org_profiles()));

revoke all on function public.can_manage_org_profiles() from public, anon;
grant execute on function public.can_manage_org_profiles() to authenticated;
revoke all on function public.protect_profile_security_fields() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_protect_security_fields'
      and not tgisinternal
  ) then
    raise exception 'ترقية ٥٩: حارس هوية profiles غير موجود';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'prof_update'
      and qual like '%can_manage_org_profiles%'
      and with_check like '%can_manage_org_profiles%'
  ) then
    raise exception 'ترقية ٥٩: سياسة تحديث profiles غير محمية';
  end if;
end $$;

commit;
