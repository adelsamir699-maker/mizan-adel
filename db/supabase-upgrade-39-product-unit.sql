-- ============================================================================
-- ترحيل ٣٩ — عمود «وحدة القياس» على جدول الأصناف (إصلاح خانة الوحدة الفاضية)
-- ----------------------------------------------------------------------------
-- المشكلة (رُمزت على بيانات حقيقية من جهاز الشركة):
--   جدول public.products مالوش عمود unit أصلًا (السخة الأصلية في supabase-schema.sql
--   بتعرّف: code / name_ar / name_en / barcode / category / الأسعار / الرصيد).
--   طبقة المزامنة (cloud.js) كانت بترجع من السحابة بـ unit:"" ثابت، فكل تحميل
--   بيتمسح الوحدة من الذاكرة ⇒ أسطر الفاتورة الجديدة بتتسجّل بوحدة فاضية،
--   وعمود «الوحدة» في فاتورة البيع/المشتريات يطلع فاضي على الورق.
--
-- الحل هنا:
--   1) add column unit text على products (نفس نمط ترحيل ٣١ اللي ضاف unit لأسطر الأصناف).
--   2) القيمة الافتراضية 'حبة' بس للسطور اللي ملهاش وحدة (الفراغ على الورق مرفوض).
--      المستخدم يعدّلها من «دليل الأصناف» لو صنفه بوحدة تانية — العمود اختياری للملا.
--   3) الكود بعتادى على العمود الجديد: cloud.js بيختبر وجوده مرة واحدة عند التحميل
--      (probeProductUnit) وبيبدأ يرفع له unit من أول جلسة بعد تنفيذ هذا الملف
--      — فما حاجة تانية اتغيرت في المزامنة ولا في أي جدول قديم.
--
-- ملاحظة: هذا الملف **لم يُنفَّذ** على السحابة بعد (قاعدة العمل: بلا رفع/تنفيذ
-- على Supabase إلا بأمر صريح من المالك). تنفيذها آمن للتكرار (IF NOT EXISTS).
-- ============================================================================
-- ✅ الحالة: نُفِّذ على السحابة 2026-10-02 (00:35) بأمر المالك الصريح
--    («أمر، نفذهم الثلاثة معًا») — السطر اللي فوق بقي قديم من يوم الكتابة.
--    من D:/_work/temp/apply_upgrade_39.js داخل transaction واحدة، والـ COMMIT
--    مشروط بفحوصات عدت كلها:
--      · products.unit = text + عليه تعليق توثيقي · المخطط 391 → 392 عمودًا (الزيادة الوحيدة)
--      · ولا صنف فضّل بلا وحدة: وحدة×8 + قطعه×3 (الـ 3 رجعت من أسطر الفواتير مش قيمة عشوائية)
--      · حصمة md5 لكل أعمدة products (عدا unit/bimestamps) متطابقة قبل = بعد
--        ⇒ مافيش صنف اتغير ولا اتشال · 431 سطر في 37 جدول = قبل وبعد
--      · الـ 61 دالة مطابقة حرفيًا · 88 قيد / 116 سياسة / 108 فهرس بلا تغيير
--    باك أب: قبل pre-mig42-38-39-20261002-0019 · بعد post-mig42-38-39-20261002-0037
-- ============================================================================

alter table public.products add column if not exists unit text;

-- سطر بلا وحدة = خانة فاضية على الفاتورة. نملّي الفراغ بقيمة محسوبة (وحدة عامة)
-- بدل الصمت: المستخدم يقدّر يغيّرها من دليل الأصناف لو عايز أدق.
update public.products
   set unit = 'وحدة'
 where unit is null or btrim(unit) = '';

-- تفضّلنا لو كانت القيم معروفة من الأسطر القديمة: أي سطر صنف في أي مستند
-- ليه وحدة مسجّلة (ترحيل ٣١) تترجّع للصنف نفسه بالاسم — أحسن من قيمة عامة.
with known as (
  select product_name, min(unit) as unit
    from (
      select product_name, unit from public.sale_items      where unit is not null and btrim(unit) <> ''
      union all
      select product_name, unit from public.purchase_items  where unit is not null and btrim(unit) <> ''
      union all
      select product_name, unit from public.sale_return_items     where unit is not null and btrim(unit) <> ''
      union all
      select product_name, unit from public.purchase_return_items where unit is not null and btrim(unit) <> ''
    ) s
   group by product_name
)
update public.products p
   set unit = k.unit
  from known k
 where p.name_ar = k.product_name
   and (p.unit is null or btrim(p.unit) = '' or p.unit = 'وحدة');

comment on column public.products.unit is
  'وحدة القياس المعروضة على الفاتورة والأسطر (ترحيل ٣٩) — كانت قبل كده محلية فقط وما بتترفعش للسحابة';

-- ---------------------------------------------------------------------------
-- فحص ذاتي: العمود موجود ومفيش صنف بفضّل بلا وحدة — وإلا فشل ظاهر
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'products'
                   and column_name = 'unit') then
    raise exception 'ترحيل ٣٩ فشل: عمود products.unit لم يُنشأ';
  end if;
  if exists (select 1 from public.products where unit is null or btrim(unit) = '') then
    raise exception 'ترحيل ٣٩ فشل: فيه صنف بفضّل بلا وحدة قياس';
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
