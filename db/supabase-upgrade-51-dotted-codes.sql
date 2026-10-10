-- ترقية ٥١ — توحيد أكواد شجرة الحسابات على الشكل المنقّط (1.1.1 … 5.2)
--
-- 🟢 **نُفّذت على السحابة 10/10 ≈18:32** بأمر المالك الحرفي («طيب وحد النقط دلوقت» + «نفّذ...») —
--    أكواد 147 حسابًا في الشركات الـ7 تحوّلت للشكل المنقّط، و`create_org_and_profile` و
--    `mizan_admin_create_org` بقيا ببذرة منقّطة. الأداة: MIZAN_ORDER_51="نفّذ"
--    node D:/_work/temp/apply_upgrade_51.js (معاملة واحدة + باك أب قبل/بعد).
--    ⛔ ممنوع إعادة تشغيلها كما هي (بوابات «قبل» بقت فشلًا متعمّدًا) — الملف هنا للسجل.
--
-- المشكلة (قياس 10/10 من لقطات حية):
--   شركة «ميزان» (المالكة) شجرتها منقّطة قرآنية (1 => الأصول، 2 => الالتزامات، 3 => حقوق الملكية،
--   4 => الإيرادات، 5 => المصروفات، وأولادها 1.1 / 1.1.1 …) ⇒ الواجهة بتشتغل على الشكل ده.
--   الشركات السبع التانية (كل واحدة 21 حسابًا ببذرة ترقية ٤٤) أكوادها **مجدّرة** (11 / 111 / 13 / 2 …)
--   ⇒ لازم تترجَّم للشكل المثالي عشان الشجرة/كشوف الحسابات هي شكل واحد في كل الشركات.
--
-- اللي بتعمله الترقية (بيانات + دالّتين تغيير أكواد فقط، مافيش جدول/عمود/فهرس/سياسة):
--   ١) تحويل أكواد حسابات الشركات الـ7 (غير المالكة) للشكل المنقّط بنفس خريطة الإسناد
--      (بالاسم/الترتيب — ميزان أسماءها في نفس ترتيب بذرة ٤٤ الحالي):
--       1 → 1 · 11 → 1.1 · 111 → 1.1.1 · 112 → 1.1.2 · 113 → 1.1.3 · 114 → 1.1.4 ·
--       115 → 1.1.5 · 12 → 1.3 · 13 → 2 · 131 → 2.1 · 132 → 2.1.1 · 133 → 2.1.2 ·
--       14 → 3 · 141 → 3.1 · 142 → 3.2 · 2 → 4 · 21 → 4.1 · 22 → 4.2 · 3 → 5 ·
--       31 → 5.1 · 32 → 5.2
--      (لا نلمس الأسماء/الأنواع/الآباء/الأرصدة — الكود هو حامل الشجرة في الواجهة).
--   ٢) create_org_and_profile بهذه البذرة المنقّطة ⇒ أي شركة جديدة من بوابة الدعوة زي الموجودات.
--   ٣) mizan_admin_create_org بنفس البذرة المنقّطة ⇒ شركة الأدمن الجديدة زي الموجودات.
--
-- اللي **مابيتلمسش**: شركة «ميزان والشجرة (المالكة — عادل/ميزان هما المالكين للبرنامج) ·
--   أي بيانات (مفيش ترغجرز على accounts ولا audit كتابي · journal_lines بتحفظ account_id + اسم —
--   النقط بتتغير في الكود، والاسم سايب ⇒ مفيش مراجع قديمة) · دوال الاستعادة (المفروض ترجّع الأكواد
--   من النسخة) · السياسات/المنح · عدد الأسطر (173 حسابًا قبل = بعد).
--
-- البوابات (أي فشل = استثناء = ROLLBACK كامل):
--   · كل شركة غير «ميزان😉 لازم 21 حسابًا بأكوادها المجردة بالشكل ده بالظبط — لو لقينا أي
--     شركة فيها نقط أو عدد مختلف ⇒ «نفّذت قبل كده» أو حالة غير متوقعة ⇒ وقف.
--   · بعد التحويل: كل شركة غير المالك لازم 21 حسابًا بالأكواد المثالية وبالأكواد القديمة = {1,2,3,4,5}
--     فقط · وشركة «ميزان لازم مافيش حساب ليها اتأثر (باقيها الأم فقط 1..5 بلا نقط زي ما هي).
--   · المراجع: عدد سطور الجداول ثابت (المعادلة بتقيسها الأداة بره الملف) و accounts ثابت 173.
do $$
declare
  v_owner uuid := '72597c1b-90e5-40d2-a318-fc9c426e1dc2';
  v_bad int;
