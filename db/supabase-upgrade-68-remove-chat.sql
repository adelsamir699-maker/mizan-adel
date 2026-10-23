-- ══════════════════════════════════════════════════════════════════════════════
-- ترقية ٦٨ — إلغاء الدردشة نهائيًا (طلبات المالك 23/10: «احذف الدردشة بالكامل»)
-- ══════════════════════════════════════════════════════════════════════════════
-- الخلفية:
--   بناء 224 شال الدردشة من الواجهة والتشغيل، وبناء 236 شال آخر مراجعها من الكود.
--   القاعدة فضل فيها جدول `public.messages` (٨٢ صفًا تاريخيًا) و٥ دوال `mizan_chat_*`
--   و٣ سياسات و٤ فهارس وعضوية في publication اللحظي — كلها بلا أي مستهلك.
--
-- اللي الملف ده بيعمله (داخل معاملة واحدة يشغّلها المشغّل):
--   ١) يحافظ على الدالتين غير المتعلقتين بالدردشة واللي كانت ترقية ٤٦ بتعرّفهما
--      (`mizan_is_owner` و`mizan_org_info`) — لأن ملف ٤٦ هيتحذف من حزمة النشر.
--   ٢) يحذف الجدول `public.messages` (CASCADE: سياسات/فهارس/تسلسل/عضوية publication).
--   ٣) يحذف الدوال الخمس: broadcast / peer / peers / read / set_scope.
--   ٤) ينضّف مفتاح `chatScope` من `profiles.features` (سطر واحد على السحابة).
--   ٥) فحص «بعد» صارم: لا جدول، لا دوال، لا عضوية publication، لا مفتاح،
--      والدالتان المحفوظتان موجودتان.
--
-- ملاحظات:
--   • لا `begin/commit` هنا — المشغّل هو اللي بيفتح المعاملة ويقرر COMMIT/ROLLBACK.
--   • idempotent: كل الحذف بـ IF EXISTS ⇒ آمن على قاعدة جديدة (ملفات ٤٥–٤٨ اتشالت
--     من الحزمة، فالسيرفر الجديد مش هيكون عنده messages أصلًا).
--   • الباك أب قبل التنفيذ: D:\MizanBackups\pre-mig68-20261023105705
--     (messages 82 صفًا + تعريفات الدوال + السياسات + الفهارس + المنح + chatScope).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── ١) تعريف «صاحب المؤسسة» (منقول حرفيًا من ترقية ٤٦ — غير متعلق بالدردشة) ──
create or replace function public.mizan_is_owner(p_id uuid)
returns boolean
language sql stable
security definer
set search_path = 'public', 'pg_temp'
as $$
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

-- ── ٢) شاشة «حسابات شركتك» (منقول حرفيًا من ترقية ٤٦ — غير متعلق بالدردشة) ──
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

-- ── ٣) حذف الدوال الخمس (بالترتيب: peers تعتمد على peer) ──────────────────────
drop function if exists public.mizan_chat_peers() cascade;
drop function if exists public.mizan_chat_broadcast(text, boolean) cascade;
drop function if exists public.mizan_chat_read(uuid) cascade;
drop function if exists public.mizan_chat_set_scope(text) cascade;
drop function if exists public.mizan_chat_peer(uuid) cascade;

-- ── ٤) حذف الجدول وكل ملحقاته (سياسات/فهارس/تسلسل/عضوية publication) ─────────
drop table if exists public.messages cascade;

-- ── ٥) تنظيف مفتاح الدردشة من ميزات الحسابات ──────────────────────────────────
update public.profiles
   set features = features - 'chatScope'
 where features ? 'chatScope';

-- ── ٦) فحص «بعد» ─────────────────────────────────────────────────────────────
do $$
declare
  n int;
begin
  if to_regclass('public.messages') is not null then
    raise exception 'ترقية ٦٨: الجدول public.messages لسه موجود';
  end if;

  select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname like 'mizan_chat_%';
  if n <> 0 then
    raise exception 'ترقية ٦٨: دوال الدردشة لسه موجودة (%)', n;
  end if;

  select count(*) into n
    from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'messages';
  if n <> 0 then
    raise exception 'ترقية ٦٨: messages لسه في publication اللحظي';
  end if;

  select count(*) into n
    from public.profiles
   where features ? 'chatScope';
  if n <> 0 then
    raise exception 'ترقية ٦٨: مفتاح chatScope لسه في % حساب', n;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = 'mizan_is_owner'
  ) then
    raise exception 'ترقية ٦٨: mizan_is_owner مش موجود';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = 'mizan_org_info'
  ) then
    raise exception 'ترقية ٦٨: mizan_org_info مش موجود';
  end if;

  raise notice 'ترقية ٦٨: تم حذف الدردشة بالكامل (جدول + ٥ دوال + chatScope) والدالتان المحفوظتان سليمتان';
end;
$$;
