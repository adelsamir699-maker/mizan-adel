-- ترقية ٤٦ — «صاحب المؤسسة» الصح + نقطة المتصل الأخضر (بند 20/أ + بند 20/د)
--
-- ✅ **نُفّذت على السحابة 03/10 ≈13:44** بأمر المالك الحرفي «من 1 الى 4 بالترتيب» (سطر ٢).
--    الأداة: MIZAN_ORDER_46="نفّذ" node D:/_work/temp/apply_upgrade_46.js → transaction واحدة،
--    ٦ فحوص داخلية + ٣ بصمات md5 للبيانات، وأخضر ⇒ commit (وأي فشل كان ROLLBACK كامل).
--    الباك أب: قبل = D:/MizanBackups/pre-mig46-20261003-1304 (schema+data+worktree.tar)
--              بعد = D:/MizanBackups/post-mig46-20261003-1354 (schema+data+logs+tools)
--    الرجوع جاهز: pre-mig46-…/rollback_46.sql (نص الدوال الثلاثة قبل ٤٦ حرفيًا من لقطة «قبل»
--              + حذف mizan_is_owner) — **لا يُنفّذ إلا بأمر المالك الحرفي وبعَد باك أب جديد**.
--    الإثبات بعد التنفيذ: lint 31/0 · حارس سلوكي قراءة-فقط test_chat_owners_46.js = **59 ✅/0 ❌**
--              (١٠ أقسام: التعريف · منح anon مرفوضة 42501 · عادل يشوف ٦ أصحاب مؤسسات ·
--               كل مالك ما يشوفش شركة تانية · العضو ما يشوفش عادل · سويتش «all» · نقطة المتصل ·
--               org_info بنفس التوقيع · خصوصية messages · بصمات البيانات بعد rollback)
--              والمخطط الحيّ: ٦٦ دالة (65+1) · ٤٠٠ عمود · ٩٣ قيد · ١١٩ سياسة · ١١٢ فهرس · ٣٨ جدول
--              وباقي ٦٢ دالة بايت-بايت زي ما كانت · ٣٢/٣٨ ملف بيانات مطابق بالبايت.
--    ⚠️ ممنوع إعادة تشغيل الملف كما هو الآن (قسم ٠ فيه فحوص «قبل» باتت فشلًا متعمّدًا).
--
-- السبب الجذري اللي الترقية دي بتقفلوا (#146):
--   ترقية ٤٥ كانت بتعرّف «صاحب المؤسسة» بـ organizations.owner_id، وعلى البيانات الحيّة
--   كل الشركات فيها owner_id = عادل ⇒ قائمة «أصحاب المؤسسات» بتاعته = صفر، والموظف
--   اللي دوره admin ما كانش بيقدر يوصل عادل أصلًا.
--
--   وقرار المالك الحرفي اللي حسم الموضوع (03/10 ≈04:20):
--     «البرنامج بيعرّف صاحب الشركة بـ«مدير مش مالك». إما يتوحّد على تعريف البرنامج»
--   ⇒ **التعريف الوحيد في ميزان كله = تعريف التطبيق**: `role='admin'` و**ليس** `is_superadmin`.
--     (app.js: بناء 126 فيه دالة واحدة اسمها `isCompanyOwnerRow` وكل الأبواب بتناديها،
--      والتسمية العربية بقت «مالك الشركة» بدل «مدير»، و«مالك البرنامج» لعادل.)
--   فرع `organizations.owner_id` **اتشال** من mizan_is_owner بالقرار ده: هو عمود تاني
--     ومش تعريف، وعلى البيانات الحالية كله عادل ⇒ ما بيضيفش حاجة، وبيفتح باب تعارض تاني.
--   وبنفس القرار `mizan_org_info.is_org_admin` (ترقية ١٧) كانت بتحسبها `role='admin'` بس
--     من غير استثناء المالك ⇒ بقت بتنادي `mizan_is_owner` هي كمان، فالتعريف السحابي
--     والتطبيقي سطر واحد. (`is_org_admin_or_super()` من ترقية ١٨ **ما اتلمستش** عمدًا:
--     دي بوابة «مين عنده صلاحية حذف» وهي UNION مقصود بيتضمن المالك، مش تعريف ملكية.)
--
-- الترقية دي **ما بتعملش**: مافيش جدول جديد · مافيش عمود · مافيش فهرس · مافيش سياسة
--   RLS جديدة أو متغيّرة · مافيش حذف أو تعديل أي سطر · مافيش لمس لدوال النسخ الاحتياطي.
--   كل التغييرات على ٤ دوال (مساعد جديد + peer + peers + org_info بنفس التوقيع).
--
-- قواعد المالك الليفضلوا حرفيين (ممنوع أي واحد فيهم يتكسر — والفحص بعد بيشهد على ده):
--   «محدش يقدر يشوف رسايل مش مبعوته له» · «محدش يقدر يشوف رسايل حد اعتبرها خصوصية»
--   · «محدش يقدر يشوف اعضاء شركه مش شركته» · «عادل مش هيظهر للموظفين» إلا لو سويته «all»
--   · «الدردشة لا تدخل النسخ الاحتياطي» · «متحذفش بيانات موجوده و خاصة شركة القاهرة…»
--
-- مافيش begin/commit جوه الملف — المعاملة ملك أداة التنفيذ.

-- ═══════════════ ٠) فحوص «قبل» + منع إعادة التشغيل (أي فشل = رجوع) ═══════════
-- **لازم تسبق أي DDL**: لو اتحطّت في آخر الملف هتقيس الحالة بعد التغيير فتبقى كاذبة
-- (وده الغلط اللي اتقاد الليلة دي: بوابة «عليها last_seen» كانت بعد الـ create).
-- القيم اللي لازم تقارن «بعد» بتتخزن في GUC محلي للمعاملة (`set_config(..., true)`)
-- فبتترجع تلقائيًا لو getعمل rollback، ومتلوثش أي session تاني.
do $$
declare
  n    int;
  src  text;
  sig0 text;
