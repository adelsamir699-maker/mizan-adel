-- ترقية ٦٥ — «المدفوع/الآجل/سطور السداد» على فاتورتي البيع والشراء (بند المراجعة #2).
-- المرجع: مراجعة المالك 19/10، البند #2: «`payments[]`/`paidAmount`/`dueAmount` مش بتوصل
-- السحابة أصلًا» ⇒ أي جهاز تاني يشوف الفاتورة بلا مدفوعها/آجلها/توزيع وسائل السداد،
-- فكشف حساب الطرف والمركز المالي وقيود الفاتورة يختلفوا بين الأجهزة.
--
-- المشكلة (مقاسة على القاعدة الحيّة 19/10): جدولا `public.sales` (١٥ صفًا) و
-- `public.purchases` (صفر) **مافيهمش** أي عمود للمدفوع/الآجل/سطور السداد، و`cloud.js`
-- (META.sales / META.purchases) ما كانش بيبعتهم ولا يقراهم ⇒ البيانات تفضل محليّة بس.
--
-- اللي بتعمله:
--   (١) ثلاثة أعمدة على `sales` و`purchases`:
--       • paid_amount  — المدفوع فعلًا على الفاتورة (نقدي/بنك/محفظة/إنستا/شيك)
--       • due_amount   — الآجل (الباقي على حساب العميل/المورّد)
--       • payments     — سطور توزيع السداد [{method,amount,treasuryId,bankName,checkNo,dueDate}]
--   (٢) تعبئة الأرصدة القديمة بنفس قاعدة النظام القديم بالحرف (صفر تلفيق):
--       payment_method = 'آجل' ⇒ paid_amount = 0 و due_amount = grand_total، وإلا العكس.
--       (كانت قاعدة `invoiceJrnPlan`: المدفوع = الإجمالي إلا لو آجل) ⇒ مفيش أي تغيير سلوكي.
--   (٣) تحصين صغير على الجدولين: سحب TRUNCATE/REFERENCES/TRIGGER من authenticated
--       (قراءة/كتابة الصفوف مش محتاجاهم) — بلا أي مساس بسياسات RLS الحالية.
--   (٤) فحص ذاتي في الآخر.
--
-- ⚠️ بلا `begin/commit` (نمط ٦٢/٦٣/٦٤). الباك أب المسجَّل: D:\MizanBackups\pre-mig65-<ts>.

-- ============================================================
-- (١) أعمدة المدفوع/الآجل/سطور السداد
-- ============================================================
alter table public.sales add column if not exists paid_amount numeric not null default 0;
alter table public.sales add column if not exists due_amount  numeric not null default 0;
alter table public.sales add column if not exists payments    jsonb   not null default '[]'::jsonb;

alter table public.purchases add column if not exists paid_amount numeric not null default 0;
alter table public.purchases add column if not exists due_amount  numeric not null default 0;
alter table public.purchases add column if not exists payments    jsonb   not null default '[]'::jsonb;

comment on column public.sales.paid_amount is 'المدفوع فعلًا على فاتورة البيع (ترقية ٦٥ — بند #2)';
comment on column public.sales.due_amount  is 'الآجل على حساب العميل في فاتورة البيع (ترقية ٦٥)';
comment on column public.sales.payments    is 'سطور توزيع السداد [{method,amount,treasuryId,...}] (ترقية ٦٥)';
comment on column public.purchases.paid_amount is 'المدفوع فعلًا على فاتورة الشراء (ترقية ٦٥ — بند #2)';
comment on column public.purchases.due_amount  is 'الآجل على حساب المورّد في فاتورة الشراء (ترقية ٦٥)';
comment on column public.purchases.payments    is 'سطور توزيع السداد [{method,amount,treasuryId,...}] (ترقية ٦٥)';

-- ============================================================
-- (٢) تعبئة الأرصدة القديمة بقاعدة النظام القديم بالحرف (آجل ⇒ كله آجل، وإلا كله مدفوع)
-- ============================================================
update public.sales
   set due_amount  = case when btrim(coalesce(payment_method, '')) = 'آجل' then coalesce(grand_total, 0) else 0 end,
       paid_amount = case when btrim(coalesce(payment_method, '')) = 'آجل' then 0 else coalesce(grand_total, 0) end
 where paid_amount = 0 and due_amount = 0 and coalesce(grand_total, 0) > 0;

update public.purchases
   set due_amount  = case when btrim(coalesce(payment_method, '')) = 'آجل' then coalesce(grand_total, 0) else 0 end,
       paid_amount = case when btrim(coalesce(payment_method, '')) = 'آجل' then 0 else coalesce(grand_total, 0) end
 where paid_amount = 0 and due_amount = 0 and coalesce(grand_total, 0) > 0;

-- ============================================================
-- (٣) تحصين صغير على الجدولين (بلا مساس بسياسات RLS)
-- ============================================================
revoke all on public.sales from anon;
revoke all on public.purchases from anon;
revoke all on public.sales from public;
revoke all on public.purchases from public;
revoke truncate, references, trigger on public.sales from authenticated;
revoke truncate, references, trigger on public.purchases from authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.purchases to authenticated;

-- ============================================================
-- (٤) فحص ذاتي
-- ============================================================
do $chk$
declare
  n_sales int;
  n_pur   int;
  n_bad   int;
  n_zero  int;
begin
  select count(*) into n_sales
    from information_schema.columns
   where table_schema = 'public' and table_name = 'sales'
     and column_name in ('paid_amount', 'due_amount', 'payments');
  if n_sales <> 3 then
    raise exception 'ترحيل ٦٥ فشل: أعمدة sales الجديدة = % (المتوقع ٣)', n_sales;
  end if;

  select count(*) into n_pur
    from information_schema.columns
   where table_schema = 'public' and table_name = 'purchases'
     and column_name in ('paid_amount', 'due_amount', 'payments');
  if n_pur <> 3 then
    raise exception 'ترحيل ٦٥ فشل: أعمدة purchases الجديدة = % (المتوقع ٣)', n_pur;
  end if;

  select count(*) into n_bad
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('sales', 'purchases')
     and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
     and grantee in ('authenticated', 'anon');
  if n_bad <> 0 then
    raise exception 'ترحيل ٦٥ فشل: صلاحيات TRUNCATE/REFERENCES/TRIGGER لسه ممنوحة (%).', n_bad;
  end if;

  select count(*) into n_zero
    from public.sales
   where coalesce(grand_total, 0) > 0 and paid_amount = 0 and due_amount = 0;
  if n_zero <> 0 then
    raise exception 'ترحيل ٦٥ فشل: % فاتورة بيع بإجمالي > 0 ولسه مدفوعها/آجلها صفر.', n_zero;
  end if;

  raise notice 'ترحيل ٦٥ تمام: أعمدة المدفوع/الآجل/السطور على الجدولين + التعبئة القديمة + التحصين.';
end
$chk$;
