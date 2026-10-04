-- ترقية ٤٨ — وصول الرسالة لحظيًا (بند 20/ج — الجزء السحابي)
--
-- ⏳ **محفوظة على القرص — لسه ما اتنفذتش على السحابة.** أمر المالك الحرفي مطلوب
--    («ممنوع أي رفع أو تنفيذ على Supabase إلا بأمر صريح من المستخدم»). الأداة:
--      node D:/_work/temp/apply_upgrade_48.js                      → يطبع الخطة ويخرج (بلا اتصال)
--      MIZAN_ORDER_48="نفّذ" node D:/_work/temp/apply_upgrade_48.js → تنفيذ في transaction واحدة
--
-- طلب المالك الحرفي (03/10 ≈02:30):
--   «علشان اصحاب المؤسسات يشوفوا الرسائل اللى وصلت لهم لحظى و يردوا عليها»
--   «و عايز الرساله لما تيجى تعمل صوت عالى»
--
-- الترقية دي بتعمل حاجة واحدة بس: `public.messages` تنضم لـ publication
-- `supabase_realtime`، عشان الاشتراك اللحظي (websocket) يلاقي الجدول.
--
-- القياس الحيّ 04/10 ≈08:00 (probe48.js — قراءة فقط، بيلغي أي رقم قديم من ذاكرة الكتابة):
--   · pg_publication: supabase_realtime موجودة (owner=postgres · insert/update/delete/truncate = true)
--   · pg_publication_tables: **صفر صفوف** ⇒ ده بالظبط سبب إن اللحظي كان مطفّي والدردشة على polling ١٢ث
--   · wal_level = logical · max_replication_slots = 5 · pg_replication_slots **فاضية**
--     (الخدمة بتعمل الـ slot عند أول مشترك ⇒ مافيش slot احنا نتحكم فيه)
--   · messages: relrowsecurity = true · replident = default(PK) — كافي لأحداث INSERT
--   · منح messages بحروفها: postgres=arwdDxtm · service_role=arwdDxtm · authenticated=ard
--     (SELECT/INSERT/DELETE بالظبط — مافيش UPDATE ومافيش anon/PUBLIC)
--   · السياسات الثلاث: msg_owner_select (منّ أو ليا) · msg_owner_insert (أنا + mizan_chat_peer + نفس الشركة)
--     · msg_owner_delete (رسايلي) — ومافيش استثناء للمالك
--   · البنية بعد ٤٧: 67 دالة · 119 سياسة · 112 فهرس · 38 جدول · 400 عمود جدول (relkind='r')
--   · أسطر messages وقت القياس: 19 (نشاط عادل الحيّ — ممنوع لمسها)
--
-- ⚠️ **ممنوع إعادة تشغيل الملف كما هو بعد التنفيذ**: بوابة «ممنوع التكرار» بترفض لو
--    `messages` منضمة فعلًا. الرجوع = `rollback_48.sql` (بتعمله `make_rollback_48.js`
--    جوه نسخة `D:/MizanBackups/pre-mig48-<stamp>/`).
--
-- 🪤 مصايد اتقادت في الصياغة دي (متثبتة عشان ميناعدش حد يركبها):
--   (١) `pg_attribute` بلا `k.relkind='r'` بيعدّ فهارس وسيكوينسات ⇒ **561** مش 400.
--       بوابة «400» على العد الغلط كانت هتعمل ROLLBACK لترقية سليمة (نفس مصيدة ٤٧).
--   (٢) نسخة الملف الأولى كان فيها `n0 int` **معلَّن ومطابَق بس بلا إسناد** ⇒ `n <> n0`
--       بتطلع NULL و«ولا سطر اتلمس» كانت فحص ميت أخضر دايمًا. دلوقتي القياس بيتخزن في
--       `set_config(..., true)` (محلي للمعاملة) وبيتقارن **عددًا وبصمةً**.
--   (٣) الأرقام المقفولة بتبقى قياس «قبل» يسقط أي إعادة تشغيل (درس ٤٩) ⇒ بوابات «بعد»
--       بتقارن بالقياس المتخزن جوه نفس المعاملة. الفحوص المطلقة اللي سايبينها هي اللي
--       **قرار** ملكنا مش قياس: ٣ سياسات · صفر UPDATE · صفر استثناء مالك · صفر anon ·
--       الدردشة بره النسخ الاحتياطي.
--   (٤) `current_setting('mizan48.…', true)` (missing_ok) بترجع NULL لما القياس يكون
--       ناقص ⇒ `n <> NULL` = NULL ⇒ الفحص **ميت أخضر**. كلها بقت نداء بوسيط واحد:
--       القياس الناقش بيرمي خطأ Postgres ومعاه رول باك كامل (fail-closed).
--
-- الخصوصية **ما بتتلمسش**: اللحظي في Supabase بيطبّق سياسات RLS قبل ما يوصّل أي سطر
-- لأي مشترك، فسابقي بيستقبل السطور اللي هو فيها from_user أو to_user بس — نفس
-- قاعدة «محدش يقدر يشوف رسايل مش مبعوته له». ومافيش أي سياسة جديدة أو متغيّرة،
-- ومافيش أي تعديل منح، ومافيش أي سطر بيتلمس.
--
-- بعد التنفيذ: الواجهة في البناء الجاي تشترك على `postgres_changes` وتسمع صوت،
-- و**الـ polling يفضل شغال** كاحتياطي أبطأ (لو النت فصل أو websocket ما كانش
-- مسموع، الرسايل توصل على أي حال).
--
-- مافيش begin/commit جوه الملف — المعاملة ملك أداة التنفيذ.

