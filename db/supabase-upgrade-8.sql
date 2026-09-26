-- ==============================================================
-- ترقية 8: متابعة المتصلين الآن (Presence)
-- كل مستخدم في النظام يرسل "نبضة حية" كل 15 ثانية أثناء فتح التطبيق.
-- المالك يشاهد عدد المتصلين وأسماء الشركات واليوزرات عبر لوحة الإدارة.
-- ==============================================================

-- 1) جدول الحضور (شخص واحد لكل مستخدم — آخر مرة شوهد فيها)
create table if not exists public.presence (
  user_id uuid primary key references auth.users on delete cascade,
  org_id uuid references public.organizations on delete cascade,
  last_seen timestamptz default now()
);

alter table public.presence enable row level security;

-- لا سياسات RLS عمدًا: الوصول يكون فقط عبر الدوال (security definer)
-- بحيث لا يمكن لأي مستخدم قراءة حضور غيره مباشرة.
grant select, insert, update, delete on public.presence to service_role;
grant select on public.presence to authenticated;

-- 2) نبضة حية: يسجل العميل "أنا على النظام الآن"
drop function if exists public.mizan_presence_heartbeat();
create or replace function public.mizan_presence_heartbeat()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations.id%type;
begin
  select org_id into v_org from public.profiles where id = auth.uid() and blocked = false;
  if v_org is null then return; end if;
  insert into public.presence (user_id, org_id, last_seen)
  values (auth.uid(), v_org, now())
  on conflict (user_id) do update set org_id = excluded.org_id, last_seen = now();
  -- تنظيف المتصلين غير النشطين (لا نبضة منذ أكثر من 5 دقائق = خرج)
  delete from public.presence where last_seen < now() - interval '5 minutes';
end $$;

-- 3) قائمة المتصلين الآن (للمالك فقط) — نعرض آخر 100 نشاط فقط
drop function if exists public.mizan_presence_online();
create or replace function public.mizan_presence_online()
returns table (
  org_name text,
  username text,
  full_name text,
  role text,
  last_seen timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select o.name,
         split_part(au.email, '@', 1),
         p.full_name,
         p.role,
         pr.last_seen
  from public.presence pr
  join public.profiles p on p.id = pr.user_id
  join public.organizations o on o.id = pr.org_id
  join auth.users au on au.id = pr.user_id
  where pr.last_seen >= now() - interval '110 seconds'
    and exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by o.name, p.role
  limit 200;
$$;

grant execute on function public.mizan_presence_heartbeat() to authenticated;
grant execute on function public.mizan_presence_online() to authenticated;