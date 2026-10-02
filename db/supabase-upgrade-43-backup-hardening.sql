-- ============================================================
-- ترحيل ٤٣: تحصين دوال النسخ الاحتياطي الأربعة (بنية فقط — مافيش أي بيانات)
-- طلب المالك 2026-10-02: «حصن دوال النسخ» + «الثالث نفذ».
--
-- ⚠️ الحالة: **لم يُنفَّذ.** مستني أمر المالك الصريح (قاعدة العمل رقم 5).
--
-- الغلط اللي بيتصلّح (من قياس القاعدة الحيّة 02/10 01:53 في
-- D:/_work/temp/probe_backup_fns_43.js — قراءة فقط، والناتج محفوظ في
-- D:/_work/temp/_backup_fns_defs_43.json):
--   (١) منح **PUBLIC EXECUTE** على `mizan_admin_backup_full` و`mizan_admin_restore_full`
--       ⇒ أي دور (وبما فيهم `anon` عن طريق PostgREST) يقدر يناديهم. الحماية الحالية
--       جوه الدالة بس (فحص `is_superadmin`)، مش من المنح. ده الأخطر.
--   (٢) `search_path` مالوش تثبيت على `pg_temp` آخر المسار ⇒ نظرية trojan: مخطط مؤقت
--       في أول المسار يقدر يظلّل أسماء غير مؤهّلة.
--   (٣) `auth` جوّه مسار زوج المالك ⇒ كل المراجع في النص مؤهّلة فعلًا (`auth.uid` /
--       `auth.users` / `auth.identities`) فالسحب آمن ويقلّل السطح.
--
-- ملاحظات أمان ودقة:
--   • **مافيش `CREATE OR REPLACE` خالص:** التعديل بـ `ALTER FUNCTION ... SET search_path`
--     و`REVOKE`/`GRANT` ⇒ **نص الدالة الأربعة يفضل حرفيًا بايت-بايت** (وإحنا محفظين md5
--     لكل نص عشان تثبت ده قبل وبعد). مافيش أي احتمال نقل غلط لـ ٢٤ ألف حرف.
--   • كل جداول/دوال داخل النصوص مؤهّلة بـ `public.`/`auth.`/`information_schema.` —
--     تم فحصه حرفيًا (مافيش اسم جدول عار) ⇒ تغيير المسار ما بيكسورش حاجة.
--   • `authenticated` بيفضل عنده EXECUTE على الأربعة ⇒ التطبيق السحابي بيشتغل زي ما هو
--     (النداءات بتروح بجوّه المستخدم، مش `anon`).
--   • المالك (عادل) وحده يقدر ينادي زوج المالك — ده جوه النصوص أصلًا، والسحب من
--     `anon`/`PUBLIC` بيضيف طبقة تانية قبل ما التنفيذ يوصل للفحص الجوهي.
--   • **مافيش أي لمس لسطر واحد:** الترحيل دوال + منح بس (392 عمود / 88 قيد / 61 دالة /
--     116 سياسة / 108 فهرس + 431 سطر بيانات — قبل وبعد).
--   • الـ REVOKE بـ RESTRICT (الافتراضي): لو كان فيه منح مُعاد منحه لشخص تاني
--     هيفشل بصوت عالي ويتراجع كل حاجة — احنا عايزين كده، مش CASCADE يخفيها.
-- ============================================================

-- ⚠️ المعاملة: الملف ده بيتنفّذ ملفوف في transaction واحدة عن طريق
--    D:/_work/temp/apply_upgrade_43.js (عبر mig_common.guardedRun: قبل ⇒ تنفيذ ⇒
--    6 فحوصات ⇒ commit أو ROLLBACK كامل). عشان كده مافيش begin/commit جواه —
--    ولو نفّذته يدويًا في SQL Editor فلفّه انت في begin … commit بنفسك.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- (٠) فحص ما قبل التنفيذ: التعريفات الحيّة = اللي اتقاست 02/10 01:53 بالحرف.
--     لو أي واحد اختلف ⇒ الدالة اتغيرت من وقت القياس، والأفضل نعيد القياس
--     قبل ما نكمّل. الفشل هنا = ROLLBACK كامل وبلا أثر.
--     (md5 محسوبة من `pg_get_functiondef` من موضع 'AS $function$' لآخر النص)
-- ------------------------------------------------------------
do $$
declare
  v_md5 text;
