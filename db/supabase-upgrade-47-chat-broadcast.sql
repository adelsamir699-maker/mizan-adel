-- ترقية ٤٧ — «رسالة للكل» من المالك عادل + الدائرة تبقى مسموعة (بند 20/ب)
--
-- ⏳ **محفوظة على القرص — لسه ما اتنفذتش على السحابة.** أمر المالك الحرفي قائم:
--    «من 1 الى 4 بالترتيب» (03/10 ≈11:00) ⇒ سطر ٣ = الترقية دي.
--      node D:/_work/temp/apply_upgrade_47.js                       → يطبع الخطة ويخرج (بلا اتصال)
--      MIZAN_ORDER_47="نفّذ" node D:/_work/temp/apply_upgrade_47.js → تنفيذ في transaction واحدة
--    **شرط تنفيذ:** ترقية ٤٦ تكون اتنفذت قبلها (هي اللي بتعرّف «صاحب المؤسسة» صح،
--    ودائرة البث بتتبنى نفس التعريف). **الرجوع:** `pre-mig47-*/rollback_47.sql`.
--
-- طلب المالك الحرفي (03/10 ≈02:30):
--   «خلى عندى انا عادل المالك امكانية ارسال رساله للكل و مش لازم اختيار رسالة
--    خاصه و علامة صح عليها دى»
--
-- إزاي ده بيتنفذ من غير ما تكسر أي قاعدة:
--   البث **مش جدول مفتوح ولا سياسة استثناء**. الدالة بتعمل **سطر مستقل لكل مستلم**
--   (to_user = المستلم نفسه)، فالرسالة وصولت له حرفيًا ⇒ قاعدة المالك
--   «محدش يقدر يشوف رسايل مش مبعوته له» فضل صحيح ١٠٠٪، وسياسة SELECT (رسايلي أنا)
--   ما اتغيّرش ولا نقطة فيها. ومفيش أي سياسة جديدة على messages.
--   دائرة المستلمين = **نفس** mizan_chat_peer بتاعته: لو سويته على «أصحاب المؤسسات»
--   يوصلهم، ولو سوّيه «كل المستخدمين» يوصل الكل. مافيش باب جديد.
--   «خاص» بقت اختيارية: الجدول أصلًا فيه is_private default false، والدالة بتستقبل
--   p_private بـ default false ⇒ الافتراضي «مش خاصة» وعلامة الصح لو عايزها.
--   الاستثناء الوحيد: **الدالة دي للمالك العام بس** (is_superadmin) — أي حساب تاني
--   يرمي رسالة ودّية وترجع من غير أي كتابة.
--
-- 🆕 **الفرع التاني في الترقية دي (اتقاس، مش تخمين):** `mizan_chat_peer` **اتجاه واحد**
--   بقرار المالك (الموظف ما يبتديش محادثة مع عادل). لو البث وصل لعضو عادي، الدالة
--   `mizan_chat_peers()` ما كانتش بتحطه في قائمة المخاطَين ⇒ الرسالة تبن «عدد جديد»
--   بس ولا حد يقدر يفتحها. فـ peers بقى فيها فرع **«اللي بعتلي»**: أي حساب وصلني منه
--   سطر دخول، لأن ده لا يفتح بابًا جديدًا — المرسل كان مسموح له أصلًا بالبوابات.
--   سياسة SELECT على messages **ما اتغيرتش**: الفحص لسه «رسايلي أنا»، فالفرع ده بيضيف
--   اسم في القائمة بس، مش مضمون رسايل.
--
-- الترقية دي **ما بتعملش**: مافيش جدول/عمود/فهرس جديد · مافيش سياسة RLS جديدة أو متغيّرة
--   · مافيش تعديل منح على messages · مافيش حذف أو تعديل أي سطر · مافيش لمس دوال النسخ.
--
-- ⚠️ **مصيدة اتقادت في المسودة الأولى (متوثقة في التسليم قسم ٢١):** فحوص «قبل» كانت
--   في نفس كتلة `do$$` **بعد** الـ create ⇒ كانت ترفع «موجودة قبل التنفيذ» على الترقية
--   السليمة وتعمل rollback. الشكل الصح: بوابة «قبل» مستقلة **قبل** أي DDL، والقياس
--   بيتخزن في جدول مؤقت `on commit drop` وتقارن بيه في بوابة «بعد».
--
-- ⚠️ **مصيدة تانية (04/10، اتقادت من قراءة النص قبل أي تشغيل):** عمود جدول الحماية كان اسمه `v`
--   وفي بوابة «بعد» متغيّر plpgsql اسمه `v` كمان. القاعدة: الاسم العاري في استعلام جوه
--   plpgsql بيتفسّر **متغيّر أولًا** ⇒ `select v into gv` كانت بترجع `v` الفارغ بصمت،
--   يعني أربع فحوصات بيانات («ولا سطر اتلمس») بتقارن بـ null وتقول «مطابق» كداب.
--   العمود بقى `gval`، والمتغيّر اتشال خالص، والحارس `check_chat_broadcast_47.js` بيمنع
--   أي عمود في `mizan_47_guard` يصادم اسم متغيّر معلن في نفس الملف.
--
-- 🪳 **مصيدة تالتة (04/10، مسكها وضع «التثبيت التجريبي» مش اللِنتر):** بوابة «بعد» كانت بتعدّ
--    الأعمدة من `pg_attribute` **من غير** `k.relkind = 'r'` ⇒ بتلمّ أعمدة الـ١١٢ فهرس (١٥٥)
--    والصناديق التسلسلية (٦) كمان = **٥٦١** مقابل ٤٠٠ ⇒ ترقية سليمة كانت هتعمل ROLLBACK.
--    الرقم ٤٠٠ نفسه صحيح، **التعبير** كان الغلط (نفس درس «ممنوع رقم مقفول من غير قياس» بس
--    من الجهة التانية: الرقم مقاس بتعبير ≠ التعبير اللي في الكاشف).
--
-- 🪟 **نافذة قياس الرسايل:** «قبل/بعد» بيقارنوا أسطر messages اللي `created_at <= t0` بس.
--   ده مش تساهل: `now()` = لحظة بدء المعاملة، فأي سطر تكتبه **الترقية نفسها** هيحمل
--   created_at = t0 بالظبط ⇒ داخل النافذة ومحسوب في البصمة (الكتابة الغلط لسه مرفوضة).
--   المستثنى = رسالة مستخدم وصلت بعد ما بدأنا — بيانات حيّة (عادل بيستخدم الدردشة فعلًا)
--   وما ينفعش تُسقط ترقية سليمة. نفس القرار اللي في `apply_upgrade_46.js`.
--
-- 🧰 **الأدوات (قرص، D:/_work/temp):** `lint_sql_generic.js` (تركيبي) ·
--   `dryrun_gates_47.js` (بنية + قياس حيّ **قراءة فقط** افتراضيًا؛ الوضع العميق
--   `MIZAN_DRYRUN_47="شغّل"` تشغيل كامل جوّه rollback + ٩ معايرات) ·
--   `apply_upgrade_47.js` (من غير مفتاح = خطة وبلا اتصال؛ `MIZAN_ORDER_47="نفّذ"` = تنفيذ) ·
--   `test_chat_broadcast_47.js` (سلوكي قراءة-فقط بـ JWT حقيقي وsavepoint) ·
--   `check_chat_broadcast_47.js` (حارس القرص + المعايرات).
--
-- مافيش begin/commit جوه الملف — المعاملة ملك أداة التنفيذ.

