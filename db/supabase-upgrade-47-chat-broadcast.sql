-- ترقية ٤٧ — «رسالة للكل» من المالك عادل، و«خاص» تبقى اختيارية (بند 20/ب)
--
-- ⏳ **محفوظة على القرص — لسه ما اتنفذتش على السحابة.** أمر المالك الحرفي مطلوب
--    («ممنوع أي رفع أو تنفيذ على Supabase إلا بأمر صريح من المستخدم»). الأداة:
--      node D:/_work/temp/apply_upgrade_47.js                      → يطبع الخطة ويخرج (بلا اتصال)
--      MIZAN_ORDER_47="نفّذ" node D:/_work/temp/apply_upgrade_47.js → تنفيذ في transaction واحدة
--    **شرط تنفيذ:** ترقية ٤٦ تكون اتنفذت قبلها (هي اللي بتعرّف «صاحب المؤسسة» صح،
--    والدالة دي بتبني دائرتها على نفس التعريف).
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
--   دائرة المستلمين = **نفس** mizan_chat_peer بتاعته: يعني لو سويته على
--   «أصحاب المؤسسات» يوصلهم، ولو سوّيه «كل المستخدمين» يوصل الكل. مافيش باب جديد.
--   «خاص» بقت اختيارية: الجدول أصلًا فيه is_private default false، والدالة بتستقبل
--   p_private بـ default false ⇒ الافتراضي «مش خاصة» وعلامة الصح لو عايزها.
--   الاستثناء الوحيد: **الدالة دي للمالك العام بس** (is_superadmin) — أي حساب تاني
--   يرمي رسالة ودّية وترجع من غير أي كتابة.
--
-- الترقية دي **ما بتعملش**: مافيش جدول/عمود/فهرس · مافيش سياسة RLS جديدة أو متغيّرة
--   · مافيش تعديل منح على messages · مافيش حذف أو تعديل أي سطر · مافيش لمس دوال النسخ.
--
-- مافيش begin/commit جوه الملف — المعاملة ملك أداة التنفيذ.

-- ═══════════════════ ١) دالة البث (حساب المالك العام بس) ═══════════════════
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

revoke all on function public.mizan_chat_broadcast(text, boolean) from public, anon;
grant execute on function public.mizan_chat_broadcast(text, boolean) to authenticated;

-- ═══════════════════════ ٢) فحوص قبل + بعد (أي فشل = رجوع) ═══════════════════
do $$
declare
  n   int;
  n0  int;
  p0  int;
  src text;
  b   boolean;
