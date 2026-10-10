-- =====================================================================================
-- ترقية ٥٢ — ضريبة القيمة المضافة: نسبتان ومفتاحان مستقلان (مبيعات / مشتريات)
-- =====================================================================================
-- 🟢 **نُفّذت على السحابة 10/10 ≈20:39** بأمر المالك الحرفي («نفذ … على السحابه») — معاملة واحدة
--    + باك أب قبل/بعد (`pre/post-mig52-20261010-2039`). ممنوع إعادة تشغيلها كما هي (بوابات «قبل»
--    بقت فشلًا متعمّدًا)، والملف هنا للسجل. أداة التنفيذ: MIZAN_ORDER_52=نفّذ node D:/_work/temp/apply_upgrade_52.js
--
-- قرار المالك (بالحرف):
--   «اعمل ضريبة المشتريات بنفس مبدأ ضريبة المبيعات إنها ممكن تكون غير نشطة عند بعض الشركات
--    أو نسبتها تتغير، ولو غير نشطة مش هيظهر العمود الخاص بها في فاتورة المشتريات»
--   + إعادة تسمية 2.1.2 إلى «ضريبة القيمة المضافة المحصلة» + إضافة 2.1.3 «ضريبة القيمة المضافة
--     المدفوعة» + الاسم الموحّد «ضريبة القيمة المضافة» على الفاتورتين + بلا تثبيت 14% في الكود.
--
-- اللي بتعمله (بيانات + عمودان + ثلاث دوال تغيير):
--   (٠) organizations: عمودان جديدان
--        · tax_rate_buy      numeric not null default 0    ← نسبة ضريبة المشتريات
--        · tax_buy_enabled   boolean not null default false ← مفتاح تشغيل ضريبة المشتريات
--      + backfill آمن: أي شركة ضريبتها (مبيعات) نشطة تترّث المشتريات بنفس النسبة والمفتاح
--        (ميزان: tax_enabled=true, tax_rate=14 ⇒ تصبح tax_buy_enabled=true, tax_rate_buy=14).
--   (١) كل حساب كوده 2.1.2 يتغيّر اسمه إلى «ضريبة القيمة المضافة المحصلة» (اسم فقط، الأرصدة لا تُمسّ).
--   (٢) كل شركة عندها 2.1.2 وما عندهاش 2.1.3 ⇒ ينزل لها حساب
--        «ضريبة القيمة المضافة المدفوعة» بنوع liability و parent_id = parent_id الشقيقة 2.1.2
--        و local_id = أقصى رقم في الشركة + 1 ورصيد صفر (ميزان: parent 2.1=11/ local 27 · القاهرة: NULL/22).
--   (٣) create_org_and_profile و mizan_admin_create_org: البذرة المنقّطة تضم 2.1.2 باسمه الجديد
--        + سطر 2.1.3 (أي شركة جديدة تنزل بالحسابين).
--   (٤) mizan_client_sett_save و mizan_admin_sett_save: تحفظان tax_rate_buy و tax_buy_enabled.
--   (٥) mizan_admin_restore_one: تستعيد العمودين (نسخ قديمة بلا المفتاح = افتراضي 0/false = آمن).
--
-- اللي **مابيتلمسش**: المبالغ/الأنواع/الآباء/الأرصدة/عدد أسطر أي جدول ثاني · السياسات/المنح ·
--   ميزان تُلمس فقط بالعمودين الجديدين + اسم 2.1.2 + سطر 2.1.3 (إضافة قياسية بلا مساس بالأرصدة).
--
-- البوابات (أي فشل = استثناء = ROLLBACK كامل):
--   · قبل: 2.1.3 لازم تكون غير موجودة في أي شركة، وكل شركة عندها 2.1.2 مرّة واحدة بالضبط.
--   · بعد: كل شركة عندها 2.1.2 (اسمه الجديد) و2.1.3 مرّة واحدة لكل منهما.
-- =====================================================================================

-- (٠) العمودان الجديدان
alter table public.organizations
  add column if not exists tax_rate_buy numeric not null default 0;
