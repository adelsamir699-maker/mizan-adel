-- ترقية ٦٣ — «مصدر السداد» على حركات العملاء والموردين (خزينة/وسيلة الدفع).
-- المرجع: طلب المالك (19/10): «خصم الخزينة عند حذف حركة السداد ده مش دقيق — المفروض يخصم من
-- الخزينة أو من الإنستا أو المحافظ أو من أي مكان استقبل السداد بقيد عكسي» ثم اختياره الحل
-- الجذري (الخيار ب): تسجيل مصدر السداد على الحركة نفسها ومزامنته سحابيًا.
--
-- المشكلة (مقاسة): `treasuryId`/`paymentMethod` كانوا بيتسجّلوا **محليًا على الجهاز بس**،
-- و`cloud.js` (customer_txs/supplier_txs) ما كانش بيبعتهما للسحابة ⇒ أي حركة نازلة من جهاز
-- تاني بقت بلا مصدر، وحذفها بيخمّن الخزينة من نص البيان (`reconcileTreasuryWithTxs`) أو
-- يسيب الرصيد زي ما هو لو مافيش سند على الجهاز — فالمبلغ ما يرجعش للخزينة الصح.
--
-- اللي بتعمله:
--   (١) أعمدة جديدة على customer_txs/supplier_txs:
--       • treasury_id   — رقم الخزينة المحلي كنص (نفس عرف vouchers.treasury_id)
--       • treasury_name — اسم الخزينة وقت السداد (احتياطي لو الخزينة اتحذفت/الأرقام اختلفت)
--       • payment_method — نقداً / بنك / محفظة / إنستا باي / شيك
--   (٢) تحصين صغير على نفس الجدولين: سحب TRUNCATE/REFERENCES/TRIGGER من authenticated
--       (قراءة/كتابة الصفوف مش محتاجاهم) — بدون أي مساس بسياسات RLS الحالية.
--   (٣) فحص ذاتي في الآخر.
--
-- ⚠️ لا تُشغّل قبل أمر المالك الصريح. بلا `begin/commit` (نمط ٦٢/٥٥/٥٤).

-- ============================================================
-- (١) أعمدة «مصدر السداد»
-- ============================================================
alter table public.customer_txs add column if not exists treasury_id    text;
alter table public.customer_txs add column if not exists treasury_name  text;
alter table public.customer_txs add column if not exists payment_method text;

alter table public.supplier_txs add column if not exists treasury_id    text;
alter table public.supplier_txs add column if not exists treasury_name  text;
alter table public.supplier_txs add column if not exists payment_method text;

comment on column public.customer_txs.treasury_id    is 'رقم الخزينة المحلي اللي استقبل التحصيل (نص، نفس عرف vouchers.treasury_id) — ترقية ٦٣.';
comment on column public.customer_txs.treasury_name  is 'اسم الخزينة وقت التحصيل — احتياطي لو الرقم اتغيّر/الخزينة اتحذفت — ترقية ٦٣.';
comment on column public.customer_txs.payment_method is 'وسيلة السداد (نقداً/بنك/محفظة/إنستا باي/شيك) — ترقية ٦٣.';
comment on column public.supplier_txs.treasury_id    is 'رقم الخزينة المحلي اللي خرج منه السداد (نص) — ترقية ٦٣.';
comment on column public.supplier_txs.treasury_name  is 'اسم الخزينة وقت السداد — احتياطي — ترقية ٦٣.';
comment on column public.supplier_txs.payment_method is 'وسيلة السداد (نقداً/بنك/محفظة/إنستا باي/شيك) — ترقية ٦٣.';

-- ============================================================
-- (٢) تحصين صغير على نفس الجدولين (بلا مساس بسياسات RLS)
-- ============================================================
revoke all on public.customer_txs from anon;
revoke all on public.supplier_txs from anon;
revoke all on public.customer_txs from public;
revoke all on public.supplier_txs from public;
revoke truncate, references, trigger on public.customer_txs from authenticated;
revoke truncate, references, trigger on public.supplier_txs from authenticated;
grant select, insert, update, delete on public.customer_txs to authenticated;
grant select, insert, update, delete on public.supplier_txs to authenticated;

-- ============================================================
-- (٣) فحص ذاتي
-- ============================================================
do $chk$
declare
  n_cust int;
  n_supp int;
  n_bad  int;
begin
  select count(*) into n_cust
    from information_schema.columns
   where table_schema = 'public' and table_name = 'customer_txs'
     and column_name in ('treasury_id', 'treasury_name', 'payment_method');
  if n_cust <> 3 then
    raise exception 'ترحيل ٦٣ فشل: أعمدة customer_txs الجديدة = % (المتوقع ٣)', n_cust;
  end if;

  select count(*) into n_supp
    from information_schema.columns
   where table_schema = 'public' and table_name = 'supplier_txs'
     and column_name in ('treasury_id', 'treasury_name', 'payment_method');
  if n_supp <> 3 then
    raise exception 'ترحيل ٦٣ فشل: أعمدة supplier_txs الجديدة = % (المتوقع ٣)', n_supp;
  end if;

  select count(*) into n_bad
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('customer_txs', 'supplier_txs')
     and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
     and grantee in ('authenticated', 'anon');
  if n_bad <> 0 then
    raise exception 'ترحيل ٦٣ فشل: صلاحيات TRUNCATE/REFERENCES/TRIGGER لسه ممنوحة (%).', n_bad;
  end if;

  raise notice 'ترحيل ٦٣ تمام: أعمدة مصدر السداد موجودة على الجدولين، والتحصين سليم.';
end
$chk$;
