-- ترقية ٥٠ — «قفل التسجيل العام + رمز الدعوة العشوائي من المالك ومساعِديه» (بناء 141)
--
-- ✅ **اتنفّذت على السحابة ٥/١٠/٢٠٢٦** (لقطة «قبل» 00:48 ولقطة «بعد» 01:29 بتوقيت الجهاز)
--    بأمر المالك الحرفي «تمام ابدا فعلها على قاعدة البيانات».
--    الأداة: MIZAN_ORDER_50="نفّذ" node D:/_work/temp/apply_upgrade_50.js
--    (معاملة واحدة: فحوص «قبل» ⇒ التنفيذ ⇒ فحوص «بعد» ⇒ commit؛ أي فشل = ROLLBACK كامل).
--    القياس الحيّ من لقطات باك أب: **الدوال 67 → 70** (الثلاث الجديدة) · `columns` و`constraints`
--    و`indexes` و`rls_policies` **md5 مطابق حرفيًا قبل = بعد** (b7dcfec… / 1a0f6af… / e2179aa… / bbe3b4f…)
--    ⇒ مافيش جدول ولا عمود ولا فهرس ولا سياسة اتغيّرت · **338 سطر بيانات في 37 جدول قبل = بعد** ·
--    **36/38 ملف بيانات مطابق بالبايت** والفرقين مش من شغلنا: `_summary.json` = ساعة اللقطة،
--    و`presence.json` = نفس الـ4 أزواج (مستخدم|شركة) وسطر `last_seen` واحد تقدّم
--    (21:48:27 → 22:15:18 = نبضة جهاز المالك) · `messages.json` مش في أي لقطة.
--    الباك أب: قبل `D:/MizanBackups/pre-mig50-20261005-0048` (worktree.tar + مخطط/بيانات «قبل»
--    + **`rollback_50.sql`** = نص `create_org_and_profile` و`join_org` قبل ٥٠ حرفيًا من لقطة «قبل»
--    + حذف الدوال الثلاثة) · بعد `D:/MizanBackups/post-mig50-20261005-0129` (مخطط/بيانات «بعد»).
--    الرجوع **لا يُنفّذ إلا بأمر المالك الحرفي وبعَد باك أب جديد**.
--    الإثبات السلوكي (مش الرقمي بس): `D:/_work/temp/test_signup_lock_50.js` = **82 ✓ / 0 ✗** على
--    **أدوار حقيقية** (anon ⇒ 42501 على الخمس دوال · البوابة بتقفل وترجع مع العضوية · المساعد
--    بيولّد رمز ٨ محارف · النصوص الودّية الخمسة · `mizan_access()` لكل الحسابات · المنح · البصمتان)
--    وكله `begin … rollback` ⇒ **صفر كتابة** في الاختبار نفسه.
--
--
-- ══════════════════════════════════════════════════════════════════════════════
-- ليه الترقية دي أصلًا (بعد ما الواجهة اتقفلت في build 141)؟
--   build 141 شال **من الواجهة** كل طرق إنشاء شركة: مافيش زرار «شركة جديدة» في DOM،
--   ومافيش في الحزمة المنشورة ولا نداء لـ `create_org_and_profile` (الحارس
--   check_signup_lock_141.js بيقاس ده حرفيًا). بس ده **تأمين واجهة** لوحده: الدالة
--   السحابية لسه موجودة و`SECURITY DEFINER`، فأی حساب مسجّل (JWT سليم) يقدر يتخطى
--   الواجهة ويناديها من REST ويولّد شركة لنفسه — ودي بالظبط «الحسابات التجريبية» اللي
--   المالك عايز يوقفها. ⇒ **الحظر لازم يكون في القاعدة** — درس متكرر في ميزان
--   (ترقية ٤٥: خصوصية الدردشة في RLS مش في الواجهة، وترقية ٤٩: المنح العامة).
--
--   والأخطر: نفس الدالة لسه **بتزرع أرصدة وهمية** — رأس مال 100000 و«البنك الأهلي
--   المصري 50000» و«محفظة فودافون كاش 10000» و«الصندوق الرئيسي 25000» (محفوظ في لقطة
--   مخطط 04/10). ده كان شكاية المالك اللي اتقفلت لـ `mizan_admin_create_org` بترقية ٤٤
--   («عملت شركة مينا لقيت حسابات بنك») — والمسار العام كان **لسه** بيزرعهم. الترقية دي
--   بتوحّد المسارين على نفس قرار ٤٤: شركة جديدة = صندوق رئيسي برصيد صفر + رأس مال صفر.
--
-- أوامر المالك الحرفية اللي الترقية دي بتنفذها (04/10):
--   «علشان محدش يعمل حسابات تجريبية» · «و بعدين اربط الدعوه منى انا»
--   · «عجبتنى فكرة انشاء رمز عشوائى نفذهل و خلى اعضاء شركة ميزان يقدروا يولدوا رمز
--      عشوائى برده شركة ميزان هى الشركة المالكه و الاعضاء اللى هضيفهم فيها هما مساعدين ليا»
-- ⇒ نطاق «إدارة برنامج ميزان» هنا = **مالك البرنامج (`profiles.is_superadmin`) أو أي حساب
--   عض في شركة «ميزان»** (`72597c1b-90e5-40d2-a318-fc9c426e1dc2`)، وهو **نفس** نطاق
--   `ownerSettingsAllowed()` في app.js (بناء 133) — مصدر واحد سحابي وموضعي، مش تعريفين.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- اللي الترقية دي بتعمله (دالة مساعد جديدة + ٣ دوال إدارة + تشديد ٢ قائمتين):
--   ١) `mizan_invite_manager()`                — القرار الوحيد: مين «إدارة برنامج ميزان».
--   ٢) `create_org_and_profile(text, text)`    — تُقفل على نفس النطاق + تزرع زي قرار ٤٤.
--   ٣) `mizan_admin_invite_codes()`            — قائمة الشركات ورموزها (للمالك ومساعِديه).
--   ٤) `mizan_admin_rotate_invite(uuid)`       — رمز عشوائي جديد بلا تصادم (للمالك ومساعِديه).
--   ٥) `join_org(text, text)`                  — تشديد: سقف `max_members` + منع الانضمام
--                                                 المزدوج + رسائل عربية ودّية بلا مصطلح تقني.
--   + منح نظيفة على الخمس دوال: `REVOKE` من `PUBLIC`/`anon` و`GRANT` لـ `authenticated`،
--     و`search_path` مثبّتة `'public', 'pg_temp'` (نفس تحصين ترقية ٤٣).
--
-- الترقية دي **ما بتعملش**: مافيش جدول جديد · مافيش عمود · مافيش فهرس · مافيش سياسة RLS
--   جديدة أو متغيّرة · **مافيش أي حذف أو تعديل سطر** (الرموز الموجودة على القاعدة بتفضل زي ما
--   هي — الحظر في `create_org_and_profile` مش في `join_org`) · مافيش لمس لدوال النسخ
--   الاحتياطي · مافيش مساس بأي شركة موجودة (و«القاهره لقطع غيار السيارات» بالذات)
--   · مافيش أي كتابة على `auth.users`.
--
-- قياس الحالة الحيّة وقت كتابة الملف (لقطة `post-publish138-20261004-2302`، 04/10 ≈23:03 بتوقيت
--   الجهاز): **5 شركات / 5 حسابات** · الرموز `7FBC0DFF` (mizan) و`6CB0A944` (المجد) و`DFE3D086`
--   (ناجى) و`2F8A8B2F` (سمير) و`17E38785` (القاهره) — **مافيش رمز فاضي ومافيش تكرار** (الفحص ٦
--   تحت بيأكد ده وقت التنفيذ مش دلوقتي) · `max_members` = 5 لـ mizan و2 لباقي الشركات، وكل شركة
--   ليها **عضو واحد بالظبط** لحد اللحظة دي ⇒ سقف الحسابات في `join_org` ما بيقفّلش شركة موجودة.
--   الأرقام نفسها في التنفيذ بتتقاس **من القاعدة** (GUC في قسم ٠) مش مكتوبة هنا، فالملف ما
--   بيموتش لو الشركات زادت أو نقصت قبل ما يتنفّذ.
--
-- حالة الواجهة بعد التنفيذ (أمانة قياس): `DATA.adminInviteCodes()` بقت بتاخدها من الدالة
--   `mizan_admin_invite_codes()` (مسار "rpc") بدل القراءة المباشرة من `organizations`، و`__invNew`
--   بترجّع الرمز الجديد فعلًا — فرع «unavailable» (رسالة «التحديث الصغير في السحابة») بقى للسيرفر
--   اللي ما اترحّلش، مش للقاعدة الحيّة. والمسار العام `create_org_and_profile` مقفول سلوكيًا
--   بـ **42501 على `anon`** وبردّ ودّي لـ `authenticated` خارج النطاق (الإثبات: 82/0).
--
-- ⚠️ **ممنوع إعادة تشغيل الملف كما هو بعد التنفيذ** — قسم ٠ فيه فحوص «قبل» بقت **فشلًا متعمّدًا**:
--    «نص `create_org_and_profile`/`join_org` القديم موجود» و«الدوال الثلاث مش موجودة» و«منح anon
--    على الخمس دوال > 0». القاعدة النهاردة في حالة «بعد»، فالتشغيل التاني بيرفض ويعمل ROLLBACK
--    (متجرّب: نفس البوابات اللي عطّلت إعادة تشغيل ٤٦ و٤٩). أي تعديل لاحق = ملف **٥١**.
--    الرجوع = `D:/MizanBackups/pre-mig50-20261005-0048/rollback_50.sql` — **بأمر المالك الحرفي
--    وبعَد باك أب جديد**، مش بأمر ضمني.
--
-- مافيش begin/commit جوه الملف — المعاملة ملك أداة التنفيذ.