alter table public.organizations
  add column if not exists tax_buy_enabled boolean not null default false;

-- backfill آمن: الشركات النشطة (مبيعات) تترّث المشتريات بنفس النسبة والمفتاح — بلا مساس بمن ضبط غيره
update public.organizations
   set tax_rate_buy = tax_rate,
       tax_buy_enabled = true
 where tax_enabled is true
   and coalesce(tax_rate, 0) > 0
   and coalesce(tax_rate_buy, 0) = 0;

-- =====================================================================================
-- (بوابة قبل) المشهد المتوقع: 2.1.2 موجودة مرّة واحدة بكل شركة، و2.1.3 غير موجودة بعد
-- =====================================================================================
do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
    from public.accounts a
   where a.code = '2.1.3';
  if v_bad > 0 then
    raise exception 'ترقية ٥٢: فيه % حساب كوده 2.1.3 بالفعل — يبدو أنها نُفّذت قبل كده', v_bad;
  end if;

  select count(*) into v_bad
    from (
      select a.org_id from public.accounts a where a.code = '2.1.2' group by a.org_id
      having count(*) <> 1
    ) t;
  if v_bad > 0 then
    raise exception 'ترقية ٥٢: فيه % شركة عدد حسابات 2.1.2 فيها مش واحد بالضبط', v_bad;
  end if;
end $$;

-- =====================================================================================
-- (١) إعادة تسمية 2.1.2 (اسم فقط) + (٢) إدراج 2.1.3 الناقص لكل شركة
-- =====================================================================================
update public.accounts
   set name_ar = 'ضريبة القيمة المضافة المحصلة'
 where code = '2.1.2';

insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active)
select
  sib.org_id,
  (select coalesce(max(a2.local_id), 0) + 1 from public.accounts a2 where a2.org_id = sib.org_id),
  '2.1.3',
  'ضريبة القيمة المضافة المدفوعة',
  'liability',
  sib.parent_id,
  0, 0, true
from public.accounts sib
where sib.code = '2.1.2'
  and not exists (select 1 from public.accounts x where x.org_id = sib.org_id and x.code = '2.1.3');

-- =====================================================================================
-- (بوابة بعد)
-- =====================================================================================
do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
    from (
      select a.org_id from public.accounts a where a.code = '2.1.2' group by a.org_id
      having count(*) <> 1
    ) t;
  if v_bad > 0 then
    raise exception 'ترقية ٥٢/بعد: عدد حسابات 2.1.2 مش واحد لكل شركة';
  end if;

  select count(*) into v_bad
    from (
      select a.org_id from public.accounts a where a.code = '2.1.3' group by a.org_id
      having count(*) <> 1
    ) t;
  if v_bad > 0 then
    raise exception 'ترقية ٥٢/بعد: فيه شركة عدد حسابات 2.1.3 فيها مش واحد بالضبط';
  end if;

  if exists (select 1 from public.accounts where code = '2.1.2' and name_ar <> 'ضريبة القيمة المضافة المحصلة') then
    raise exception 'ترقية ٥٢: فيه حساب 2.1.2 لسه باسمه القديم';
  end if;
end $$;