-- ═══════════════ ١) بوابة «قبل» + تخزين القياس (قبل أي DDL) ═══════════════
create temp table mizan_47_guard (k text primary key, gval text) on commit drop;

do $$
declare
  n     int;
  sig   text;
  n0    int;
  m0    text;
  p0    int;
  t0    timestamptz;
begin
  t0 := now();

  -- ٤٥: جدول الرسايل نفسه
  if to_regclass('public.messages') is null then
    raise exception 'ترقية ٤٧: جدول messages مش موجود — ترقية ٤٥ لسه ما اتنفذتش';
  end if;

  -- ٤٦: التعريف الوحيد «صاحب المؤسسة»
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'mizan_is_owner';
  if n <> 1 then
    raise exception 'ترقية ٤٧: mizan_is_owner مش موجودة — ترقية ٤٦ لسه ما اتنفذتش';
  end if;

  -- الدالة الجديدة: ممنوع الترقية تتكرر فوق نسخة منها
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'mizan_chat_broadcast';
  if n <> 0 then
    raise exception 'ترقية ٤٧: mizan_chat_broadcast موجودة قبل التنفيذ — ممنوع تتكرر';
  end if;

  -- الدالة اللي هتتبدل لازم تكون موجودة بنسخة واحدة
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'mizan_chat_peers';
  if n <> 1 then
    raise exception 'ترقية ٤٧: mizan_chat_peers = % نسخة (مفروض ١)', n;
  end if;

  -- توقيع peers قبل ⇒ لازم يرجع **بايت-بايت** بعد (drop+create بلا تغيير توقيع)
  select pg_get_function_result('public.mizan_chat_peers()'::regprocedure) into sig;
  if sig is null or position('last_seen' in sig) = 0 or position('is_online' in sig) = 0 then
    raise exception 'ترقية ٤٧: توقيع peers قبل التنفيذ مالو last_seen/is_online — حالة القاعدة مش قياس ٤٦';
  end if;
  insert into mizan_47_guard (k, gval) values ('peers_sig', sig);

  -- خصوصية messages قبل التنفيذ: ٣ سياسات وبلا UPDATE
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'messages';
  if n <> 3 then raise exception 'ترقية ٤٧: سياسات messages قبل التنفيذ = % (مفروض ٣)', n; end if;
  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename = 'messages' and cmd = 'UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٧: فيه سياسة UPDATE على messages قبل التنفيذ'; end if;

  -- قياس البيانات المتينة (الترقية المفروض ما تكتبش ولا سطر)
  -- 🪟 النافذة `created_at <= t0` مش تساهل: `now()` في Postgres = **لحظة بدء المعاملة**، فأي سطر
  --    تكتبه هذي الترقية هيحمل created_at = t0 بالظبط ⇒ داخل النافذة ومحسوب في البصمة.
  --    اللي بتستثنَاه النافذة = رسالة مستخدم وصلت **بعد** ما بدأنا (معاملة لاحقة) — وهي بيانات
  --    مستخدم حية، مش شغلنا، وما ينفعش تُسقط الترقية السليمة (نفس درس ٤٦ و`apply_upgrade_46.js`).
  select count(*) into n0 from public.messages where created_at <= t0;
  select coalesce(md5(string_agg(id::text, ',' order by id)), 'empty') into m0
    from public.messages where created_at <= t0;
  select count(*) into p0 from public.profiles;
  insert into mizan_47_guard (k, gval) values
    ('msg_n', n0::text), ('msg_fp', m0), ('prof_n', p0::text),
    -- `t0::text` (مش to_char بلا إزاحة): نص فيه الإزاحة، و`::timestamptz` في **نفس الجلسة**
    -- يرجّعه لنفس اللحظة بالمايكرو ثانية ⇒ بوابة «بعد» تقدر تعيد نفس النافذة بالحرف.
    ('t0', t0::text);

  raise notice 'ترقية ٤٧: بوابة «قبل» خضراء (messages=% أسطر · profiles=%)', n0, p0;
