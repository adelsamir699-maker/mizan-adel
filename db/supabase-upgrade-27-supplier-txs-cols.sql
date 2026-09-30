-- ============================================================
-- ترحيل ٢٧ — بناء ١٠٨ (المرتجعات): أعمدة الحركة بالتفصيل لحركات المورد
-- ============================================================
-- المشكلة: جدول supplier_txs كان بيخزّن amount فقط (رقم واحد) بدون debit/credit/description،
-- فأي حركة مرتجع مشتريات (دائن) بترجع بعد إعادة التحميل من السحابة كحركة مديونية (مدين) —
-- يعني رصيد المورد بيتقلب بدل ما ينقص. customer_txs عنده الأعمدة الثلاثة فعلًا.
-- الحل: نفس شكل customer_txs بالظبط، مع تحويل الصفوف القديمة (amount → debit أو credit).
-- آمنة للتكرار (idempotent).

alter table public.supplier_txs
  add column if not exists description text,
  add column if not exists debit numeric default 0,
  add column if not exists credit numeric default 0;

-- الصفوف القديمة اللي عليها amount بس: المرتجع يبقى دائن، وغيره يفضل مدين
update public.supplier_txs
   set debit = coalesce(amount, 0)
 where coalesce(debit, 0) = 0
   and coalesce(credit, 0) = 0
   and coalesce(amount, 0) <> 0
   and coalesce(type, '') not like '%مرتجع%';

update public.supplier_txs
   set credit = coalesce(amount, 0)
 where coalesce(debit, 0) = 0
   and coalesce(credit, 0) = 0
   and coalesce(amount, 0) <> 0
   and coalesce(type, '') like '%مرتجع%';

-- الوصف القديم كان بيضيع: ننسخ الـ type في الـ description للصفوف الفاضية
update public.supplier_txs
   set description = coalesce(type, '')
 where description is null or description = '';

-- فهرس يظبط التحميل بالكود (نفس نمط customer_txs)
create index if not exists idx_supplier_txs_org_date on public.supplier_txs (org_id, doc_date);
