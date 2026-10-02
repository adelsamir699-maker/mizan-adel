-- ترقية ٤٥ — الدردشة الداخلية (بند 16)
--
-- ✅ **اتنفّذت على Supabase 03/10 ≈00:44 بأمر المالك الحرفي «يلا، نفذ ترقية الدردشة دلوقتي»**.
--    الأداة: D:/_work/temp/apply_upgrade_45.js (مقفولة بمفتاح MIZAN_ORDER_45="نفّذ") —
--    transaction واحدة + ١٩ فحصًا بعد = كلها خضراء قبل الـ commit.
--    الباك أب: قبل = pre-mig45-20261003-0037 · بعد = post-mig45-20261003-0057.
--    المخطط: 392→400 عمودًا · 88→93 قيدًا · 61→65 دالة · 116→119 سياسة · 108→112 فهرس · 37→38 جدول.
--    الإثبات السلوكي على أدوار حقيقية: test_chat_privacy_45.js = **60 ✅/0 ❌** (كله rollback).
--    ❗ ممنوع إعادة تشغيل الملف كما هو: فحص «messages فاضي» بيبقى فشل متعمّد بعد أول استخدام
--       (ده مقصود — الترقيات ما تتكررش فوق بيانات حية). لو لازم تعديل لاحق = ملف جديد ٤٦ بأمر صريح.
--
--    تصحيحان طلعوا من **التنفيذ نفسه** (المحاكاة والمحلي ما كانش ممكن يمسكوا دول):
--      (١) Supabase بيدي منح all لـ `authenticated` تلقائيًا على أي جدول جديد ⇒ `revoke` عن
--          anon/PUBLIC بس كان بيسيب UPDATE فاعلة، والفحص الداخلي رفض ⇒ سحبناها من authenticated كمان.
--      (٢) استعلام فحص منح الدوال كان مكتوبًا `from pg_proc p, aclexplode(...) x join pg_namespace …`
--          وهو **باطل نحويًا** في Postgres (ON تبع JOIN ما يرجعش لعنصر الفاصلة اللي قبله).
--
-- قواعد المالك الحرفية اللي التحصين ده مبني عليها:
--   ١) «محدش يقدر يشوف رسايل مش مبعوته له»        → سياسة SELECT على الصف نفسه: from = أنا أو to = أنا
--   ٢) «محدش يقدر يشوف رسايل حد اعتبرها خصوصية»   → نفس السياسة + is_private محصورة في الطرفين
--   ٣) «محدش يقدر يشوف اعضاء شركة مش شركته»       → ميزان الدردشة (peer) بيطلب نفس org_id
--   الحماية **في القاعدة (RLS)** مش إخفاء في الواجهة، و**مفيش أي رحمة لـ is_superadmin**
--   داخل سياسة الـ RLS — عادل شغال بنفس القاعدة، واللي بيتحكم في ظهوره هو سويته في ضبطه.
--
-- قرار المالك: «الدردشة لا تدخل النسخ الاحتياطي» → messages **مش** موجودة في
--   mizan_admin_backup_full / mizan_admin_restore_full ولا FULL_RESTORE_TABLES، والفحص
--   تحت بيمسك أي محاولة إدخال لها.
--
-- مافيش begin/commit جوه الملف — المعاملة ملك أداة التنفيذ.

-- ═══════════════════════════════ ١) الجدول ═══════════════════════════════
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid default public.current_org(),   -- سياق الإرسال، **مش** بوابة صلاحية
  from_user   uuid not null references auth.users(id) on delete cascade,
  to_user     uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  is_private  boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint msg_not_self   check (from_user <> to_user),
  constraint msg_body_len   check (body <> '' and char_length(body) <= 4000)
);

create index if not exists messages_to_unread_idx on public.messages (to_user, read_at);
create index if not exists messages_from_created_idx on public.messages (from_user, created_at);
create index if not exists messages_to_created_idx on public.messages (to_user, created_at);

comment on table public.messages is
  'الدردشة الداخلية — خاصة بين المرسل والمستلم فقط (RLS). لا تدخل أي نسخة احتياطية.';

-- ═══════════════════════════ ٢) دوال المساعدة ════════════════════════════
-- كل الدوال security definer ومسارها مثبّت وpg_temp **آخر** (نفس حصانة ترقية ٤٣)،
-- والمنح لـ authenticated بس (ممنوع anon/public).

