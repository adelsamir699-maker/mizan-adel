-- ترحيل ٢٩ — أسطر الأصناف والأسطر المحاسبية: هوية السطر بقت «رقم أبوه السحابي + ترتيبه جوه أبوه»
--
-- السبب: المزامنة الجديدة بتعمل upsert على (id) مش على (org_id, local_id)، لأن إعادة كتابة
-- الـ id كانت بتيتّم السطور وبنقل سطور لفواتير تانية. القيد الفريد القديم على
-- (org_id, local_id) كان بيرفض أي سطر جديد مركّب رقمه → الفشل بيوقع الدفعة كلها
-- (upsert ذرّي) وبيضيع الشغل كله في الطلب ده، والشعار بيكتفي بـ console.warn.
--
-- الحل: إسقاط القيد الفريد من جداول السطور الخمسة، والاستعاضة عنه بفهرس بحث عادي.
-- ملاحظة: جداول المستندات نفسها (sales / purchases / sale_returns / purchase_returns /
-- journal_entries) لسه محتفظة بقيد (org_id, local_id) الفريد — مزامنتها شغّالة عليه.

-- ١) مؤشرات فريدة قديمة بصيغة «فهرس» (indexes)
drop index if exists public.uq_sale_items_orglocal;
drop index if exists public.uq_purchase_items_orglocal;
drop index if exists public.uq_jrn_lines_orglocal;

-- ٢) قيود فريدة (constraints) — إسقاطها من الجدول مش من الفهرس
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'sale_return_items_org_id_local_id_key') then
    alter table public.sale_return_items drop constraint sale_return_items_org_id_local_id_key;
  end if;
  if exists (select 1 from pg_constraint where conname = 'purchase_return_items_org_id_local_id_key') then
    alter table public.purchase_return_items drop constraint purchase_return_items_org_id_local_id_key;
  end if;
end $$;

-- ٣) فهارس بحث (غير فريدة) على (org_id, local_id) — بنفس التغطية القديمة
create index if not exists idx_sale_items_org_local
  on public.sale_items (org_id, local_id);
create index if not exists idx_purchase_items_org_local
  on public.purchase_items (org_id, local_id);
create index if not exists idx_journal_lines_org_local
  on public.journal_lines (org_id, local_id);
create index if not exists idx_sale_ret_items_org_local
  on public.sale_return_items (org_id, local_id);
create index if not exists idx_purchase_ret_items_org_local
  on public.purchase_return_items (org_id, local_id);