begin
  -- (أ) شركة «ميزان موجودة والمشهد الحالي هو المشهد المجرّد: أي شركة غيرها عندها حساب فيه نقط
  --     أو كود بره القائمة القديمة ⇒ يعني إما نُفّذت قبل كده أو مشهد غير متوقع ⇒ وقف.
  select count(*) into v_bad
    from public.accounts a
   where a.org_id <> v_owner
     and (a.code ~ '[.]' or a.code not in
          ('1','11','111','112','113','114','115','12','13','131','132','133',
           '14','141','142','2','21','22','3','31','32'));
  if v_bad > 0 then
    raise exception 'ترقية 51: حساب برة النطاق المتوقع (شركة فيها نقط/كود غريب أو اتنفذت قبل كده؟) = %', v_bad;
  end if;
  -- (ب) كل شركة غير المالك لازم عددها 21 بالضبط (بذرة ٤٤ كاملة).
  select count(*) into v_bad
    from public.accounts a
   where a.org_id <> v_owner
   group by a.org_id
  having count(*) <> 21;
  if v_bad > 0 then
    raise exception 'ترقية 51: فيه شركات خارج المالك عدد حساباتها مش 21';
  end if;
end $$;

-- =====================================================================================
-- (١) ترجمة الأكواد في الشركات السبع (غير المالكة) للشكل المنقّط — تحديث مسطّح آمن:
--     لا يوجد قيد UNIQUE على (org_id, code) وهناك فقط uq_accounts_orglocal (org_id, local_id)
--     وخريطة الإسناد داخل كل شركة متباينة (21 قيمة كلها مختلفة) ⇒ بلا أي تصادم.
-- =====================================================================================
update public.accounts a
   set code = case a.code
       when '1'   then '1'
       when '11'  then '1.1'
       when '111' then '1.1.1'
       when '112' then '1.1.2'
       when '113' then '1.1.3'
       when '114' then '1.1.4'
       when '115' then '1.1.5'
       when '12'  then '1.3'
       when '13'  then '2'
       when '131' then '2.1'
       when '132' then '2.1.1'
       when '133' then '2.1.2'
       when '14'  then '3'
       when '141' then '3.1'
       when '142' then '3.2'
       when '2'   then '4'
       when '21'  then '4.1'
       when '22'  then '4.2'
       when '3'   then '5'
       when '31'  then '5.1'
       when '32'  then '5.2'
       else a.code
     end
 where a.org_id <> '72597c1b-90e5-40d2-a318-fc9c426e1dc2'
   and a.code in ('1','11','111','112','113','114','115','12','13','131','132','133',
                  '14','141','142','2','21','22','3','31','32');

-- =====================================================================================
-- (٢) تحقق «بعد»: جوّه نفس المعاملة — أي خروج من البوابات = استثناء = ROLLBACK كامل
-- بعد: هذي الفحوص بتتقاس من غير نقطة باسم واحدة (بصمة الأكواد النهائية بتتقارن بره في الأداة)
-- =====================================================================================
do $$
declare
  v_owner uuid := '72597c1b-90e5-40d2-a318-fc9c426e1dc2';
  v_bad int;
