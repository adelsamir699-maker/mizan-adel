-- ============================================================
-- ترحيل ٢٨ — وقت تسجيل حركة العميل + جعء الأسطر لها هوية ثابتة
-- ============================================================
-- (١) حركة العملاء (customer_txs) كانت الوحيدة بلا created_at، فأي جهاز تاني
--     بيشوف الحركة بتاريخ المستند بس من غير وقت التسجيل. supplier_txs عنده
--     العمود ده من زمان — هنا نجعل الشكلين واحدًا.
-- (٢) أسطر الأصناف والمرتجعات كانت بلا فهرس على الأب → حذف فاتورة/مرتجع
--     كان يعمل مسح كامل للجداول الكبيرة (seq scan).
-- آمن للتكرار (idempotent).

alter table public.customer_txs
  add column if not exists created_at timestamp with time zone default now();

-- الصفوف القديمة: أقرب وقت معروف هو تاريخ المستند نفسه (بلا ساعة)
update public.customer_txs
   set created_at = doc_date::timestamptz
 where created_at is null;

-- الحركات القديمة اللي حتى بلا تاريخ: نخليها وقت ما الجدول اتعمل (now)
update public.customer_txs set created_at = now() where created_at is null;

create index if not exists idx_customer_txs_org_created
  on public.customer_txs (org_id, created_at desc);

-- فهارس الأسطر بالأب (نفس نمط بقية الجداول)
create index if not exists idx_sale_items_sale
  on public.sale_items (sale_id);
create index if not exists idx_purchase_items_purchase
  on public.purchase_items (purchase_id);
create index if not exists idx_sale_return_items_return
  on public.sale_return_items (return_id);
create index if not exists idx_purchase_return_items_return
  on public.purchase_return_items (return_id);
