-- ============================================================================
-- ترقية ٤٩ — سحب صلاحية التنفيذ من «الزائر» ومن «أي حد» على دوال ميزان
-- (اسم التشغيل: التصحيح ٤٩ / access-grants)
-- ============================================================================
-- ⚠️ **الحالة: اتنفّذ على Supabase 03/10 ≈11:05 بأمر المالك «من 1 الى 4 بالترتيب» — النطاق (ج) `full`.**
--    الإثبات (كله مقاس، مش متوقّع): `apply_upgrade_49.js` (بمفتاحين: `MIZAN_ORDER_49="نفّذ"` +
--    `MIZAN_SCOPE_49="full"`) رجّع 13 فحصًا أخضر و0 ❌ ⇒
--    PUBLIC EXECUTE في المخطط **22 → 0** · anon EXECUTE **15 → 0** · جداول بمنح anon **30 → 0** ·
--    والمخطط ثابت (**400 عمود / 93 قيدًا / 65 دالة / 119 سياسة / 112 فهرس**) و**482 سطر بيانات في
--    37 جدول حرفيًا قبل = بعد** (لا سطر اتلمس) · وأجسام الـ65 دالة بنفس البصمة (منحٌ بس).
--    بعده: `test_access_grants_49.js` = **19 ✅ / 0 ❌ / 0 ⏸** (`anon` بترجع **401/42501** على
--    customers/organizations/profiles/treasury/`mizan_admin_orgs`، و`authenticated` لسه شغالة عادي).
--    القياس الحيّ عبر PostgREST بمفتاح النشر العام: **200 = 0** من الـ22 (كانت 6 + نبضة 204).
--    الباك أب: قبل = `D:/MizanBackups/pre-mig49-*` · بعد = `D:/MizanBackups/post-mig49-*`
--    (فيهم `grants_before|after/*.json` + **`rollback_49.sql`** مولّد من لقطة «قبل» = رجوع دقيق).
--
-- ⛔ **ممنوع إعادة تشغيل الملف كما هو:** بوابة «قبل» جواه بتفحص إن المنح العامة لسه موجودة
--    (22 PUBLIC / 15 anon / 30 جدول) — ودي باتت **فشلًا متعمّدًا** بعد التنفيذ، زي فحص
--    «messages فاضية» في ٤٥. أي تعديل لاحق على المنح = ملف **٥٠**.
--    الملف انضمّ لـ `DEPLOY_DB_FILES` واتشال من `DEPLOY_DB_EXCLUDE` (نفس نمط ٤٣ و٤٤ و٤٥).
--
--
-- ── المشكلة (مقاسة من القاعدة الحيّة 03/10 ≈08:35، مش متخيّلة) ──
-- • 65 دالة في `public` · **22 عليها EXECUTE لـ PUBLIC** و**15 عليها EXECUTE لـ `anon` صراحةً**
--   (إجمالي 37 سطر منح في `aclexplode` = 22 عام + 15 anon) · **مافيش أي دالة `proacl IS NULL`**.
-- • **30 جدول لسه تعطي `anon` منح `arwdDxtm`** (= كل العمليات) من الأيام اللي قبل RLS.
-- • **تصحيح لحقيقة كنت مكتوبها قبل كده («مافيش سياسة RLS لـ anon»):** كل الـ119 سياسة
--   معرّفة **`TO PUBLIC`** — وده معناه إنها **بتنطبق على `anon` برضه** (عام = كل الأدوار).
--   القياس الحيّ على PostgREST بمفتاح النشر العام (قراءة فقط): `GET customers / organizations /
--   treasury / profiles` بترجع **200 مع `[]`** — أي الزائر بيسأل فعلًا والسياسة بتردّ «لا سطور»،
--   بينما `messages` (اللي اتعملها منح صريح في ٤٥) بترجع **401 / 42501 «permission denied for table»**.
--   ⇒ الفرق: الدردشة مقفولة **على مستوى الدور**، والباقي مقفول **على مستوى السياسة بس**.
-- • **تصحيح تاني (قياس `probe_rpc_anon_49.js` 03/10 ≈09:05، قراءة فقط):** كنت كتبت إن نداء الدوال
--   عبر REST بدور `anon` بيرجع **404 PGRST205** ⇒ **ده كان غلط**. المقاس فعلًا: **6 دوال بترجع 200**
--   بدور الزائر (`current_org` · `mizan_access` · `mizan_admin_orgs` · `mizan_get_invoice_seq` ·
--   `mizan_get_subs_plans` (حمولة 84 بايت) · `mizan_list_docs`) و**واحدة بـ 204**
--   (`mizan_presence_heartbeat` — جسمها بيرجع بدري لو `auth.uid()` فاضي، يعني ما كتبتش سطر).
--   والباقي **404 PGRST202** («تعذّر تطابق الوظيفة») لأنهم بياخدوا وسائط — **ده فشل مطابقة
--   مش رفض أمني**، ومنح `PUBLIC` لسه موجود ومقاس في الكتالوج.
--   ⇒ **الخطر العملي مباشر ومش نظري:** دوال المالك الإدارية (`mizan_admin_orgs` بالذات) **منادة
--   الآن بكلمة السرّ العامة للمنشور من أي متصفح**، والـ `RLS` ما بتحميش من الـ `definer functions`.
--   ومنح الجداول للـ `anon` (30 جدول) = أي زائر بيوصل لفحص السياسة على أي سطر.
--
-- ── الإصلاح (مفيش أي `CREATE OR REPLACE` — الأجسام ما بتتلمسش) ──
-- لكل دالة في النطاق: `revoke execute … from public, anon` + `grant execute … to authenticated`
-- (تثبيت المنح للحسابات، مش سحب منها — وكل الـ22 عندها `authenticated=EXECUTE` فعلًا قبل
--  الترقية، فالبرنامج الحيّ ما بيتأثرش: التطبيق كله بيكلّم القاعدة بجلسة مستخدم).
-- لو `mizan_49.anon_tables = 'on'`: `revoke all on table … from anon` للجدول اللي فيه أي منح.
-- **مافيش أي لمس لسطر بيانات · مافيش أي تغيير في نص أي دالة · مافيش سياسة RLS اتغيّرت.**
--
-- ── النطاق: قرار المالك، وبيتختار بمفاتيح (مش بت rewriting الملف) ──
--   `set mizan_49.scope = 'admin'` ⇒ (أ) 6 دوال: `mizan_admin_orgs` · `mizan_admin_members`
--        · `mizan_admin_set_sub` · `mizan_admin_delete_org` · `mizan_set_subs_plans` · `mizan_access`
--   `set mizan_49.scope = 'all'`   ⇒ (ب) الـ22 كلها
--   `set mizan_49.scope = 'full'`  ⇒ (ج) الـ22 كلها **+** تنظيف منح `anon` من الـ30 جدول
--   (`'full'` بتضبط `mizan_49.anon_tables = 'on'` لوحدها، و`'all'`/`'admin'` ما تلمسش الجداول)
--   **لو المفاتيح مش متظبّطة = الرفض** (مافيش تنفيذ على عمي).
--
-- ── البوابات ──
-- «قبل»: النطاق مطلوب · الدوال الـ22 موجودة **بتواقيعها الحرفية** ومن غير `overload` ·
--         `authenticated` عندها EXECUTE على كل مستهدفة (مانقفلش التطبيق) · مافيش `proacl IS NULL` ·
--         عدد دوال `PUBLIC EXECUTE` = 22 ومجموعتها = القياس (أي انحراف = رفض وأعد القياس) ·
--         مافيش سياسة `roles` فيها `anon` صراحة · الجداول المستهدفة بالتظيف = 30 (لو النطاق ج) ·
--         بصمة أجسام الـ65 = `2220d58d3a73d3f0fe23afee8725f7a8`.
-- «بعد»: مافيش سطر `EXECUTE` لـ PUBLIC أو `anon` على أي دالة في النطاق · `authenticated`
--         لسه عندها EXECUTE (عدد = حجم النطاق) · `proacl` مش NULL · الأجسام بنفس البصمة ·
--         الـ65 دالة والـ119 سياسة والـ37 جدول RLS عددهم زي ما هو · (لو ج) صفر جدول فيه منح لـ `anon`.
-- أي فشل جوّه البوابات = `raise exception` ⇒ أداة التنفيذ بتعمل **ROLLBACK كامل**.
-- مافيش `begin/commit` هنا — المعاملة ملك `apply_upgrade_49.js`.
-- ============================================================================

