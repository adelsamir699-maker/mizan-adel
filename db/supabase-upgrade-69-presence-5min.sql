-- trqyh 69 — "متصل الآن" 5 دقائق بدل 110 ثانية
-- أمر المالك 23/10: «توسيع نافذة متصل خليها 5 دقائق»
-- يعيد تعريف دالتَي العرض فقط — صفر مساس بجدول presence أو بالبيانات.
-- لا begin/commit داخل الملف (المشغّل هو اللي بيفتح المعاملة).
-- ✅ اتنفذت على السحابة ٢٥/١٠ (مع ترقية ٧٠ في نفس أمر المالك «كل ما سبق») — القياس الحيّ
--    بعدها: الدالتان فيهم interval '5 minutes' وصفر «110 seconds». ملفها بقى داخل نسخة النشر
--    (DEPLOY_DB_FILES) في بناء 246 لأن قاعدة سيرفر جديد لازم تبقى زي الحيّة.
--    إعادة تشغيلها آمنة (create or replace + فحص إيجابي)، وبرضه مش مطلوبة.

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
  where pr.last_seen >= now() - interval '5 minutes'
    and exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true)
  order by o.name, p.role
  limit 200;
$$;

revoke all on function public.mizan_presence_online() from public;
revoke all on function public.mizan_presence_online() from anon;
grant execute on function public.mizan_presence_online() to authenticated;

create or replace function public.mizan_admin_orgs()
 returns table(org_id uuid, org_name text, plan_start date, plan_end date, plan_status text, locked boolean, owner_name text, members bigint, owner_id uuid, protected boolean, max_members integer, org_phone text, admin_username text, last_seen timestamp with time zone, online boolean, plan text, sub_price numeric)
 language sql
 stable security definer
 set search_path to 'public', 'auth'
as $function$
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
                  where pr.org_id = o.id and pr.last_seen >= now() - interval '5 minutes'),
         o.plan, o.sub_price
  from public.organizations o
  where exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_superadmin is true)
  order by o.created_at desc;
$function$;

revoke all on function public.mizan_admin_orgs() from public;
revoke all on function public.mizan_admin_orgs() from anon;
grant execute on function public.mizan_admin_orgs() to authenticated;

do $$
declare
  v_online text := pg_get_functiondef('public.mizan_presence_online()'::regprocedure);
  v_orgs   text := pg_get_functiondef('public.mizan_admin_orgs()'::regprocedure);
begin
  if position('interval ''5 minutes''' in v_online) = 0 then
    raise exception 'ترقية ٦٩ فشلت: mizan_presence_online لسه مش 5 دقائق';
  end if;
  if position('110 seconds' in v_online) > 0 then
    raise exception 'ترقية ٦٩ فشلت: mizan_presence_online لسه فيها 110 ثانية';
  end if;
  if position('interval ''5 minutes''' in v_orgs) = 0 then
    raise exception 'ترقية ٦٩ فشلت: mizan_admin_orgs لسه مش 5 دقائق';
  end if;
  if position('110 seconds' in v_orgs) > 0 then
    raise exception 'ترقية ٦٩ فشلت: mizan_admin_orgs لسه فيها 110 ثانية';
  end if;
  if not has_function_privilege('authenticated', 'public.mizan_presence_online()', 'EXECUTE') then
    raise exception 'ترقية ٦٩ فشلت: authenticated ممنوع من mizan_presence_online';
  end if;
  if not has_function_privilege('authenticated', 'public.mizan_admin_orgs()', 'EXECUTE') then
    raise exception 'ترقية ٦٩ فشلت: authenticated ممنوع من mizan_admin_orgs';
  end if;
  if has_function_privilege('anon', 'public.mizan_presence_online()', 'EXECUTE') then
    raise exception 'ترقية ٦٩ فشلت: anon لسه بيقدر ينفّذ mizan_presence_online';
  end if;
  if has_function_privilege('anon', 'public.mizan_admin_orgs()', 'EXECUTE') then
    raise exception 'ترقية ٦٩ فشلت: anon لسه بيقدر ينفّذ mizan_admin_orgs';
  end if;
end $$;
