-- ============================================================
-- Mizan — ترقية 19: أساس تعدد الأجهزة (Offline-First المرحلة ٣)
--
-- الغرض:
--   تمهيد القاعدة لهوية سجل آمنة عبر الأجهزة + حل تعارض last-write-wins
--   + حذف ناعم (tombstone). هذه الترقية تضيف الأعمدة والفهرس/الـ trigger
--   اللازمة، لكنها **لا تغيّر سلوك العميل بمفردها** — لازم تتطبّق بالتزامن
--   مع إطلاق كود العميل ٣B/٣C (cloud.js: onConflict:"id" + soft-delete).
--
-- ⚠️⚠️ تم التجهيز للحفظ المحلي فقط — لا يُنفَّذ على Supabase إلا بأمر صريح
--      من المستخدم، وبالتزامن مع نشر كود ٣B/٣C. تطبيقها منفردةً (أو نشر
--      ٣B قبلها) يكسر المزامنة.
--
-- ملاحظات تصميمية:
--   * local_id كان هو هوية المزامنة (unique org_id,local_id). في ٣B تصبح
--     الهوية هي id (uuid مولّد من العميل)، فنفهرس (org_id,local_id) يتحوّل
--     من UNIQUE إلى عادي (local_id بقى رقم عرض غير فريد عبر الأجهزة).
--   * updated_at default now() يضمن أن الصفوف القديمة/العميل القديم لها
--     قيمة أساس، فلا يفشل الـ upsert أثناء الفترة الانتقالية.
--   * trigger mizan_lww_guard يرفض الكتابة الأقدم (NEW.updated_at < OLD)
--     بإرجاع OLD — أي أن أحدث تعديل فقط هو اللي يكسب.
-- ============================================================

begin;

-- ---------- 1) دالة حارس last-write-wins ----------
create or replace function public.mizan_lww_guard()
returns trigger
language plpgsql
as $$
begin
  -- لو الكتابة الواردة أقدم من الموجودة → تجاهلها واحتفظ بالقديمة.
  -- (null = عميل قديم لم يرسل updated_at → لا نمنعه، يمرّر الكتابة.)
  if new.updated_at is not null
     and old.updated_at is not null
     and new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end;
$$;

-- ---------- 2) أعمدة + حارس + فهرس لكل جدول بيانات ----------
do $$
declare
  tables text[] := array[
    'customers', 'suppliers', 'products',
    'sales', 'sale_items',
    'purchases', 'purchase_items',
    'supplier_txs', 'customer_txs',
    'treasury', 'vouchers', 'accounts',
    'journal_entries', 'journal_lines'
  ];
  t text;
begin
  foreach t in array tables loop
    -- أعمدة المزامنة الجديدة (idempotent)
    execute format('alter table public.%I add column if not exists updated_at timestamptz default now();', t);
    execute format('alter table public.%I add column if not exists device_id text;', t);
    execute format('alter table public.%I add column if not exists rev bigint default 0;', t);
    execute format('alter table public.%I add column if not exists deleted boolean default false;', t);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz;', t);

    -- backfill: أي صف بلا updated_at ياخد قيمته الأساسية
    execute format('update public.%I set updated_at = now() where updated_at is null;', t);

    -- حارس last-write-wins (BEFORE UPDATE)
    execute format('drop trigger if exists %I_lww_guard on public.%I;', t, t);
    execute format(
      'create trigger %I_lww_guard before update on public.%I
         for each row execute function public.mizan_lww_guard();',
      t, t
    );

    -- فهرس لدعم الحذف الناعم/الاستعلام حسب updated_at (اختياري لكن مفيد)
    execute format('create index if not exists %I_updated_at_idx on public.%I (updated_at);', t, t);
  end loop;
end $$;

-- ---------- 3) تحويل (org_id, local_id) من UNIQUE إلى عادي ----------
-- ⚠️ جزء من إطلاق ٣B: بعد توحيد الهوية على id (uuid)، local_id لم يعد
--    فريدًا عبر الأجهزة. الإبقاء على UNIQUE كان يسبب تصادم/overwrite.
--    نفهرس UNIQUE يُسقط ويُستبدل بفهرس عادي (للأداء) غير فريد.
--    ملاحظة: إسقاطه قبل نشر ٣B (onConflict:"id") يكسر upsert الحالي
--    (onConflict:"org_id,local_id") — لذلك الهجرة والعميل يُطلقان معًا.
do $$
declare
  idx text[] := array[
    'uq_customers_orglocal', 'uq_suppliers_orglocal', 'uq_products_orglocal',
    'uq_sales_orglocal', 'uq_sale_items_orglocal',
    'uq_purchases_orglocal', 'uq_purchase_items_orglocal',
    'uq_supplier_txs_orglocal', 'uq_customer_txs_orglocal',
    'uq_treasury_orglocal', 'uq_vouchers_orglocal', 'uq_accounts_orglocal',
    'uq_journal_orglocal', 'uq_jrn_lines_orglocal'
  ];
  i text;
begin
  foreach i in array idx loop
    execute format('drop index if exists public.%I;', i);
  end loop;
end $$;

-- فهارس عادية (غير فريدة) على (org_id, local_id) للأداء بعد إسقاط UNIQUE
do $$
declare
  tables text[] := array[
    'customers', 'suppliers', 'products',
    'sales', 'sale_items', 'purchases', 'purchase_items',
    'supplier_txs', 'customer_txs', 'treasury', 'vouchers',
    'accounts', 'journal_entries', 'journal_lines'
  ];
  t text;
begin
  foreach t in array tables loop
    execute format('create index if not exists %I_org_local_idx on public.%I (org_id, local_id);', t, t);
  end loop;
end $$;

commit;

-- ============================================================
-- للتراجع (rollback) — يُنفَّذ يدويًا فقط لو لزم:
--   drop trigger if exists <t>_lww_guard on public.<t>;  (لكل جدول)
--   drop function if exists public.mizan_lww_guard();
--   drop index if exists public.<t>_updated_at_idx / <t>_org_local_idx;
--   إعادة إنشاء uq_<t>_orglocal unique index (org_id, local_id);
--   (الأعمدة الجديدة يمكن إبقاؤها بلا ضرر، أو drop column if exists ...)
-- ============================================================