-- السلطة الوحيدة «مين يقدر يبايع مين»: ١٠٠٪ من منطق الخصوصية، بترجع boolean.
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
        -- (٣) أعضاء شركتي بس
        (me.org_id is not null and them.org_id is not null and me.org_id = them.org_id)
        -- عادل ↔ أصحاب المؤسسات (افتراضي)، أو ↔ الكل لو سويته على «all»
        or (me.sup and them.org_id is not null
            and (me.scope = 'all'
                 or exists (select 1 from public.organizations o
                             where o.owner_id = them.id)))
        -- صاحب شركة ↔ عادل
        or (them.sup and me.org_id is not null
            and exists (select 1 from public.organizations o where o.owner_id = me.id))
      )
  );
$$;

revoke all on function public.mizan_chat_peer(uuid) from public, anon;
grant execute on function public.mizan_chat_peer(uuid) to authenticated;

-- قائمة المخاطَبين — بتتبنى نفس Mizan_chat_peer فالبوابة واحدة مش منسوخة.
create or replace function public.mizan_chat_peers()
returns table (
  id uuid, full_name text, role text, is_superadmin boolean,
  org_id uuid, org_name text, is_owner boolean
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
         (o.owner_id = p.id)
    from public.profiles p
    left join public.organizations o on o.id = p.org_id
   where coalesce(p.is_active,true) is true
     and coalesce(p.blocked,false) is false
     and public.mizan_chat_peer(p.id)
   order by coalesce(o.name,''), lower(coalesce(p.full_name,''));
$$;

revoke all on function public.mizan_chat_peers() from public, anon;
grant execute on function public.mizan_chat_peers() to authenticated;

-- تعليم الرسالة كمقروءة — الحد الوحيد: أنا المستلم. (بدون أي صلاحية UPDATE على الجدول.)
create or replace function public.mizan_chat_read(p_id uuid)
returns void
language sql
security definer
set search_path = 'public', 'pg_temp'
as $$
  update public.messages
     set read_at = coalesce(read_at, now())
   where id = p_id
     and to_user = auth.uid();
$$;

revoke all on function public.mizan_chat_read(uuid) from public, anon;
grant execute on function public.mizan_chat_read(uuid) to authenticated;

-- سويتها عادل: «owners» (أصحاب المؤسسات فقط — افتراضي) أو «all» (كل المستخدمين).
create or replace function public.mizan_chat_set_scope(p_scope text)
returns text
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if p_scope not in ('owners','all') then
    raise exception 'الدردشة تفتح لـ«أصحاب المؤسسات» أو «كل المستخدمين» بس';
  end if;

  update public.profiles
     set features = jsonb_set(coalesce(features,'{}'::jsonb), '{chatScope}', to_jsonb(p_scope))
   where id = auth.uid()
     and coalesce(is_superadmin,false) is true;

  if not found then
    raise exception 'دي إعدادات حساب المالك فقط';
  end if;

  return p_scope;
end;
$$;

revoke all on function public.mizan_chat_set_scope(text) from public, anon;
grant execute on function public.mizan_chat_set_scope(text) to authenticated;

-- ═══════════════════════════ ٣) سياسات RLS ═══════════════════════════════
-- ملاحظة مقصودة: enable مش force — لأن mizan_chat_read (definer) لازم تقدر تكتب read_at،
-- وبوابتها الذاتية (to_user = auth.uid()) هي الضمان.

alter table public.messages enable row level security;

drop policy if exists msg_owner_select on public.messages;
create policy msg_owner_select on public.messages
  for select
  using (from_user = auth.uid() or to_user = auth.uid());

drop policy if exists msg_owner_insert on public.messages;
create policy msg_owner_insert on public.messages
  for insert
  with check (
    from_user = auth.uid()
    and public.mizan_chat_peer(to_user)
    and org_id is not distinct from public.current_org()
  );

-- حذف رسالة **بنا** مش بتاعتنا = مرفوض (مفيش أي سياسة UPDATE خالص).
drop policy if exists msg_owner_delete on public.messages;
create policy msg_owner_delete on public.messages
  for delete
  using (from_user = auth.uid());