begin
  -- كل شركة غير المالك: 21 حسابًا كلها بالأكواد المثالية (الآباء الأم 1..5 بلا نقط هي الوحيدة).
  select count(*) into v_bad
    from public.accounts a
   where a.org_id <> v_owner
     and a.code not in
         ('1','1.1','1.1.1','1.1.2','1.1.3','1.1.4','1.1.5','1.3',
          '2','2.1','2.1.1','2.1.2','3','3.1','3.2','4','4.1','4.2','5','5.1','5.2');
  if v_bad > 0 then
    raise exception 'ترقية 51: بعد التحويل فيه حسابات بكواد برة الشكل المثالي = %', v_bad;
  end if;
  -- ميزان (المالك): لازم لسه الكوديدات القديمة بس 1..5 على مستوى الأب الأم فقط.
  if exists (select 1 from public.accounts a
              where a.org_id = v_owner and not (a.code ~ '[.]') and a.code not in ('1','2','3','4','5')) then
    raise exception 'ترقية 51: شركة ميزان اتأثرت في أكوادها — مرفوض';
  end if;
end $$;

-- =====================================================================================
-- (٣) البذرة المنقّطة لبوابة الدعوة — نفس الدالة الحية حرفيًا إلا الأكواد (بذرة ٤٤ → منقّطة)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.create_org_and_profile(p_org_name text, p_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'لا توجد جلسة دخول. أعد تسجيل الدخول ثم أعد المحاولة.';
  end if;

  -- 🛡 بناء 141: الدالة كانت متاحة لأي حساب مسجّل ⇒ أي حد يفتح شركة تجريبية من REST.
  --    النطاق بقى = مالك البرنامج أو مساعِديه في شركة «ميزان» (نفس نطاق الواجهة).
  if not public.mizan_invite_manager() then
    raise exception 'الانضمام لبرنامج ميزان بيتم برمز دعوة من إدارة البرنامج. مافيش إنشاء شركة من داخل البرنامج.';
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

  -- 🛡 ترقية ٥١ (10/10): البذرة بقت منقّطة قرآنية (نفس الشجرة النموذجية في كل الشركات).
  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'group', NULL, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '1.1.2', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '1.1.4', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '2', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '2.1', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '2.1.1', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '2.1.2', 'ضريبة المبيعات المستحقة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '3', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 14, '3.1', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 15, '3.2', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 16, '4', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 17, '4.1', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 18, '4.2', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '5', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 20, '5.1', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 21, '5.2', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  -- 🛡 نفس قرار ترقية ٤٤ بالحرف: خزينة واحدة «الصندوق الرئيسي» برصيد صفر — بلا بنك
  --    «٥٠٠٠٠» ومحفظة «١٠٠٠٠» ورأس مال «١٠٠٠٠٠» وهميين، فأي شركة جديدة = فاضية ١٠٠٪.
  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', 0, 0, true);

  return v_org;
end $function$;

-- =====================================================================================
-- (٤) البذرة المنقّطة لبوابة الأدمن — نفس الدالة الحية حرفيًا إلا الأكواد (بذرة ٤٤ → منقّطة)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.mizan_admin_create_org(p_org_name text, p_admin_username text, p_admin_password text, p_max_members integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
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

  insert into public.mizan_pw_store (user_id, plain_password) values (v_uid, p_admin_password)
  on conflict (user_id) do update set plain_password = excluded.plain_password, updated_at = now();

  -- 🛡 ترقية ٥١ (10/10): البذرة بقت منقّطة قرآنية (نفس الشجرة النموذجية في كل الشركات).
  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'group', NULL, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '1.1.2', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '1.1.4', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '2', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '2.1', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '2.1.1', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '2.1.2', 'ضريبة المبيعات المستحقة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '3', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 14, '3.1', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 15, '3.2', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 16, '4', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 17, '4.1', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 18, '4.2', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '5', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 20, '5.1', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 21, '5.2', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  -- 🛡 ترقية ٤٤ (02/10): خزينة واحدة «الصندوق الرئيسي» نقدية برصيد صفر —
  --    بلا أي حساب بنكي أو محفظة إلكترونية أو رصيد وهمي مع الشركة الجديدة.
  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', 0, 0, true);

  return v_org;
end $function$;
