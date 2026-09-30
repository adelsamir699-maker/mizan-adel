-- ترحيل ٣٠ — ربط الفاتورة بالعميل/المورد على السحابة
--
-- المشكلة: جدول المبيعات بيعه «customer» (اسم النص) وبس، وجدول المشتريات «supplier» (اسم النص) بس.
-- يعني أي جهاز تاني بينزّل الفواتير بيشوف اسم العميل من غير رقمه، فكل حاجة بتعتمد على
-- customerId بتتعطل: المتاح للرجوع على فاتورة، تسجيل مرتجع جديد، وسم المرتجع على الفاتورة،
-- وفلترة كشوف الحساب بالفاتورة. (مرتجعات البناء الجديد بتخزن customer_id / supplier_id بالفعل.)
--
-- الحل: نفس الأعمدة لفواتير البيع والشراء. الأعمدة نصية (text) زي ما هو معمول في
-- customer_txs.customer_id و sale_returns.customer_id — والبرنامج بيحط فيها الرقم المحلي (local_id).
-- القيم القديمة (NULL) البرنامج بيربطها بالاسم أول ما ينزّل وبعدها يقفلها على السحابة.

alter table public.sales     add column if not exists customer_id text;
alter table public.purchases add column if not exists supplier_id  text;

comment on column public.sales.customer_id   is 'رقم العميل المحلي (local_id) — للربط بعد التنزيل على جهاز تاني';
comment on column public.purchases.supplier_id is 'رقم المورد المحلي (local_id) — للربط بعد التنزيل على جهاز تاني';

-- تنبيه PostgREST إن الـ catalog اتغيّر (عشان العمود الجديد يبقى متاح للـ API فورًا)
select pg_notify('pgrst', 'reload schema');