begin
  select md5(substring(def from position('AS $function$' in def))) into v_md5
  from (select pg_get_functiondef(p.oid) as def
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'mizan_admin_backup_full') x;
  if v_md5 is distinct from 'b301b3f765c79caa731596dd84aa1b3b' then
    raise exception 'فحص ٤٣-قبل: نص mizan_admin_backup_full اختلف عن القياس (md5=%) — وقف وأعد القياس', v_md5;
  end if;

  select md5(substring(def from position('AS $function$' in def))) into v_md5
  from (select pg_get_functiondef(p.oid) as def
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'mizan_admin_restore_full') x;
  if v_md5 is distinct from '010da879c9c6bdbf7334e96275cebefc' then
    raise exception 'فحص ٤٣-قبل: نص mizan_admin_restore_full اختلف عن القياس (md5=%) — وقف وأعد القياس', v_md5;
  end if;

  select md5(substring(def from position('AS $function$' in def))) into v_md5
  from (select pg_get_functiondef(p.oid) as def
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'mizan_client_export') x;
  if v_md5 is distinct from '9148308e8c79c97dffcf3fff98307863' then
    raise exception 'فحص ٤٣-قبل: نص mizan_client_export اختلف عن القياس (md5=%) — وقف وأعد القياس', v_md5;
  end if;

  select md5(substring(def from position('AS $function$' in def))) into v_md5
  from (select pg_get_functiondef(p.oid) as def
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'mizan_client_restore') x;
  if v_md5 is distinct from '027f47f0c121d4822d34c42e188a5375' then
    raise exception 'فحص ٤٣-قبل: نص mizan_client_restore اختلف عن القياس (md5=%) — وقف وأعد القياس', v_md5;
  end if;

  raise notice 'فحص ٤٣-قبل ✓ النصوص الأربعة مطابقة حرفيًا للقياس (مافيش انحراف قبل التعديل)';
end $$;

-- ------------------------------------------------------------
-- (٠ب) لقطة المخطط قبل التنفيذ (جوه نفس المعاملة) — الفحص اللي بعد التنفيذ
--      بيقارن بيها، فمش ماسك أرقام ثابتة ممكن تتغير بين يوم ويوم.
--      القيم وقت قياس 02/10: 392 عمود / 88 قيد / 61 دالة / 116 سياسة / 108 فهرس
-- ------------------------------------------------------------
create temp table mizan_43_before on commit drop as
select (select count(*) from information_schema.columns where table_schema = 'public')::int as cols,
       (select count(*) from pg_constraint con join pg_namespace n on n.oid = con.connamespace
          where n.nspname = 'public')::int as cons,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public')::int as fns,
       (select count(*) from pg_policies where schemaname = 'public')::int as pols,
       (select count(*) from pg_indexes where schemaname = 'public')::int as idxs;

-- ------------------------------------------------------------
-- (١) سحب EXECUTE من PUBLIC و anon عن الأربعة، وتثبيته لـ authenticated
-- ------------------------------------------------------------
revoke execute on function public.mizan_admin_backup_full()       from public, anon;
revoke execute on function public.mizan_admin_restore_full(jsonb) from public, anon;
revoke execute on function public.mizan_client_export()           from anon;
revoke execute on function public.mizan_client_restore(text, jsonb) from anon;

grant execute on function public.mizan_admin_backup_full()        to authenticated;
grant execute on function public.mizan_admin_restore_full(jsonb)  to authenticated;
grant execute on function public.mizan_client_export()            to authenticated;
grant execute on function public.mizan_client_restore(text, jsonb) to authenticated;

-- ------------------------------------------------------------
-- (٢) و(٣) تثبيت المسار: `public` أولًا و`pg_temp` آخره دائمًا، وسحب `auth`
--          من زوج المالك (كل المراجع `auth.*` مؤهّلة أصلًا).
-- ------------------------------------------------------------
alter function public.mizan_admin_backup_full()         set search_path = 'public', 'pg_temp';
alter function public.mizan_admin_restore_full(jsonb)   set search_path = 'public', 'pg_temp';
alter function public.mizan_client_export()             set search_path = 'public', 'pg_temp';
alter function public.mizan_client_restore(text, jsonb) set search_path = 'public', 'pg_temp';

