-- ترقية 3: تأكيد إيميل تلقائي (دخول مباشر من غير رسالة تأكيد)
-- أي مستخدم جديد يتأكد فورًا في نفس لحظة التسجيل، فيقدر يسجل الدخول ويبدأ فورًا.

create or replace function public.mizan_autoconfirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  new.raw_app_meta_data := jsonb_set(
    coalesce(new.raw_app_meta_data, '{}'::jsonb),
    '{email_confirmed}',
    'true'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  before insert on auth.users
  for each row execute function public.mizan_autoconfirm();