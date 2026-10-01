-- ============================================================================
-- ترحيل ٣٧ — «سجل الأصول الثابتة» (مهمة 98 / بناء 117)
-- ----------------------------------------------------------------------------
-- جدول واحد جديد، بنفس نمط كل جداول ميزان (ونفس نمط ترحيل ٣٥ للموظفين):
--   id uuid pk  +  org_id (عزل الشركة عبر current_org())  +  local_id (رقم محلي ثابت)
--   مفتاح السطر السحابي = detUuid('fixed_assets', local_id) في طبقة المزامنة (cloud.js)
--   ⇒ الهوية ثابتة عبر الأجهزة، مفيش تكرار (درس ترحيل ٣٤/٣٥).
--
-- public.fixed_assets — بطاقة كل أصل ثابت:
--   name_ar      : اسم الأصل (مبنى المستودع / سيارة النقل / ماكينات الخياطة…)
--   asset_class  : 'noncurrent' = أصول غير متداولة (أراضٍ/مباني/معدات/سيارات)
--                  'intangible'  = أصول غير ملموسة (علامة تجارية/براءة اختراع/امتياز)
--                  ⇒ الاتنين بيغذّوا قسميهما في «قائمة المركز المالي» (مهمة 97)
--   category     : نوع الأصل للعرض والترتيب (أرض/مبنى/معدات/سيارة/أثاث/إلكترونيات/علامة/أخرى)
--   purchase_date: تاريخ الشراء،  cost: التكلفة،  accum_dep: الإهلاك التراكمي
--                  صافي الدفتر = cost − accum_dep (محسوب في الواجهة، مش مخزّن)
--
-- لا يمسّ أي جدول/دالة/سياسة قائمة، وما بيغيّرش شجرة الحسابات (الحسابات اختيارية
-- كما هي؛ السجل مصدر مستقل لقسم «غير المتداولة/غير الملموسة» في المركز المالي).
-- تنفيذ هذا الملف آمن للتكرار (IF NOT EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) جدول الأصول الثابتة
-- ---------------------------------------------------------------------------
create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  local_id bigint,
  name_ar text not null,                     -- اسم الأصل
  asset_class text not null default 'noncurrent'
    constraint fixed_assets_class_ok
    check (asset_class in ('noncurrent','intangible')),
  category text default 'أخرى',              -- النوع للعرض (عربي كما كتبه المستخدم)
  purchase_date date,                        -- تاريخ الشراء
  cost numeric(14,2) not null default 0      check (cost >= 0),
  accum_dep numeric(14,2) not null default 0 check (accum_dep >= 0),
  notes text default '',
  is_active boolean default true,            -- الأصل في الخدمة / اتشال
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_fixed_assets_org on public.fixed_assets (org_id);
create index if not exists idx_fixed_assets_class on public.fixed_assets (org_id, asset_class);
create unique index if not exists uq_fixed_assets_orglocal on public.fixed_assets (org_id, local_id) where local_id is not null;
-- منع تكرار اسم نفس الأصل في الشركة (المسحوب/المحذوف ما يدخلش)
create unique index if not exists uq_fixed_assets_name on public.fixed_assets (org_id, lower(btrim(name_ar)))
  where deleted is not true;

-- ---------------------------------------------------------------------------
-- 2) RLS: العزل الكامل — كل شركة ترى أصولها فقط (نفس سياسات بقية الجداول)
-- ---------------------------------------------------------------------------
alter table public.fixed_assets enable row level security;

drop policy if exists fixed_assets_select on public.fixed_assets;
drop policy if exists fixed_assets_insert on public.fixed_assets;
drop policy if exists fixed_assets_update on public.fixed_assets;
drop policy if exists fixed_assets_delete on public.fixed_assets;
create policy fixed_assets_select on public.fixed_assets for select using (org_id = public.current_org());
create policy fixed_assets_insert on public.fixed_assets for insert with check (org_id = public.current_org());
create policy fixed_assets_update on public.fixed_assets for update using (org_id = public.current_org());
create policy fixed_assets_delete on public.fixed_assets for delete using (org_id = public.current_org());

-- لا منح لـ anon إطلاقًا (درس ترقية 27: لا كتابة مباشرة مجهولة الهوية على القاعدة)
revoke all on public.fixed_assets from anon;
revoke all on public.fixed_assets from public;
grant select, insert, update, delete on public.fixed_assets to authenticated;

-- ---------------------------------------------------------------------------
-- 3) النسخ الاحتياطي السحابي: دوال التصدير/الاستيراد لازم تعرف الجدول الجديد
--    (نفس نمط ترحيل ٣٦ للحضور — التعديل الكامل للدوال الأربعة في ترحيل ٣٨)
-- ---------------------------------------------------------------------------
comment on table public.fixed_assets is
  'سجل الأصول الثابتة (مهمة 98) — يغذي قسمي «غير المتداولة» و«غير الملموسة» في قائمة المركز المالي';

-- ---------------------------------------------------------------------------
-- 4) فحص ذاتي: الجدول والسياسات موجودين وشغّالين — وإلا فشل ظاهر
-- ---------------------------------------------------------------------------
do $$
begin
  if (select count(*) from information_schema.tables where table_schema='public'
        and table_name = 'fixed_assets') <> 1 then
    raise exception 'ترحيل ٣٧ فشل: جدول fixed_assets لم يُنشأ';
  end if;
  if (select count(*) from pg_policies where schemaname='public'
        and tablename = 'fixed_assets') <> 4 then
    raise exception 'ترحيل ٣٧ فشل: سياسات RLS غير مكتملة (المطلوب 4)';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public'
        and indexname = 'uq_fixed_assets_orglocal') then
    raise exception 'ترحيل ٣٧ فشل: فهرس الهوية (org_id, local_id) غير موجود';
  end if;
end $$;
