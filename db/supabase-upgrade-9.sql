-- ==============================================================
-- ترقية 9: حماية المالك من حظر نفسه
-- زرار الحظر اختُفي من الواجهة، بالإضافة إلى حماية في مستوى
-- قاعدة البيانات: ممنوع حظر أي حساب is_superadmin
-- ==============================================================

drop function if exists public.mizan_admin_set_user(uuid, boolean);
create or replace function public.mizan_admin_set_user(p_user_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super boolean;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  select is_superadmin into v_super from public.profiles where id = p_user_id;
  if v_super then
    raise exception 'لا يمكن حظر حساب المالك';
  end if;
  update public.profiles set blocked = coalesce(p_blocked, blocked) where id = p_user_id;
end $$;

grant execute on function public.mizan_admin_set_user(uuid, boolean) to authenticated;