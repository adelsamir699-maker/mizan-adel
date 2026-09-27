-- ============================================================
-- Mizan — ترقية 18: حماية الجداول الحساسة من الحذف لغير المديرين
--
-- الغرض:
-- منع الكاشير أو العضو العادي (member) داخل الشركة من حذف الفواتير
-- أو الخزائن أو الحركات المحاسبية عبر RLS المباشر.
-- الحذف يُسمح به فقط لمدير الشركة (role = 'admin') أو المالك (is_superadmin).
--
-- ⚠️ تم التجهيز للحفظ المحلي — لا يُنفّذ على Supabase إلا بطلب المستخدم.
-- ============================================================

begin;

-- دالة مساعدة سريعة للتحقق إن كان المستخدم الحالي مديراً لشركته أو سوبر أدمن
create or replace function public.is_org_admin_or_super()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(blocked, false) is false
      and (role = 'admin' or is_superadmin is true)
  );
$$;

-- تطبيق سياسة الحذف المقيدة على جداول الشغل الحساسة
do $$
declare
  tables text[] := array[
    'sales', 'sale_items',
    'purchases', 'purchase_items',
    'treasury', 'accounts',
    'customer_txs', 'supplier_txs',
    'vouchers', 'journal_entries', 'journal_lines'
  ];
  t text;
begin
  foreach t in array tables loop
    -- إسقاط سياسة الحذف القديمة
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    -- إنشاء السياسة المحمية: نفس الشركة + دور مدير أو سوبر أدمن فقط
    execute format(
      'create policy %I_delete on public.%I for delete using (org_id = public.current_org() and public.is_org_admin_or_super());',
      t, t
    );
  end loop;
end $$;

commit;
