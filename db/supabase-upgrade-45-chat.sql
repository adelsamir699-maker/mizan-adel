-- ترقية ٤٥ — الدردشة الداخلية (بند 16)
--
-- ⚠️ هذا الملف **محفوظ على القرص بس**. ممنوع تنفيذه على Supabase إلا بأمر صريح من المالك.
--    أداة التنفيذ: D:/_work/temp/apply_upgrade_45.js — متقفلة بمفتاح MIZAN_ORDER_45="نفّذ".
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
revoke all on public.messages from anon, public;
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
  if n <> 8 then raise exception 'ترقية ٤٥: عدد أعمدة messages = %% (مفروض ٨)', n; end if;

  select relrowsecurity into b from pg_class where oid='public.messages'::regclass;
  if b is distinct from true then raise exception 'ترقية ٤٥: RLS مش مفعّلة على messages'; end if;

  -- بعد: ٣ سياسات بالظبط، ومافيش سياسة UPDATE، ومافيش رحمة superadmin في أي سياسة
  select count(*) into n from pg_policies where schemaname='public' and tablename='messages';
  if n <> 3 then raise exception 'ترقية ٤٥: سياسات messages = %% (مفروض ٣)', n; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages' and cmd='UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٥: فيه سياسة UPDATE على messages — مرفوض'; end if;

  select count(*) into n from pg_policies
    where schemaname='public' and tablename='messages'
      and (polqual like '%is_superadmin%' or polwithcheck like '%is_superadmin%');
  if n <> 0 then raise exception 'ترقية ٤٥: سياسة بتستثنى المالك — الخصوصية لازم حرفية'; end if;

  -- بعد: المنح — anon/public مالهمش أي صلاحية، وauthenticated بلا UPDATE
  select count(*) into n from information_schema.role_table_grants
    where table_schema='public' and table_name='messages'
      and grantee in ('anon','public');
  if n <> 0 then raise exception 'ترقية ٤٥: منح anon/public على messages لسه موجودة'; end if;

  select count(*) into n from information_schema.role_table_grants
    where table_schema='public' and table_name='messages'
      and grantee='authenticated' and privilege_type='UPDATE';
  if n <> 0 then raise exception 'ترقية ٤٥: authenticated لسه عندها UPDATE على messages'; end if;

  -- بعد: الدوال الأربعة محصّنة (definer + pg_temp آخر المسار + بتقرأ auth.uid)
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public'
      and p.proname in ('mizan_chat_peer','mizan_chat_peers','mizan_chat_read','mizan_chat_set_scope')
      and p.prosecdef = true
      and array_to_string(p.proconfig,',') like '%search_path=public%'
      and array_to_string(p.proconfig,',') like '%pg_temp%'
      and p.prosrc like '%auth.uid()%';
  if n <> 4 then raise exception 'ترقية ٤٥: الدوال المحصّنة = %% (مفروض ٤)', n; end if;

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
  if n <> 0 then raise exception 'ترقية ٤٥: messages فيها %% سطر — المفروض فضايي', n; end if;
end;
$$;

-- ═══════════════════════ سجل ═══════════════════════
-- الحالة: مكتوبة ومحفوظة على القرص (بناء ١٢٥) — **لم تُنفّذ**.
-- التنفيذ يحتاج أمر المالك الحرفي، وبعده: باك أب قبل/بعد + test_chat_privacy_45.js
-- (رحلات أدوار حقيقية داخل savepoint/rollback — درس ترقية ٤٣).