-- ═══════════════ ٠) فحوص «قبل» + منع إعادة التشغيل (أي فشل = رجوع) ═══════════
-- **لازم تسبق أي DDL**: لو اتحطّت في آخر الملف هتقيس الحالة بعد التغيير فتبقى كاذبة
-- (درس ترقية ٤٦). القيم اللي الفحص «بعد» يقارنها بتتخزن في GUC محلي للمعاملة
-- (`set_config(..., true)`) فبتترجع تلقائيًا لو حصلت rollback، وما تلوثش أي جلسة تانية.
do $$
declare
  v_n   int;
  v_src text;
begin
  -- ── ١. لازم ترقية ٤٤ (منع الزرع) تكون اتنفذت — ممنوع نقفز فوق قاعدة ناقصة ──
  select prosrc into v_src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mizan_admin_create_org' limit 1;
  if v_src is null or v_src not like '%الصندوق الرئيسي%' or v_src like '%البنك الأهلي المصري%' then
    raise exception '٥٠: ترقية ٤٤ (منع الزرع) لسه ما اتنفّذتش على القاعدة دي — وقّف';
  end if;

  -- ── ٢. منع إعادة التشغيل: `create_org_and_profile` لازم لسه بالنص القديم ──
  select prosrc into v_src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'create_org_and_profile' limit 1;
  if v_src is null then
    raise exception '٥٠: الدالة create_org_and_profile مش موجودة — القاعدة مش الحالة اللي الملف اتكتب لها';
  end if;
  if v_src like '%mizan_invite_manager%' then
    raise exception '٥٠: اتنفذت قبل كده على هالقاعدة — ممنوع تعيد تشغيل الملف كما هو';
  end if;
  if v_src not like '%البنك الأهلي المصري%' or v_src not like '%25000%' then
    raise exception '٥٠: نص create_org_and_profile مش مطابق للقطة 04/10 — وقّف وراجع المصدر';
  end if;

  -- ── ٣. منع إعادة التشغيل: `join_org` لازم لسه بالنص القديم ──
  select prosrc into v_src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'join_org' limit 1;
  if v_src is null then
    raise exception '٥٠: الدالة join_org مش موجودة — وقّف';
  end if;
  if v_src like '%mizan_50_slots%' then
    raise exception '٥٠: اتنفذت قبل كده على هالقاعدة — ممنوع تعيد تشغيل الملف كما هو';
  end if;
  if v_src not like '%رمز الدعوة غير صحيح%' or v_src like '%max_members%' then
    raise exception '٥٠: نص join_org مش مطابق للقطة 04/10 — وقّف وراجع المصدر';
  end if;

  -- ── ٤. الدوال الثلاثة الجديدة لازم ما تكونش موجودة (منع إعادة التشغيل) ──
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('mizan_invite_manager', 'mizan_admin_invite_codes', 'mizan_admin_rotate_invite');
  if v_n <> 0 then
    raise exception '٥٠: % من دوالها الجديدة موجود على القاعدة فعلًا — يعني اتنفّذت أو اتنصّفت، وممنوع تعيد تشغيل الملف كما هو', v_n;
  end if;

  -- ── ٥. شركة «ميزان» (= شركة المالك، مساعِدوه جوه) لازم تكون موجودة ──
  if not exists (select 1 from public.organizations
                  where id = '72597c1b-90e5-40d2-a318-fc9c426e1dc2') then
    raise exception '٥٠: شركة «ميزان» مش موجودة على القاعدة — نطاق المدير مبنى عليها';
  end if;

  -- ── ٦. ولا شركة برمز فاضي ولا رمز مكرر (وإلا مطابقة الرمز في `join_org` وحلقة التوليد ضللت) ──
  --       الفحص ده **عدّادان منفصلان** بسطر واحد: القديم كان بفلتر الفاضي الأول ثم يجمّع،
  --       فالتكرار بين الرموز الحقيقية كان بيفلت من الفحص (غلط تركيبي، اتقيد قبل التنفيذ).
  select count(*) into v_n from public.organizations
   where invite_code is null or btrim(invite_code) = '';
  if v_n <> 0 then
    raise exception '٥٠: فيه % شركة برمز فاضي أو ملوش رمز — صلّحهم قبل التنفيذ (القياس 04/10: صفر)', v_n;
  end if;

  select count(*) into v_n from (
    select btrim(invite_code) as c from public.organizations
     where invite_code is not null and btrim(invite_code) <> ''
     group by btrim(invite_code) having count(*) > 1
  ) q;
  if v_n <> 0 then
    raise exception '٥٠: فيه % رمز مكرر على أكتر من شركة — الرموز لازم تكون فريدة قبل التنفيذ (القياس 04/10: صفر تكرار)', v_n;
  end if;

  -- ── ٧. المنح الحالية: الدوال الاتنين الموجودين فعلًا (`create_org_and_profile` + `join_org`)
  --       لازم يكون عندهم EXECUTE لـ `authenticated` — وإلا اللي بعد كده مش «تثبيت» بل فتح باب،
  --       أو إن الوضع على السحابة مش الحالة اللي الملف اتكتب لها.
  --       (الفحص بيعدّ **المخالفين** بس: لو أي واحد منهم مالوش EXECUTE ⇒ رفض.)
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('create_org_and_profile', 'join_org')
     and not has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_n <> 0 then
    raise exception '٥٠: % من الدوال العامة مالهاش EXECUTE لـ authenticated قبل التنفيذ — الوضع مش المتوقع، وقّف', v_n;
  end if;

  -- ── ٨. قياس «قبل» للمقارنة البعدية (بدل أرقام مقفولة ممكن تتحرك بترقية تانية) ──
  perform set_config('mizan50.fns',
    (select count(*)::text from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public'), true);
  perform set_config('mizan50.cols',
    (select count(*)::text from information_schema.columns where table_schema = 'public'), true);
  perform set_config('mizan50.pols',
    (select count(*)::text from pg_policies where schemaname = 'public'), true);
  perform set_config('mizan50.tbls',
    (select count(*)::text from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relkind = 'r'), true);
  perform set_config('mizan50.idxs',
    (select count(*)::text from pg_indexes where schemaname = 'public'), true);
  perform set_config('mizan50.orgs',
    (select count(*)::text from public.organizations), true);
  perform set_config('mizan50.profs',
    (select count(*)::text from public.profiles), true);
  perform set_config('mizan50.codes',
    (select coalesce(string_agg(invite_code, ',' order by name), '') from public.organizations), true);
end $$;

-- ═══════════ ١) `mizan_invite_manager()` — نطاق «إدارة برنامج ميزان» (مصدر واحد) ═══════════
-- بتقرا `profiles` جوّه دالة definer (فتتجاوز RLS) **بعد** ما تتأكد من هويتها هي:
--   (أ) مالك البرنامج: `profiles.is_superadmin` — نفس تعريف ترقية ٤٢/٤٦
--   (ب) أي حساب عضّو في شركة «ميزان» = مساعِدي المالك (قراره الحرفي 04/10).
-- `anon`/بدون جلسة: `auth.uid()` فاضي ⇒ `exists` = false، فالرفض هو الوضع الافتراضي
-- (fail-closed)، والكود الموضعي في app.js (`ownerSettingsAllowed`) بيقرر نفس الحاجة.
create or replace function public.mizan_invite_manager()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.profiles pr
     where pr.id = auth.uid()
       and (pr.is_superadmin is true
            or pr.org_id = '72597c1b-90e5-40d2-a318-fc9c426e1dc2')
  );