-- =====================================================================================
-- (٣) البذرة المنقّطة لبوابة الدعوة — 2.1.2 بالاسم الجديد + سطر 2.1.3 جديد
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.create_org_and_profile(p_org_name text, p_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'لا توجد جلسة دخول. أعد تسجيل الدخول ثم أعد المحاولة.';
  end if;

  if not public.mizan_invite_manager() then
    raise exception 'الانضمام لبرنامج ميزان بيتم برمز دعوة من إدارة البرنامج. مافيش إنشاء شركة من داخل البرنامج.';
  end if;

  insert into public.organizations (name, plan, plan_status, plan_start, owner_id, invite_code)
  values (
    coalesce(nullif(trim(p_org_name), ''), 'شركة'),
    'free',
    'active',
    current_date,
    v_uid,
    upper(substr(md5(random()::text), 1, 8))
  )
  returning id into v_org;

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org, coalesce(nullif(p_name,''), split_part(auth.email(),'@',1)), 'admin');

  -- ترقية ٥١: بذرة منقّطة · ترقية ٥٢: 2.1.2 بالاسم الجديد + سطر 2.1.3
  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'group', NULL, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '1.1.2', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '1.1.4', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '2', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '2.1', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '2.1.1', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '2.1.2', 'ضريبة القيمة المضافة المحصلة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '2.1.3', 'ضريبة القيمة المضافة المدفوعة', 'liability', NULL, 0, 0, true),
    (v_org, 14, '3', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 15, '3.1', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 16, '3.2', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 17, '4', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 18, '4.1', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '4.2', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 20, '5', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 21, '5.1', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 22, '5.2', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', 0, 0, true);

  return v_org;
end $function$;

-- =====================================================================================
-- البذرة المنقّطة لبوابة الأدمن — نفس التغيير
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.mizan_admin_create_org(p_org_name text, p_admin_username text, p_admin_password text, p_max_members integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
declare
  v_org uuid;
  v_uid uuid;
  v_email text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  if nullif(trim(p_org_name), '') is null or nullif(trim(p_admin_username), '') is null or nullif(p_admin_password, '') is null then
    raise exception 'بيانات ناقصة';
  end if;
  v_email := lower(regexp_replace(trim(p_admin_username), '[^a-z0-9._-]', '', 'g')) || '@mizan.app';
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'اسم المستخدم محجوز بالفعل';
  end if;

  insert into public.organizations (name, plan, plan_status, plan_start, owner_id, invite_code, max_members)
  values (trim(p_org_name), 'active', 'active', current_date, auth.uid(),
          upper(substr(md5(random()::text), 1, 8)),
          coalesce(p_max_members, 5))
  returning id into v_org;

  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_admin_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"email_confirmed":true}'::jsonb,
    jsonb_build_object('sub', v_uid, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    now(), now(), '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
  ) values (
    v_email, v_uid, jsonb_build_object('sub', v_uid, 'email', v_email, 'email_verified', false, 'phone_verified', false),
    'email', now(), now(), now(), gen_random_uuid()
  );

  insert into public.profiles (id, org_id, full_name, role)
  values (v_uid, v_org, coalesce(nullif(trim(p_admin_username),''), 'مدير الشركة'), 'admin');

  insert into public.mizan_pw_store (user_id, plain_password) values (v_uid, p_admin_password)
  on conflict (user_id) do update set plain_password = excluded.plain_password, updated_at = now();

  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'group', NULL, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '1.1.2', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '1.1.4', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '2', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '2.1', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '2.1.1', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '2.1.2', 'ضريبة القيمة المضافة المحصلة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '2.1.3', 'ضريبة القيمة المضافة المدفوعة', 'liability', NULL, 0, 0, true),
    (v_org, 14, '3', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 15, '3.1', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 16, '3.2', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 17, '4', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 18, '4.1', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '4.2', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 20, '5', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 21, '5.1', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 22, '5.2', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', 0, 0, true);

  return v_org;
end $function$;

-- =====================================================================================
-- (٤) دالة حفظ إعدادات العميل — ضم العمودين الجديدين
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.mizan_client_sett_save(p_org jsonb, p_categories jsonb, p_units jsonb, p_warehouses jsonb, p_owners jsonb, p_wallets jsonb, p_banks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
declare
  v_org uuid;
  r jsonb;
  v_id uuid;
  v_local bigint;
begin
  select org_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'غير مصرح';
  end if;

  if p_org is not null then
    if (p_org->>'name') is not null then update public.organizations set name = p_org->>'name' where id = v_org; end if;
    if (p_org->>'phone') is not null then update public.organizations set phone = p_org->>'phone' where id = v_org; end if;
    if (p_org->>'address') is not null then update public.organizations set address = p_org->>'address' where id = v_org; end if;
    if (p_org->>'tax_number') is not null then update public.organizations set tax_number = p_org->>'tax_number' where id = v_org; end if;
    if (p_org->>'tax_enabled') is not null then update public.organizations set tax_enabled = (p_org->>'tax_enabled')::boolean where id = v_org; end if;
    if (p_org->>'tax_rate') is not null then update public.organizations set tax_rate = (p_org->>'tax_rate')::numeric where id = v_org; end if;
    if (p_org->>'tax_buy_enabled') is not null then update public.organizations set tax_buy_enabled = (p_org->>'tax_buy_enabled')::boolean where id = v_org; end if;
    if (p_org->>'tax_rate_buy') is not null then update public.organizations set tax_rate_buy = (p_org->>'tax_rate_buy')::numeric where id = v_org; end if;
    if (p_org->>'tax_title') is not null then update public.organizations set tax_title = p_org->>'tax_title' where id = v_org; end if;
    if (p_org->>'paper_size') is not null then update public.organizations set paper_size = p_org->>'paper_size' where id = v_org; end if;
    if (p_org->>'warranty_terms') is not null then update public.organizations set warranty_terms = p_org->>'warranty_terms' where id = v_org; end if;
    if (p_org->>'org_note') is not null then update public.organizations set org_note = p_org->>'org_note' where id = v_org; end if;
    if (p_org ? 'invoice_fields') then update public.organizations set invoice_fields = p_org->'invoice_fields' where id = v_org; end if;
  end if;

  if p_categories is not null then
    delete from public.categories where org_id = v_org;
    for r in select * from jsonb_array_elements(p_categories)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.categories (id, org_id, name, description, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'description', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_units is not null then
    delete from public.units where org_id = v_org;
    for r in select * from jsonb_array_elements(p_units)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.units (id, org_id, name, symbol, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'symbol', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_warehouses is not null then
    delete from public.warehouses where org_id = v_org;
    for r in select * from jsonb_array_elements(p_warehouses)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.warehouses (id, org_id, code, name, address, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'code', r->>'name', r->>'address', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_owners is not null then
    delete from public.owners where org_id = v_org;
    for r in select * from jsonb_array_elements(p_owners)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.owners (id, org_id, name, phone, capital, withdrawals, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, r->>'name', r->>'phone', coalesce((r->>'capital')::numeric, 0), coalesce((r->>'withdrawals')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_wallets is not null then
    delete from public.treasury where org_id = v_org and type = 'wallet';
    for r in select * from jsonb_array_elements(p_wallets)
    loop
      v_id := (r->>'id')::uuid;
      v_local := (r->>'local_id')::bigint;
      if v_local is null or exists (
           select 1 from public.treasury t2
            where t2.org_id = v_org and t2.local_id = v_local and t2.id is distinct from v_id) then
        v_local := public.mizan_treasury_next_local(v_org, v_id);
      end if;
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, v_local, r->>'name', 'wallet', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_banks is not null then
    delete from public.treasury where org_id = v_org and type = 'bank';
    for r in select * from jsonb_array_elements(p_banks)
    loop
      v_id := (r->>'id')::uuid;
      v_local := (r->>'local_id')::bigint;
      if v_local is null or exists (
           select 1 from public.treasury t2
            where t2.org_id = v_org and t2.local_id = v_local and t2.id is distinct from v_id) then
        v_local := public.mizan_treasury_next_local(v_org, v_id);
      end if;
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), v_org, v_local, r->>'name', 'bank', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
end $function$;

-- =====================================================================================
-- (٤/ب) دالة حفظ إعدادات المالك — نفس الإضافة
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.mizan_admin_sett_save(p_org_id uuid, p_org jsonb, p_categories jsonb, p_units jsonb, p_warehouses jsonb, p_owners jsonb, p_wallets jsonb, p_banks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
declare
  r jsonb;
  v_id uuid;
  v_local bigint;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;

  if p_org is not null then
    if (p_org->>'name') is not null then update public.organizations set name = p_org->>'name' where id = p_org_id; end if;
    if (p_org->>'phone') is not null then update public.organizations set phone = p_org->>'phone' where id = p_org_id; end if;
    if (p_org->>'address') is not null then update public.organizations set address = p_org->>'address' where id = p_org_id; end if;
    if (p_org->>'tax_number') is not null then update public.organizations set tax_number = p_org->>'tax_number' where id = p_org_id; end if;
    if (p_org->>'tax_enabled') is not null then update public.organizations set tax_enabled = (p_org->>'tax_enabled')::boolean where id = p_org_id; end if;
    if (p_org->>'tax_rate') is not null then update public.organizations set tax_rate = (p_org->>'tax_rate')::numeric where id = p_org_id; end if;
    if (p_org->>'tax_buy_enabled') is not null then update public.organizations set tax_buy_enabled = (p_org->>'tax_buy_enabled')::boolean where id = p_org_id; end if;
    if (p_org->>'tax_rate_buy') is not null then update public.organizations set tax_rate_buy = (p_org->>'tax_rate_buy')::numeric where id = p_org_id; end if;
    if (p_org->>'tax_title') is not null then update public.organizations set tax_title = p_org->>'tax_title' where id = p_org_id; end if;
    if (p_org->>'paper_size') is not null then update public.organizations set paper_size = p_org->>'paper_size' where id = p_org_id; end if;
    if (p_org->>'warranty_terms') is not null then update public.organizations set warranty_terms = p_org->>'warranty_terms' where id = p_org_id; end if;
    if (p_org->>'org_note') is not null then update public.organizations set org_note = p_org->>'org_note' where id = p_org_id; end if;
  end if;

  if p_categories is not null then
    delete from public.categories where org_id = p_org_id;
    for r in select * from jsonb_array_elements(p_categories)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.categories (id, org_id, name, description, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'name', r->>'description', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_units is not null then
    delete from public.units where org_id = p_org_id;
    for r in select * from jsonb_array_elements(p_units)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.units (id, org_id, name, symbol, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'name', r->>'symbol', coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_warehouses is not null then
    delete from public.warehouses where org_id = p_org_id;
    for r in select * from jsonb_array_elements(p_warehouses)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.warehouses (id, org_id, code, name, address, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'code', r->>'name', r->>'address', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_owners is not null then
    delete from public.owners where org_id = p_org_id;
    for r in select * from jsonb_array_elements(p_owners)
    loop
      v_id := (r->>'id')::uuid;
      insert into public.owners (id, org_id, name, phone, capital, withdrawals, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, r->>'name', r->>'phone', coalesce((r->>'capital')::numeric, 0), coalesce((r->>'withdrawals')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_wallets is not null then
    delete from public.treasury where org_id = p_org_id and type = 'wallet';
    for r in select * from jsonb_array_elements(p_wallets)
    loop
      v_id := (r->>'id')::uuid;
      v_local := (r->>'local_id')::bigint;
      if v_local is null or exists (
           select 1 from public.treasury t2
            where t2.org_id = p_org_id and t2.local_id = v_local and t2.id is distinct from v_id) then
        v_local := public.mizan_treasury_next_local(p_org_id, v_id);
      end if;
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, v_local, r->>'name', 'wallet', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
  if p_banks is not null then
    delete from public.treasury where org_id = p_org_id and type = 'bank';
    for r in select * from jsonb_array_elements(p_banks)
    loop
      v_id := (r->>'id')::uuid;
      v_local := (r->>'local_id')::bigint;
      if v_local is null or exists (
           select 1 from public.treasury t2
            where t2.org_id = p_org_id and t2.local_id = v_local and t2.id is distinct from v_id) then
        v_local := public.mizan_treasury_next_local(p_org_id, v_id);
      end if;
      insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
      values (coalesce(v_id, gen_random_uuid()), p_org_id, v_local, r->>'name', 'bank', r->>'account_no', coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
    end loop;
  end if;
end $function$;

-- =====================================================================================
-- (٥) mizan_admin_restore_one — استعادة العمودين الجديدين (فرع التحديث + فرع الإدراج)
-- =====================================================================================
drop function if exists public.mizan_admin_restore_one(uuid, jsonb);
create or replace function public.mizan_admin_restore_one(p_org_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  r jsonb;
  v_id uuid;
  v_org jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;

  -- تحديد كائن الشركة: من قائمة الشركات (شامل) أو من مفتاح org (نسخة شركة واحدة)
  if p_payload->'organizations' is not null then
    select e into v_org from jsonb_array_elements(p_payload->'organizations') e
    where e->>'id' = p_org_id::text limit 1;
  else
    v_org := p_payload->'org';
  end if;

  -- تحديث / إدراج الشركة نفسها
  if v_org is not null then
    if exists (select 1 from public.organizations where id = p_org_id) then
      if (v_org->>'name') is not null then update public.organizations set name = v_org->>'name' where id = p_org_id; end if;
      if (v_org->>'phone') is not null then update public.organizations set phone = v_org->>'phone' where id = p_org_id; end if;
      if (v_org->>'address') is not null then update public.organizations set address = v_org->>'address' where id = p_org_id; end if;
      if (v_org->>'tax_number') is not null then update public.organizations set tax_number = v_org->>'tax_number' where id = p_org_id; end if;
      if (v_org->>'tax_enabled') is not null then update public.organizations set tax_enabled = (v_org->>'tax_enabled')::boolean where id = p_org_id; end if;
      if (v_org->>'tax_rate') is not null then update public.organizations set tax_rate = (v_org->>'tax_rate')::numeric where id = p_org_id; end if;
      if (v_org->>'tax_buy_enabled') is not null then update public.organizations set tax_buy_enabled = (v_org->>'tax_buy_enabled')::boolean where id = p_org_id; end if;
      if (v_org->>'tax_rate_buy') is not null then update public.organizations set tax_rate_buy = (v_org->>'tax_rate_buy')::numeric where id = p_org_id; end if;
      if (v_org->>'tax_title') is not null then update public.organizations set tax_title = v_org->>'tax_title' where id = p_org_id; end if;
      if (v_org->>'paper_size') is not null then update public.organizations set paper_size = v_org->>'paper_size' where id = p_org_id; end if;
      if (v_org->>'warranty_terms') is not null then update public.organizations set warranty_terms = v_org->>'warranty_terms' where id = p_org_id; end if;
      if (v_org->>'org_note') is not null then update public.organizations set org_note = v_org->>'org_note' where id = p_org_id; end if;
    else
      insert into public.organizations (id, name, phone, address, tax_number, tax_enabled, tax_rate, tax_buy_enabled, tax_rate_buy, tax_title, paper_size, warranty_terms, org_note)
      values (p_org_id, v_org->>'name', v_org->>'phone', v_org->>'address', v_org->>'tax_number',
              coalesce((v_org->>'tax_enabled')::boolean, false), coalesce((v_org->>'tax_rate')::numeric, 0),
              coalesce((v_org->>'tax_buy_enabled')::boolean, false), coalesce((v_org->>'tax_rate_buy')::numeric, 0),
              v_org->>'tax_title', v_org->>'paper_size', v_org->>'warranty_terms', v_org->>'org_note');
    end if;
  end if;

  delete from public.sale_items where org_id = p_org_id;
  delete from public.sales where org_id = p_org_id;
  delete from public.purchase_items where org_id = p_org_id;
  delete from public.purchases where org_id = p_org_id;
  delete from public.supplier_txs where org_id = p_org_id;
  delete from public.customer_txs where org_id = p_org_id;
  delete from public.vouchers where org_id = p_org_id;
  delete from public.journal_lines where org_id = p_org_id;
  delete from public.journal_entries where org_id = p_org_id;
  delete from public.treasury where org_id = p_org_id;
  delete from public.accounts where org_id = p_org_id;
  delete from public.owners where org_id = p_org_id;
  delete from public.warehouses where org_id = p_org_id;
  delete from public.units where org_id = p_org_id;
  delete from public.categories where org_id = p_org_id;
  delete from public.customers where org_id = p_org_id;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'customers', p_org_id::text))
  loop
    insert into public.customers (id, org_id, local_id, code, name_ar, phone, address, opening_balance, current_balance, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'phone', r->>'address',
            coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'current_balance')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'suppliers', p_org_id::text))
  loop
    insert into public.suppliers (id, org_id, local_id, code, name_ar, phone, address, opening_balance, current_balance, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'phone', r->>'address',
            coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'current_balance')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'products', p_org_id::text))
  loop
    insert into public.products (id, org_id, local_id, code, name_ar, price, cost, qty, unit, category, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar',
            coalesce((r->>'price')::numeric, 0), coalesce((r->>'cost')::numeric, 0), coalesce((r->>'qty')::numeric, 0),
            r->>'unit', r->>'category', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'treasury', p_org_id::text))
  loop
    insert into public.treasury (id, org_id, local_id, name, type, account_no, opening_balance, balance, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'name', coalesce(r->>'type','cash'), r->>'account_no',
            coalesce((r->>'opening_balance')::numeric, 0), coalesce((r->>'balance')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'accounts', p_org_id::text))
  loop
    insert into public.accounts (id, org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'code', r->>'name_ar', r->>'type',
            (r->>'parent_id')::bigint, coalesce((r->>'opening_debit')::numeric, 0), coalesce((r->>'opening_credit')::numeric, 0),
            coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'categories', p_org_id::text))
  loop
    insert into public.categories (id, org_id, name, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'name', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'units', p_org_id::text))
  loop
    insert into public.units (id, org_id, name, symbol, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'name', r->>'symbol', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'warehouses', p_org_id::text))
  loop
    insert into public.warehouses (id, org_id, code, name, address, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'code', r->>'name', r->>'address', coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'owners', p_org_id::text))
  loop
    insert into public.owners (id, org_id, name, phone, capital, withdrawals, is_active, deleted, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, r->>'name', r->>'phone', coalesce((r->>'capital')::numeric, 0), coalesce((r->>'withdrawals')::numeric, 0), coalesce((r->>'is_active')::boolean, true), coalesce((r->>'deleted')::boolean, false), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'sales', p_org_id::text))
  loop
    insert into public.sales (id, org_id, local_id, invoice_no, doc_date, customer, payment_method, treasury_id, store, notes, discount, tax, grand_total, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'customer', r->>'payment_method',
            (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'sale_items', p_org_id::text))
  loop
    insert into public.sale_items (id, org_id, local_id, sale_id, product_id, product_name, qty, price, total)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, coalesce((r->>'sale_id')::uuid, gen_random_uuid()), (r->>'product_id')::text, r->>'product_name',
            coalesce((r->>'qty')::numeric, 0), coalesce((r->>'price')::numeric, 0), coalesce((r->>'total')::numeric, 0));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'purchases', p_org_id::text))
  loop
    insert into public.purchases (id, org_id, local_id, invoice_no, doc_date, supplier, payment_method, treasury_id, store, notes, discount, tax, grand_total, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'invoice_no', coalesce((r->>'doc_date')::date, now()::date), r->>'supplier', r->>'payment_method',
            (r->>'treasury_id')::text, r->>'store', r->>'notes', coalesce((r->>'discount')::numeric, 0), coalesce((r->>'tax')::numeric, 0), coalesce((r->>'grand_total')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'purchase_items', p_org_id::text))
  loop
    insert into public.purchase_items (id, org_id, local_id, purchase_id, product_id, product_name, qty, price, total)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, coalesce((r->>'purchase_id')::uuid, gen_random_uuid()), (r->>'product_id')::text, r->>'product_name',
            coalesce((r->>'qty')::numeric, 0), coalesce((r->>'price')::numeric, 0), coalesce((r->>'total')::numeric, 0));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'supplier_txs', p_org_id::text))
  loop
    insert into public.supplier_txs (id, org_id, local_id, supplier_id, doc_date, type, amount, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, (r->>'supplier_id')::text, coalesce((r->>'doc_date')::date, now()::date), r->>'type', coalesce((r->>'amount')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'customer_txs', p_org_id::text))
  loop
    insert into public.customer_txs (id, org_id, local_id, customer_id, doc_date, description, debit, credit, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, (r->>'customer_id')::text, coalesce((r->>'doc_date')::date, now()::date), r->>'description', coalesce((r->>'debit')::numeric, 0), coalesce((r->>'credit')::numeric, 0), coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'vouchers', p_org_id::text))
  loop
    insert into public.vouchers (id, org_id, local_id, no, doc_date, kind, treasury_id, account_id, amount, notes, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'no', coalesce((r->>'doc_date')::date, now()::date), r->>'kind', (r->>'treasury_id')::text, (r->>'account_id')::text, coalesce((r->>'amount')::numeric, 0), r->>'notes', coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'journal_entries', p_org_id::text))
  loop
    insert into public.journal_entries (id, org_id, local_id, jrn_no, doc_date, ref_type, ref_id, description, created_at)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, r->>'jrn_no', coalesce((r->>'doc_date')::date, now()::date), r->>'ref_type', (r->>'ref_id')::text, r->>'description', coalesce((r->>'created_at')::timestamptz, now()));
  end loop;

  for r in select * from jsonb_array_elements(public.mizan_org_rows(p_payload,'journal_lines', p_org_id::text))
  loop
    insert into public.journal_lines (id, org_id, local_id, entry_id, account_id, account_name, debit, credit)
    values (coalesce((r->>'id')::uuid, gen_random_uuid()), p_org_id, (r->>'local_id')::bigint, coalesce((r->>'entry_id')::uuid, gen_random_uuid()), (r->>'account_id')::text, r->>'account_name', coalesce((r->>'debit')::numeric, 0), coalesce((r->>'credit')::numeric, 0));
  end loop;