end;
$$;

-- ═══════════════════ ٢) دالة البث (حساب المالك العام بس) ═══════════════════
create or replace function public.mizan_chat_broadcast(p_body text, p_private boolean default false)
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me   uuid;
  v_org  uuid;
  v_body text;
  n      int;
begin
  v_me := auth.uid();
  if v_me is null then
    raise exception 'الدردشة محتاجة حساب مسجّل دخول';
  end if;

  -- البث للمالك العام بس — أي حساب تاني يترفض قبل أي كتابة
  if not exists (select 1 from public.profiles p
                  where p.id = v_me
                    and coalesce(p.is_superadmin,false) is true
                    and coalesce(p.is_active,true) is true
                    and coalesce(p.blocked,false) is false) then
    raise exception 'دي رسالة المالك؛ الحساب العادي يبعت لشخص واحد';
  end if;

  -- نفس حدود الجدول بالحرف (من غير كده أي سطر بيُرفض بخطاء تقنية)
  v_body := btrim(coalesce(p_body, ''));
  if v_body = '' then
    raise exception 'اكتب الرسالة الأول';
  end if;
  if length(v_body) > 4000 then
    raise exception 'الرسالة أطول من المسموح';
  end if;

  -- سياق الإرسال = نفس شرط سياسة INSERT (org_id is not distinct from current_org())
  v_org := public.current_org();

  -- دائرة المستلمين = نفس ميزان الخصوصية بتاعه بالظبط (بوابة واحدة، مافيش باب جديد)
  insert into public.messages (org_id, from_user, to_user, body, is_private)
  select v_org, v_me, p.id, v_body, coalesce(p_private, false)
    from public.profiles p
   where p.id <> v_me
     and coalesce(p.is_active,true) is true
     and coalesce(p.blocked,false) is false
     and public.mizan_chat_peer(p.id);

  get diagnostics n = row_count;

  if n = 0 then
    -- مافيش حد في الدائرة دلوقتي ⇒ الرجوع أحسن من «بعتنا لحد»
    raise exception 'مافيش مخاطَب في الدائرة الحالية — قلّب السويتش أو ابعت لع شخص';
  end if;

  return n;