-- ═══════════════════════════ ٤) المنح ═════════════════════════════════════
-- تنبيه تنفيذي (03/10): Supabase بيدي **افتراضيًا** منح all لـ authenticated على أي
-- جدول جديد في public. لو سحبنا المنح عن anon/PUBLIC بس، UPDATE بتاع authenticated
-- بيفضل موجود والفحص الداخلي بيرفض (والترقية كلها ترجع). ⇒ نسحب الكل أولًا على
-- authenticated كمان، وبعدين نمنح التلاتة المسموحين بالظبط.
revoke all on public.messages from anon, public, authenticated;
grant select, insert, delete on public.messages to authenticated;
-- ممنوع update: تعليم «مقروءة» يتم بالدالة فقط.

-- ═══════════════════════ ٥) فحوص قبل + بعد (تراجع لو فشل أي) ═══════════════════════
do $$
declare
  n int;
  src text;
  b boolean;
begin
  -- قبل: لو الجدول موجود بالفعل لازم يكون بنفس الشكل (ممنوع إنشاء فوق جدول مختلف)
  if exists (select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
              where ns.nspname='public' and c.relname='messages' and c.relkind='r') then
    select count(*) into n from pg_attribute a
      where a.attrelid = 'public.messages'::regclass
        and a.attnum > 0 and not a.attisdropped
        and a.attname in ('id','org_id','from_user','to_user','body','is_private','read_at','created_at');
    if n <> 8 then
      raise exception 'ترقية ٤٥: messages موجود بشكل مختلف (% أعمدة من ٨) — rollback', n;
    end if;
  end if;

  -- بعد: العمودات + RLS
  select count(*) into n from pg_attribute a
    where a.attrelid = 'public.messages'::regclass
      and a.attnum > 0 and not a.attisdropped
      and a.attname in ('id','org_id','from_user','to_user','body','is_private','read_at','created_at');
  if n <> 8 then raise exception 'ترقية ٤٥: عدد أعمدة messages = % (مفروض ٨)', n; end if;

  select relrowsecurity into b from pg_class where oid='public.messages'::regclass;
  if b is distinct from true then raise exception 'ترقية ٤٥: RLS مش مفعّلة على messages'; end if;
  -- relforce = false **بقرار**: mizan_chat_read (definer) لازم تكتب read_at، وبوابتها الذاتية هي الضمان
  select relforcerowsecurity into b from pg_class where oid='public.messages'::regclass;
  if b is distinct from false then raise exception 'ترقية ٤٥: relforce على messages مش false — dوال المقروء هتتقفل'; end if;

  -- بعد: ٣ سياسات بالظبط، ومافيش سياسة UPDATE، ومافيش رحمة superadmin في أي سياسة
  select count(*) into n from pg_policies where schemaname='public' and tablename='messages';
  if n <> 3 then raise exception 'ترقية ٤٥: سياسات messages = % (مفروض ٣)', n; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages' and cmd='UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٥: فيه سياسة UPDATE على messages — مرفوض'; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages'
      and (qual like '%is_superadmin%' or with_check like '%is_superadmin%');
  if n <> 0 then raise exception 'ترقية ٤٥: سياسة بتستثنى المالك — الخصوصية لازم حرفية'; end if;

  -- بعد: المنح — anon/PUBLIC مالهمش أي صلاحية، وauthenticated عندها ٣ ومن غير UPDATE
  -- (aclexplode موثوق: grantee=0 هو PUBLIC، وinformation_schema بيفسّر PUBLIC بشكل مختلف)
  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and (x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public'));
  if n <> 0 then raise exception 'ترقية ٤٥: منح anon/PUBLIC على messages لسه موجودة (% grant)', n; end if;

  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and pg_get_userbyid(x.grantee) = 'authenticated'
      and x.privilege_type in ('SELECT','INSERT','DELETE');
  if n <> 3 then raise exception 'ترقية ٤٥: منح authenticated على messages = % (مفروض ٣: select/insert/delete)', n; end if;

  select count(*) into n from pg_class k, aclexplode(k.relacl) x
    where k.oid = 'public.messages'::regclass
      and pg_get_userbyid(x.grantee) = 'authenticated' and x.privilege_type = 'UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٥: authenticated لسه عندها UPDATE على messages'; end if;

  -- بعد: الدوال الأربعة محصّنة (definer + search_path مثبّت وpg_temp آخره)
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_chat_peer','mizan_chat_peers','mizan_chat_read','mizan_chat_set_scope')
      and p.prosecdef = true
      and array_to_string(p.proconfig, ',') = 'search_path=public, pg_temp';
  if n <> 4 then raise exception 'ترقية ٤٥: الدوال المحصّنة = % (مفروض ٤)', n; end if;

  -- بعد: التقييد الذاتي — ٣ دوال بتقرأ auth.uid() (peers بتستدعي peer فمستناش auth.uid مباشرة)
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_chat_peer','mizan_chat_read','mizan_chat_set_scope')
      and p.prosrc like '%auth.uid()%';
  if n <> 3 then raise exception 'ترقية ٤٥: دوال بتقرأ auth.uid() = % (مفروض ٣)', n; end if;

  -- بعد: المنح على الدوال — authenticated بس، وممنوع أي grant لـ anon/PUBLIC
  -- تصحيح تنفيذي (03/10): الصيغة القديمة (aclexplode مرميّ بالفاصلة قبل JOIN pg_namespace)
  -- **باطلة في Postgres** — ON حق الـ JOIN ما ينفعش يرجع للعنصر اللي قبله بالفاصلة، وكانت بترجّع
  -- `invalid reference to FROM-clause entry for table "p"`. الصيغة دي كمان بتفشل لو proacl فاضي
  -- (NULL = PUBLIC مسموح ضمنيًا) بدل ما تعدّي في صمت.
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_chat_peer','mizan_chat_peers','mizan_chat_read','mizan_chat_set_scope')
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) x
                       where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','public')));
  if n <> 0 then raise exception 'ترقية ٤٥: دوال الدردشة لمنح anon/PUBLIC (% دالة)', n; end if;

  select prosrc into src from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public' and p.proname='mizan_chat_read';
  if src not like '%to_user = auth.uid()%' then
    raise exception 'ترقية ٤٥: mizan_chat_read ما بتقيّدهاش بالمستلم';
  end if;

  -- بعد: الدردشة ما تدخلش النسخ الاحتياطي (قرار المالك)
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_admin_backup_full','mizan_admin_restore_full')
      and p.prosrc like '%messages%';
  if n <> 0 then raise exception 'ترقية ٤٥: messages دخلت دوال النسخ الاحتياطي — قرار المالك مرفوض'; end if;

  -- بعد: مفيش أي سطر بيانات اتلمس
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'ترقية ٤٥: messages فيها % سطر — المفروض فاضية', n; end if;
end;
$$;