begin
  -- ── لازم ترقية ٤٥ تكون اتنفذت (ممنوع نزلّق فوق قاعدة ناقصة) ──
  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                  where ns.nspname = 'public' and c.relname = 'messages' and c.relkind = 'r') then
    raise exception 'ترقية ٤٦: جدول messages مش موجود — ترقية ٤٥ لسه ما اتنفذتش';
  end if;

  select count(*) into n from pg_policies where schemaname='public' and tablename='messages';
  if n <> 3 then raise exception 'ترقية ٤٦: سياسات messages قبل التنفيذ = % (مفروض ٣)', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname = 'mizan_chat_peers';
  if n <> 1 then raise exception 'ترقية ٤٦: mizan_chat_peers قبل التنفيذ = % (مفروض ١)', n; end if;

  -- التوقيع القديم مالوش last_seen (لو عليه ⇒ ٤٦ اتنفذت قبل كده، وممنوع تتكرر)
  select pg_get_function_result('public.mizan_chat_peers()'::regprocedure) into src;
  if src ilike '%last_seen%' then
    raise exception 'ترقية ٤٦: mizan_chat_peers عليها last_seen فعلًا — الترقية دي اتنفذت قبل كده، ممنوع تتكرر';
  end if;

  -- mizan_org_info لسه بتحسب is_org_admin من role وحده (ده كمان مانع تكرار)
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname='public' and p.proname='mizan_org_info') then
    raise exception 'ترقية ٤٦: mizan_org_info مش موجودة — ترقية ١٧ لسه ما اتنفذتش؟';
  end if;
  select prosrc into src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_org_info';
  if src like '%mizan_is_owner%' then
    raise exception 'ترقية ٤٦: mizan_org_info لسه بتنادي mizan_is_owner — الترقية دي اتنفذت قبل كده، ممنوع تتكرر';
  end if;
  -- توقيع org_info لازم يفضل حرفيًا زي ما هو (٨ أعمدة) — بنخزنه وبنقارنه «بعد» بالبايت
  select pg_get_function_result('public.mizan_org_info()'::regprocedure) into sig0;
  if sig0 is null or sig0 not ilike '%is_org_admin%' then
    raise exception 'ترقية ٤٦: توقيع mizan_org_info قبل التنفيذ مش المتوقع ⇒ «%»', coalesce(sig0,'(null)');
  end if;
  if sig0 ilike '%last_seen%' then
    raise exception 'ترقية ٤٦: توقيع mizan_org_info فيه last_seen قبل التنفيذ؟ قياس غلط';
  end if;

  -- mizan_is_owner لازم تبقى **جديدة** (لو موجودة يبقى في نسخة اتنفذت قبل كده)
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
              where ns.nspname='public' and p.proname='mizan_is_owner') then
    raise exception 'ترقية ٤٦: mizan_is_owner موجودة قبل التنفيذ — الترقية دي اتنفذت قبل كده، ممنوع تتكرر';
  end if;

  -- بصمة الأسطر «قبل» (الفحص «بعد» بيقارن) — أي سطر يتشال = rollback
  perform set_config('mizan_46.msg0',  (select count(*) from public.messages)::text,     true);
  perform set_config('mizan_46.prof0', (select count(*) from public.profiles)::text,     true);
  perform set_config('mizan_46.org0',  (select count(*) from public.organizations)::text, true);
  perform set_config('mizan_46.pres0', (select count(*) from public.presence)::text,     true);
  perform set_config('mizan_46.sig0',  coalesce(sig0,''),                                 true);

  raise notice 'ترقية ٤٦: فحوص «قبل» خضراء (messages=% · profiles=% · organizations=% · presence=%)',
    current_setting('mizan_46.msg0'), current_setting('mizan_46.prof0'),
    current_setting('mizan_46.org0'), current_setting('mizan_46.pres0');