end $$;

grant execute on function public.mizan_admin_restore_one(uuid, jsonb) to authenticated;
-- إعادة الإنشاء بعد drop بترجّع المنح الافتراضية (منح anon) ⇒ نرجع نفس تشديد الترقية 27
revoke execute on function public.mizan_admin_restore_one(uuid, jsonb) from anon;
revoke execute on function public.mizan_admin_restore_one(uuid, jsonb) from public;

-- =====================================================================================
-- (فحص ذاتي) الدالتان بقتا بتعرفوا العمودين + الحسابان اتنزّلوا
-- =====================================================================================
do $chk$
declare
  v_def text;
  v_src text;
  v_bad text[] := '{}';
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'organizations' and column_name = 'tax_rate_buy') then
    raise exception 'ترقية ٥٢: عمود tax_rate_buy مش موجود';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'organizations' and column_name = 'tax_buy_enabled') then
    raise exception 'ترقية ٥٢: عمود tax_buy_enabled مش موجود';
  end if;

  foreach v_def in array array['mizan_client_sett_save', 'mizan_admin_sett_save', 'mizan_admin_restore_one']
  loop
    select pg_get_functiondef(p.oid) into v_src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_def and p.prokind = 'f';
    if v_src is null then
      raise exception 'ترقية ٥٢: الدالة % مش موجودة', v_def;
    end if;
    if v_src not like '%tax_rate_buy%' then
      v_bad := array_append(v_bad, v_def);
    end if;
  end loop;
  if array_length(v_bad, 1) > 0 then
    raise exception 'ترقية ٥٢: الدوال دي لسه ما بتعرفش tax_rate_buy: %', array_to_string(v_bad, ', ');
  end if;

  if not exists (select 1 from public.accounts where code = '2.1.3' and name_ar = 'ضريبة القيمة المضافة المدفوعة') then
    raise exception 'ترقية ٥٢: حساب 2.1.3 ما اتنزّلش';
  end if;
  raise notice 'ترقية ٥٢ تمام: العمودان + الحسابان + الدوال';
end
$chk$;
