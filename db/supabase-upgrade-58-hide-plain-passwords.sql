-- ترقية ٥٨ — «إخفاء كلمات المرور الصريحة نهائيًا» (بند المراجعة #17).
-- المرجع: بند #17 في مراجعة المالك ("إخفاء password_plain")، والملاحظة المسجّلة في app.js
-- (DEPLOY_DB_FILES): «العمود password_plain لسه موجود … شيله نهائيًا = ترقية ٥٨ بأمر المالك».
--
-- المشكلة (مقاسة على القاعدة الحيّة 19/10):
--   • public.mizan_pw_store.plain_password  — ٥ صفوف بكلمات مرور **صريحة** حقيقية
--     (منها كلمة مرور المالك نفسه) + دالة قراءة mizan_admin_get_password(uuid).
--   • public.mizan_created_accounts.password_plain — عمود فارغ (٠ صف) بتكتبه
--     mizan_log_created_account.
--   • ٨ دوال بتكتب/تقرأ الصريح: change_my_password · admin_reset_password ·
--     org_reset_member_password · org_add_member · admin_create_org · log_created_account ·
--     admin_pw_store · admin_get_password.
--
-- اللي بتعمله:
--   (١) إعادة تعريف الدوال الستة اللي **بتكتب** الصريح — بلا أي حفظ لكلمة المرور
--       (كلمة المرور بتتخزّن مجزّأة في auth.users بس).
--   (٢) حذف mizan_admin_get_password(uuid) (كانت بترجّع الصريح للمالك).
--   (٣) إعادة تعريف mizan_admin_pw_store() بلا عمود كلمة المرور (بتفضل ترجّع
--       الحساب/الشركة/آخر تحديث عشان شاشة المالك).
--   (٤) حذف العمودين: mizan_pw_store.plain_password و mizan_created_accounts.password_plain
--       ⇒ **الـ٥ كلمات الصريحة تتشال من القاعدة نهائيًا**.
--   (٥) فحص ذاتي في الآخر.
--
-- ⚠️ لا تُشغّل قبل أمر المالك الصريح. بلا `begin/commit` (نمط ٦٢/٦٣/٥٥/٥٤).
-- 🔁 بعد التنفيذ: إعادة تعيين كلمة أي حساب = زر «🔑 إعادة تعيين» (مش قراءة الكلمة).

-- ============================================================
-- (١) الدوال اللي كانت بتحفظ الصريح — نسخة بلا حفظ
-- ============================================================
CREATE OR REPLACE FUNCTION public.mizan_change_my_password(p_old_password text, p_new_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_pf record;
begin
  if v_uid is null then raise exception 'لا توجد جلسة'; end if;
  if nullif(trim(coalesce(p_new_password,'')), '') is null then
    raise exception 'كلمة المرور الجديدة مطلوبة';
  end if;
  if length(trim(p_new_password)) < 6 then
    raise exception 'كلمة المرور لازم 6 حروف على الأقل';
  end if;

  -- التحقق من الكلمة الحالية اختياري: لو تُركت فارغة نتخطاها
  if p_old_password is not null and trim(p_old_password) <> '' then
    select encrypted_password into v_hash from auth.users where id = v_uid;
    if v_hash is null or v_hash <> extensions.crypt(p_old_password, v_hash) then
      raise exception 'كلمة المرور الحالية غير صحيحة';
    end if;
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_uid;

  -- ترقية ٥٨: مفيش حفظ للنسخة الصريحة (الكلمة مجزّأة في auth.users بس)

  select p.org_id, o.name into v_pf
  from public.profiles p left join public.organizations o on o.id = p.org_id
  where p.id = v_uid;

  insert into public.password_changes (user_id, username, org_id, org_name, changed_at)
  values (v_uid, split_part(coalesce((select email from auth.users where id = v_uid),''), '@', 1),
          v_pf.org_id, v_pf.name, now());
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.mizan_admin_reset_password(p_user_id uuid, p_new_password text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_org_id uuid;
  v_org_name text;
begin
  if auth.uid() is null then raise exception 'غير مصرح'; end if;

  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;

  if nullif(trim(coalesce(p_new_password,'')), '') is null then
    raise exception 'كلمة المرور فارغة';
  end if;

  if length(trim(p_new_password)) < 6 then
    raise exception 'كلمة المرور لازم 6 حروف على الأقل';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then raise exception 'المستخدم غير موجود'; end if;

  -- ✅ الهدف هو المتصل نفسه → تغيير ذاتي آمن (بدون مسح الجلسات)
  if p_user_id = auth.uid() then
    perform public.mizan_change_my_password(null, trim(p_new_password));
    return v_email;
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;

  -- ترقية ٥٨: مفيش حفظ للنسخة الصريحة

  -- إنهاء جلسات الهدف (الهدف غير المتصل — لا نمسح جلسة المتصل أبدًا)
  delete from auth.sessions where user_id = p_user_id;

  select p.org_id, o.name into v_org_id, v_org_name
  from public.profiles p left join public.organizations o on o.id = p.org_id
  where p.id = p_user_id;

  insert into public.password_changes (user_id, username, org_id, org_name, changed_at)
  values (p_user_id, split_part(v_email, '@', 1), v_org_id, v_org_name, now());

  return v_email;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mizan_org_reset_member_password(p_user_id uuid, p_new_password text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caller_org uuid;
  v_is_super   boolean;
  v_caller_role text;
  v_blocked    boolean;
  v_target_org uuid;
  v_email      text;
begin
  if auth.uid() is null then raise exception 'غير مصرح'; end if;
  if nullif(trim(coalesce(p_new_password,'')), '') is null then
    raise exception 'كلمة المرور فارغة';
  end if;
  if length(trim(p_new_password)) < 6 then
    raise exception 'كلمة المرور لازم 6 حروف على الأقل';
  end if;

  select p.org_id, coalesce(p.is_superadmin, false), coalesce(p.role, ''), coalesce(p.blocked, false)
    into v_caller_org, v_is_super, v_caller_role, v_blocked
  from public.profiles p
  where p.id = auth.uid();

  if v_caller_org is null and not v_is_super then
    raise exception 'غير مصرح';
  end if;
  if coalesce(v_blocked, false) then raise exception 'حسابك محظور'; end if;

  select pr.org_id, u.email into v_target_org, v_email
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where pr.id = p_user_id;

  if v_email is null then raise exception 'الحساب غير موجود'; end if;

  if not v_is_super and v_target_org is distinct from v_caller_org then
    raise exception 'لا يمكنك تغيير كلمة مرور حساب من شركة أخرى';
  end if;

  -- حماية جديدة: تغيير باسورد حساب آخر = مدير الشركة فقط
  if p_user_id <> auth.uid()
     and not (v_is_super or (v_target_org = v_caller_org and v_caller_role = 'admin')) then
    raise exception 'غير مصرح: فقط مدير الشركة أو المالك يمكنه تغيير كلمة مرور حساب آخر';
  end if;

  if p_user_id = auth.uid() then
    perform public.mizan_change_my_password(null, trim(p_new_password));
    return v_email;
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;

  -- ترقية ٥٨: مفيش حفظ للنسخة الصريحة

  -- إنهاء جلسات الحساب حتى لا يبقى أحد داخل بالكلمة القديمة
  delete from auth.sessions where user_id = p_user_id;

  insert into public.password_changes (user_id, username, org_id, org_name, changed_at)
  select p_user_id, split_part(v_email, '@', 1), v_target_org, o.name, now()
  from public.organizations o where o.id = v_target_org;

  return v_email;
end $function$;

CREATE OR REPLACE FUNCTION public.mizan_org_add_member(p_username text, p_password text, p_full_name text DEFAULT NULL::text, p_role text DEFAULT 'member'::text, p_features jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid;
  v_email text;
  v_max int;
  v_count bigint;
  v_org uuid;
  v_org_name text;
  v_is_admin boolean;
  v_is_super boolean;
  v_blocked boolean;
begin
  select org_id, (role = 'admin'), is_superadmin, name, coalesce(blocked, false)
    into v_org, v_is_admin, v_is_super, v_org_name, v_blocked
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid();
  if v_org is null then raise exception 'لا يوجد حساب مرتبط بشركة'; end if;
  if v_blocked then raise exception 'حسابك محظور'; end if;
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

  -- ترقية ٥٨: مفيش حفظ لكلمة المرور الصريحة

  insert into public.audit_logs (org_id, user_name, action, detail, local_id)
  values (v_org, split_part(auth.email(), '@', 1), 'add_member',
          'إضافة حساب "' || split_part(v_email, '@', 1) || '" ضمن شركة "' || v_org_name || '"',
          coalesce((select max(local_id) + 1 from public.audit_logs where org_id = v_org), 1));

  return v_uid;
end $function$;

CREATE OR REPLACE FUNCTION public.mizan_admin_create_org(p_org_name text, p_admin_username text, p_admin_password text, p_max_members integer DEFAULT 5)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid;
  v_uid uuid;
  v_email text;
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_superadmin is true) then
    raise exception 'غير مصرح: المالك العام فقط';
  end if;
  if nullif(trim(coalesce(p_org_name,'')), '') is null then
    raise exception 'اسم الشركة مطلوب';
  end if;
  if nullif(trim(coalesce(p_admin_username,'')), '') is null or nullif(coalesce(p_admin_password,''),'') is null then
    raise exception 'بيانات مدير الشركة مطلوبة';
  end if;

  insert into public.organizations (name, max_members, owner_id)
  values (trim(p_org_name), coalesce(p_max_members, 5), auth.uid())
  returning id into v_org;

  v_uid := gen_random_uuid();
  v_email := lower(regexp_replace(trim(p_admin_username), '[^a-z0-9._-]', '', 'g')) || '@mizan.app';
  if v_email = '@mizan.app' then
    raise exception 'اسم المستخدم يجب أن يحتوي حروفًا إنجليزية أو أرقامًا';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'اسم المستخدم محجوز بالفعل';
  end if;

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

  -- ترقية ٥٨: مفيش حفظ لكلمة المرور الصريحة

  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'group', NULL, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '1.1.2', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '1.1.4', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 23, '1.1.7', 'شيكات لدى العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '2', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '2.1', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '2.1.1', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '2.1.2', 'ضريبة القيمة المضافة المحصلة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '2.1.3', 'ضريبة القيمة المضافة المدفوعة', 'liability', NULL, 0, 0, true),
    (v_org, 14, '3', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 15, '3.1', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 16, '3.2', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 17, '4', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 18, '4.1', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '4.2', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 20, '5', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 21, '5.1', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 22, '5.2', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  insert into public.treasury (org_id, local_id, name, type, account_no, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', NULL, 0, 0, true),
    (v_org, 2, 'المحفظة', 'wallet', '000000', 0, 0, true),
    (v_org, 3, 'إنستا باي', 'instapay', NULL, 0, 0, true);

  return v_org;
end $function$;

-- سجل «الحسابات المُنشأة»: بلا كلمة مرور (الباراميتر p_password محفوظ للتوافق مع العميل ومُهمَل)
CREATE OR REPLACE FUNCTION public.mizan_log_created_account(p_org_id uuid, p_username text, p_password text, p_full_name text DEFAULT NULL::text, p_features jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org_name text;
  v_owner    uuid;
  v_email    text;
  v_uid      uuid;
  v_id       bigint;
begin
  if auth.uid() is null then raise exception 'غير مصرح'; end if;
  if nullif(trim(p_username), '') is null or nullif(p_password, '') is null then
    raise exception 'بيانات ناقصة';
  end if;

  select o.name, o.owner_id into v_org_name, v_owner
  from public.organizations o
  where o.id = p_org_id;

  if v_owner is null then raise exception 'الشركة غير موجودة'; end if;

  -- المسموح: صاحب الشركة نفسها، أو المالك العام
  if v_owner <> auth.uid() then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_superadmin is true
    ) then
      raise exception 'غير مصرح';
    end if;
  end if;

  -- استنتاج إيميل الحساب الحقيقي (نفس نمط إنشاء الحساب) والتحقق من وجوده
  v_email := lower(regexp_replace(trim(p_username), '[^a-z0-9._-]', '', 'g')) || '@mizan.app';
  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  if v_uid is null then
    raise exception 'الحساب غير موجود في القاعدة';
  end if;

  insert into public.mizan_created_accounts
    (org_id, org_name, username, full_name, features, created_by, user_id)
  values
    (p_org_id, v_org_name, trim(p_username),
     nullif(trim(coalesce(p_full_name, '')), ''), coalesce(p_features, '{}'::jsonb), auth.uid(), v_uid)
  returning id into v_id;

  return v_id;
end $function$;

-- ============================================================
-- (٢) حذف دالة قراءة كلمة المرور الصريحة
-- ============================================================
drop function if exists public.mizan_admin_get_password(uuid);

-- ============================================================
-- (٣) شاشة «كلمات المرور الحالية» — بلا كلمة مرور (الحساب/الشركة/آخر تحديث فقط)
-- ============================================================
drop function if exists public.mizan_admin_pw_store();
CREATE FUNCTION public.mizan_admin_pw_store()
 RETURNS TABLE(user_id uuid, username text, email text, org_name text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'غير مصرح'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'هذا الإجراء للمالك العام فقط';
  end if;

  return query
  select s.user_id,
         split_part(u.email, '@', 1)::text,
         u.email::text,
         o.name::text,
         s.updated_at::timestamptz
  from public.mizan_pw_store s
  join auth.users u on u.id = s.user_id
  left join public.profiles p on p.id = s.user_id
  left join public.organizations o on o.id = p.org_id
  order by o.name nulls last, s.user_id;
end $function$;

revoke all on function public.mizan_admin_pw_store() from public;
revoke all on function public.mizan_admin_pw_store() from anon;
grant execute on function public.mizan_admin_pw_store() to authenticated, service_role;

-- ============================================================
-- (٤) حذف العمودين الصريحين (الكلمات الخمس تتشال من القاعدة)
-- ============================================================
alter table public.mizan_pw_store drop column if exists plain_password;
alter table public.mizan_created_accounts drop column if exists password_plain;

comment on table public.mizan_pw_store is 'آخر وقت تغيير كلمة مرور لكل حساب — **بلا كلمة مرور** بعد ترقية ٥٨ (الكلمة مجزّأة في auth.users فقط).';

-- ============================================================
-- (٥) فحص ذاتي
-- ============================================================
do $chk$
declare
  n_col_pw  int;
  n_col_ca  int;
  n_fn_read int;
  n_src     int;
  v_ok      int;
begin
  select count(*) into n_col_pw
    from information_schema.columns
   where table_schema='public' and table_name='mizan_pw_store' and column_name='plain_password';
  if n_col_pw <> 0 then
    raise exception 'ترحيل ٥٨ فشل: العمود plain_password لسه موجود.';
  end if;

  select count(*) into n_col_ca
    from information_schema.columns
   where table_schema='public' and table_name='mizan_created_accounts' and column_name='password_plain';
  if n_col_ca <> 0 then
    raise exception 'ترحيل ٥٨ فشل: العمود password_plain لسه موجود.';
  end if;

  select count(*) into n_fn_read
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='mizan_admin_get_password';
  if n_fn_read <> 0 then
    raise exception 'ترحيل ٥٨ فشل: دالة mizan_admin_get_password لسه موجودة.';
  end if;

  select count(*) into n_src
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and (p.prosrc ilike '%plain_password%' or p.prosrc ilike '%password_plain%');
  if n_src <> 0 then
    raise exception 'ترحيل ٥٨ فشل: % دالة لسه بتلمس كلمة مرور صريحة.', n_src;
  end if;

  select count(*) into v_ok
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in (
     'mizan_change_my_password','mizan_admin_reset_password','mizan_org_reset_member_password',
     'mizan_org_add_member','mizan_admin_create_org','mizan_log_created_account','mizan_admin_pw_store')
     and p.prosecdef is true;
  if v_ok <> 7 then
    raise exception 'ترحيل ٥٨ فشل: الدوال المُعاد تعريفها = % (المتوقع ٧ كلها SECURITY DEFINER).', v_ok;
  end if;

  raise notice 'ترحيل ٥٨ تمام: صفر كلمات مرور صريحة في القاعدة، والدوال السبعة معرّفة بلا تخزين.';
end
$chk$;
