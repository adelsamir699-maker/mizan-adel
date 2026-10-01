-- ============================================================
-- ترحيل ٤٢: حساب المالك (عادل / is_superadmin) يفضل مفتوح دائمًا
-- طلب المالك 2026-10-01: «عايز حساب عادل يكون بكل الصلاحيات دائمًا
--  ومفيش أي شاشة مقفولة عليه» + «الضبط الخاص بيا والنسخة الاحتياطية
--  يظهرا فورًا ومتخفيهمش تاني نهائي».
--
-- الغلط اللي بيتصلّح: mizan_access كان بيرجع allowed=false لأي حساب
--  شركة مقفولة أو منتهية — بما فيهم المالك نفسه. يعني لو عادل قفل
--  شركته بالخطأ أو حط تاريخ انتهاء لشركته، هو نفسه يتقفل بره برنامجه
--  ومافيش شاشة ولا نسخ احتياطي. كمان blocked بيقفل المالك لو هو عملها
--  لحسابه (مستحيل يرجّعها لنفسه).
--
-- القرار: استثناء صريح لصاحب is_superadmin من قفل الشركة/الاشتراك/الحجب.
-- ملاحظات أمان مهمة:
--  • ده استثناء على «الواجهة والوقت والقفل» بس. مافيش أي قراءة/كتابة
--    بتتجاوز عزل الشركات: RLS على current_org() فاضلة زي ما هي، والمالك
--    ما يشوفش بيانات شركة غيرها إلا من دوال المالمصرّحة (mizan_admin_*).
--  • باقي الحسابات: نفس السلوك بالحرف (allowed/reason/features).
--  • نفس عدد الأعمدة وترتيبها (13) عشان data.js/accessInfo ما يتكسروش.
-- ============================================================

-- ============================================================
-- ✅ الحالة: نُفِّذ على السحابة 2026-10-02 (00:26) بأمر المالك الصريح
--    («أمر، نفذهم الثلاثة معًا»). مُنفَّذ من D:/_work/temp/apply_upgrade_42.js
--    داخل transaction واحدة، والـ COMMIT مشروط بفحوصات كلها عدت (لو واحد فشل = ROLLBACK):
--      · التعريف الجديد فيه استثناء المالك: allowed=true و reason='ok' قبل أي قفل/انتهاء/حجب
--      · توقيع الدالة = 13 عمودًا بنفس الترتيب ⇒ data.js / accessInfo ما اتكسروش
--      · المنح: authenticated execute · service_role · owner — ولا منح لـ anon
--      · باقي 60 دالة مطابقة حرفيًا (المُغيَّر محصور في mizan_access وحدها)
--      · المخطط ثابت: 391 عمود / 88 قيد / 61 دالة / 116 سياسة / 108 فهرس
--      · 431 سطر في 37 جدول = قبل وبعد (ولا سطر اتلمس)
--    إثبات سلوكي (قراءة فقط) في D:/_work/temp/test_owner_access_42.js:
--      · 7 حسابات على القاعدة ⇒ ردّ السيرفر = المتوقع في 7/7
--      · adel@mizan.app (المالك) ⇒ allowed=true reason=ok
--      · elmagd و mohamed (شركة المجد، انتهت 2026-09-30) ⇒ allowed=false reason=plan
--        ⇒ بقية الحسابات سلوكها القديم حرفيًا، وعزل الشركات ما اتغيرش
--    وإثبات «الحصانة» في D:/_work/temp/test_owner_lockout_42.js: قفلنا شركة المالك
--    عمدًا (locked=true + plan_status=expired + plan_end=أمس) داخل معاملة ⇒ الدالة رجّعت
--    allowed=true، وبعدها ROLLBACK والصف رجع locked=false / active / plan_end=null (بلا أثر).
--    النسخ الاحتياطية: قبل pre-mig42-38-39-20261002-0019 · بعد post-mig42-38-39-20261002-0037
-- ============================================================

drop function if exists public.mizan_access();
create or replace function public.mizan_access()
returns table (
  allowed boolean,
  reason text,
  role text,
  org_id uuid,
  org_name text,
  plan_start date,
  plan_end date,
  locked boolean,
  blocked boolean,
  is_superadmin boolean,
  features jsonb,
  org_max_members integer,
  org_members_count bigint
) language sql stable security definer set search_path = public
as $$
  select
    -- 🔓 المالك: مافيش قفل شركة، مافيش انتهاء اشتراك، مافيش حجب يقفله بره برنامجه
    case when p.id is null then false
         when p.is_superadmin is true then true
         when p.blocked is not true
           and o.id is not null and o.locked is not true
           and o.plan_status = 'active'
           and (o.plan_end is null or o.plan_end >= current_date)
         then true else false end,
    case when p.id is null then 'noprofile'
         when p.is_superadmin is true then 'ok'
         when p.blocked then 'blocked'
         when o.id is null then 'noorganization'
         when o.locked then 'locked'
         when o.plan_status <> 'active' or (o.plan_end is not null and o.plan_end < current_date) then 'plan'
         else 'ok' end,
    p.role, o.id, o.name, o.plan_start, o.plan_end, o.locked, p.blocked, p.is_superadmin,
    coalesce(p.features, '{}'::jsonb) || coalesce(o.features, '{}'::jsonb),
    coalesce(o.max_members, 5),
    (select count(*) from public.profiles pc where pc.org_id = p.org_id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.organizations o on o.id = p.org_id
  where u.id = auth.uid();
$$;

grant execute on function public.mizan_access() to authenticated;
revoke all on function public.mizan_access() from anon;

-- فحص بعد التنفيذ (قراءة فقط): نفس الناتج القديم لغير المالك، و open للمالك
-- select p.email, p.is_superadmin, o.locked, o.plan_end,
--        (case when p.is_superadmin then 'expected open' else 'expected same as before' end) note
--   from public.profiles p join public.organizations o on o.id = p.org_id;
