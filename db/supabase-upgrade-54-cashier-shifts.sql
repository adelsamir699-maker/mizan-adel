-- ============================================================================
-- ترحيل ٥٤ — «ورديات الكاشير» (بناء 177)
-- ----------------------------------------------------------------------------
-- النسخة القانونية في db-admin (سجل قاعدة البيانات) — والنسخة الحرفية داخل حزمة النشر
-- في mizan-web/db/supabase-upgrade-54-cashier-shifts.sql (لأن DEPLOY_DB_FILES بيقرأها من هناك).
--
-- جدول واحد جديد، بنفس نمط كل جداول ميزان (ونفس نمط ترحيل ٣٧ للأصول الثابتة):
--   id uuid pk  +  org_id (عزل الشركة عبر current_org())  +  local_id (رقم محلي ثابت)
--   مفتاح السطر السحابي = detUuid('cashier_shifts', local_id) في طبقة المزامنة (cloud.js)
--   ⇒ الهوية ثابتة عبر الأجهزة، مفيش تكرار (درس ترحيل ٣٤/٣٥).
--
-- public.cashier_shifts — جلسة استعمال صندوق (خزينة نقدية) لِكاشير:
--   cashier_id / cashier_name / cashier_key : هوية الكاشير (id ثم الاسم)
--   treasury_id / treasury_name             : الصندوق (خزينة type=cash) اللي الوردية شغّالة عليه
--   opened_at / opening_float               : وقت الفتح + الرقاقة الافتتاحية (تُحفظ كسند قبض)
--   status                                  : 'open' مفتوحة / 'closed' مقفولة / 'settled' مسوّاة
--   closed_at / closed_by                   : وقت ومين قفل (الإغلاق بأمر فقط، مش بالوقت)
--   expected_cash / counted_cash / difference: المتوقّع من رصيد الصندوق / المعدود (عدّ أعمى اختياري) / الفرق
--   denoms                                  : jsonb — عدّ الفئات (اختياري)
--   settled_at / settled_by / main_treasury_id / settled_amount : التسليم للخزينة الرئيسية (بصلاحية مدير)
--   breakdown                               : jsonb — ملخّص وسائل الدفع (نقد/بنك/محفظة/آجل)
--   notes / deleted / created_at / updated_at
--
-- لا يمسّ أي جدول/دالة/سياسة قائمة. تنفيذ هذا الملف آمن للتكرار (IF NOT EXISTS).
--
-- ⚠️ ملاحظة النسخ الاحتياطي السحابي (مؤجَّل عمدًا): الجدول **لسه مش** داخل دوال النسخ الأربعة
--    (mizan_admin_backup_full/mizan_admin_restore_full/mizan_client_export/mizan_client_restore)
--    ولا داخل FULL_RESTORE_TABLES في الواجهة — نفس الوضع اللي كان فيه fixed_assets بين ترحيلي
--    ٣٧ و٣٨. اللحظة اللي تُطلب فيها إضافته للنسخ تُكتب ترقية منفصلة تعدّل الدوال الأربعة (نمط ٣٨).
--
-- ----------------------------------------------------------------------------
-- ✅ الحالة: **نُفّذت على القاعدة الحيّة 18/10** بأمر المالك الصريح.
-- 📏 القياس الحيّ بعدها (قراءة فقط — `D:/_work/temp/ro_doc57.js`): جدول `cashier_shifts`
--    موجود بـ **26 عمود** · `relrowsecurity = 1` · **4 سياسات** RLS · **1 سطر** بيانات.
--    المخطط الكلي: 420 عمود / 93 قيد / 71 دالة / 115 سياسة / 108 فهرس / 37 جدول.
-- ⛔ ما تتشغّلش تاني إلا بأمر المالك الصريح (الملف idempotent فمش بيرفض نفسه).
--    أي تعديل لاحق = ملف **٥٨**.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) جدول ورديات الكاشير
-- ---------------------------------------------------------------------------
create table if not exists public.cashier_shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  local_id bigint,
  cashier_id text default '',                -- معرّف الكاشير (user_id/username)
  cashier_name text default '',              -- اسم الكاشير للعرض
  cashier_key text default '',               -- مفتاح المطابقة (id وإلا الاسم)
  treasury_id bigint,                        -- رقم الصندوق المحلي (خزينة type=cash)
  treasury_name text default '',
  opened_at text default '',                 -- ISO محلي بلا منطقة زمنية (نمط مستندات ميزان)
  opening_float numeric(14,2) not null default 0,  -- الرقاقة الافتتاحية
  status text not null default 'open'
    constraint cashier_shifts_status_ok
    check (status in ('open','closed','settled')),
  closed_at text,
  closed_by text,
  expected_cash numeric(14,2),               -- المتوقّع (رصيد الصندوق لحظة الإغلاق)
  counted_cash numeric(14,2),                -- المعدود فعليًا
  difference numeric(14,2),                  -- counted − expected (سالب = عجز)
  denoms jsonb,                              -- عدّ الفئات (اختياري)
  notes text default '',
  settled_at text,
  settled_by text,
  main_treasury_id bigint,                   -- الخزينة الرئيسية المستلَم إليها
  settled_amount numeric(14,2),
  breakdown jsonb,                           -- ملخّص وسائل الدفع
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cashier_shifts_org on public.cashier_shifts (org_id);
create index if not exists idx_cashier_shifts_status on public.cashier_shifts (org_id, status);
create unique index if not exists uq_cashier_shifts_orglocal on public.cashier_shifts (org_id, local_id) where local_id is not null;

