-- تراجع ترقية ٥٩ — لا يُنفّذ إلا بأمر صريح وبعد نسخة احتياطية جديدة.
-- يعيد سياسة prof_update كما كانت قبل الترقية؛ بيانات profiles لا تتغير.

begin;

drop policy if exists prof_update on public.profiles;
create policy prof_update on public.profiles
  for update using (org_id = public.current_org());

drop trigger if exists profiles_protect_security_fields on public.profiles;
drop function if exists public.can_manage_org_profiles();
drop function if exists public.protect_profile_security_fields();

commit;