end;
$$;

comment on function public.mizan_chat_broadcast(text, boolean) is
  'إعلان من المالك: سطر مستقل لكل مستلم (fanned-out) — فالخصوصية نفسها ما بتتلمسش.';

-- ═══════════ ٣) peers: + فرع «اللي بعتلي» (التوقيع بايت-بايت زي ما هو) ═══════════
drop function if exists public.mizan_chat_peers();

create or replace function public.mizan_chat_peers()
returns table(id uuid, full_name text, role text, is_superadmin boolean, org_id uuid,
              org_name text, is_owner boolean, last_seen timestamp with time zone, is_online boolean)
language sql
stable
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
     and p.id <> auth.uid()
     and (
           -- (أ) الدائرة المعتادة: نفس البوابة الواحدة، مافيش نسخة من شرطها
           public.mizan_chat_peer(p.id)
           -- (٢) ٤٧: اللي بعتلي يبان عندي (الرسايل نفسها لسه بتفلترها سياسة SELECT)
        or exists (select 1 from public.messages m
                    where m.to_user = auth.uid() and m.from_user = p.id)
         )
   order by coalesce(o.name,''), lower(coalesce(p.full_name,''));
$$;

comment on function public.mizan_chat_peers() is
  'قائمة من أقدر أبايعه — الدائرة (mizan_chat_peer) + أي حساب وصلني منه رسالة. آخر اتصال: متصلة الآن.';

-- ═══════════════════════ ٤) المنح (نفس نمط ٤٣/٤٥/٤٦/٤٩) ═══════════════════════
revoke all on function public.mizan_chat_broadcast(text, boolean) from public, anon;
grant execute on function public.mizan_chat_broadcast(text, boolean) to authenticated;

revoke all on function public.mizan_chat_peers() from public, anon;
grant execute on function public.mizan_chat_peers() to authenticated;

-- ═══════════════════════ ٥) بعد: فحوص ما بعد التنفيذ (أي فشل = رجوع) ═══════════════════════
do $$
declare
  n     int;
  b     boolean;
  src   text;
  sig   text;
  gv    text;
  -- ⚠️ مافيش متغيّر اسمه `v` هنا **بالعَمد**: كان بيصطدم مع عمود جدول الحماية (`v text`)،
  --    وفي plpgsql الاسم العاري بيتفسّر متغيّر أولًا ⇒ `select v into gv` كانت بترجع فارغ
  --    بصمت. العمود بقى `gval` والمتغيّر مش محتاجه حد.