-- ------------------------------------------------------------
-- (٤) فحوصات بعد التنفيذ: أي فشل = ROLLBACK كامل (مافيش نصف تنفيذ).
--     الفحوصات بتقرأ التمثيل الحقيقي (aclexplode + عناصر proconfig) مش نص
--     تقريبي، فمتفشلش بسبب صيغة التخزين.
-- ------------------------------------------------------------
do $$
declare
  r        record;
  v_set    text;
  v_arr    text[];
  v_first  text;
  v_last   text;
  v_count  int;
  v_b      mizan_43_before%rowtype;
  v_a      mizan_43_before%rowtype;
begin
  -- أ) المسار: موجود، أوله public، آخره pg_temp، ومافيش auth
  for r in select p.oid, p.proname, p.proconfig
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full',
                                'mizan_client_export','mizan_client_restore')
  loop
    v_set := null;
    select i into v_set from unnest(r.proconfig) i
      where lower(i) like 'search\_path=%' escape '\' limit 1;
    if v_set is null then
      raise exception 'فحص ٤٣-بعد: % ملوش search_path مثبّت (proconfig=%)', r.proname,
        coalesce(array_to_string(r.proconfig, ' ; '), '(فاضي)');
    end if;
    v_set := lower(trim(substring(v_set from length('search_path=') + 1)));
    v_arr := regexp_split_to_array(v_set, ',');
    v_first := trim(both '"' from trim(v_arr[1]));
    v_last  := trim(both '"' from trim(v_arr[array_length(v_arr, 1)]));
    if v_first <> 'public' then
      raise exception 'فحص ٤٣-بعد: % أول المسار = % (مفروض public)', r.proname, v_first;
    end if;
    if v_last <> 'pg_temp' then
      raise exception 'فحص ٤٣-بعد: % آخر المسار = % (مفروض pg_temp — ده التحصين الأساسي)', r.proname, v_last;
    end if;
    if v_set like '%auth%' then
      raise exception 'فحص ٤٣-بعد: % لسه فيه auth جوّه المسار (% — سحبه أأمن)', r.proname, v_set;
    end if;
  end loop;

  -- ب) مافيش أي EXECUTE لـ PUBLIC (grantee=0) أو anon على الأربعة.
  --    ملاحظة دقيقة: لو proacl فاضي (NULL) يبقى المنح «افتراضي» = PUBLIC عنده
  --    execute ضمنيًا! فبنطلب صراحة إن ACL بقى مكتوب (غير NULL) على الأربعة.
  select count(*) into v_count from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full',
                        'mizan_client_export','mizan_client_restore')
      and p.proacl is not null;
  if v_count <> 4 then
    raise exception 'فحص ٤٣-بعد: ACL مكتوب على % دالة بس (مفروض 4) — اتركها NULL معناه PUBLIC مسموح ضمنيًا', v_count;
  end if;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join lateral aclexplode(p.proacl) a on true
  where n.nspname = 'public'
    and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full',
                      'mizan_client_export','mizan_client_restore')
    and a.privilege_type = 'EXECUTE'
    and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  if v_count <> 0 then
    raise exception 'فحص ٤٣-بعد: PUBLIC/anon لسه عندهم execute على % دالة — السحب ما اتنفّذش', v_count;
  end if;

  -- ج) authenticated محتفظ بالـ execute على الأربعة (وإلا التطبيق السحابي يكسر)
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join lateral aclexplode(p.proacl) a on true
  where n.nspname = 'public'
    and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full',
                      'mizan_client_export','mizan_client_restore')
    and a.privilege_type = 'EXECUTE'
    and a.grantee = 'authenticated'::regrole::oid;
  if v_count <> 4 then
    raise exception 'فحص ٤٣-بعد: authenticated فقد execute (عدد الممنوح = %، مفروض 4)', v_count;
  end if;

  -- د) النصوص لسه حرفية (ALTER ما بيغيّرش النص) — إعادة نفس md5 بتاعة القياس
  select count(*) into v_count
  from (
    select p.proname,
           md5(substring(pg_get_functiondef(p.oid)
                 from position('AS $function$' in pg_get_functiondef(p.oid)))) as h
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full',
                        'mizan_client_export','mizan_client_restore')
  ) x
  where (x.proname = 'mizan_admin_backup_full'   and x.h = 'b301b3f765c79caa731596dd84aa1b3b')
     or (x.proname = 'mizan_admin_restore_full'  and x.h = '010da879c9c6bdbf7334e96275cebefc')
     or (x.proname = 'mizan_client_export'       and x.h = '9148308e8c79c97dffcf3fff98307863')
     or (x.proname = 'mizan_client_restore'      and x.h = '027f47f0c121d4822d34c42e188a5375');
  if v_count <> 4 then
    raise exception 'فحص ٤٣-بعد: نص دالة واحدة على الأقل اتغير (% من 4 مطابق) — وقف', v_count;
  end if;

  -- هـ) باقي البنية ما اتلمستش: الأرقام بعد = الأرقام قبل (المتاخدة في mizan_43_before).
  --    وقت قياس 02/10 كانت: 392 عمود / 88 قيد / 61 دالة / 116 سياسة / 108 فهرس
  select * into v_b from mizan_43_before;
  select
    (select count(*) from information_schema.columns where table_schema = 'public')::int,
    (select count(*) from pg_constraint con join pg_namespace n on n.oid = con.connamespace
       where n.nspname = 'public')::int,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public')::int,
    (select count(*) from pg_policies where schemaname = 'public')::int,
    (select count(*) from pg_indexes where schemaname = 'public')::int
    into v_a;
  if v_a.cols <> v_b.cols or v_a.cons <> v_b.cons or v_a.fns <> v_b.fns
     or v_a.pols <> v_b.pols or v_a.idxs <> v_b.idxs then
    raise exception 'فحص ٤٣-بعد: المخطط اتغير! قبل (%) بعد (%)', v_b::text, v_a::text;
  end if;

  raise notice 'فحص ٤٣-بعد ✓ المسار (public … pg_temp) · PUBLIC/anon مسحوب · authenticated محفوظ (4/4) · النصوص حرفية · المخطط ثابت: % عمود / % قيد / % دالة / % سياسة / % فهرس',
    v_a.cols, v_a.cons, v_a.fns, v_a.pols, v_a.idxs;