$function$;

-- ═══════════ ٢) `create_org_and_profile` — مقفولة على النطاق، ومزروعة زي قرار ٤٤ ═══════════
-- التوقيع القديم مستنسخ حرفيًا (`p_name` اختيارية) ⇒ أي نداء قديم ما يتكسرش، بس الباب
-- اتقفل. الرسالة عربية ودّية: الحزمة المنشورة ما بتناديش الدالة أصلًا، فالنص ده للاحتياط
-- وللسجل، وهو كمان ماحدش بيشوفه غير لو تعدّى الواجهة وطلب الدالة من REST مباشرة.
create or replace function public.create_org_and_profile(p_org_name text, p_name text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
    (v_org, 14, '141', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 15, '142', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 16, '2', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 17, '21', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 18, '22', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '3', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 20, '31', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 21, '32', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  -- 🛡 نفس قرار ترقية ٤٤ بالحرف: خزينة واحدة «الصندوق الرئيسي» برصيد صفر — بلا بنك
  --    «٥٠٠٠٠» ومحفظة «١٠٠٠٠» ورأس مال «١٠٠٠٠٠» وهميين، فأي شركة جديدة = فاضية ١٠٠٪.
  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', 0, 0, true);

  return v_org;
end $function$;

-- ═══════════ ٣) `mizan_admin_invite_codes()` — قائمة الرموز للمالك ومساعِديه ═══════════
-- دي اللي بتخلي شاشة «🎟️ دعوات الشركات» تشتغل **لكل** مساعِد، مش للمالك لوحده: سياسة
-- `org_select` الحيّة (لقطة 04/10) بترجّع كل صفوف `organizations` لـ `is_superadmin` بس،
-- فأی حساب تاني — حتى لو عض في شركة «ميزان» — بيشوف **صفّ شركته هو**. الدالة definer
-- فبتتجاوز السياسة **بعد** ما تتأكد من النطاق جوه. قراءة فقط: مافيش insert/update/delete.
create or replace function public.mizan_admin_invite_codes()
 returns table (org_id uuid, org_name text, invite_code text, plan_status text)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.mizan_invite_manager() then
    raise exception 'غير مصرح';
  end if;
  return query
    select o.id, o.name, o.invite_code, o.plan_status
      from public.organizations o
     order by o.created_at desc;
end $function$;

-- ═══════════ ٤) `mizan_admin_rotate_invite(uuid)` — رمز عشوائي جديد ═══════════
-- قرار المالك: توليد رمز لكل شركة، والرمز القديم يبطل. نفس وصفة التوليد التاريخية
-- (`upper(substr(md5(random()::text), 1, 8))`) عشان الشكل يفضل ٨ محارف كابيتال زي
-- الرموز السبعة الموجودة، بس بحلقة تمنع أي تصادم مع رمز مستخدم. الكتابة على عمود
-- `invite_code` في صفّ الشركة المطلوبة وحده.
create or replace function public.mizan_admin_rotate_invite(p_org_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_new text;
  v_try int := 0;
begin
  if not public.mizan_invite_manager() then
    raise exception 'غير مصرح';
  end if;
  if p_org_id is null or not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'الشركة غير موجودة';
  end if;

  loop
    v_try := v_try + 1;
    v_new := upper(substr(md5(random()::text), 1, 8));
    exit when not exists (select 1 from public.organizations where invite_code = v_new);
    if v_try > 20 then
      raise exception 'تعذر توليد رمز جديد فريد — عاود بعد شوية';
    end if;
  end loop;

  update public.organizations set invite_code = v_new where id = p_org_id;
  return v_new;
end $function$;

-- ═══════════ ٥) `join_org` — تشديد: سقف الحسابات + منع الانضمام المزدوج ═══════════
-- الرمز نفسه زي ما هو (كل الشركات الموجودة على القاعدة شغّالة بلا أي تغيير في رموزها —
-- القياس 04/10: ٥ شركات و٥ رموز فريدة)، اللي اتشدّد:
--   (أ) `max_members` بقى سقفًا فعليًا (`mizan_admin_create_org` كانت بتخزّنه وما حدش يقراه)
--       ⇒ مساعِد دبّغ رمز لشركة كاملة العدد بياخد رد ودّي بدل الحساب يدخل على طول.
--   (ب) الحساب اللي ليه شركة بالفعل ما ينضمش لشركة تانية برمز (كان بيوصل إن `profiles`
--           ليه سطرين لشركتين ⇒ كسر العزل بينها، وده نفس مرض بناء ١١٩).
--   (ج) الرسائل عربية ودّية بلا أي مصطلح تقني (درس build 127)، والواجهة بتفرّق
--       «رمز غلط» عن «جلسة» عن «صلاحية» في `inviteFailText` (app.js).
create or replace function public.join_org(p_code text, p_name text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org   uuid;
  v_uid   uuid := auth.uid();
  v_have  uuid;
  v_max   int;
  v_count int;
begin
  if v_uid is null then
    raise exception 'لا توجد جلسة دخول. أعد تسجيل الدخول ثم أعد المحاولة.';
  end if;

  -- mizan_50_slots: علامة جوّه النص — قسم ٠ بيمنع بيها إعادة التشغيل والفحص «بعد» بيثبت بيها
  -- رمز فاضي/مسافات بس مرفوض **قبل** أي مطابقة: لو عدّيناه، `upper(btrim(''))` كان بيطابق
  -- أي شركة برمز فاضي (والقاعدة النهاردة ما فيهاش رمز فاضي — فحص ٦ — بس نمنع الفرض ده في الكود).
  if p_code is null or btrim(p_code) = '' then
    raise exception 'اكتب رمز الدعوة اللي وصلك من إدارة برنامج ميزان';
  end if;

  select id into v_org from public.organizations
   where invite_code is not null and btrim(invite_code) <> ''
     and upper(btrim(invite_code)) = upper(btrim(p_code))
     and plan_status = 'active';
  if v_org is null then
    raise exception 'رمز الدعوة غير صحيح أو الشركة غير نشطة';
  end if;

  select org_id into v_have from public.profiles where id = v_uid;
  if v_have is not null then
    if v_have = v_org then
      return v_org;                     -- نفس الشركة = مقبول بلا سطر تاني
    end if;
    raise exception 'الحساب ده تابع لشركة بالفعل — تابع مع إدارة برنامج ميزان';
  end if;

  select coalesce(max_members, 5) into v_max from public.organizations where id = v_org;
  select count(*) into v_count from public.profiles where org_id = v_org;
  if v_count >= v_max then
    raise exception 'عدد الحسابات في الشركة دي وصل للحد — تابع مع إدارة برنامج ميزان ليزيد العدد';
  end if;

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org, coalesce(nullif(p_name,''), split_part(auth.email(),'@',1)), 'member');
  return v_org;