-- ═══════════ ١) بوابات «قبل» + قياس محلي للمعاملة + الكتابة الوحيدة ═══════════
do $$
declare
  n int;
  s text;
  b boolean;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'ترقية ٤٨: publication supabase_realtime مش موجودة على السحابة دي';
  end if;

  -- الـ publication لازم تنشر INSERT فعلًا، وإلا الانضمام شكل وبلا فائدة (اللحظي ما هيشوفش حاجة)
  select pubinsert into b from pg_publication where pubname = 'supabase_realtime';
  if b is distinct from true then
    raise exception 'ترقية ٤٨: supabase_realtime ما بتنشرش INSERT';
  end if;

  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                  where ns.nspname = 'public' and c.relname = 'messages' and c.relkind = 'r') then
    raise exception 'ترقية ٤٨: جدول messages مش موجود — ترقية ٤٥ لسه ما اتنفذتش';
  end if;

  -- الترتيب: سطر ٣ (ترقية ٤٧ — «رسالة للكل») لازم تكون سبقت، وإلا اللحظي بيوصل رسايل عادية وبس
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'mizan_chat_broadcast';
  if n <> 1 then
    raise exception 'ترقية ٤٨: mizan_chat_broadcast مش موجودة — سطر ٣ (ترقية ٤٧) لسه ما اتنفذتش';
  end if;

  -- ممنوع التكرار: `add table` على جدول موجود بيرمي خطأ، والفحص ده بيحوّله لرسالة واضحة
  if exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime'
                and schemaname = 'public' and tablename = 'messages') then
    raise exception 'ترقية ٤٨: messages منضمة للـ publication فعلًا — ممنوع الترقية تتكرر (الرجوع في rollback_48.sql)';
  end if;

  select setting into s from pg_settings where name = 'wal_level';
  if s <> 'logical' then raise exception 'ترقية ٤٨: wal_level = % (مفروض logical)', s; end if;

  -- قبل: الخصوصية زي ما المفروض تكون — ٣ سياسات، مافيش UPDATE، مافيش رحمة للمالك
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'messages';
  if n <> 3 then raise exception 'ترقية ٤٨: سياسات messages = % (مفروض ٣ قبل أي لمس)', n; end if;

  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename = 'messages' and cmd = 'UPDATE';
  if n <> 0 then
    raise exception 'ترقية ٤٨: سياسة UPDATE على messages — الخصوصية اتبدلت قبل ما نلمس حاجة';
  end if;

  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and (qual like '%is_superadmin%' or with_check like '%is_superadmin%');
  if n <> 0 then raise exception 'ترقية ٤٨: سياسة بتستثنى المالك — الخصوصية لازم حرفية'; end if;

  select relrowsecurity into b from pg_class where oid = 'public.messages'::regclass;
  if b is distinct from true then raise exception 'ترقية ٤٨: RLS مش مفعّلة على messages'; end if;

  -- ═══ القياس المتين «قبل» — محلي للمعاملة (is_local = true): أي فرق بعده = ROLLBACK ═══
  -- نافذة «ما قبل Start» — نفس درس ٤٧: عادل بيستخدم الدردشة فعلًا، فأي رسالة بتوصل بعد
  -- لحظة القياس ملكه هي مش شغلنا ⇒ العدّ والبصمة بيتقيدوا بـ created_at <= t0 (مش عدّ خام).
  select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') into s;
  perform set_config('mizan48.t0', s, true);

  select count(*) into n from public.messages
    where created_at <= current_setting('mizan48.t0')::timestamptz;
  perform set_config('mizan48.msg_n', n::text, true);

  select coalesce(md5(string_agg(id::text || '|' || body || '|' || is_private::text || '|' ||
        coalesce(read_at::text, '') || '|' || created_at::text, ',' order by created_at, id)), 'empty')
    into s from public.messages
    where created_at <= current_setting('mizan48.t0')::timestamptz;
  perform set_config('mizan48.msg_fp', s, true);

  select count(*) into n from pg_publication_tables where pubname = 'supabase_realtime';
  perform set_config('mizan48.pub_n', n::text, true);

  -- الأعمدة: **relkind = 'r'** (بدونها الرقم 561 مش 400 — مصيدة (١) في الرأس)
  select count(*) into n from pg_attribute a
    join pg_class k on k.oid = a.attrelid
    join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname = 'public' and k.relkind = 'r' and a.attnum > 0 and not a.attisdropped;
  perform set_config('mizan48.cols', n::text, true);

  select count(*) into n from pg_indexes where schemaname = 'public';
  perform set_config('mizan48.idxs', n::text, true);

  select count(*) into n from pg_class k join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname = 'public' and k.relkind = 'r';
  perform set_config('mizan48.tbls', n::text, true);

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public';
  perform set_config('mizan48.fns', n::text, true);

  select count(*) into n from pg_policies where schemaname = 'public';
  perform set_config('mizan48.pols', n::text, true);

  select coalesce(md5(array_to_string(k.relacl, ',')), '(null)') into s
    from pg_class k where k.oid = 'public.messages'::regclass;
  perform set_config('mizan48.acl_fp', s, true);

  select coalesce(md5(string_agg(policyname || '|' || cmd || '|' || coalesce(qual, '-') || '|' ||
        coalesce(with_check, '-'), ';' order by policyname)), 'empty') into s
    from pg_policies where schemaname = 'public' and tablename = 'messages';
  perform set_config('mizan48.pol_fp', s, true);

  -- ═══ الكتابة الوحيدة في الترقية دي ═══
  execute 'alter publication supabase_realtime add table public.messages';