end;
$$;

-- ═══════════════════ ١) التعريف الصح لـ «صاحب المؤسسة» ══════════════════════
create or replace function public.mizan_is_owner(p_id uuid)
returns boolean
language sql stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  -- 🧭 التعريف الوحيد في ميزان كله — حرفيًا نفس سطر التطبيق (`isCompanyOwnerRow`):
  --    admin وليس سوبر أدمن. (`organizations.owner_id` اتشال بقرار المالك 03/10.)
  --    شرطا `is_active` و`blocked` مش تعريف بديل — دول «الحساب ده أصلًا صالح للاستخدام؟»،
  --    بنفس ما التطبيق ما بيشوفش حساب محظور من الأساس.
  select exists (
    select 1
      from public.profiles p
     where p.id = p_id
       and coalesce(p.is_active, true) is true
       and coalesce(p.blocked, false) is false
       and coalesce(p.is_superadmin, false) is false
       and p.role = 'admin'
  );
$$;

comment on function public.mizan_is_owner(uuid) is
  'التعريف الوحيد لـ«مالك الشركة» = تعريف التطبيق: role=admin وغير سوبر أدمن (بناء 126).';

revoke all on function public.mizan_is_owner(uuid) from public, anon;
grant execute on function public.mizan_is_owner(uuid) to authenticated;

-- ═══════════════ ٢) ميزان الخصوصية — نفس البنية، التعريف اتصحح ══════════════
-- الفرق عن ٤٥ في فرعين بس: «عادل ↔ أصحاب المؤسسات» و«صاحب شركة ↔ عادل» بقاو
-- بيشاوروا على mizan_is_owner. فرع «أعضاء شركتي بس» ما اتلمسش، وسويتها «all»
-- لسه هي اللي بتفتح عادل لكل المستخدمين.

create or replace function public.mizan_chat_peer(p_to uuid)
returns boolean
language sql stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  with me as (
    select id, org_id, coalesce(is_superadmin,false) as sup,
           coalesce(features->>'chatScope','owners') as scope
      from public.profiles
     where id = auth.uid() and coalesce(is_active,true) is true
       and coalesce(blocked,false) is false
  ),
  them as (
    select id, org_id, coalesce(is_superadmin,false) as sup
      from public.profiles
     where id = p_to and coalesce(is_active,true) is true
       and coalesce(blocked,false) is false
  )
  select exists (
    select 1 from me, them
    where me.id <> them.id
      and (
        -- (١) أعضاء شركتي بس — مافيش أي شركة تانية
        (me.org_id is not null and them.org_id is not null and me.org_id = them.org_id)
        -- (٢) عادل ↔ أصحاب المؤسسات (افتراضي)، أو ↔ الكل لو سويته على «all»
        or (me.sup and them.org_id is not null
            and (me.scope = 'all'
                 or public.mizan_is_owner(them.id)))
        -- (٣) صاحب شركة ↔ عادل
        or (them.sup and me.org_id is not null
            and public.mizan_is_owner(me.id))
      )
  );
$$;

revoke all on function public.mizan_chat_peer(uuid) from public, anon;
grant execute on function public.mizan_chat_peer(uuid) to authenticated;