end $function$;

-- ═══════════ ٦) منح نظيفة على الخمس دوال (نفس تحصين ترقية ٤٣) ═══════════
-- الدوال دي بتقرا وتكتب على `organizations`، فممنوع تنفّذ لـ `anon` أو `PUBLIC`
-- (المنح «الفارغة» = أي دور بياخدها ضمانيًا — درس ٤٣/٤٩ في ACL الحيّ).
revoke all on function public.mizan_invite_manager()               from public, anon;
revoke all on function public.mizan_admin_invite_codes()           from public, anon;
revoke all on function public.mizan_admin_rotate_invite(uuid)      from public, anon;
revoke all on function public.create_org_and_profile(text, text)   from public, anon;
revoke all on function public.join_org(text, text)                 from public, anon;

grant execute on function public.mizan_invite_manager()             to authenticated;
grant execute on function public.mizan_admin_invite_codes()         to authenticated;
grant execute on function public.mizan_admin_rotate_invite(uuid)    to authenticated;
grant execute on function public.create_org_and_profile(text, text) to authenticated;
grant execute on function public.join_org(text, text)               to authenticated;

-- ═══════════ ٧) فحوص «بعد» — أي فشل = المعاملة كلها ترجع ═══════════
do $$
declare
  v_n   int;
  v_src text;
