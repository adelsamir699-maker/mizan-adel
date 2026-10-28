-- ترقية ٧٢ — منع فتح نفس الحساب على أكتر من جهاز في نفس الوقت (بناء 263).
--
-- القاعدة (طلب المالك الحرفي):
--   «الحساب المفتوح على جهاز مينفعش جهاز تاني يدخل ويفتح نفس الحساب… الأولوية للجهاز اللي
--    شغّال، ولو جهاز تاني حاول يدخل بنفس اليوزر/الباسورد تظهر له رسالة
--    (هذا الحساب مفتوح على جهاز اخر الان)… الغرض فقط عدم فتح الحساب في نفس الوقت على أكتر من جهاز.»
--
-- التنفيذ:
--   • جدول `mizan_sessions`: صف واحد لكل اسم مستخدم = الجهاز اللي ماسك الحساب دلوقتي.
--   • `mizan_session_claim`  : دخول — لو الجهاز هو نفسه صاحب الجلسة يجدّد، ولو جهاز تاني
--                              والجلسة لسه حيّة (آخر نبضة < ١٢٠ ثانية) يرجّع busy = true.
--   • `mizan_session_beat`   : نبضة كل ٤٥ ثانية من الجهاز الماسك. لو جهاز تاني خد الحساب
--                              يرجّع lost = true ⇒ الجهاز القديم يخرج ويقول للمستخدم.
--   • `mizan_session_release`: خروج صريح ⇒ الحساب يتحرّر فورًا.
--   • الجلسة اللي بلا نبضة ١٢٠ ثانية (تطبيق اتقفل/الجهاز فصل/الشبكة قطعت) بتبقى **حرّة**
--     ⇒ صاحبها يقدر يدخل من أي جهاز، وما يقعدش مقفول للأبد.
--   • الجدول مقفول تمامًا: RLS بلا أي سياسة + سحب كل الصلاحيات من anon/authenticated
--     ⇒ الوصول من خلال الدوال الأمنة (security definer) بس.
--
-- لا تُشغّل قبل موافقة المالك الصريحة.

create table if not exists public.mizan_sessions (
  username   text primary key,
  device_id  text not null,
  session_id text not null default '',
  last_seen  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.mizan_sessions enable row level security;
revoke all on public.mizan_sessions from anon;
revoke all on public.mizan_sessions from authenticated;
revoke all on public.mizan_sessions from public;

comment on table public.mizan_sessions is
  'جلسة واحدة لكل حساب — الجهاز الماسك الحساب دلوقتي (بناء 263). RLS بلا سياسة: الدوال الأمنة بس.';

-- مدة صلاحية الجلسة بدون نبضة (ثوانٍ). أقل من كده = الحساب محجوز، أكتر = حرّ.
create or replace function public.mizan_session_ttl()
returns integer
language sql
immutable
as $$ select 120 $$;

create or replace function public.mizan_session_claim(p_user text, p_device text, p_session text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key  text := lower(btrim(coalesce(p_user, '')));
  v_dev  text := btrim(coalesce(p_device, ''));
  v_sid  text := coalesce(p_session, '');
  v_row  public.mizan_sessions%rowtype;
  v_ttl  integer := public.mizan_session_ttl();
begin
  if v_key = '' or v_dev = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;

  insert into public.mizan_sessions(username, device_id, session_id, last_seen)
  values (v_key, v_dev, v_sid, now())
  on conflict (username) do nothing;

  select * into v_row from public.mizan_sessions where username = v_key for update;

  -- نفس الجهاز ⇒ تجديد عادي (تحديث الصفحة/إعادة الفتح ما تقفلش على صاحبها)
  if v_row.device_id = v_dev then
    update public.mizan_sessions
       set session_id = v_sid, last_seen = now()
     where username = v_key;
    return jsonb_build_object('ok', true, 'busy', false, 'same_device', true);
  end if;

  -- جهاز تاني والجلسة لسه حيّة ⇒ ممنوع
  if v_row.last_seen > now() - make_interval(secs => v_ttl) then
    return jsonb_build_object('ok', false, 'busy', true,
                              'last_seen', to_char(v_row.last_seen, 'YYYY-MM-DD"T"HH24:MI:SSOF'));
  end if;

  -- الجلسة القديمة سقطت (مفيش نبضة) ⇒ الجهاز الجديد ياخدها
  update public.mizan_sessions
     set device_id = v_dev, session_id = v_sid, last_seen = now()
   where username = v_key;
  return jsonb_build_object('ok', true, 'busy', false, 'took_over', true);
end;
$$;

create or replace function public.mizan_session_beat(p_user text, p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := lower(btrim(coalesce(p_user, '')));
  v_dev text := btrim(coalesce(p_device, ''));
begin
  if v_key = '' or v_dev = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  update public.mizan_sessions
     set last_seen = now()
   where username = v_key and device_id = v_dev;
  if not found then
    -- الحساب بقى على جهاز تاني (أو اتحرّر) ⇒ الجهاز ده يخرج
    return jsonb_build_object('ok', false, 'lost', true);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.mizan_session_release(p_user text, p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := lower(btrim(coalesce(p_user, '')));
  v_dev text := btrim(coalesce(p_device, ''));
begin
  if v_key = '' or v_dev = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  delete from public.mizan_sessions where username = v_key and device_id = v_dev;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mizan_session_claim(text, text, text) from public, anon;
revoke all on function public.mizan_session_beat(text, text) from public, anon;
revoke all on function public.mizan_session_release(text, text) from public, anon;
grant execute on function public.mizan_session_claim(text, text, text) to authenticated;
grant execute on function public.mizan_session_beat(text, text) to authenticated;
grant execute on function public.mizan_session_release(text, text) to authenticated;

notify pgrst, 'reload schema';