end;
$$;

-- ═══════════════════════ ٢) فحوص بعد (أي فشل = رجوع) ═══════════════════════
do $$
declare
  n   int;
  s   text;
  b   boolean;
begin
  -- بعد: العضوية = ١ بالظبط، ومجموع الجداول = «قبل + ١» (مافيش جدول تاني اتلمس)
  select count(*) into n from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages';
  if n <> 1 then raise exception 'ترقية ٤٨: messages في publication = % (مفروض ١)', n; end if;

  select count(*) into n from pg_publication_tables where pubname = 'supabase_realtime';
  if n <> current_setting('mizan48.pub_n')::int + 1 then
    raise exception 'ترقية ٤٨: جداول publication = % (مفروض قبل % + ١)',
      n, current_setting('mizan48.pub_n');
  end if;

  select setting into s from pg_settings where name = 'wal_level';
  if s <> 'logical' then raise exception 'ترقية ٤٨: wal_level = % (مفروض logical)', s; end if;

  -- بعد: مافيش جدول تاني اتلمس في الـ publication (عدد الباقي = «قبل» بالظبط)
  select count(*) into n from pg_publication_tables
    where pubname = 'supabase_realtime'
      and not (schemaname = 'public' and tablename = 'messages');
  if n <> current_setting('mizan48.pub_n')::int then
    raise exception 'ترقية ٤٨: جداول تانية في supabase_realtime = % (كانت % قبل)',
      n, current_setting('mizan48.pub_n');
  end if;

  -- بعد: الخصوصية زي ما كانت — ٣ سياسات، مافيش UPDATE، مافيش رحمة للمالك
  select count(*) into n from pg_policies where schemaname='public' and tablename='messages';
  if n <> 3 then raise exception 'ترقية ٤٨: سياسات messages = % (مفروض ٣ ثابتة)', n; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages' and cmd='UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٨: سياسة UPDATE على messages — مرفوض'; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages'
      and (qual like '%is_superadmin%' or with_check like '%is_superadmin%');
  if n <> 0 then raise exception 'ترقية ٤٨: سياسة بتستثنى المالك — الخصوصية لازم حرفية'; end if;

  select relrowsecurity into b from pg_class where oid='public.messages'::regclass;
  if b is distinct from true then raise exception 'ترقية ٤٨: RLS مش مفعّلة على messages'; end if;

  -- بعد: **نصّات** السياسات الثلاث بايت-بايت (مش عدد بس — درس ٤٧)
  select coalesce(md5(string_agg(policyname || '|' || cmd || '|' || coalesce(qual, '-') || '|' ||
        coalesce(with_check, '-'), ';' order by policyname)), 'empty') into s
    from pg_policies where schemaname = 'public' and tablename = 'messages';
  if s <> current_setting('mizan48.pol_fp') then
    raise exception 'ترقية ٤٨: نصّات سياسات messages اتغيرت (بصمة قبل % ≠ بعد %)',
      left(current_setting('mizan48.pol_fp'), 8), left(s, 8);
  end if;

  -- بعد: المنح ما اتغيّرتش (select/insert/delete بس لـ authenticated، ومافيش anon/PUBLIC)
  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and pg_get_userbyid(x.grantee) = 'authenticated'
      and x.privilege_type in ('SELECT','INSERT','DELETE');
  if n <> 3 then raise exception 'ترقية ٤٨: منح authenticated على messages = % (مفروض ٣)', n; end if;

  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and (x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public'));
  if n <> 0 then raise exception 'ترقية ٤٨: منح anon/PUBLIC على messages (% grant)', n; end if;

  -- بعد: المنح حرفية (نفس بصمة relacl — مش نوع المنح بس)
  select coalesce(md5(array_to_string(k.relacl, ',')), '(null)') into s
    from pg_class k where k.oid = 'public.messages'::regclass;
  if s <> current_setting('mizan48.acl_fp') then
    raise exception 'ترقية ٤٨: منح messages اتغيرت (بصمة قبل % ≠ بعد %)',
      left(current_setting('mizan48.acl_fp'), 8), left(s, 8);
  end if;

  -- بعد: الدردشة لسه بره النسخ الاحتياطي (قرار المالك) — **بشيل التعليقات** عشان
  -- أي سطر شرح بيسمّي الجدول ما يديش ROLLBACK كاذب (درس ٤٦/٤٧).
  -- ملاحظة تركيبي: `[^\n]` جوه نص قياسي مش newline ⇒ الحدود بت chr(10).
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full')
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') like '%messages%';
  if n <> 0 then raise exception 'ترقية ٤٨: messages دخلت دوال النسخ الاحتياطي — قرار المالك مرفوض'; end if;

  -- بعد: مافيش أي سطر اتلمس (الضمّ بنية مش بيانات) — بعدّاد **وبصمة** على نافذة «قبل» (مصيدة (٢))
  select count(*) into n from public.messages
    where created_at <= current_setting('mizan48.t0')::timestamptz;
  if n <> current_setting('mizan48.msg_n')::int then
    raise exception 'ترقية ٤٨: أسطر messages في النافذة = % (كانت % قبل المعاملة)',
      n, current_setting('mizan48.msg_n');
  end if;

  select coalesce(md5(string_agg(id::text || '|' || body || '|' || is_private::text || '|' ||
        coalesce(read_at::text, '') || '|' || created_at::text, ',' order by created_at, id)), 'empty')
    into s from public.messages
    where created_at <= current_setting('mizan48.t0')::timestamptz;
  if s <> current_setting('mizan48.msg_fp') then
    raise exception 'ترقية ٤٨: بصمة رسايل النافذة اتغيرت (قبل % ≠ بعد %) — ممنوع أي سطر يتلمس',
      left(current_setting('mizan48.msg_fp'), 8), left(s, 8);
  end if;

  -- بعد: البنية ثابتة **بالقياس** (مصيدة (٣): الأرقام المقفولة = قياس «قبل» بيسقط أي إعادة تشغيل)
  select count(*) into n from pg_attribute a
    join pg_class k on k.oid = a.attrelid
    join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname='public' and k.relkind='r' and a.attnum > 0 and not a.attisdropped;
  if n <> current_setting('mizan48.cols')::int then
    raise exception 'ترقية ٤٨: أعمدة الجداول = % (كانت % — الترقية ما تزوّدتش عمود)',
      n, current_setting('mizan48.cols');
  end if;

  select count(*) into n from pg_indexes where schemaname='public';
  if n <> current_setting('mizan48.idxs')::int then
    raise exception 'ترقية ٤٨: فهارس public = % (كانت %)', n, current_setting('mizan48.idxs');
  end if;

  select count(*) into n from pg_class k join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname='public' and k.relkind='r';
  if n <> current_setting('mizan48.tbls')::int then
    raise exception 'ترقية ٤٨: جداول public = % (كانت %)', n, current_setting('mizan48.tbls');
  end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public';
  if n <> current_setting('mizan48.fns')::int then
    raise exception 'ترقية ٤٨: دوال public = % (كانت %)', n, current_setting('mizan48.fns');
  end if;

  select count(*) into n from pg_policies where schemaname='public';
  if n <> current_setting('mizan48.pols')::int then
    raise exception 'ترقية ٤٨: سياسات public = % (كانت %)', n, current_setting('mizan48.pols');
  end if;

  raise notice 'ترقية ٤٨: messages بقى في supabase_realtime والخصوصية زي ما هي';
end;
$$;
