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
-- القياس الحيّ 03/10: الـ publication موجودة و`wal_level=logical` بس **صفر جدول**
-- فيها ⇒ اللحظي كان مطفّي والسبب ده بالظبط، فالدردشة كانت على polling (١٢ ثانية).
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

-- ═══════════════ ١) ضمّ جدول الرسايل لـ publication اللحظي ═══════════════
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'ترقية ٤٨: publication supabase_realtime مش موجودة على السحابة دي';
  end if;

  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                  where ns.nspname = 'public' and c.relname = 'messages' and c.relkind = 'r') then
    raise exception 'ترقية ٤٨: جدول messages مش موجود — ترقية ٤٥ لسه ما اتنفذتش';
  end if;

  -- ممنوع التكرار: `add table` على جدول موجود بيرمي خطأ، والفحص ده بيحوّله لرسالة واضحة
  if exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime'
                and schemaname = 'public' and tablename = 'messages') then
    raise exception 'ترقية ٤٨: messages منضمة للـ publication فعلًا — ممنوع الترقية تتكرر';
  end if;

  execute 'alter publication supabase_realtime add table public.messages';
end;
$$;

-- ═══════════════════════ ٢) فحوص بعد (أي فشل = رجوع) ═══════════════════════
do $$
declare
  n   int;
  n0  int;
  s   text;
  b   boolean;
begin
  -- بعد: العضوية = ١ بالظبط، والـ wal_level منطقي فعليًا (مافيش معنى نفعّل من غيره)
  select count(*) into n from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages';
  if n <> 1 then raise exception 'ترقية ٤٨: messages في publication = % (مفروض ١)', n; end if;

  select setting into s from pg_settings where name = 'wal_level';
  if s <> 'logical' then raise exception 'ترقية ٤٨: wal_level = % (مفروض logical)', s; end if;

  select count(*) into n from pg_publication_tables where pubname = 'supabase_realtime';
  if n <> 1 then raise exception 'ترقية ٤٨: جداول supabase_realtime = % (مفروض ١ — جدول الرسايل بس)', n; end if;

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

  -- بعد: الدردشة لسه بره النسخ الاحتياطي (قرار المالك)
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full')
      and p.prosrc like '%messages%';
  if n <> 0 then raise exception 'ترقية ٤٨: messages دخلت دوال النسخ الاحتياطي — قرار المالك مرفوض'; end if;

  -- بعد: مافيش أي سطر اتلمس (الضمّ بنية مش بيانات)
  select count(*) into n from public.messages;
  if n <> n0 then raise exception 'ترقية ٤٨: أسطر messages اتغيّرت'; end if;

  -- بعد: البنية ثابتة (الترقية ما بتزودش عمود/فهرس/سياسة/جدول/دالة)
  select count(*) into n from pg_attribute a
    join pg_class k on k.oid = a.attrelid
    join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname='public' and a.attnum > 0 and not a.attisdropped;
  if n <> 400 then raise exception 'ترقية ٤٨: أعمدة public = % (مفروض ٤٠٠ ثابتة)', n; end if;

  select count(*) into n from pg_indexes where schemaname='public';
  if n <> 112 then raise exception 'ترقية ٤٨: فهارس public = % (مفروض ١١٢ ثابتة)', n; end if;

  select count(*) into n from pg_class k join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname='public' and k.relkind='r';
  if n <> 38 then raise exception 'ترقية ٤٨: جداول public = % (مفروض ٣٨ ثابتة)', n; end if;

  raise notice 'ترقية ٤٨: messages بقى في supabase_realtime والخصوصية زي ما هي';
end;
$$;
