-- ============================================================
-- ترحيل ٢٣: النسخة الاحتياطية الشاملة القابلة للتشغيل
--  )1( mizan_admin_backup_full(): يُلقي كل جداول public +
--      حسابات الدخول (auth.users/identities) في jsonb واحد.
--      للمالك (سوبر أدمن) فقط.
--  )2( mizan_admin_restore_full(p_payload): يرجّع قاعدة البيانات
--      لحالة الملف: يُفرّغ كل الجداول، يزرع auth.users أولًا ثم
--      organizations ثم profiles ثم الباقي. العملية كلها في
--      transaction واحدة — أي خطأ يُلغي كل شيء (ولا يمسح حاجة).
--      للمالك فقط. تُستخدم من زر «استعادة نسخة كاملة» في شاشة المالك.
--      تكيّفية مع أي إصدار Supabase: تتجاهل الأعمدة المُولَّدة
--      (generated) وتعيد تسمية عمود الهوية لو اختلف بين الإصدارات.
-- ملاحظة أمان: encrypted_password مشفرة bcrypt — نفس اليوزرات
--   ترجع بنفس كلمات مرورها. الملف الحساس ده ما يتشارش مع أحد.
-- ============================================================

drop function if exists public.mizan_admin_backup_full();
create or replace function public.mizan_admin_backup_full()
returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  t text;
  rows jsonb;
  out jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_superadmin is true) then
    raise exception 'مسموح للمالك فقط';
  end if;

  out := jsonb_set(out, '{_meta}',
        jsonb_build_object('at', now()::text, 'app', 'mizan', 'source', 'mizan_admin_backup_full'));

  -- حسابات الدخول (كل الأعمدة؛ تشمل encrypted_password)
  select coalesce(jsonb_agg(to_json(u) order by u.created_at), '[]'::jsonb) into rows from auth.users u;
  out := jsonb_set(out, '{_auth_users}', rows);
  select coalesce(jsonb_agg(to_json(i)), '[]'::jsonb) into rows from auth.identities i;
  out := jsonb_set(out, '{_auth_identities}', rows);

  foreach t in array array[
    'organizations','profiles',
    'accounts','audit_logs','categories','customer_txs','customers',
    'journal_entries','journal_lines','mizan_created_accounts','mizan_invoice_seq',
    'mizan_pw_store','owners','password_changes','presence','products',
    'purchase_items','purchases','sale_items','sales','supplier_txs','suppliers',
    'treasury','units','vouchers','warehouses'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_json(x)), ''[]''::jsonb) from public.%I x', t
    ) into rows;
    out := jsonb_set(out, array[t], rows);
  end loop;

  return out;
end $$;

-- إدراج سطر JSON في جدول: يدرج فقط المفاتيح الموجودة فعليًا في الهدف
-- ويتخطى الأعمدة المُولَّدة (generated) — يعمل على أي إصدار Supabase.
-- دالة داخلية: لا تُمنح لأدوار PostgREST إطلاقًا (لا anon ولا authenticated)
-- — تُستدعى فقط من داخل mizan_admin_restore_full (maliki بحراسة سوبر أدمن).
create or replace function public.mizan_adaptive_insert(p_schema text, p_table text, p_row jsonb)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  cols text;
begin
  select string_agg(format('%I', k), ', ') into cols
  from jsonb_object_keys(p_row) as k
  where exists (
    select 1 from pg_attribute a
    where a.attrelid = format('%I.%I', p_schema, p_table)::regclass
      and a.attname = k and a.attgenerated = '' and not a.attisdropped
  );
  if cols is null then
    raise exception 'لا أعمدة صالحة للإدراج في %', format('%I.%I', p_schema, p_table);
  end if;
  execute format(
    'insert into %I.%I (%s) select %s from jsonb_populate_record(null::%I.%I, $1::jsonb)',
    p_schema, p_table, cols, cols, p_schema, p_table
  ) using p_row;
end $$;

drop function if exists public.mizan_admin_restore_full(jsonb);
create or replace function public.mizan_admin_restore_full(p_payload jsonb)
returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  t text;
  r jsonb;
  uidcol text;
  n bigint := 0;
  tables text[] := array[
    'accounts','audit_logs','categories','customer_txs','customers',
    'journal_entries','journal_lines','mizan_created_accounts','mizan_invoice_seq',
    'mizan_pw_store','owners','password_changes','presence','products',
    'purchase_items','purchases','sale_items','sales','supplier_txs','suppliers',
    'treasury','units','vouchers','warehouses'
  ];
