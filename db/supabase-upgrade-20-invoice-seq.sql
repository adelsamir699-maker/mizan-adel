-- ============================================================
-- Mizan — ترقية 20: تسلسل أرقام الفواتير لكل شركة (على السحابة)
--
-- الغرض:
--   رقم الفاتورة يبقى عدد صحيح يبدأ من ١ لكل شركة، بلا حروف، ولا يتكرر.
--   الحدّ الأعلى (high-water mark) يتحفظ على السحابة لكل شركة على حدة،
--   فلو البرنامج اشتغل على أكتر من جهاز لنفس الشركة الأرقام ما تتعارضش.
--
-- عزل الشركات:
--   مفتاح الجدول (org_id, kind). org_id هو id الشركة وهو UUID أساسي (PK)
--   في organizations (gen_random_uuid) — أي شركة جديدة ليها id فريد لا يتكرر
--   بطبيعة التوليد، فالتسلسل معزول تمامًا لكل شركة.
--   كل الدوال security definer وتقرأ current_org() من التوكن، فالعميل
--   لا يستطيع العبث بـ org_id شركة أخرى.
--
-- ⚠️ يُنفّذ على Supabase فقط بأمر المستخدم (وهنا أُذن بالتطبيق).
-- ============================================================

begin;

-- 1) جدول التسلسل لكل شركة/نوع فاتورة
create table if not exists public.mizan_invoice_seq (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  kind       text not null check (kind in ('sale', 'purchase')),
  last_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, kind)
);

-- عزل تام: RLS مفعّل ومافيش سياسات مباشرة — الوصول الوحيد من خلال الدوال أدناه.
alter table public.mizan_invoice_seq enable row level security;

-- 2) دالة: ارفع الحدّ الأعلى إلى greatest(الحالي, المُرسَل) — آمنة للتعدد
create or replace function public.mizan_bump_invoice_seq(p_kind text, p_value bigint)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v bigint;
  o uuid := public.current_org();
begin
  if o is null then return 0; end if;
  insert into public.mizan_invoice_seq (org_id, kind, last_value, updated_at)
    values (o, p_kind, greatest(coalesce(p_value,0), 1), now())
  on conflict (org_id, kind) do update
    set last_value = greatest(public.mizan_invoice_seq.last_value, excluded.last_value),
        updated_at = now()
  returning last_value into v;
  return v;
end $$;

-- 3) دالة: اقرأ الحدّ الأعلى لكل أنواع الفواتير بالشركة الحالية (للمعاينة/الاسترجاع)
create or replace function public.mizan_get_invoice_seq()
returns table (kind text, last_value bigint)
language sql stable security definer set search_path = public
as $$
  select s.kind, s.last_value
  from public.mizan_invoice_seq s
  where s.org_id = public.current_org();
$$;

-- 4) دالة ذرّية: احجز الرقم التالي وزوّد الحدّ (يُستخدم لو عايز ترقيم من الخادم مباشرة)
create or replace function public.mizan_next_invoice_no(p_kind text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v bigint;
  o uuid := public.current_org();
begin
  if o is null then return 1; end if;
  insert into public.mizan_invoice_seq (org_id, kind, last_value, updated_at)
    values (o, p_kind, 1, now())
  on conflict (org_id, kind) do update
    set last_value = public.mizan_invoice_seq.last_value + 1,
        updated_at = now()
  returning last_value into v;
  return v;
end $$;

-- 5) صلاحيات التنفيذ للمستخدم المسجّل فقط
grant execute on function public.mizan_bump_invoice_seq(text, bigint) to authenticated;
grant execute on function public.mizan_get_invoice_seq()              to authenticated;
grant execute on function public.mizan_next_invoice_no(text)          to authenticated;

-- منع استخدام المفتاح المجهول (anon) للدوال
revoke execute on function public.mizan_bump_invoice_seq(text, bigint) from anon;
revoke execute on function public.mizan_get_invoice_seq()              from anon;
revoke execute on function public.mizan_next_invoice_no(text)          from anon;

commit;

-- ============================================================
-- ملاحظة للتطبيق الآمن:
-- عند مسح بيانات الشركات (إبقاء البنية) لا تمسح جدول mizan_invoice_seq —
-- هو مصدر الحدّ الأعلى للأرقام. لو عايز ترجّع ترقيم شركة لـ ١ من الصفر،
-- احذف أسطر شركتها من mizan_invoice_seq فقط:
--   delete from public.mizan_invoice_seq where org_id = '<uuid الشركة>';
-- ============================================================
