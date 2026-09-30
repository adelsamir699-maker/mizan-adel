-- ترحيل ٣١ — تفاصيل أسطر الأصناف على السحابة (وحدة القياس + كود الصنف + خصم/ضريبة السطر)
--
-- المشكلة: جداول الأصناف الأربعة كانت بتخزن (product_id, product_name, qty, price, total) بس.
-- يعني الجهاز التاني اللي بينزّل الفاتورة بيشوف السطر من غير وحدة القياس ومن غير كود الصنف
-- ومن غير الخصم/الضريبة بتاعين السطر → الفاتورة بتطبع مختلفة عن جهاز الإدخال، وحساب الإجمالي
-- والربح بياخد أرقام ناقصة.
--
-- الحل: نفس الأعمدة اللي عندنا في المستندات الرئيسية (text/numeric)، بـ default 0 للفراغات.

alter table public.sale_items            add column if not exists unit     text;
alter table public.sale_items            add column if not exists code      text;
alter table public.sale_items            add column if not exists discount  numeric(14,2) not null default 0;
alter table public.sale_items            add column if not exists tax       numeric(14,2) not null default 0;

alter table public.purchase_items        add column if not exists unit     text;
alter table public.purchase_items        add column if not exists code      text;
alter table public.purchase_items        add column if not exists discount  numeric(14,2) not null default 0;
alter table public.purchase_items        add column if not exists tax       numeric(14,2) not null default 0;

alter table public.sale_return_items     add column if not exists unit     text;
alter table public.sale_return_items     add column if not exists code      text;
alter table public.sale_return_items     add column if not exists discount  numeric(14,2) not null default 0;
alter table public.sale_return_items     add column if not exists tax       numeric(14,2) not null default 0;

alter table public.purchase_return_items add column if not exists unit     text;
alter table public.purchase_return_items add column if not exists code      text;
alter table public.purchase_return_items add column if not exists discount  numeric(14,2) not null default 0;
alter table public.purchase_return_items add column if not exists tax       numeric(14,2) not null default 0;

select pg_notify('pgrst', 'reload schema');
