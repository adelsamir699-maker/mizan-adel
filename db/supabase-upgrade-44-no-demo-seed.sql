/* ===================================================================================
 * supabase-upgrade-44-no-demo-seed.sql
 * منع «زرع» بنك + محفظة + أرصدة وهمية في أي شركة جديدة  (طلب المالك 02/10)
 * ===================================================================================
 * البلاغ: «طلبت إن الشركة الجديدة تكون فاضية 100% — عملت شركة ولقيت فيها حسابات بنك».
 *
 * القياس (قراءة فقط: probe_new_org_seed.js + dump_create_org_44.js):
 *   الدالة الحيّة mizan_admin_create_org(text,text,text,int) على Supabase هي نفس نص
 *   upgrade-7، وبتعمل insert إلزامي مع كل شركة جديدة:
 *     - treasury: «الصندوق الرئيسي» 25000 + «البنك الأهلي المصري» bank 50000
 *                 + «محفظة فودافون كاش» wallet 10000
 *     - accounts: «رأس المال» برصيد افتتاحي 100000
 *   نتيجة القياس: 6 من 7 شركات ليهم نفس الثلاث سطور بالظبط (منها شركة النهاردة 16:27).
 *   تصحيح بناء 122 كان بيمنع الزرع جوه المتصفح بس — الدالة السحابية ما اتلمستش.
 *
 * الإصلاح (قدّامي فقط): CREATE OR REPLACE بنفس النص الحيّ حرفيًا + استبدالين بس:
 *     (١) سطور الخزائن → سطر واحد «الصندوق الرئيسي» / cash / 0
 *     (٢) افتتاحي «رأس المال» → 0 زي باقي الدليل
 *   مافيش أي DELETE/UPDATE على جداول البيانات ⇒ ولا سطر في شركة موجودة بيتلمس.
 *
 * الأمان: بوابة قبل بمقارنة md5 للنص الحيّ (لو الدالة اتغيّرت عن القياس = exception
 *   → ROLLBACK) + فحوصات بعد (ممنوع بنك/محفظة/أرصدة · عدد الأسطر 22 · SECURITY DEFINER
 *   · search_path=public · المنح: authenticated موجود و anon/public مرفوضان) +
 *   ثبات عدد الأسطر في 10 جداول قبل/بعد (شركات · خزائن · دليل · عملاء · موردون · أصناف ·
 *   حركة عملاء · حركة موردين · قيود · حسابات دخول). المعاملة ملك apply_upgrade_44.js، ومعاها
 *   اختبار سلوكي (إنشاء شركة ثم ROLLBACK) outside the transaction. عدد الأسطر
 *   في 10 جداول بيتقارن قبل/بعد: مافيش ولا سطر بيتلمس.
 * =================================================================================== */

/* ---- (0) قياسات ما قبل التنفيذ (للمقارنة بعدها) ---- */
drop table if exists _u44_before;
create temp table _u44_before as
select
  (select count(*) from public.organizations) as orgs,
  (select count(*) from public.treasury)      as tre,
  (select count(*) from public.accounts)      as acc,
  (select count(*) from public.customers)     as cust,
  (select count(*) from public.suppliers)     as supp,
  (select count(*) from public.products)      as prod,
  (select count(*) from public.customer_txs)  as ctx,
  (select count(*) from public.supplier_txs)  as stx,
  (select count(*) from public.journal_entries) as jrn,
  (select count(*) from auth.users)           as authusers;