begin
  -- ── الدالة موجودة، definer، ومسارها مثبّت pg_temp آخره ──
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'mizan_chat_broadcast'
      and p.prosecdef = true
      and array_to_string(p.proconfig, ',') = 'search_path=public, pg_temp';
  if n <> 1 then raise exception 'ترقية ٤٧: mizan_chat_broadcast مش محصّنة (definer + مسار مثبّت)'; end if;

  -- ── المنح: لا anon ولا PUBLIC، وauthenticated بس (للجديدة وpeers) ──
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname in ('mizan_chat_broadcast', 'mizan_chat_peers')
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) x
                       where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public')));
  if n <> 0 then raise exception 'ترقية ٤٧: أي من الدالتين ليها منح anon/PUBLIC'; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname in ('mizan_chat_broadcast', 'mizan_chat_peers')
      and exists (select 1 from aclexplode(p.proacl) x
                   where pg_get_userbyid(x.grantee) = 'authenticated'
                     and x.privilege_type = 'EXECUTE');
  if n <> 2 then raise exception 'ترقية ٤٧: authenticated مالهاش EXECUTE على الاتنين (=%)', n; end if;

  -- ── حصانة البث: بتسأل على المالك، وعلى ميزان peer، وما بتتجاوزش حدود الجدول ──
  select prosrc into src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'mizan_chat_broadcast';
  if src not like '%is_superadmin%' then
    raise exception 'ترقية ٤٧: mizan_chat_broadcast ما بتتحقاش في المالك';
  end if;
  if src not like '%mizan_chat_peer%' then
    raise exception 'ترقية ٤٧: mizan_chat_broadcast بتتجاوز ميزان الخصوصية';
  end if;
  if src not like '%v_me, p.id%' then
    raise exception 'ترقية ٤٧: البث مش بختم المرسل نفسه (منع الانتحال)';
  end if;
  if src not like '%4000%' then
    raise exception 'ترقية ٤٧: البث ما بيحدّش طول الرسالة';
  end if;
  -- مافيش أي UPDATE ولا DELETE جوه دالة البث
  if src ~* 'update[[:space:]]+public\.messages' or src ~* 'delete[[:space:]]+from[[:space:]]+public\.messages' then
    raise exception 'ترقية ٤٧: mizan_chat_broadcast بتعدّل أو تمسح رسايل — مرفوض';
  end if;

  -- ── peers: التوقيع رجع بايت-بايت زي ما كان + الفرعين موجودين + ما بتلمسش غير القراءة ──
  select pg_get_function_result('public.mizan_chat_peers()'::regprocedure) into sig;
  select gval into gv from mizan_47_guard where k = 'peers_sig';
  if sig is distinct from gv then
    raise exception 'ترقية ٤٧: توقيع peers اتغير ⇒ شاشة الدردشة هتتكسر';
  end if;

  select prosrc into src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'mizan_chat_peers';
  if src not like '%mizan_chat_peer(p.id)%' then
    raise exception 'ترقية ٤٧: peers ما بتتبنىش البوابة الواحدة';
  end if;
  if src not like '%m.to_user = auth.uid() and m.from_user = p.id%' then
    raise exception 'ترقية ٤٧: فرع «اللي بعتلي» مش موجود في peers';
  end if;
  if src not like '%presence pr on pr.user_id = p.id%' then
    raise exception 'ترقية ٤٧: peers ما بتقراش آخر اتصال';
  end if;
  -- peers بتقرأ messages قراءةً بس (ممنوع أي كتابة جوه الدالة)
  if src ~* 'insert into public\.messages' or src ~* 'update public\.messages' or src ~* 'delete from public\.messages' then
    raise exception 'ترقية ٤٧: peers بتكتب في جدول الرسايل — لازم قراءة بس';
  end if;

  -- ── مافيش أي سياسة جديدة ولا متغيّرة على messages ──
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'messages';
  if n <> 3 then raise exception 'ترقية ٤٧: سياسات messages بعد التنفيذ = % (مفروض ٣ ثابتة)', n; end if;

  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename = 'messages' and cmd = 'UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٧: سياسة UPDATE على messages — مرفوض'; end if;

  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and (qual like '%is_superadmin%' or with_check like '%is_superadmin%');
  if n <> 0 then raise exception 'ترقية ٤٧: سياسة بتستثنى المالك — الخصوصية لازم حرفية'; end if;

  -- ── منح الجدول ما اتغيّرتش ──
  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and pg_get_userbyid(x.grantee) = 'authenticated'
      and x.privilege_type in ('SELECT','INSERT','DELETE');
  if n <> 3 then raise exception 'ترقية ٤٧: منح authenticated على messages = % (مفروض ٣)', n; end if;

  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and (x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public'));
  if n <> 0 then raise exception 'ترقية ٤٧: منح anon/PUBLIC على messages (% grant)', n; end if;

  -- ── الدردشة بره النسخ الاحتياطي (قرار المالك) ──
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname in ('mizan_admin_backup_full', 'mizan_admin_restore_full')
      and p.prosrc like '%messages%';
  if n <> 0 then raise exception 'ترقية ٤٧: messages دخلت دوال النسخ الاحتياطي — قرار المالك مرفوض'; end if;

  -- ── ولا سطر اتلمس (الدالة ما اتنادتش جوّه الترقية) ──
  -- نفس نافذة «قبل» بالحرف: أي سطر تكتبه هذي المعاملة created_at = t0 ⇒ محسوب،
  -- واللي يوصل من مستخدم بعد ما بدأنا (معاملة لاحقة) مش من شغلنا ولا يوقّف ترقية سليمة.
  select gval into gv from mizan_47_guard where k = 't0';
  select count(*) into n from public.messages where created_at <= gv::timestamptz;
  select gval into gv from mizan_47_guard where k = 'msg_n';
  if n::text is distinct from gv then
    raise exception 'ترقية ٤٧: أسطر messages (في نافذة ما قبل start) اتغيرت من % إلى %', gv, n;
  end if;

  select coalesce(md5(string_agg(id::text, ',' order by id)), 'empty') into src
    from public.messages where created_at <= (select gval from mizan_47_guard where k = 't0')::timestamptz;
  select gval into gv from mizan_47_guard where k = 'msg_fp';
  if src is distinct from gv then
    raise exception 'ترقية ٤٧: بصمة معرّات messages اتغيرت — أي سطر اتضاف أو اتشال';
  end if;

  select count(*) into n from public.profiles;
  select gval into gv from mizan_47_guard where k = 'prof_n';
  if n::text is distinct from gv then
    raise exception 'ترقية ٤٧: أسطر profiles اتغيرت من % إلى %', gv, n;
  end if;

  -- ── البنية: الدوال +١ بس (broadcast)، وباقي المقاييس ثابتة ──
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public';
  if n <> 67 then raise exception 'ترقية ٤٧: دوال public = % (مفروض ٦٦ + broadcast = ٦٧)', n; end if;

  -- ⚠️ `relkind='r'` **ضرورية** (اتقادت 04/10 في وضع التثبيت التجريبي): pg_attribute بيشمل كمان
  --    الفهارس (١١٢ جدول ⇒ ١٥٥ عمود) والصناديق التسلسلية (٢ ⇒ ٦) ⇒ نفس العدّ بلا الشرط كان
  --    بيرجّع ٥٦١ ويوقع ترقية سليمة بـ ROLLBACK. مع `relkind='r'` = ٤٠٠ حرفيًا (مقاس).
  select count(*) into n from pg_attribute a
    join pg_class k on k.oid = a.attrelid
    join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname = 'public' and k.relkind = 'r' and a.attnum > 0 and not a.attisdropped;
  if n <> 400 then raise exception 'ترقية ٤٧: أعمدة جداول public = % (مفروض ٤٠٠ ثابتة)', n; end if;

  select count(*) into n from pg_policy pol join pg_class k on k.oid = pol.polrelid
    join pg_namespace ns on ns.oid = k.relnamespace where ns.nspname = 'public';
  if n <> 119 then raise exception 'ترقية ٤٧: سياسات RLS في public = % (مفروض ١١٩ ثابتة)', n; end if;

  select count(*) into n from pg_class k join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname = 'public' and k.relkind = 'r';
  if n <> 38 then raise exception 'ترقية ٤٧: جداول public = % (مفروض ٣٨ ثابتة)', n; end if;

  select relrowsecurity into b from pg_class where oid = 'public.messages'::regclass;
  if b is distinct from true then raise exception 'ترقية ٤٧: RLS مش مفعّلة على messages'; end if;

  select count(*) into n from public.messages;
  raise notice 'ترقية ٤٧: الفحوص كلها خضراء (messages=% أسطر قبل=بعد)', n;
end;
$$;