begin
  -- ── قبل: ٤٥ و٤٦ لازم يكونوا اتنفذوا ──
  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                  where ns.nspname = 'public' and c.relname = 'messages' and c.relkind = 'r') then
    raise exception 'ترقية ٤٧: جدول messages مش موجود — ترقية ٤٥ لسه ما اتنفذتش';
  end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname = 'mizan_is_owner';
  if n <> 1 then raise exception 'ترقية ٤٧: mizan_is_owner مش موجودة — ترقية ٤٦ لسه ما اتنفذتش'; end if;

  -- قبل: الدالة الجديدة مالهاش وجود (ممنوع الترقية تتكرر فوق نسخة منها)
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname = 'mizan_chat_broadcast';
  if n <> 0 then raise exception 'ترقية ٤٧: mizan_chat_broadcast موجودة قبل التنفيذ — ممنوع تتكرر'; end if;

  select count(*) into n from pg_policies where schemaname='public' and tablename='messages';
  if n <> 3 then raise exception 'ترقية ٤٧: سياسات messages قبل التنفيذ = % (مفروض ٣)', n; end if;

  -- بصمة البيانات قبل (أي تغيير بعدها = rollback)
  select count(*) into n0 from public.messages;
  select count(*) into p0 from public.profiles;

  -- ── بعد: الدالة موجودة، definer، مسارها مثبّت وpg_temp آخره ──
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_chat_broadcast'
      and p.prosecdef = true
      and array_to_string(p.proconfig, ',') = 'search_path=public, pg_temp';
  if n <> 1 then raise exception 'ترقية ٤٧: mizan_chat_broadcast مش محصّنة (definer + مسار مثبّت)'; end if;

  -- بعد: المنح — لا anon ولا PUBLIC، وauthenticated بس
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_chat_broadcast'
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) x
                       where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public')));
  if n <> 0 then raise exception 'ترقية ٤٧: mizan_chat_broadcast ليها منح anon/PUBLIC'; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_chat_broadcast'
      and exists (select 1 from aclexplode(p.proacl) x
                   where pg_get_userbyid(x.grantee) = 'authenticated'
                     and x.privilege_type = 'EXECUTE');
  if n <> 1 then raise exception 'ترقية ٤٧: mizan_chat_broadcast عليها منح authenticated'; end if;

  -- بعد: حصانة الدالة نفسها — بتسأل على المالك، وعلى ميزان peer، وما بتتجاوزش حدود الجدول
  select prosrc into src from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public' and p.proname='mizan_chat_broadcast';
  if src not like '%is_superadmin%' then
    raise exception 'ترقية ٤٧: mizan_chat_broadcast ما بتتحقاش في المالك';
  end if;
  if src not like '%mizan_chat_peer%' then
    raise exception 'ترقية ٤٧: mizan_chat_broadcast بتتجاوز ميزان الخصوصية';
  end if;
  if src not like '%from_user = v_me%' and src not like '%v_me, p.id%' then
    raise exception 'ترقية ٤٧: البث مش بختم المرسل نفسه (منع الانتحال)';
  end if;
  if src not like '%4000%' then
    raise exception 'ترقية ٤٧: البث ما بيحدّش طول الرسالة';
  end if;
  -- ممنوع أي UPDATE أو DELETE جوه دالة البث
  if src ~* 'update[[:space:]]+public\.messages' or src ~* 'delete[[:space:]]+from[[:space:]]+public\.messages' then
    raise exception 'ترقية ٤٧: mizan_chat_broadcast بتعدّل أو تمسح رسايل — مرفوض';
  end if;

  -- بعد: مافيش أي سياسة جديدة ولا متغيّرة على messages (البث بيكتب سطور عادية بالظبط)
  select count(*) into n from pg_policies where schemaname='public' and tablename='messages';
  if n <> 3 then raise exception 'ترقية ٤٧: سياسات messages بعد التنفيذ = % (مفروض ٣ ثابتة)', n; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages' and cmd='UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٧: سياسة UPDATE على messages — مرفوض'; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages'
      and (qual like '%is_superadmin%' or with_check like '%is_superadmin%');
  if n <> 0 then raise exception 'ترقية ٤٧: سياسة بتستثنى المالك — الخصوصية لازم حرفية'; end if;

  -- بعد: منح الجدول ما اتغيّرتش
  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and pg_get_userbyid(x.grantee) = 'authenticated'
      and x.privilege_type in ('SELECT','INSERT','DELETE');
  if n <> 3 then raise exception 'ترقية ٤٧: منح authenticated على messages = % (مفروض ٣)', n; end if;

  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and (x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public'));
  if n <> 0 then raise exception 'ترقية ٤٧: منح anon/PUBLIC على messages (% grant)', n; end if;

  -- بعد: الدردشة بره النسخ الاحتياطي (قرار المالك)
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full')
      and p.prosrc like '%messages%';
  if n <> 0 then raise exception 'ترقية ٤٧: messages دخلت دوال النسخ الاحتياطي — قرار المالك مرفوض'; end if;

  -- بعد: مافيش أي سطر اتلمس (الدالة ما اتنادتش جوّه الترقية)
  select count(*) into n from public.messages;
  if n <> n0 then raise exception 'ترقية ٤٧: أسطر messages اتغيّرت من % إلى %', n0, n; end if;

  select count(*) into n from public.profiles;
  if n <> p0 then raise exception 'ترقية ٤٧: أسطر profiles اتغيّرت من % إلى %', p0, n; end if;

  -- بعد: البنية — الدوال +١ بس (broadcast)، وباقي المقاييس ثابتة
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public';
  if n <> 67 then raise exception 'ترقية ٤٧: دوال public = % (مفروض ٦٦ + broadcast = ٦٧)', n; end if;

  select count(*) into n from pg_attribute a
    join pg_class k on k.oid = a.attrelid
    join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname='public' and a.attnum > 0 and not a.attisdropped;
  if n <> 400 then raise exception 'ترقية ٤٧: أعمدة public = % (مفروض ٤٠٠ ثابتة)', n; end if;

  select count(*) into n from pg_policy pol join pg_class k on k.oid = pol.polrelid
    join pg_namespace ns on ns.oid = k.relnamespace where ns.nspname='public';
  if n <> 119 then raise exception 'ترقية ٤٧: سياسات RLS في public = % (مفروض ١١٩ ثابتة)', n; end if;

  select count(*) into n from pg_class k join pg_namespace ns on ns.oid = k.relnamespace
    where ns.nspname='public' and k.relkind='r';
  if n <> 38 then raise exception 'ترقية ٤٧: جداول public = % (مفروض ٣٨ ثابتة)', n; end if;

  select relrowsecurity into b from pg_class where oid='public.messages'::regclass;
  if b is distinct from true then raise exception 'ترقية ٤٧: RLS مش مفعّلة على messages'; end if;

  raise notice 'ترقية ٤٧: الفحوص كلها خضراء (messages=% أسطر قبل=بعد)', n0;
end;
$$;
