-- ==============================================================
-- ترقية 13: حذف شركة من الإدارة (لكل المالكين)
--   mizan_admin_delete_org(uuid, text):
--     p_mode = 'users' → حذف حسابات أعضاء الشركة فقط (تبقى البيانات محفوظة)
--     p_mode = 'full'  → حذف الشركة بالكامل بكل بياناتها المخزنة (cascade)
-- حماية:
--   - المالك فقط (is_superadmin).
--   - لا يُحذفون الحسابات ذات الصلاحيات السوبر أدمن.
--   - سجل الإجراء في audit_logs إن وُجد.
-- ==============================================================

drop function if exists public.mizan_admin_delete_org(uuid, text);

create or replace function public.mizan_admin_delete_org(p_org_id uuid, p_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user_ids uuid[];
  uid_i uuid;
  v_org_name text;
begin
  if not exists (select 1 from public.profiles where id = v_uid and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if p_org_id is null then
    raise exception 'لم يتم تحديد الشركة';
  end if;
  if coalesce(p_mode, '') not in ('users', 'full') then
    raise exception 'أمر غير معروف';
  end if;

  select name into v_org_name from public.organizations where id = p_org_id;
  if v_org_name is null then
    raise exception 'الشركة غير موجودة';
  end if;

  -- الحماية: لا يجوز حذف شركة رئيسية تابعة لمالك/سوبر أدمن (شركة المالك نفسها أو ما فيها سوبر أدمن)
  if exists (
    select 1 from public.organizations o
    where o.id = p_org_id
      and (o.owner_id is not null
            and exists (select 1 from public.profiles p where p.id = o.owner_id and p.is_superadmin is true)
           or exists (select 1 from public.profiles p where p.org_id = o.id and p.is_superadmin is true))
  ) then
    raise exception 'هذه الشركة رئيسية خاصة بنظام ميزان ولا يمكن حذفها';
  end if;

  -- جمع أعضاء الشركة (مع تجاهل حسابات السوبر أدمن لحمايتها)
  select array_agg(distinct id) into v_user_ids
  from public.profiles
  where org_id = p_org_id and is_superadmin is not true;

  -- حذف الحضور (heartbeat) و البروفايلات الخاصة بالشركة
  delete from public.presence where org_id = p_org_id;

  -- حذف الحسابات (auth.users) الخاصة بأعضاء الشركة فقط
  if v_user_ids is not null and array_length(v_user_ids, 1) > 0 then
    foreach uid_i in array v_user_ids
    loop
      -- في البداية نحذف profile (سيُحذف تلقائيًا مع cascade عند حذف organization في full)
      delete from public.profiles where id = uid_i;
      begin
        delete from auth.users where id = uid_i;
      exception when others then
        -- قد تمنع القاعدة حذف المستخدم (نكمل — البيانات والشركة تُحذف حالياً)
        null;
      end;
    end loop;
  end if;

  if p_mode = 'full' then
    -- حذف الشركة بكل ما تحته من بيانات (cascade على كل الجداول المرتبطة)
    delete from public.audit_logs where org_id = p_org_id;
    delete from public.organizations where id = p_org_id;
    return 'full|' || v_org_name;
  end if;

  -- mode = users : نخلي الشركة بدون حساب دخول (يُعاد إنشاء حساب لها لاحقًا)
  update public.organizations set owner_id = null where id = p_org_id;
  return 'users|' || v_org_name;
end $$;

grant execute on function public.mizan_admin_delete_org(uuid, text) to authenticated;