/* ---- (1) بوابة قبل: النص الحيّ لازم يكون هو المقاس حرفيًا ---- */
do $$
declare v_md5 text; v_n int;
begin
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mizan_admin_create_org';
  if v_n <> 1 then raise exception 'ترقية 44: متوقع دالة إنشاء واحدة، لقينا %', v_n; end if;

  select md5(pg_get_functiondef(p.oid)) into v_md5
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mizan_admin_create_org';

  if v_md5 is null then raise exception 'ترقية 44: مافيش نص للدالة'; end if;
  if v_md5 <> '0c2be8dbf3ecd9e22279dc78ae61ecc4' then
    raise exception 'ترقية 44: النص الحيّ للدالة اتغير عن القياس (md5 % != 0c2be8dbf3ecd9e22279dc78ae61ecc4) — وقف، متعدلش على مجهول', v_md5;
  end if;
  raise notice 'بوابة قبل ✓ النص الحيّ مطابق للقياس (md5 %)', left(v_md5, 8);
end $$;

/* ---- (2) نفس الدالة، استبدالين بس (الخزائن + افتتاحي رأس المال) ---- */
CREATE OR REPLACE FUNCTION public.mizan_admin_create_org(p_org_name text, p_admin_username text, p_admin_password text, p_max_members integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    (v_org, 2, '11', 'الأصول المتداولة', 'group', NULL, 0, 0, true),
    (v_org, 3, '111', 'الصناديق النقدية', 'asset', NULL, 0, 0, true),
    (v_org, 4, '112', 'البنوك', 'asset', NULL, 0, 0, true),
    (v_org, 5, '113', 'المحافظ الإلكترونية', 'asset', NULL, 0, 0, true),
    (v_org, 6, '114', 'المخزون', 'asset', NULL, 0, 0, true),
    (v_org, 7, '115', 'مديونيات العملاء', 'asset', NULL, 0, 0, true),
    (v_org, 8, '12', 'الأصول الثابتة', 'group', NULL, 0, 0, true),
    (v_org, 9, '13', 'الالتزامات', 'group', NULL, 0, 0, true),
    (v_org, 10, '131', 'الالتزامات المتداولة', 'liability', NULL, 0, 0, true),
    (v_org, 11, '132', 'مستحقات الموردين', 'liability', NULL, 0, 0, true),
    (v_org, 12, '133', 'ضريبة المبيعات المستحقة', 'liability', NULL, 0, 0, true),
    (v_org, 13, '14', 'حقوق الملكية', 'group', NULL, 0, 0, true),
    (v_org, 14, '141', 'رأس المال', 'equity', NULL, 0, 0, true),
    (v_org, 15, '142', 'الأرباح المحتجزة', 'equity', NULL, 0, 0, true),
    (v_org, 16, '2', 'الإيرادات', 'group', NULL, 0, 0, true),
    (v_org, 17, '21', 'إيرادات المبيعات', 'revenue', NULL, 0, 0, true),
    (v_org, 18, '22', 'إيرادات أخرى', 'revenue', NULL, 0, 0, true),
    (v_org, 19, '3', 'المصروفات', 'group', NULL, 0, 0, true),
    (v_org, 20, '31', 'مصروفات عمومية وإدارية', 'expense', NULL, 0, 0, true),
    (v_org, 21, '32', 'إيجارات وما شابه', 'expense', NULL, 0, 0, true);

  -- 🛡 ترقية ٤٤ (02/10): خزينة واحدة «الصندوق الرئيسي» نقدية برصيد صفر —
  --    بلا أي حساب بنكي أو محفظة إلكترونية أو رصيد وهمي مع الشركة الجديدة.
  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي', 'cash', 0, 0, true);

  return v_org;
end $function$;

/* ---- (3) فحوصات بعد ---- */
do $$
declare d text; v_cfg text; v_def bool; v_rows int; v_bad text; v_n int;
        v_orgs bigint; v_tre bigint; v_acc bigint; v_cust bigint; v_supp bigint; v_prod bigint;
        v_ctx bigint; v_stx bigint; v_jrn bigint; v_au bigint;
begin
  select pg_get_functiondef(p.oid), array_to_string(p.proconfig, ','), p.prosecdef
    into d, v_cfg, v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'mizan_admin_create_org';
  if d is null then raise exception 'ترقية 44: الدالة اختفت!'; end if;

  /* (أ) سطر الخزينة الجديد موجود بالظبط، وممنوع أي أثر للزرع */
  if position('(v_org, 1, ''الصندوق الرئيسي'', ''cash'', 0, 0, true);' in d) = 0 then
    raise exception 'ترقية 44: سطر الخزينة الجديد مش موجود';
  end if;
  v_bad := '';
  if position('البنك الأهلي المصري' in d) > 0 then v_bad := v_bad || 'bank-name '; end if;
  if position('محفظة فودافون كاش' in d) > 0 then v_bad := v_bad || 'wallet-name '; end if;
  if position('''bank''' in d) > 0 then v_bad := v_bad || '''bank'' '; end if;
  if position('''wallet''' in d) > 0 then v_bad := v_bad || '''wallet'' '; end if;
  if position('25000' in d) > 0 or position('50000' in d) > 0 or position('10000' in d) > 0 then
    v_bad := v_bad || 'fake-balances';
  end if;
  if v_bad <> '' then raise exception 'ترقية 44: الزرع لسه جوّه الدالة → %', v_bad; end if;

  /* (ب) عدد أسطر الإدراج = 22 (21 دليل + خزينة واحدة) — مافيش سطر ضايل أو زايد */
  select count(*) into v_rows from unnest(string_to_array(d, chr(10))) l
   where l ~ '^\s*\(v_org, [0-9]+,';
  if v_rows <> 22 then raise exception 'ترقية 44: عدد أسطر الإدراج % (متوقع 22)', v_rows; end if;

  /* (ج) الخصائص والمنح زي ما هي */
  if not v_def then raise exception 'ترقية 44: SECURITY DEFINER اتسحبت'; end if;
  if v_cfg is null or v_cfg not like '%search_path=public%' then
    raise exception 'ترقية 44: search_path اتغيرت: %', coalesce(v_cfg, 'null');
  end if;
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace, aclexplode(p.proacl) x
   where n.nspname = 'public' and p.proname = 'mizan_admin_create_org'
     and x.privilege_type = 'EXECUTE' and x.grantee::regrole::text in ('anon', 'public');
  if v_n > 0 then raise exception 'ترقية 44: منح تنفيذ لـ anon/public موجود'; end if;
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace, aclexplode(p.proacl) x
   where n.nspname = 'public' and p.proname = 'mizan_admin_create_org'
     and x.privilege_type = 'EXECUTE' and x.grantee::regrole::text = 'authenticated';
  if v_n = 0 then raise exception 'ترقية 44: منح authenticated مفقود — التطبيق هيموت'; end if;

  /* (د) مافيش ولا سطر اتلمس في أي جدول */
  select orgs, tre, acc, cust, supp, prod, ctx, stx, jrn, authusers
    into v_orgs, v_tre, v_acc, v_cust, v_supp, v_prod, v_ctx, v_stx, v_jrn, v_au from _u44_before;
  if (select count(*) from public.organizations)   <> v_orgs then raise exception 'ترقية 44: عدد الشركات اتغير'; end if;
  if (select count(*) from public.treasury)        <> v_tre  then raise exception 'ترقية 44: أسطر الخزائن اتغيرت'; end if;
  if (select count(*) from public.accounts)        <> v_acc  then raise exception 'ترقية 44: أسطر الدليل اتغيرت'; end if;
  if (select count(*) from public.customers)       <> v_cust then raise exception 'ترقية 44: أسطر العملاء اتغيرت'; end if;
  if (select count(*) from public.suppliers)       <> v_supp then raise exception 'ترقية 44: أسطر الموردين اتغيرت'; end if;
  if (select count(*) from public.products)        <> v_prod then raise exception 'ترقية 44: أسطر الأصناف اتغيرت'; end if;
  if (select count(*) from public.customer_txs)    <> v_ctx  then raise exception 'ترقية 44: حركة العملاء اتغيرت'; end if;
  if (select count(*) from public.supplier_txs)    <> v_stx  then raise exception 'ترقية 44: حركة الموردين اتغيرت'; end if;
  if (select count(*) from public.journal_entries) <> v_jrn  then raise exception 'ترقية 44: القيود اتغيرت'; end if;
  if (select count(*) from auth.users)             <> v_au   then raise exception 'ترقية 44: حسابات الدخول اتغيرت'; end if;

  raise notice 'فحوصات بعد ✓ أسطر الإدراج % · الشركات % · الخزائن % · الدليل % · حركة العملاء % (كلها ثابتة)',
    v_rows, v_orgs, v_tre, v_acc, v_ctx;
end $$;

/* مافيش begin/commit جوه الملف — المعاملة ملك apply_upgrade_44.js: أي raise فوق
 * = ROLLBACK كامل والقاعدة ترجع زي ما كانت حرفيًا (منح + نص + بيانات).
 * CREATE OR REPLACE لنفس المالك بيحافظ على proacl والملكية، وده متثبت في (ج). */

/* ===================================================================================
 * سجل التنفيذ — 2026-10-02 ≈17:35 (بتوقيت الجهاز) بأمر المالك الصريح «نفذ منع الزرع»
 * -----------------------------------------------------------------------------------
 * • القياس قبل: النص الحيّ = upgrade-7 حرفيًا · md5 = 0c2be8dbf3ecd9e22279dc78ae61ecc4
 *   (محفوظ في D:/_work/temp/_create_org_live_44.json) · ACL = {postgres=X, authenticated=X,
 *   service_role=X} · search_path=public · SECURITY DEFINER.
 * • التنفيذ: apply_upgrade_44.js (مقفول بمفتاح MIZAN_ORDER_44="نفذ") — transaction واحدة،
 *   16 فحصًا أخضر قبل COMMIT، ومنح/خصائص/diff سطر-بسطر (5 أسطر مختلفة كلها متوقعة) كلها
 *   مطابقة، و12 قياس عدد أساطر ثابت. النتيجة: **COMMIT**.
 *   (المحاولة الأولى راحت ROLLBACK بسبب `syntax error at or near "do"` — pg_get_functiondef
 *    بيرجع النص بدون فاصلة منقوطة في الآخر؛ اتصلّح بإضافتها، ومعها كان خطأ `public.txs`
 *    اللي مافيش أصلًا ⇒ اسماء الحركات الصح: customer_txs / supplier_txs. ولا أثر على القاعدة.)
 * • الإثبات بعد التنفيذ: test_no_seed_44.js = **24 ✅ / 0 ❌** — النص الجديد بلا bank/wallet/
 *   أرصدة وهمية، الخصائص والمنح زي ما هي، عدد الأسطر في 12 جدولًا مطابقًا تمامًا لقططة
 *   ما قبل التنفيذ، والمخطط ثابت (392 عمود · 61 دالة · 116 سياسة).
 * • الاختبار السلوكي (جوه ROLLBACK، مافيش شركة فضلته): نداء mizan_admin_create_org باسم
 *   اختبار ⇒ خزينة واحدة «الصندوق الرئيسي» cash برصيد افتتاحي وحالي **صفر** · 21 حساب
 *   كلهم افتتاحيهم صفر · مافيش ولا صنف/عميل/مورد/حركة/تصنيف/وحدة/مستودع · ولا بنك ولا
 *   محفظة · وبعد الرجوع عدد الشركات وحسابات الدخول زي الأول بالحرف.
 * • النسخ الاحتياطية: D:/MizanBackups/pre-mig44-20261002-1721  ·  post-mig44-20261002-1741
 * • مافيش أي DELETE/UPDATE على بيانات: شركة «مينا» (التجريبية) سطورها الثلاثة لسه زي ما هي
 *   بأمر المالك «سيبها وانا امسحها». شركات 02/10 قبل الترقية ما اتلمستش.
 * =================================================================================== */
