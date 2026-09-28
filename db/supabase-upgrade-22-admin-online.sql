-- ============================================================
-- ترحيل ٢٢: mizan_admin_orgs يضيف عمود online
-- (شركة متصلة الآن؟ = لها نبضة حضور خلال آخر 110 ثوانٍ،
--  نفس نافذة «متصلون الآن» في mizan_presence_online)
-- الواجهة تستخدمه عشان: المتصلة تتشال من قائمة «آخر اتصال»
-- ويظهر وقت الانقطاع الفعلي لكل شركة على حدة.
-- ============================================================

drop function if exists public.mizan_admin_orgs();
create or replace function public.mizan_admin_orgs()
returns table (
  org_id uuid, org_name text, plan_start date, plan_end date, plan_status text,
  locked boolean, owner_name text, members bigint, owner_id uuid, protected boolean,
  max_members int, org_phone text, admin_username text, last_seen timestamptz,
  online boolean
)
language sql stable security definer set search_path = public, auth
as $$
  select o.id, o.name, o.plan_start, o.plan_end, o.plan_status, o.locked,
         (select p.full_name from public.profiles p where p.org_id = o.id and p.role = 'admin' limit 1),
         (select count(*) from public.profiles p where p.org_id = o.id),
         o.owner_id,
         (o.id = (select p.org_id from public.profiles p where p.id = auth.uid())
           or exists (select 1 from public.profiles p where p.org_id = o.id and p.is_superadmin is true)),
         o.max_members,
         o.phone,
         (select split_part(au.email, '@', 1)
            from public.profiles p join auth.users au on au.id = p.id
           where p.org_id = o.id and p.role = 'admin' limit 1),
         (select max(pr.last_seen) from public.presence pr where pr.org_id = o.id),
         exists (select 1 from public.presence pr
                  where pr.org_id = o.id and pr.last_seen >= now() - interval '110 seconds')
  from public.organizations o
  where exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by o.created_at desc;
$$;

grant execute on function public.mizan_admin_orgs() to authenticated;
revoke all on function public.mizan_admin_orgs() from anon;