-- ═══ ١) بوابة الفحص قبل ═══
do $$
declare
  v_scope text := coalesce(nullif(current_setting('mizan_49.scope', true), ''), '');
  v_tables text := coalesce(nullif(current_setting('mizan_49.anon_tables', true), ''), 'off');
  v_names text[] := array[
    'create_org_and_profile','current_org','join_org','mizan_access','mizan_add_doc',
    'mizan_admin_delete_org','mizan_admin_members','mizan_admin_orgs','mizan_admin_set_sub',
    'mizan_bump_invoice_seq','mizan_del_doc','mizan_doc_priv','mizan_get_invoice_seq',
    'mizan_get_subs_plans','mizan_list_docs','mizan_list_retired','mizan_next_code',
    'mizan_next_invoice_no','mizan_presence_heartbeat','mizan_retire_code',
    'mizan_set_subs_plans','mizan_treasury_next_local'];
  v_admin text[] := array['mizan_admin_orgs','mizan_admin_members','mizan_admin_set_sub',
    'mizan_admin_delete_org','mizan_set_subs_plans','mizan_access'];
  v_want text[];
  -- التواقيع الحرفية المقاسة 03/10 من pg_get_function_identity_arguments
  v_sigs text[] := array[
    'create_org_and_profile|p_org_name text, p_name text',
    'current_org|',
    'join_org|p_code text, p_name text',
    'mizan_access|',
    'mizan_add_doc|p_party_type text, p_party_id bigint, p_party_code text, p_file_name text, p_ext text, p_rel text, p_type text, p_size bigint',
    'mizan_admin_delete_org|p_org_id uuid, p_mode text',
    'mizan_admin_members|p_org_id uuid',
    'mizan_admin_orgs|',
    'mizan_admin_set_sub|p_org_id uuid, p_plan_start date, p_plan_end date, p_plan text, p_price numeric, p_unlock boolean',
    'mizan_bump_invoice_seq|p_kind text, p_value bigint',
    'mizan_del_doc|p_doc uuid',
    'mizan_doc_priv|p_org uuid',
    'mizan_get_invoice_seq|',
    'mizan_get_subs_plans|',
    'mizan_list_docs|p_party_type text, p_party_code text',
    'mizan_list_retired|p_party_type text',
    'mizan_next_code|p_party_type text',
    'mizan_next_invoice_no|p_kind text',
    'mizan_presence_heartbeat|',
    'mizan_retire_code|p_party_type text, p_code text',
    'mizan_set_subs_plans|p_plans jsonb',
    'mizan_treasury_next_local|p_org uuid, p_id uuid'];
  v_n int;
  v_miss text;
  v_fp text;
