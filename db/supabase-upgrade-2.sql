-- ترقية 2: محاذاة بذور الشركة الجديدة مع local_id الخاص بالتطبيق
-- حتى تتطابق المعرفات المحلية (حسابات 1..21 وخزائن 1..3) مع نفس الأرقام داخل السحابة.

create or replace function public.create_org_and_profile(p_org_name text, p_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_org uuid;
begin
  insert into public.organizations (name, invite_code)
  values (p_org_name, upper(substr(md5(random()::text), 1, 8)))
  returning id into v_org;
  insert into public.profiles (id, org_id, full_name, role)
  values (auth.uid(), v_org, coalesce(nullif(p_name,''), split_part(auth.email(),'@',1)), 'admin');

  -- شجرة الحسابات الافتراضية مطابقة لبيانات التطبيق التجريبية
  insert into public.accounts (org_id, local_id, code, name_ar, type, parent_id, opening_debit, opening_credit, is_active) values
    (v_org, 1, '1', 'الأصول', 'asset', 0, 0, 0, true),
    (v_org, 2, '1.1', 'الأصول المتداولة', 'asset', 1, 0, 0, true),
    (v_org, 3, '1.1.1', 'الصناديق النقدية', 'asset', 2, 25000, 0, true),
    (v_org, 4, '1.1.2', 'البنوك والحسابات البنكية', 'asset', 2, 50000, 0, true),
    (v_org, 5, '1.1.3', 'المحافظ الإلكترونية', 'asset', 2, 10000, 0, true),
    (v_org, 6, '1.1.4', 'المخزون (بضاعة)', 'asset', 2, 0, 0, true),
    (v_org, 7, '1.1.5', 'مديونيات العملاء', 'asset', 2, 0, 0, true),
    (v_org, 8, '1.3', 'الأصول الثابتة', 'asset', 1, 0, 0, true),
    (v_org, 9, '1.3.1', 'المباني والمعدات', 'asset', 8, 0, 0, true),
    (v_org, 10, '2', 'الالتزامات', 'liability', 0, 0, 0, true),
    (v_org, 11, '2.1', 'الالتزامات المتداولة', 'liability', 10, 0, 0, true),
    (v_org, 12, '2.1.1', 'مستحقات الموردين', 'liability', 11, 0, 0, true),
    (v_org, 13, '2.1.2', 'ضريبة المبيعات المستحقة', 'liability', 11, 0, 0, true),
    (v_org, 14, '3', 'حقوق الملكية', 'equity', 0, 0, 0, true),
    (v_org, 15, '3.1', 'رأس المال', 'equity', 14, 100000, 0, true),
    (v_org, 16, '3.2', 'الأرباح المحتجزة', 'equity', 14, 0, 0, true),
    (v_org, 17, '4', 'الإيرادات', 'revenue', 0, 0, 0, true),
    (v_org, 18, '4.1', 'إيرادات المبيعات', 'revenue', 17, 0, 0, true),
    (v_org, 19, '5', 'المصروفات', 'expense', 0, 0, 0, true),
    (v_org, 20, '5.1', 'مصروفات عمومية وإدارية', 'expense', 19, 0, 0, true),
    (v_org, 21, '5.2', 'إيجارات وما شابه', 'expense', 19, 0, 0, true);

  -- الخزن الافتراضية مطابقة لبيانات التطبيق التجريبية
  insert into public.treasury (org_id, local_id, name, type, opening_balance, balance, is_active) values
    (v_org, 1, 'الصندوق الرئيسي (نقدي)', 'cash', 25000, 25000, true),
    (v_org, 2, 'البنك الأهلي المصري (1234567890)', 'bank', 50000, 50000, true),
    (v_org, 3, 'محفظة فودافون كاش (01002655282)', 'wallet', 10000, 10000, true);

  return v_org;
end $$;