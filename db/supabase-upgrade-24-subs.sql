-- supabase-upgrade-24-subs.sql — ترحيل build 103: الاشتراكات (idempotent)
-- 1) سعر يدوي لكل شركة  2) خطة محفوظة لكل شركة  3) أسعار الباقات قابلة للتعديل

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS sub_price numeric;

-- مزامنة الدالة مع build 102 (كانت 15 عمود) + عمودان جدد في الآخر: plan, sub_price
-- (DROP قبل CREATE لأن نوع الإرجاع لا يمكن تعديله بـ OR REPLACE)
DROP FUNCTION IF EXISTS public.mizan_admin_orgs();
CREATE OR REPLACE FUNCTION public.mizan_admin_orgs()
 RETURNS TABLE(org_id uuid, org_name text, plan_start date, plan_end date, plan_status text, locked boolean, owner_name text, members bigint, owner_id uuid, protected boolean, max_members integer, org_phone text, admin_username text, last_seen timestamp with time zone, online boolean, plan text, sub_price numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
                  where pr.org_id = o.id and pr.last_seen >= now() - interval '110 seconds'),
         o.plan, o.sub_price
  from public.organizations o
  where exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_superadmin is true)
  order by o.created_at desc;
$function$;

-- حفظ اشتراك شركة: الخطة + التواريخ + السعر اليدوي + فك القفل (للمالك فقط)
CREATE OR REPLACE FUNCTION public.mizan_admin_set_sub(
  p_org_id uuid, p_plan_start date, p_plan_end date, p_plan text, p_price numeric, p_unlock boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  update public.organizations set
    plan_start = coalesce(p_plan_start, plan_start),
    plan_end   = coalesce(p_plan_end, plan_end),
    plan       = coalesce(p_plan, plan),
    sub_price  = coalesce(p_price, sub_price),
    plan_status = case when coalesce(p_plan_end, plan_end) is null then 'active'
                       when coalesce(p_plan_end, plan_end) < current_date then 'expired'
                       else 'active' end,
    locked     = case when p_unlock is true then false else locked end
  where id = p_org_id;
end $function$;

-- جدول إعداد واحد لتسعير الباقات الافتراضي القابل للتعديل
CREATE TABLE IF NOT EXISTS public.subs_plans_cfg (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  plans jsonb NOT NULL
);

INSERT INTO public.subs_plans_cfg (id, plans)
 VALUES (1, '{"m":{"price":200},"h":{"price":1000},"y":{"price":1800},"f":{"price":0}}'::jsonb)
 ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mizan_get_subs_plans()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select plans from public.subs_plans_cfg where id = 1;
$function$;

CREATE OR REPLACE FUNCTION public.mizan_set_subs_plans(p_plans jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.subs_plans_cfg set plans = p_plans where id = 1;
$function$;

GRANT EXECUTE ON FUNCTION public.mizan_admin_orgs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_admin_set_sub(uuid, date, date, text, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_get_subs_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_set_subs_plans(jsonb) TO authenticated;