begin
  -- (١) النطاق لازم يتقال صراحة
  if v_scope = 'admin' then v_want := v_admin;
  elsif v_scope = 'all' then v_want := v_names;
  elsif v_scope = 'full' then v_want := v_names; v_tables := 'on';
  else raise exception '٤٩: mizan_49.scope مش متظبّط (المسموح: admin / all / full) — مافيش تنفيذ على عمي';
  end if;
  if v_tables not in ('on','off') then raise exception '٤٩: mizan_49.anon_tables مسموحها on أو off بس، واللي اتظبط: %', v_tables; end if;
  if array_length(v_want, 1) < 1 then raise exception '٤٩: النطاق فاضي'; end if;

  -- (٢) الدوال موجودة، وحدة وحدة بـ overload، وبتواقيعها الحرفية
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(v_want);
  if v_n <> array_length(v_want, 1) then
    raise exception '٤٩: الدوال المستهدفة % بس اللي موجودة % — فرق في الأسماء، أعد القياس', array_length(v_want, 1), v_n;
  end if;
  -- ملاحظة محاسبية: `<> ANY` معناها «مختلفة عن واحدة على الأقل» ⇒ دايمًا صحيحة.
  -- الصيغة الصح «مش موجودة في القياس» = `not (s = any(...))`.
  select count(*) into v_n from (
    select p.proname || '|' || pg_get_function_identity_arguments(p.oid) s from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any(v_names)) t
    where not (t.s = any(v_sigs));
  if v_n <> 0 then
    raise exception '٤٩: % دالة من الـ22 توقيعها مش مطابق للياس المحفوظ — الوقف، أعد القياس', v_n;
  end if;
  select count(*) into v_n from (
    select p.proname, count(*) c from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any(v_names) group by 1 having count(*) > 1) t;
  if v_n <> 0 then raise exception '٤٩: فيه اسم دالة بـ overload (% حالة) ⇒ التواقيع مش وحيدة، الوقف', v_n; end if;

  -- (٣) PUBLIC EXECUTE الآن = 22 ونفس المجموعة (أي انحراف = إعادة قياس)
  select count(distinct p.oid) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    left join aclexplode(p.proacl) a on true
   where n.nspname = 'public' and a.grantee = 0 and a.privilege_type = 'EXECUTE';
  if v_n <> 22 then raise exception '٤٩: عدد دوال PUBLIC EXECUTE بقى % مش 22 — المخطط اتحرك، أعد القياس قبل التنفيذ', v_n; end if;
  select coalesce(string_agg(x, ',' order by x), '') into v_miss from (
    select p.proname || '=' || a.grantee::text x from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join aclexplode(p.proacl) a on true
     where n.nspname = 'public' and a.grantee = 0 and a.privilege_type = 'EXECUTE'
       and not (p.proname = any(v_names))) t;
  if v_miss <> '' then raise exception '٤٩: منح PUBLIC على دوال بره القياس المحفوظ: %', v_miss; end if;
  select coalesce(string_agg(x, ',' order by x), '') into v_miss from (
    select p.proname x from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join aclexplode(p.proacl) a on true
     where n.nspname = 'public' and a.grantee = 'anon'::regrole::oid and a.privilege_type = 'EXECUTE'
       and not (p.proname = any(v_names))) t;
  if v_miss <> '' then raise exception '٤٩: منح anon على دوال بره القياس المحفوظ: %', v_miss; end if;

  -- (٤) مانقفلش التطبيق: authenticated لازم تبقى عندها EXECUTE قبل (فالمنح بعد = تثبيت مش فتح)
  select coalesce(string_agg(p.proname, ', '), '') into v_miss from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = any(v_want)
     and not has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_miss <> '' then raise exception '٤٩: دوال مستهدفة ماعندهاش EXECUTE لـ authenticated: % — السحب هيقفّل التطبيق، الوقف', v_miss; end if;

  -- (٥) مافيش proacl IS NULL (NULL = PUBLIC مسموح ضمنيًا والـ revoke عليه محتاج تصرف تاني)
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proacl is null;
  if v_n <> 0 then raise exception '٤٩: فيه % دالة proaclها NULL (منح ضمني) — خارج نطاق الملف ده، أعد القياس', v_n; end if;

  -- (٦) مافيش سياسة RLS بتستهدف anon صراحة (السياسات كله TO PUBLIC)
  select count(*) into v_n from pg_policies where schemaname = 'public' and roles::text[] && array['anon'];
  if v_n <> 0 then raise exception '٤٩: فيه % سياسة rolesها anon صراحة — السحب بيغيّر سلوكها، الوقف للمراجعة', v_n; end if;

  -- (٦ب) عدد الجداول بـ RLS مفعّل = 37 (قياس 03/10: 38 جدول، وsubs_plans_cfg بس بلا RLS)
  --      البوابة «قبل» لازم تمسك الانحراف ده **قبل** أي revoke، مش بعدها بس.
  select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity = true;
  if v_n <> 37 then raise exception '٤٩: عدد الجداول بـ RLS مفعّل بقى % مش 37 — حد قفل/فتح RLS من وقت القياس، أعد القياس', v_n; end if;

  -- (٧) الجداول المستهدفة (لو النطاق ج) = 30 زي القياس
  if v_tables = 'on' then
    select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
          or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE')
          or has_table_privilege('anon', c.oid, 'REFERENCES') or has_table_privilege('anon', c.oid, 'TRIGGER'));
    if v_n <> 30 then raise exception '٤٩: الجداول اللي ليها منح anon بقت % مش 30 — أعد القياس قبل التنظيف', v_n; end if;
  end if;

  -- (٨) بصمة الأجسام: الترقية منحٌ بس، فأي تغيير في نص أي دالة = رفض
  select md5(string_agg(p.proname || '=' || md5(p.prosrc), E'\n' order by p.proname || '=' || md5(p.prosrc)))
    into v_fp from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';
  if v_fp <> '2220d58d3a73d3f0fe23afee8725f7a8' then
    raise exception '٤٩: بصمة أجسام الـ65 دالة = % مش المحفوظة — مافيش أي نص دالة المفروض يتغيّر هنا', v_fp;
  end if;

  raise notice '٤٩/قبل: النطاق = % (% دالة) · تنظيف جداول anon = % · المنح الحالية: 22 PUBLIC / 15 anon',
    v_scope, array_length(v_want, 1), v_tables;