-- ---------------------------------------------------------------------------
-- 2) RLS: العزل الكامل — كل شركة ترى وردياتها فقط (نفس سياسات بقية الجداول)
-- ---------------------------------------------------------------------------
alter table public.cashier_shifts enable row level security;

drop policy if exists cashier_shifts_select on public.cashier_shifts;
drop policy if exists cashier_shifts_insert on public.cashier_shifts;
drop policy if exists cashier_shifts_update on public.cashier_shifts;
drop policy if exists cashier_shifts_delete on public.cashier_shifts;
create policy cashier_shifts_select on public.cashier_shifts for select using (org_id = public.current_org());
create policy cashier_shifts_insert on public.cashier_shifts for insert with check (org_id = public.current_org());
create policy cashier_shifts_update on public.cashier_shifts for update using (org_id = public.current_org());
create policy cashier_shifts_delete on public.cashier_shifts for delete using (org_id = public.current_org());

-- لا منح لـ anon إطلاقًا (درس ترقية 27: لا كتابة مباشرة مجهولة الهوية على القاعدة)
revoke all on public.cashier_shifts from anon;
revoke all on public.cashier_shifts from public;
grant select, insert, update, delete on public.cashier_shifts to authenticated;

comment on table public.cashier_shifts is
  'ورديات الكاشير (بناء 177) — جلسة استعمال صندوق نقدي: رقاقة افتتاحية + بيع نقدي + إغلاق بعدّ + تسليم للخزينة الرئيسية';

-- ---------------------------------------------------------------------------
-- 3) فحص ذاتي: الجدول والسياسات موجودين وشغّالين — وإلا فشل ظاهر
-- ---------------------------------------------------------------------------
do $$
begin
  if (select count(*) from information_schema.tables where table_schema='public'
        and table_name = 'cashier_shifts') <> 1 then
    raise exception 'ترحيل ٥٤ فشل: جدول cashier_shifts لم يُنشأ';
  end if;
  if (select count(*) from pg_policies where schemaname='public'
        and tablename = 'cashier_shifts') <> 4 then
    raise exception 'ترحيل ٥٤ فشل: سياسات RLS غير مكتملة (المطلوب 4)';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public'
        and indexname = 'uq_cashier_shifts_orglocal') then
    raise exception 'ترحيل ٥٤ فشل: فهرس الهوية (org_id, local_id) غير موجود';
  end if;
end $$;
