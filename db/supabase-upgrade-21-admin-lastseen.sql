-- ============================================================
-- ترحيل ٢١: لوحة الإدارة — آخر اتصال + حماية حساب المالك
-- (طُبِّق على Supabase — لا يمسح أي بيانات)
-- 1) mizan_presence_heartbeat: الكفّ عن حذف الصفوف القديمة،
--    عشان جدول presence يحتفظ بـ«آخر اتصال» لكل مستخدم.
--    (كشف «متصل الآن» بيظل يعتمد على شرط الزمن في mizan_presence_online)
-- 2) mizan_admin_orgs: أعمدة إضافية (هاتف/يوزر الشركة/أقصى أعضاء)
--    + last_seen = آخر اتصال مسجل لأي عضو في الشركة.
-- 3) mizan_admin_members: علود is_superadmin عشان الواجهة
--    ما تعرضش زرار الحذف قدام حساب المالك.
-- ============================================================

-- 1) النبضة: من غير تنظيف تاريخي
drop function if exists public.mizan_presence_heartbeat();
create or replace function public.mizan_presence_heartbeat()
returns void language plpgsql security definer set search_path = public, auth
as $$
declare v_org public.organizations.id%type;
begin
  select org_id into v_org from public.profiles where id = auth.uid() and blocked = false;
  if v_org is null then return; end if;
  insert into public.presence (user_id, org_id, last_seen)
  values (auth.uid(), v_org, now())
  on conflict (user_id) do update set org_id = excluded.org_id, last_seen = now();
  -- لا حذف للصفوف القديمة: presence صار سجل «آخر اتصال» لكل مستخدم
end $$;

-- 2) قائمة الشركات للمالك + آخر اتصال
drop function if exists public.mizan_admin_orgs();
create or replace function public.mizan_admin_orgs()
returns table (
  org_id uuid, org_name text, plan_start date, plan_end date, plan_status text,
  locked boolean, owner_name text, members bigint, owner_id uuid, protected boolean,
  max_members int, org_phone text, admin_username text, last_seen timestamptz
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
         (select max(pr.last_seen) from public.presence pr where pr.org_id = o.id)
  from public.organizations o
  where exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by o.created_at desc;
$$;

-- 3) أعضاء الشركة مع علم السوبر أدمن
drop function if exists public.mizan_admin_members(uuid);
create or replace function public.mizan_admin_members(p_org_id uuid)
returns table (
  user_id uuid, username text, full_name text, role text, blocked boolean,
  features jsonb, created_at timestamptz, is_superadmin boolean
)
language sql stable security definer set search_path = public, auth
as $$
  select p.id,
         split_part(au.email, '@', 1),
         p.full_name,
         p.role,
         p.blocked,
         coalesce(p.features, '{}'::jsonb),
         p.created_at,
         coalesce(p.is_superadmin, false)
  from public.profiles p
  join auth.users au on au.id = p.id
  where p.org_id = p_org_id
    and exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by p.created_at;
$$;

grant execute on function public.mizan_presence_heartbeat() to authenticated;
grant execute on function public.mizan_admin_orgs() to authenticated;
grant execute on function public.mizan_admin_members(uuid) to authenticated;
revoke all on function public.mizan_presence_heartbeat() from anon;
revoke all on function public.mizan_admin_orgs() from anon;
revoke all on function public.mizan_admin_members(uuid) from anon;