end $$;

-- ═══ ٢) التنفيذ — منحٌ بس ═══
do $$
declare
  v_scope text := coalesce(nullif(current_setting('mizan_49.scope', true), ''), '');
  v_tables text := coalesce(nullif(current_setting('mizan_49.anon_tables', true), ''), 'off');
  v_names text[] := array[
    'create_org_and_profile','current_org','join_org','mizan_access','mizan_add_doc',
    'mizan_admin_delete_org','mizan_admin_members','mizan_admin_orgs','mizan_admin_set_sub',
    'mizan_bump_invoice_seq','mizan_del_doc','mizan_doc_priv','mizan_get_invoice_seq',
    'mizan_get_subs_plans','mizan_list_docs','mizan_list_retired','mizan_next_code',
    'mizan_next_invoice_no','mizan_presence_heartbeat','mizan_retire_code',
    'mizan_set_subs_plans','mizan_treasury_next_local'];
  v_admin text[] := array['mizan_admin_orgs','mizan_admin_members','mizan_admin_set_sub',
    'mizan_admin_delete_org','mizan_set_subs_plans','mizan_access'];
  v_want text[];
  r record;
  n int := 0;
begin
  if v_scope = 'admin' then v_want := v_admin;
  elsif v_scope in ('all','full') then v_want := v_names;
  else raise exception '٤٩: mizan_49.scope مش متظبّط'; end if;
  if v_scope = 'full' then v_tables := 'on'; end if;

  for r in execute $q$ select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
                          from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                         where ns.nspname = 'public' and p.proname = any($1) order by p.proname $q$
             using v_want
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated', r.proname, r.args);
    n := n + 1;
  end loop;
  if n <> array_length(v_want, 1) then
    raise exception '٤٩: عدلت % دالة بس والمستهدف % — الوقف', n, array_length(v_want, 1);
  end if;
  raise notice '٤٩: سحبت PUBLIC/anon EXECUTE وثبّت authenticated لـ % دالة', n;

  if v_tables = 'on' then
    n := 0;
    for r in execute $qt$ select c.oid, c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                            where ns.nspname = 'public' and c.relkind = 'r'
                              and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
                                or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE')
                                or has_table_privilege('anon', c.oid, 'REFERENCES') or has_table_privilege('anon', c.oid, 'TRIGGER'))
                            order by c.relname $qt$
    loop
      execute format('revoke all on table public.%I from anon', r.relname);
      n := n + 1;
    end loop;
    raise notice '٤٩/تنظيف: سحبت كل منح anon من % جدول', n;
  end if;