end $$;

-- ------------------------------------------------------------
-- (٥) عرض التشخيص (للمنفِّذ يقراه في اللوج قبل COMMIT)
-- ------------------------------------------------------------
select p.proname as "الدالة",
       coalesce(array_to_string(p.proconfig, ' ; '), '(لا شيء)') as "proconfig",
       coalesce(array_to_string(p.proacl,  ' ; '), '(افتراضي)')  as "proacl",
       p.prosecdef as "security_definer",
       pg_get_userbyid(p.proowner) as "المالك"
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full',
                    'mizan_client_export','mizan_client_restore')
order by 1;

-- ============================================================
-- ✅ الرجوع لوضع ما قبل الترحيل (حرفيًا زي القياس 02/10 01:53):
--
--   alter function public.mizan_admin_backup_full()         set search_path = 'public', 'auth';
--   alter function public.mizan_admin_restore_full(jsonb)   set search_path = 'public', 'auth';
--   alter function public.mizan_client_export()             set search_path = 'public';
--   alter function public.mizan_client_restore(text, jsonb) set search_path = 'public';
--   grant execute on function public.mizan_admin_backup_full()          to public;
--   grant execute on function public.mizan_admin_restore_full(jsonb)    to public;
--   (زوج العميل ما كانش ممنوح PUBLIC أصلًا — مافيش حاجة ترجّعه)
-- ============================================================

-- (الـ commit بيتم بعد فحوصات apply_upgrade_43.js — ملهمش commit جوه الملف)

-- ============================================================
-- سجل التنفيذ: (فاضي — لسه ما اتنفّذش)
--   التاريخ/الساعة: …    المنفِّذ: …    الأداة: D:/_work/temp/apply_upgrade_43.js
--   مخطط قبل: 392 عمود / 88 قيد / 61 دالة / 116 سياسة / 108 فهرس · 431 سطر بيانات
--   مخطط بعد: …   (مفروض حرفيًا زي قبل — الترحيل دوال + منح بس)
--   باك أب قبل: …   باك أب بعد: …
--   اختبار سلوكي بعد التنفيذ: D:/_work/temp/test_backup_hardening_43.js
--     · JWT حقيقي لعضو عادي → زوج المالك مرفوض (من المنح دلوقتي، مش من جوه الدالة بس)
--     · JWT المالك → mizan_admin_backup_full() ترجّع jsonb كامل وفيه fixed_assets
--     · anon (مفتاح المصادقة العام، بلا JWT) → 42501 insufficient privilege
--     · عدد الدوال والسياسات والأعمدة ثابت + md5 النصوص الأربعة ثابت
-- ============================================================
