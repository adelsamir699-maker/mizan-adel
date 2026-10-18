-- تراجع ترقية ٦٠ — يعيد دالة ترقية ٥٩ كما كانت قبل التصحيح.
-- لا يُنفذ إلا بأمر صريح وبعد نسخة احتياطية جديدة.

begin;

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

commit;