-- ═══════ ٣) قائمة المخاطَين — نفس البوابة + «متصل» (النقطة الخضرا) ═══════
-- التوقيع اتغيّر (+last_seen +online) ⇒ Postgres ما بيقبلش create or replace على
-- توقيع مختلف، فلازم drop ثم create. النافذة بين الاتنين قصيرة والمعاملة واحدة،
-- والأداة بتعمل reload لكاش PostgREST بعد الـ commit.
-- `is_online` بنفس نافذة «متصلون الآن» في لوحة الإدارة (ترحيل ٢٢ = ١١٠ ثانية)
-- والنبضة كل ١٥ ثانية — فأي حساب فاتح ميزان يبقى عليه نقطة خضرا.

drop function if exists public.mizan_chat_peers();

create or replace function public.mizan_chat_peers()
returns table (
  id uuid, full_name text, role text, is_superadmin boolean,
  org_id uuid, org_name text, is_owner boolean,
  last_seen timestamptz, is_online boolean
)
language sql stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select p.id,
         nullif(trim(coalesce(p.full_name,'')),'')::text,
         p.role::text,
         coalesce(p.is_superadmin,false),
         p.org_id,
         o.name::text,
         public.mizan_is_owner(p.id),
         pr.last_seen,
         (pr.last_seen is not null
          and pr.last_seen >= now() - interval '110 seconds')
    from public.profiles p
    left join public.organizations o on o.id = p.org_id
    left join public.presence pr on pr.user_id = p.id
   where coalesce(p.is_active,true) is true
     and coalesce(p.blocked,false) is false
     and public.mizan_chat_peer(p.id)
   order by coalesce(o.name,''), lower(coalesce(p.full_name,''));
$$;

comment on function public.mizan_chat_peers() is
  'قائمة من أقدر أبايعه — بتتبنى mizan_chat_peer (بوابة واحدة)، وبتنقل آخر اتصال «متصل الآن».';

revoke all on function public.mizan_chat_peers() from public, anon;
grant execute on function public.mizan_chat_peers() to authenticated;

-- ═══════════ ٤) شاشة «حسابات شركتك» — نفس التعريف، بلا نسخة تانية ═══════════
-- ترقية ١٧ كانت بتحسب `is_org_admin` بـ `p.role = 'admin'` من غير استثناء عادل
-- ⇒ عادل كان بيبان «مالك شركة» في شاشته، وده الفرق اللي المالك ملاحظه. التوقيع
-- والخُرج ما اتغيّروش (٨ أعمدة بنفس الترتيب والأنواع) ⇒ `create or replace` عادي،
-- والتغيير سطر الحساب + تثبيت search_path (نفس نمط ترقية ٤٣).
-- (الواجهة ما بتغيرش سلوكها: `canManage = is_org_admin || is_superadmin` — عادل
--  برضه بيطلع true من الشق التاني، فالتصحيح **تعبيري** مش وظيفي.)

create or replace function public.mizan_org_info()
returns table (
  org_id uuid,
  org_name text,
  role text,
  is_org_admin boolean,
  is_superadmin boolean,
  max_members int,
  members_count bigint,
  locked boolean
)
language sql stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select o.id, o.name, p.role,
         public.mizan_is_owner(p.id),
         p.is_superadmin,
         coalesce(o.max_members, 5),
         (select count(*) from public.profiles pc where pc.org_id = p.org_id),
         o.locked
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid();
$$;

revoke all on function public.mizan_org_info() from public, anon;
grant execute on function public.mizan_org_info() to authenticated;

-- ═══════════════════ ٥) فحوص «بعد» (أي فشل = رجوع) ═══════════════════
-- فحوص «قبل» ومنع التكرار في أول الملف (قسم ٠) — هنا **بعد** بس، والقياسات القديمة
-- بتتقرا من GUC المعاملة اللي قسم ٠ خزّنها.
do $$
declare
  n   int;
  n0  int;
  p0  int;
  o0  int;
  pr0 int;
  src text;
  sig0 text;
  b   boolean;