begin
  -- ── (٠) قياس «قبل» لازم يكون موجود جوّه نفس المعاملة ──
  --      `set_config(..., true)` = `SET LOCAL`: بيترمي مع أول عبارة لو الملف اتنفّذ **بره**
  --      معاملة (psql مباشر) — وبيترمي كمان لو الحفظ الفرعي (savepoint) اللي ضبطه اترجّع.
  --      الفحوص تحت بتقارن بـ `current_setting` فلو القياس راح كانت هتقارن بفاضي.
  --      ⚠️ **مصيدة مقيسة (التجربة الجافّة 05/10):** `current_setting('mizan50.fns', true)`
  --      بيرجّع **`''` مش NULL** لأي GUC مخصصة اسمها اتلمّس في الجلسة مرة قبل كده (الـ
  --      placeholder بيفضل معرّف بقيمة فاضية بعد إلغاء الحفظ). فالفحص القديم
  --      (`is not null`) كان **بيعدّ الفاضي كموجود** ⇒ «أخضر كاذب» في البند ده.
  --      الإصلاح: الأرقام لازم تكون **أرقامًا فعلًا** (`~ '^[0-9]+$'`)، والرموز لازم تكون
  --      **بعدد الشركات المسجّل** (مطابقة تركيبية تمنع القياس الممزّق).
  select count(*) into v_n from (values
    ('mizan50.fns'), ('mizan50.cols'), ('mizan50.pols'), ('mizan50.tbls'),
    ('mizan50.idxs'), ('mizan50.orgs'), ('mizan50.profs')) k(key)
   where coalesce(current_setting(k.key, true), '') ~ '^[0-9]+$';
  if v_n <> 7 then
    raise exception '٥٠/بعد: قياس «قبل» الرقمي ناقص أو مش عدد (% من ٧) — الملف اتنفّذ بره معاملة أو الحفظ اترجّع؟ وقّف ونفّذه من أداة فيها begin/commit', v_n;
  end if;
  if (select count(*) from unnest(string_to_array(coalesce(current_setting('mizan50.codes', true), ''), ',')) c
       where btrim(c) <> '') <> current_setting('mizan50.orgs', true)::int then
    raise exception '٥٠/بعد: بصمة رموز «قبل» مش بعدد الشركات المسجّل — القياس اتمزّق، وقّف';
  end if;

  -- ── (١) الدوال الثلاثة الجديدة موجودة بتواقيعها الصحيحة ──
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mizan_invite_manager'
     and p.pronargs = 0 and p.prorettype = 'pg_catalog.bool'::regtype;
  if v_n <> 1 then raise exception '٥٠/بعد: mizan_invite_manager() مش بتوقيعها الصحيح (%)', v_n; end if;

  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mizan_admin_invite_codes'
     and array_to_string(p.proargnames, ',') = 'org_id,org_name,invite_code,plan_status';
  if v_n <> 1 then raise exception '٥٠/بعد: mizan_admin_invite_codes() مالهاش التوقيع المحفوظ (%)', v_n; end if;

  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mizan_admin_rotate_invite'
     and p.pronargs = 1 and p.proargtypes[0] = 'uuid'::regtype
     and p.prorettype = 'pg_catalog.text'::regtype;
  if v_n <> 1 then raise exception '٥٠/بعد: mizan_admin_rotate_invite(uuid) مش بتوقيعها الصحيح (%)', v_n; end if;

  -- ── (٢) الخمس دوال definer، ومسارها مثبّت بـ pg_temp آخره ──
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('mizan_invite_manager','mizan_admin_invite_codes',
                       'mizan_admin_rotate_invite','create_org_and_profile','join_org')
     and p.prosecdef = true
     and array_to_string(p.proconfig, ',') like '%pg_temp%';
  if v_n <> 5 then
    raise exception '٥٠/بعد: دوال definer بمسار مثبّت المفروض ٥، لقينا % — الوقف', v_n;
  end if;

  -- ── (٣) البوابات جوّه النصوص ──
  select prosrc into v_src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'create_org_and_profile' limit 1;
  if v_src not like '%mizan_invite_manager%' then
    raise exception '٥٠/بعد: بوابة النطاق مش في create_org_and_profile';
  end if;
  if v_src like '%البنك الأهلي المصري%' or v_src like '%25000%' then
    raise exception '٥٠/بعد: الزرع الوهمي لسه في create_org_and_profile — التطبيق ما اتعملش';
  end if;

  select prosrc into v_src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mizan_admin_invite_codes' limit 1;
  if v_src not like '%mizan_invite_manager%' then
    raise exception '٥٠/بعد: بوابة النطاق مش في mizan_admin_invite_codes';
  end if;

  select prosrc into v_src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mizan_admin_rotate_invite' limit 1;
  if v_src not like '%mizan_invite_manager%' then
    raise exception '٥٠/بعد: بوابة النطاق مش في mizan_admin_rotate_invite';
  end if;

  select prosrc into v_src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'join_org' limit 1;
  if v_src not like '%mizan_50_slots%' or v_src not like '%max_members%' then
    raise exception '٥٠/بعد: join_org ما اتشدّتش (سقف الحسابات) — التطبيق ما اتعملش';
  end if;

  -- ── (٤) مافيش أي جداول `auth` جوّه الخمس دوال (المرجع الوحيد المسموح دوال `auth.uid/auth.email`) ──
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('mizan_invite_manager','mizan_admin_invite_codes',
                       'mizan_admin_rotate_invite','create_org_and_profile','join_org')
     and (p.prosrc like '%auth.users%' or p.prosrc like '%auth.identities%' or p.prosrc like '%auth.sessions%');
  if v_n <> 0 then
    raise exception '٥٠/بعد: فيه مرجع لجدول auth جوّه دوالها (%) — الوقف', v_n;
  end if;

  -- ── (٥) المنح: صفر منح EXECUTE لـ PUBLIC (grantee=0) أو `anon`، و`authenticated` ٥/٥ ──
  select count(*) into v_n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    join aclexplode(p.proacl) a on true
   where ns.nspname = 'public'
     and p.proname in ('mizan_invite_manager','mizan_admin_invite_codes',
                       'mizan_admin_rotate_invite','create_org_and_profile','join_org')
     and a.privilege_type = 'EXECUTE'
     and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  if v_n <> 0 then
    raise exception '٥٠/بعد: لسه فيه منح EXECUTE لـ PUBLIC/anon على دوالها (%)', v_n;
  end if;

  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('mizan_invite_manager','mizan_admin_invite_codes',
                       'mizan_admin_rotate_invite','create_org_and_profile','join_org')
     and p.proacl is not null;
  if v_n <> 5 then
    raise exception '٥٠/بعد: proacl فاضي (= إذن عام ضمني) على بعض دوالها — العدد %', v_n;
  end if;

  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('mizan_invite_manager','mizan_admin_invite_codes',
                       'mizan_admin_rotate_invite','create_org_and_profile','join_org')
     and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_n <> 5 then
    raise exception '٥٠/بعد: منح authenticated على دوالها المفروض ٥، لقينا % — التطبيق هيقف', v_n;
  end if;

  -- ── (٦) المخطط: +٣ دوال بالظبط، وكل عدّاد تاني زي قياس «قبل» ──
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public';
  if v_n <> current_setting('mizan50.fns')::int + 3 then
    raise exception '٥٠/بعد: عدد دوال public مش «قبل + ٣» (قبل % ← بعد %)',
      current_setting('mizan50.fns'), v_n;
  end if;

  select count(*) into v_n from information_schema.columns where table_schema = 'public';
  if v_n <> current_setting('mizan50.cols')::int then
    raise exception '٥٠/بعد: عدد الأعمدة اتغيّر (قبل % ← بعد %)',
      current_setting('mizan50.cols'), v_n;
  end if;

  select count(*) into v_n from pg_policies where schemaname = 'public';
  if v_n <> current_setting('mizan50.pols')::int then
    raise exception '٥٠/بعد: عدد سياسات RLS اتغيّر (قبل % ← بعد %)',
      current_setting('mizan50.pols'), v_n;
  end if;

  select count(*) into v_n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r';
  if v_n <> current_setting('mizan50.tbls')::int then
    raise exception '٥٠/بعد: عدد الجداول اتغيّر (قبل % ← بعد %)',
      current_setting('mizan50.tbls'), v_n;
  end if;

  select count(*) into v_n from pg_indexes where schemaname = 'public';
  if v_n <> current_setting('mizan50.idxs')::int then
    raise exception '٥٠/بعد: عدد الفهارس اتغيّر (قبل % ← بعد %)',
      current_setting('mizan50.idxs'), v_n;
  end if;

  -- ── (٧) البيانات: ولا سطر اتلمس، وكل الرموز الموجودة زي ما هي حرفيًا (نفس الترتيب) ──
  select count(*) into v_n from public.organizations;
  if v_n <> current_setting('mizan50.orgs')::int then
    raise exception '٥٠/بعد: عدد الشركات اتغيّر (قبل % ← بعد %) — المفروض صفر كتابة',
      current_setting('mizan50.orgs'), v_n;
  end if;

  select count(*) into v_n from public.profiles;
  if v_n <> current_setting('mizan50.profs')::int then
    raise exception '٥٠/بعد: عدد الحسابات اتغيّر (قبل % ← بعد %) — المفروض صفر كتابة',
      current_setting('mizan50.profs'), v_n;
  end if;

  select coalesce(string_agg(invite_code, ',' order by name), '') into v_src from public.organizations;
  if v_src <> current_setting('mizan50.codes') then
    raise exception '٥٠/بعد: رمز دعوة اتغيّر في التنفيذ (قبل % | بعد %) — المفروض قراءة وبوابة بس',
      current_setting('mizan50.codes'), v_src;
  end if;
end $$;

-- ═══════════ ٨) إخطار PostgREST إن المخطط اتreload (آخر سطر في الملف) ═══════════
notify pgrst, 'reload schema';