-- ═══════════════════════ سجل ═══════════════════════
-- ✅ مُنفَّذة على Supabase 2026-10-03 ≈00:44 (توقيت القاهرة) بأمر المالك الحرفي
--    «يلا، نفذ ترقية الدردشة دلوقتي» — transaction واحدة، ١٩ فحصًا بعد التنفيذ كلها ✅ ثم commit.
--   قبل: 392 عمودًا/88 قيدًا/61 دالة/116 سياسة/108 فهرس/37 جدول — بعد: 400/93/65/119/112/38.
--    ولا سطر بيانات اتلمس: profiles=9 · organizations=8 · employees=0 قبل وبعد، و md5 حزمة
--    دوال النسخ الأربعة زي ما هي حرفيًا (78094c20cba0a7aaf55ffa25e1f8321c).
--    الباك أب: D:/MizanBackups/pre-mig45-20261003-0037 · D:/MizanBackups/post-mig45-20261003-0057
--    (لقطة البنية بتثبت: ٨ أعمدة messages + ٣ سياسات select/insert/delete وبلا أي سياسة UPDATE،
--     وملف messages **موجودش** في لقطة البيانات = الدردشة بره النسخ الاحتياطي بقرار المالك).
--    الإثبات السلوكي بأدوار حقيقية (كل محاولة في savepoint والكل rollback — درس ٤٣):
--    test_chat_privacy_45.js = **60 ✅/0 ❌** يغطي الأوامر الأربعة + anon + منع الانتحال +
--    منع UPDATE + الحذف للمرسل فقط + سويتش owners/all + «messages بره mizan_admin_backup_full».
--    أول استخدام حيّ بعد التنفيذ: عادل بعت رسالتين من التطبيق فعليًا (00:56 و00:57) بعد ما قلب
--    السويتش على «كل المستخدمين» ⇒ الكتابة والقراءة شغالة من غير أي تعديل كود إضافي.
--    المتأجل لقراره: فرع «أصحاب المؤسسات» بيقارن `organizations.owner_id`، وعلى البيانات الحالية
--    كل الشركات owner_id = عادل ⇒ القائمة الافتراضية بتاعته = صفر، بينما تعريف التطبيق لصاحب
--    الشركة = `role='admin' && !is_superadmin` (app.js:1532). أي تصويب = ترقية ٤٦ بأمره الحرفي.
