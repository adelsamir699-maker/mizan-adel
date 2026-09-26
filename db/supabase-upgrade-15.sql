-- ==============================================================
-- ترقية 15: حذف عضو واحد + فك الحجز بعد الحذف
--  1) mizan_admin_create_user: رفض الأسماء العربية بوضوح (حتى لا تتحول لإيميل فارغ = "محجوز")
--  2) mizan_admin_delete_member(uuid): حذف عضو واحد نهائيًا من قاعدة الدخول
--     (identities ثم sessions ثم auth.users) ليُعاد استخدام الاسم بعده
-- ==============================================================

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
  if v_email = '@mizan.app' then
    raise exception 'اسم المستخدم يجب أن يحتوي حروفًا إنجليزية أو أرقامًا (بدون مسافات أو رموز)';
  end if;
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

grant execute on function public.mizan_admin_create_user(uuid, text, text, text, text) to authenticated;

-- حذف عضو واحد نهائيًا (يتحرر اسمه بعد الحذف)
drop function if exists public.mizan_admin_delete_member(uuid);
create or replace function public.mizan_admin_delete_member(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_is_super boolean;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if p_user_id is null then raise exception 'لم يتم تحديد العضو'; end if;

  select org_id, is_superadmin into v_org_id, v_is_super
  from public.profiles where id = p_user_id;
  if v_org_id is null then raise exception 'العضو غير موجود'; end if;
  if v_is_super is true or p_user_id = auth.uid() then
    raise exception 'لا يمكن حذف هذا الحساب (حساب رئيسي أو الحساب الحالي)';
  end if;

  select name into v_org_name from public.organizations where id = v_org_id;

  delete from public.presence where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;
  begin
    delete from auth.identities where user_id = p_user_id;
    delete from auth.sessions where user_id = p_user_id;
    delete from auth.users where id = p_user_id;
  exception when others then
    null;
  end;

  return 'deleted|' || coalesce(v_org_name, '');
end $$;

grant execute on function public.mizan_admin_delete_member(uuid) to authenticated;