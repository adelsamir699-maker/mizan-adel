-- ترقية ٦٠ — منع مدير الشركة من تعديل صلاحيات حسابه بنفسه
--
-- ترقية ٥٩ محفوظة كما نُفذت على القاعدة الحية. هذا التعديل التكميلي يضيف
-- شرط old.id <> v_uid لصلاحيات features فقط، مع إبقاء إدارة أعضاء الشركة.
-- نُفذت على Supabase في 18/10/2026 بعد نسخة وdry-run موثقين.
-- backup: pre-mig60-20261018-2052؛ 36 جدولًا/2,380 صفًا، و37 artifact hash متحققة.
-- profiles SHA-256 قبل/بعد التنفيذ وبعد اختبارات السلوك:
-- a780e1e24f69952c7a2eefb4661ca6e569c0099ce3b32061b6ce5f087454893b.
-- dry-run وما بعد التنفيذ: رفض تعديل features للنفس للمدير والعضو (P0001)،
-- والسماح للمدير بتعديل عضو آخر؛ اختبارات السلوك انتهت بـ ROLLBACK.

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
       and old.id <> v_uid
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

do $$
declare
  v_def text := pg_get_functiondef('public.protect_profile_security_fields()'::regprocedure);
  v_features_start integer;
  v_role_start integer;
begin
  v_features_start := strpos(v_def, 'new.features is distinct from old.features');
  v_role_start := strpos(v_def, 'new.role is distinct from old.role');
  if v_features_start = 0 or v_role_start <= v_features_start
     or strpos(substr(v_def, v_features_start, v_role_start - v_features_start), 'old.id <> v_uid') = 0 then
    raise exception 'ترقية ٦٠: حارس self-update لصلاحيات profiles غير موجود';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_protect_security_fields'
      and not tgisinternal
  ) then
    raise exception 'ترقية ٦٠: حارس تحديث profiles غير مربوط';
  end if;
end $$;

commit;