begin
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.is_superadmin is true) then
    raise exception 'مسموح للمالك فقط';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'ملف النسخة غير صالح';
  end if;
  if not (p_payload ? 'organizations') or jsonb_typeof(p_payload->'organizations') <> 'array' then
    raise exception 'الملف ما فيهوش قائمة organizations — مش نسخة ميزان كاملة';
  end if;

  -- 1) تفريغ كل الجداول العامة دفعة واحدة (TRUNCATE يتخطى ترتيب الـ FK)
  execute format('truncate table %s',
    (select string_agg(format('public.%I', x), ', ')
       from unnest(array['organizations','profiles'] || tables) x));

  -- 2) حسابات الدخول: تحديث الموجود (نفس الـ id) وإدراج الجديد
  if p_payload ? '_auth_users' and jsonb_typeof(p_payload->'_auth_users') = 'array' then
    for r in select jsonb_array_elements(p_payload->'_auth_users') loop
      if exists (select 1 from auth.users au where au.id = (r->>'id')::uuid) then
        update auth.users
           set email               = coalesce(r->>'email', email),
               encrypted_password  = coalesce(r->>'encrypted_password', encrypted_password),
               raw_user_meta_data  = coalesce(r->'raw_user_meta_data', raw_user_meta_data),
               aud                 = coalesce(r->>'aud', aud),
               role                = coalesce(r->>'role', role),
               banned_until        = (r->>'banned_until')::timestamptz
         where id = (r->>'id')::uuid;
      else
        perform public.mizan_adaptive_insert('auth', 'users', r);
      end if;
      n := n + 1;
    end loop;
  end if;

  -- 3) الهويات: حذف القديمة لكل مستخدم في الملف ثم زرعها (تكيّف مع اسم العمود)
  select case when exists (
      select 1 from information_schema.columns
      where table_schema='auth' and table_name='identities' and column_name='auth_user_id'
    ) then 'auth_user_id' else 'user_id' end into uidcol;

  if p_payload ? '_auth_identities' and jsonb_typeof(p_payload->'_auth_identities') = 'array' then
    execute format(
      'delete from auth.identities where %I in (
         select (v->>''id'')::uuid from jsonb_array_elements(coalesce($1->''_auth_users'',''[]''::jsonb)) v)',
      uidcol) using p_payload;
    for r in select jsonb_array_elements(p_payload->'_auth_identities') loop
      if uidcol = 'auth_user_id' and r ? 'user_id' then
        r := (jsonb_set(r, '{auth_user_id}', r->'user_id')) - 'user_id';
      elsif uidcol = 'user_id' and r ? 'auth_user_id' then
        r := (jsonb_set(r, '{user_id}', r->'auth_user_id')) - 'auth_user_id';
      end if;
      perform public.mizan_adaptive_insert('auth', 'identities', r);
    end loop;
  end if;

  -- 4) الشركات ثم الملفات (FKs على الاتنين)
  for r in select jsonb_array_elements(p_payload->'organizations') loop
    insert into public.organizations select * from jsonb_populate_record(null::public.organizations, r);
  end loop;
  if p_payload ? 'profiles' and jsonb_typeof(p_payload->'profiles') = 'array' then
    for r in select jsonb_array_elements(p_payload->'profiles') loop
      insert into public.profiles select * from jsonb_populate_record(null::public.profiles, r);
    end loop;
  end if;

  -- 5) باقي الجداول
  foreach t in array tables loop
    if p_payload ? t and jsonb_typeof(p_payload->t) = 'array' then
      for r in select jsonb_array_elements(p_payload->t) loop
        execute format(
          'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1::jsonb)', t, t
        ) using r;
      end loop;
    end if;
  end loop;

  return format('تمت الاستعادة: %s حساب دخول، %s شركة',
    n, jsonb_array_length(p_payload->'organizations'));
end $$;

grant execute on function public.mizan_admin_backup_full() to authenticated;
revoke all on function public.mizan_admin_backup_full() from anon;
-- الدالة الداخلية: للمالك (postgres) فقط — ممنوعة من كل أدوار الواجهة
revoke all on function public.mizan_adaptive_insert(text, text, jsonb) from public;
revoke all on function public.mizan_adaptive_insert(text, text, jsonb) from anon;
revoke all on function public.mizan_adaptive_insert(text, text, jsonb) from authenticated;
grant execute on function public.mizan_admin_restore_full(jsonb) to authenticated;
revoke all on function public.mizan_admin_restore_full(jsonb) from anon;