end $$;

-- ═══ ٣) بوابة الفحص بعد ═══
do $$
declare
  v_scope text := coalesce(nullif(current_setting('mizan_49.scope', true), ''), '');
  v_tables text := coalesce(nullif(current_setting('mizan_49.anon_tables', true), ''), 'off');
  v_names text[] := array[
    'create_org_and_profile','current_org','join_org','mizan_access','mizan_add_doc',
    'mizan_admin_delete_org','mizan_admin_members','mizan_admin_orgs','mizan_admin_set_sub',
    'mizan_bump_invoice_seq','mizan_del_doc','mizan_doc_priv','mizan_get_invoice_seq',
    'mizan_get_subs_plans','mizan_list_docs','mizan_list_retired','mizan_next_code',
    'mizan_next_invoice_no','mizan_presence_heartbeat','mizan_retire_code',
    'mizan_set_subs_plans','mizan_treasury_next_local'];
  v_admin text[] := array['mizan_admin_orgs','mizan_admin_members','mizan_admin_set_sub',
    'mizan_admin_delete_org','mizan_set_subs_plans','mizan_access'];
  v_want text[];
  v_n int;
  v_left text;
  v_fp text;
begin
  if v_scope = 'admin' then v_want := v_admin;
  elsif v_scope in ('all','full') then v_want := v_names;
  else raise exception '٤٩/بعد: mizan_49.scope مش متظبّط'; end if;
  if v_scope = 'full' then v_tables := 'on'; end if;

  -- (١) مافيش أي سطر EXECUTE لـ PUBLIC أو anon على دوال النطاق
  select coalesce(string_agg(x, ', ' order by x), '') into v_left from (
    select p.proname || '→' || case when a.grantee = 0 then 'PUBLIC' else 'anon' end x
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      join aclexplode(p.proacl) a on true
     where n.nspname = 'public' and p.proname = any(v_want)
       and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid)) t;
  if v_left <> '' then raise exception '٤٩/بعد: لسه فيه منح زائر/عام: %', v_left; end if;

  -- (٢) authenticated لسه يقدر (مانقفلش التطبيق) — عدد = حجم النطاق
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(v_want)
      and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_n <> array_length(v_want, 1) then
    raise exception '٤٩/بعد: authenticated لسه مالهاش EXECUTE على % من % دالة', array_length(v_want, 1) - v_n, array_length(v_want, 1);
  end if;

  -- (٣) proacl مش NULL · والدوال بره النطاق ما اتلمستش (بصمة الأجسام + الأعداد)
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(v_want) and p.proacl is null;
  if v_n <> 0 then raise exception '٤٩/بعد: % دالة اتساب لها proacl NULL', v_n; end if;
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';
  if v_n <> 65 then raise exception '٤٩/بعد: عدد دوال public بقى % مش 65', v_n; end if;
  select count(*) into v_n from pg_policies where schemaname = 'public';
  if v_n <> 119 then raise exception '٤٩/بعد: عدد سياسات RLS بقى % مش 119', v_n; end if;
  select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity = true;
  if v_n <> 37 then raise exception '٤٩/بعد: عدد الجداول بـ RLS مفعّل بقى % مش 37', v_n; end if;
  select md5(string_agg(p.proname || '=' || md5(p.prosrc), E'\n' order by p.proname || '=' || md5(p.prosrc)))
    into v_fp from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';
  if v_fp <> '2220d58d3a73d3f0fe23afee8725f7a8' then
    raise exception '٤٩/بعد: بصمة الأجسام اتغيرت (% ⇒ مافيش CREATE OR REPLACE هنا!)', v_fp;
  end if;

  -- (٤) الجداول: اللي مفروض تتلمس بس
  select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'REFERENCES') or has_table_privilege('anon', c.oid, 'TRIGGER'));
  if v_tables = 'on' then
    if v_n <> 0 then raise exception '٤٩/بعد: لسه % جدول فيه منح anon رغم إن التنظيف مطلوب', v_n; end if;
    -- منح authenticated على الجداول ما تتلمسش
    select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'SELECT');
    if v_n < 30 then raise exception '٤٩/بعد: authenticated فقدت SELECT على الجداول (% بس)', v_n; end if;
  else
    if v_n <> 30 then raise exception '٤٩/بعد: التنظيف مش مطلوب ومع ذلك عدد جداول anon بقى % مش 30', v_n; end if;
  end if;

  raise notice '٤٩/بعد: ✅ النطاق % خلص — صفر منح عام/زائر على المستهدف، وauthenticated كاملة، والمخطط ثابت', v_scope;
end $$;

-- بعد تغيير المنح، PostgREST محتاج يعيد قراءة كتالوج الصلاحيات
notify pgrst, 'reload schema';
