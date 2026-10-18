-- ============================================================================
-- ترحيل ٥٧ — تحصين أمني للقاعدة  [بناء 189]
-- ----------------------------------------------------------------------------
-- النسخة القانونية في db-admin (سجل قاعدة البيانات) — والنسخة الحرفية داخل حزمة
-- النشر في mizan-web/db/supabase-upgrade-57-security-hardening.sql.
--
-- بيغلق ٣ فتحات اتقاسوا على القاعدة الحيّة (قراءة فقط):
--
-- (١) أسعار الباقات — مفتوحة لأي حساب:
--     جدول subs_plans_cfg كان **RLS مطفأ** + منح كامل لـ authenticated
--     (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) ⇒ أي مستخدم مسجَّل من أي شركة
--     يقدر يقرأ/يغيّر/يمسح أسعار الباقات مباشرة. وكمان الدالة
--     mizan_set_subs_plans(jsonb) كانت SECURITY DEFINER **بلا أي فحص صلاحية**
--     ⇒ أي حساب يقدر يغيّر الأسعار من غير ما يكون المالك.
--     الحل: تشغيل RLS على الجدول (وبلا سياسات ⇒ المنع الافتراضي)، وسحب كل المنح
--     من anon/authenticated/public (الدوال SECURITY DEFINER مالكها postgres
--     فبتتخطى RLS وتفضل شغّالة)، وإضافة حارس is_superadmin على دالة الحفظ.
--
-- (٢) عدّادات الترقيم التلقائي — مفتوحة:
--     mizan_created_accounts_id_seq و password_changes_id_seq كانوا ممنوحين
--     anon/authenticated (SELECT/UPDATE/USAGE) ⇒ أي حساب يقدر يزوّد/يعدّل العدّاد.
--     الحل: سحب المنح (الإدراج كله بيمر بدوال SECURITY DEFINER مالكها postgres
--     فمش محتاج منح للمستخدمين).
--
-- (٣) سجل الحسابات المُنشأة — لقطة غير مربوطة بحساب حقيقي:
--     mizan_created_accounts كان بيسجّل اليوزرنيم/الباسورد نصًّا **بلا** أي ربط
--     أو تحقق إن الحساب موجود فعلًا في auth.users (السجل مجرد لقطة).
--     الحل: عمود user_id (مرجع auth.users) + إعادة تعريف دالة التسجيل بحيث
--     تستنتج الإيميل من اليوزرنيم (نفس نمط mizan_org_add_member:
--     lower(regexp_replace(user,'[^a-z0-9._-]','','g'))||'@mizan.app') وتدوّر
--     على الحساب الحقيقي؛ **لو مش موجود ترفض** ⇒ مفيش لقطة وهمية تاني.
--
-- ⚠️ آمن للتكرار (if not exists / create or replace). لا يمسّ أي بيان قائم
--    (عمود user_id بيفضل NULL للسطور القديمة لحد ما يتربط).
--
-- ----------------------------------------------------------------------------
-- ✅ الحالة: كُتب — يُنفَّذ على السحابة بأمر المالك الصريح فقط.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (١) أسعار الباقات
-- ---------------------------------------------------------------------------
alter table public.subs_plans_cfg enable row level security;
revoke all on public.subs_plans_cfg from public, anon, authenticated;
comment on table public.subs_plans_cfg is
  'أسعار الباقات الافتراضية (بناء 189) — RLS مفعّل وبلا سياسات: يتقرأ/يتعدّل عبر دوال SECURITY DEFINER فقط';

create or replace function public.mizan_set_subs_plans(p_plans jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_superadmin is true
  ) then
    raise exception 'غير مصرح';
  end if;
  if p_plans is null then
    raise exception 'بيانات ناقصة';
  end if;
  update public.subs_plans_cfg set plans = p_plans where id = 1;
end $function$;

revoke all on function public.mizan_set_subs_plans(jsonb) from public, anon;
grant execute on function public.mizan_set_subs_plans(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- (٢) عدّادات الترقيم التلقائي
-- ---------------------------------------------------------------------------
revoke all on sequence public.mizan_created_accounts_id_seq from public, anon, authenticated;
revoke all on sequence public.password_changes_id_seq        from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (٣) سجل الحسابات المُنشأة — ربط بحساب حقيقي + تحقق إلزامي
-- ---------------------------------------------------------------------------
alter table public.mizan_created_accounts
  add column if not exists user_id uuid references auth.users(id) on delete set null;

comment on column public.mizan_created_accounts.user_id is
  'رقم الحساب الحقيقي في auth.users (بناء 189) — يثبت إن السجل مربوط بحساب موجود';

create or replace function public.mizan_log_created_account(
  p_org_id uuid,
  p_username text,
  p_password text,
  p_full_name text default null,
  p_features jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
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
    (org_id, org_name, username, password_plain, full_name, features, created_by, user_id)
  values
    (p_org_id, v_org_name, trim(p_username), p_password,
     nullif(trim(coalesce(p_full_name, '')), ''), coalesce(p_features, '{}'::jsonb), auth.uid(), v_uid)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.mizan_log_created_account(uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.mizan_log_created_account(uuid,text,text,text,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- فحص ذاتي: كل التحصينات اتطبّقت — وإلا فشل ظاهر
-- ---------------------------------------------------------------------------
do $$
declare
  v_rls   boolean;
  v_priv  int;
  v_grant int;
  v_col   int;
  v_guard boolean;
begin
  -- (١) RLS على subs_plans_cfg + صفر منح لـ authenticated
  select relrowsecurity into v_rls from pg_class where oid = 'public.subs_plans_cfg'::regclass;
  if v_rls is not true then
    raise exception 'ترحيل ٥٧ فشل: RLS مش مفعّل على subs_plans_cfg';
  end if;
  select count(*) into v_priv from information_schema.role_table_grants
   where table_schema='public' and table_name='subs_plans_cfg' and grantee in ('anon','authenticated');
  if v_priv <> 0 then
    raise exception 'ترحيل ٥٧ فشل: لسه فيه % منح على subs_plans_cfg', v_priv;
  end if;

  -- (٢) الدوال/الجداول الحسّاسة: صفر منح لـ anon/authenticated
  select count(*) into v_grant from information_schema.role_table_grants
   where table_schema='public' and table_name in ('mizan_created_accounts') and grantee in ('anon','authenticated');
  if v_grant <> 0 then
    raise exception 'ترحيل ٥٧ فشل: mizan_created_accounts لسه ممنوح';
  end if;

  -- (٣) عمود user_id + حارس is_superadmin جوه دالة الحفظ
  select count(*) into v_col from information_schema.columns
   where table_schema='public' and table_name='mizan_created_accounts' and column_name='user_id';
  if v_col <> 1 then
    raise exception 'ترحيل ٥٧ فشل: عمود user_id مش موجود';
  end if;
  select (position('is_superadmin' in pg_get_functiondef(p.oid)) > 0) into v_guard
    from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='mizan_set_subs_plans';
  if v_guard is not true then
    raise exception 'ترحيل ٥٧ فشل: مفيش حارس is_superadmin على mizan_set_subs_plans';
  end if;

  raise notice 'ترحيل ٥٧: (١) أسعار مقيّدة (٢) عدّادات مسحوبة (٣) سجل الحسابات مربوط بـauth.users ✓';
end $$;

-- ---------------------------------------------------------------------------
-- عرض تنويري
-- ---------------------------------------------------------------------------
select c.relname, c.relrowsecurity as rls
  from pg_class c where c.oid = 'public.subs_plans_cfg'::regclass;