begin
  n0  := current_setting('mizan_46.msg0')::int;
  p0  := current_setting('mizan_46.prof0')::int;
  o0  := current_setting('mizan_46.org0')::int;
  pr0 := current_setting('mizan_46.pres0')::int;
  sig0 := current_setting('mizan_46.sig0');
  if sig0 is null or sig0 = '' then
    raise exception 'ترقية ٤٦: GUC «mizan_46.sig0» فاضي ⇒ قسم ٠ (فحوص قبل) ما اتشغّلش — لا تنفّذ الملف مجزّأ';
  end if;

  -- ── بعد: الدوال الثلاث المحصّنة + المساعد الجديد (٥ دوال definer بمسار مثبّت) ──
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_chat_peer','mizan_chat_peers','mizan_chat_read',
                        'mizan_chat_set_scope','mizan_is_owner')
      and p.prosecdef = true
      and array_to_string(p.proconfig, ',') = 'search_path=public, pg_temp';
  if n <> 5 then raise exception 'ترقية ٤٦: دوال الدردشة المحصّنة = % (مفروض ٥)', n; end if;

  -- بعد: المنح على الدوال الخمس — authenticated بس (ممنوع anon/PUBLIC، وممنوع proacl فاضي)
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_chat_peer','mizan_chat_peers','mizan_chat_read',
                        'mizan_chat_set_scope','mizan_is_owner')
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) x
                       where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public')));
  if n <> 0 then raise exception 'ترقية ٤٦: دوال الدردشة ليها منح anon/PUBLIC (% دالة)', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_chat_peer','mizan_chat_peers','mizan_chat_read',
                        'mizan_chat_set_scope','mizan_is_owner')
      and exists (select 1 from aclexplode(p.proacl) x
                   where pg_get_userbyid(x.grantee) = 'authenticated'
                     and x.privilege_type = 'EXECUTE');
  if n <> 5 then raise exception 'ترقية ٤٦: دوال عليها منح authenticated = % (مفروض ٥)', n; end if;

  -- بعد: mizan_is_owner بتقرأ profiles وبتستثنى السوبر وبتقبل role=admin
  -- 🧵 ملاحظة أداة: كل فحوص «الجسم» هنا بتشتغل على النص **بعد شيل تعليقات `--`**، بنفس
  --    قاعدة اللِنتر (lint_sql_generic.js). السبب مقاس فعليًا: جسم mizan_is_owner فيه تعليق
  --    بيسمّي العمود القديم بالاسم، والحارس «ممنوع التعريف القديم» بيبحث عن نفس الاسم
  --    ⇒ على النص الخام كانت الترقية السليمة بترجع بـ ROLLBACK كاذب (03/10، محاولة ٣).
  --    الكود نفسه ما بيتأثرش: اللي بيتقاس هو اللي بيفضل بعد الشيل.
  select regexp_replace(prosrc, '--[^\n]*', '', 'g') into src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_is_owner';
  if src not like '%p.role = ''admin''%' then
    raise exception 'ترقية ٤٦: mizan_is_owner ما بتعتمدش على role=admin';
  end if;
  if src not like '%is_superadmin%' then
    raise exception 'ترقية ٤٦: mizan_is_owner ما بتستثنيناش حساب المالك';
  end if;
  if src not like '%blocked%' or src not like '%is_active%' then
    raise exception 'ترقية ٤٦: mizan_is_owner ما بتفحصش الحظر/الفعلية';
  end if;
  -- 🧭 التوحيد: ممنوع أي فرع تاني للتعاريف (owner_id) يرجع يخلط التعريف
  if src like '%owner_id%' then
    raise exception 'ترقية ٤٦: mizan_is_owner لسه بتستخدم organizations.owner_id — القرار كان «يتوحّد على تعريف البرنامج»';
  end if;

  -- بعد: peer بتستدعي mizan_is_owner مرتين (فرع عادل + فرع صاحب الشركة)
  select regexp_replace(prosrc, '--[^\n]*', '', 'g') into src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_chat_peer';
  n := (length(src) - length(replace(src, 'mizan_is_owner', ''))) / length('mizan_is_owner');
  if n <> 2 then raise exception 'ترقية ٤٦: mizan_chat_peer بتنادي mizan_is_owner % مرة (مفروض ٢)', n; end if;
  if src like '%owner_id = them.id%' or src like '%owner_id = me.id%' then
    raise exception 'ترقية ٤٦: mizan_chat_peer لسه بتقارن organizations.owner_id مباشرة';
  end if;
  -- فرع «أعضاء شركتي» لازم يفضل كما هو (عزل الشركات)
  if src not like '%me.org_id = them.org_id%' then
    raise exception 'ترقية ٤٦: فرع عزل الشركات اتشال من mizan_chat_peer';
  end if;
  -- السويتش «all» لسه هو الوحيد اللي بيفتح عادل لكل المستخدمين
  if src not like '%me.scope = ''all''%' then
    raise exception 'ترقية ٤٦: سويتش «all» اتشال من mizan_chat_peer';
  end if;

  -- بعد: peers بتستدعي peer (بوابة واحدة مش منسوخة) وبتقرأ presence
  select regexp_replace(prosrc, '--[^\n]*', '', 'g') into src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_chat_peers';
  if src not like '%mizan_chat_peer(p.id)%' then
    raise exception 'ترقية ٤٦: mizan_chat_peers ما بتتبنىش البوابة الواحدة';
  end if;
  if src not like '%presence%' then
    raise exception 'ترقية ٤٦: mizan_chat_peers ما بتقراش presence';
  end if;
  if src like '%messages%' then
    raise exception 'ترقية ٤٦: mizan_chat_peers بتلمس جدول الرسايل — القائمة بس';
  end if;

  select pg_get_function_result('public.mizan_chat_peers()'::regprocedure) into src;
  if src not ilike '%last_seen%' or src not ilike '%is_online%' then
    raise exception 'ترقية ٤٦: توقيع mizan_chat_peers عليه آخر اتصال';
  end if;

  -- بعد: mizan_org_info بقت بتنادي التعريف الوحيد، وتوقيعها **بايت-بايت** زي ما كان
  select prosrc into src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_org_info';
  if src not like '%public.mizan_is_owner(p.id)%' then
    raise exception 'ترقية ٤٦: mizan_org_info ما بتناديش التعريف الوحيد';
  end if;
  if src like '%p.role = ''admin''%' then
    raise exception 'ترقية ٤٦: mizan_org_info لسه فيها نسخة من الشرط (role=admin لحالها)';
  end if;
  if pg_get_function_result('public.mizan_org_info()'::regprocedure) is distinct from sig0 then
    raise exception 'ترقية ٤٦: توقيع mizan_org_info اتغير — شاشة «حسابات شركتك» هتتكسر';
  end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_org_info'
      and p.prosecdef = true
      and array_to_string(p.proconfig, ',') = 'search_path=public, pg_temp';
  if n <> 1 then raise exception 'ترقية ٤٦: mizan_org_info مش محصّنة (definer + مسار مثبّت)'; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_org_info'
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) x
                       where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public')));
  if n <> 0 then raise exception 'ترقية ٤٦: mizan_org_info ليها منح anon/PUBLIC'; end if;

  -- بعد: قواعد الخصوصية ما اتلمستش (٣ سياسات، مافيش UPDATE، مافيش رحمة للمالك)
  select count(*) into n from pg_policies where schemaname='public' and tablename='messages';
  if n <> 3 then raise exception 'ترقية ٤٦: سياسات messages بعد التنفيذ = % (مفروض ٣)', n; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages' and cmd='UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٦: فيه سياسة UPDATE على messages — مرفوض'; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages'
      and (qual like '%is_superadmin%' or with_check like '%is_superadmin%');
  if n <> 0 then raise exception 'ترقية ٤٦: سياسة بتستثنى المالك — الخصوصية لازم حرفية'; end if;

  -- بعد: منح الجدول زي ما هي (select/insert/delete بس) — الترقية ما بتغيّرش المنح
  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and (x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public'));
  if n <> 0 then raise exception 'ترقية ٤٦: منح anon/PUBLIC على messages بترجع (% grant)', n; end if;

  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and pg_get_userbyid(x.grantee) = 'authenticated'
      and x.privilege_type in ('SELECT','INSERT','DELETE');
  if n <> 3 then raise exception 'ترقية ٤٦: منح authenticated على messages = % (مفروض ٣)', n; end if;

  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and pg_get_userbyid(x.grantee) = 'authenticated' and x.privilege_type = 'UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٦: authenticated لسه عندها UPDATE على messages'; end if;

  -- بعد: الدردشة بره النسخ الاحتياطي (قرار المالك) — ما تتلمسش في ٤٦
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full')
      and p.prosrc like '%messages%';
  if n <> 0 then raise exception 'ترقية ٤٦: messages دخلت دوال النسخ الاحتياطي — قرار المالك مرفوض'; end if;

  -- بعد: مافيش أي سطر اتشال. المقارنة بـ < مش = عن قصد: عادل بيستخدم الدردشة فعلًا، وأي سطر
  --   جديد (رسالة/نبضة presence/حساب) بيشفه أول statement بعد commit بتاعه ⇒ المساواة
  --   المطلقة كانت بتعمل ROLLBACK كاذب. «اللي كان موجود ما اتلمسش» بتثبّته الأداة ببصمة md5
  --   على الأسطر القديمة نفسها (created_at <= t0) وبصمة profiles/organizations — وده الحارس الصارم.
  select count(*) into n from public.messages;
  if n < n0 then raise exception 'ترقية ٤٦: أسطر messages نقصت من % إلى % — مرفوض', n0, n; end if;

  select count(*) into n from public.profiles;
  if n < p0 then raise exception 'ترقية ٤٦: أسطر profiles نقصت من % إلى % — مرفوض', p0, n; end if;

  select count(*) into n from public.organizations;
  if n < o0 then raise exception 'ترقية ٤٦: أسطر organizations نقصت من % إلى % — مرفوض', o0, n; end if;

  select count(*) into n from public.presence;
  if n < pr0 then raise exception 'ترقية ٤٦: أسطر presence نقصت من % إلى % — مرفوض', pr0, n; end if;

  -- بعد: البنية كلها ما اتغيّرتش (الدوال +١ بس: mizan_is_owner) — مقاييس ٤٥ المأخودة 03/10
  -- 📏 المقياس لازم يبقى **نفس** مقياس الأداة (information_schema.columns = ٤٠٠):
  --    pg_attribute لوحدها بيجرّ وراه أعمدة الـ sequences (public فيه ٢ sequence = ٦ أعمدة
  --    وهمية ⇒ ٥٦١ بدل ٤٠٠). القيد `relkind='r'` بيرجّع المقياسين لرقم واحد. (مقاس 03/10.)
  select count(*) into n from pg_attribute a
    join pg_class k on k.oid = a.attrelid
    join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname='public' and k.relkind = 'r' and a.attnum > 0 and not a.attisdropped;
  if n <> 400 then raise exception 'ترقية ٤٦: عدد أعمدة public = % (مفروض ٤٠٠ ثابتة)', n; end if;

  select count(*) into n from pg_constraint c
    join pg_namespace ns on ns.oid = c.connamespace where ns.nspname='public';
  if n <> 93 then raise exception 'ترقية ٤٦: عدد قيود public = % (مفروض ٩٣ ثابتة)', n; end if;

  select count(*) into n from pg_policy pol join pg_class k on k.oid = pol.polrelid
    join pg_namespace ns on ns.oid = k.relnamespace where ns.nspname='public';
  if n <> 119 then raise exception 'ترقية ٤٦: عدد سياسات RLS في public = % (مفروض ١١٩ ثابتة)', n; end if;

  select count(*) into n from pg_indexes where schemaname='public';
  if n <> 112 then raise exception 'ترقية ٤٦: عدد فهارس public = % (مفروض ١١٢ ثابتة)', n; end if;

  select count(*) into n from pg_class k join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname='public' and k.relkind='r';
  if n <> 38 then raise exception 'ترقية ٤٦: عدد جداول public = % (مفروض ٣٨ ثابتة)', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public';
  if n <> 66 then raise exception 'ترقية ٤٦: دوال public = % (مفروض ٦٥ + mizan_is_owner = ٦٦)', n; end if;

  -- بعد: سويتها عادل (features->chatScope) ما اتلمستش — هي قراره مش قرار الترقية
  select count(*) into n from public.profiles
    where coalesce(is_superadmin,false) is true
      and coalesce(features->>'chatScope','owners') in ('owners','all');
  if n < 1 then raise exception 'ترقية ٤٦: مافيش حساب مالك عليه سويتة دردشة صحيحة'; end if;

  select relrowsecurity into b from pg_class where oid='public.messages'::regclass;
  if b is distinct from true then raise exception 'ترقية ٤٦: RLS مش مفعّلة على messages'; end if;

  raise notice 'ترقية ٤٦: الفحوص كلها خضراء (messages=% أسطر، profiles=%، قبل=بعد)', n0, p0;
end;
$$;
