-- ============================================================================
-- ترحيل ٣٥ — تبويب «الحضور والانصراف» (بناء 115)
-- ----------------------------------------------------------------------------
-- 3 جداول جديدة فقط، بنفس نمط كل جداول ميزان:
--   id uuid pk  +  org_id (عزل الشركة عبر current_org())  +  local_id (رقم محلي ثابت)
--   مفتاح السطر السحابي = detUuid(table, local_id) في طبقة المزامنة (cloud.js)
--   ⇒ نفس درس ترحيل ٣٤: الهوية ثابتة، مفيش تكرار عَبر الأجهزة.
--
-- 1) public.employees    — بيانات الموظفين (كود/اسم/وظيفة/قسم/تليفون/تعيين/حالة/معرّف)
-- 2) public.attendance   — سجل الحضور: سطر واحد لكل موظف في كل يوم
--      unique (org_id, employee_id, att_date) يمنع التسجيل المزدوج من أي جهاز
-- 3) public.att_settings — مدة العمل لكل شركة: بداية/نهاية/سماح التأخير/فاصل (سطر واحد لكل شركة)
--
-- الصلاحيات: صلاحية مستقلة «attendance» (نفس نمط returnsManager):
--   المالك (سوبر أدمن) وصاحب الشركة (role=admin) لهما دائمًا؛ العضو لا يراها حتى تُفعَّل صريحًا.
-- سجل التعديلات: مizan_att_edit() — أي تعديل يدوي على سجل حضور/انصراف يمر من هنا،
--   فيُكتب في audit_logs الموجود (المستخدم/الوقت/القيمة القديمة/الجديدة/السبب) قبل التحديث.
--
-- لا يمسّ أي جدول/دالة/سياسة قائمة. تنفيذ هذا الملف آمن للتكرار (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) جدول الموظفين
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  local_id bigint,
  code text default '',              -- كود الموظف
  name_ar text not null,             -- اسم الموظف
  job_title text default '',         -- الوظيفة
  department text default '',        -- القسم
  phone text default '',             -- رقم الهاتف إن وجد
  hire_date date,                    -- تاريخ التعيين
  is_active boolean default true,    -- يعمل / متوقف
  badge text default '',             -- رقم/وسيلة تعريف الموظف لتسجيل الحضور
  notes text default '',
  deleted boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_employees_org on public.employees (org_id);
create unique index if not exists uq_employees_orglocal on public.employees (org_id, local_id) where local_id is not null;
create unique index if not exists uq_employees_badge on public.employees (org_id, lower(badge)) where badge <> '' and deleted is not true;

-- ---------------------------------------------------------------------------
-- 2) جدول الحضور والانصراف — سطر لكل موظف/يوم
--    الحالة: present|absent|late|mission|leave|permit|holiday
--    (حاضر/غائب/متأخر/مأمورية/إجازة/إذن/عطلة رسمية — العرض بالعربي في الواجهة)
--    late_min/early_min/work_min/ot_min محسوبة من النظام وقت التسجيل (أو عند التعديل المصرّح به)
--    auto_timed: الوقت أُخذ من النظام تلقائيًا (مش إدخال يدوي)
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  local_id bigint,
  employee_id bigint not null,           -- local_id الموظف (هوية ثابتة عبر الأجهزة)
  att_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present'
    constraint attendance_status_ok
    check (status in ('present','absent','late','mission','leave','permit','holiday')),
  late_min integer default 0,            -- مدة التأخير (بعد تجاوز فترة السماح)
  early_min integer default 0,           -- الانصراف المبكر
  work_min integer default 0,            -- ساعات العمل الفعلية
  ot_min integer default 0,              -- العمل الإضافي
  auto_timed boolean default true,
  note text default '',
  user_name text default '',             -- من سجّل العملية
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_attendance_org on public.attendance (org_id);
create index if not exists idx_attendance_date on public.attendance (org_id, att_date);
create index if not exists idx_attendance_emp on public.attendance (org_id, employee_id);
create unique index if not exists uq_attendance_orglocal on public.attendance (org_id, local_id) where local_id is not null;
create unique index if not exists uq_attendance_empday on public.attendance (org_id, employee_id, att_date);

-- ---------------------------------------------------------------------------
-- 3) إعدادات مدة العمل — سطر واحد لكل شركة
-- ---------------------------------------------------------------------------
create table if not exists public.att_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  local_id bigint,
  work_start time not null default '09:00',
  work_end time not null default '17:00',
  grace_min integer not null default 10,   -- مدة السماح بالتأخير
  lunch_min integer not null default 0,    -- فاصل الغداء (يُخصم من ساعات العمل)
  created_at timestamptz default now()
);

create index if not exists idx_att_settings_org on public.att_settings (org_id);
create unique index if not exists uq_att_settings_org on public.att_settings (org_id);
create unique index if not exists uq_att_settings_local on public.att_settings (org_id, local_id) where local_id is not null;

-- ---------------------------------------------------------------------------
-- 4) RLS: العزل الكامل — كل شركة ترى بياناتها فقط (نفس سياسات بقية الجداول)
-- ---------------------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.att_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['employees','attendance','att_settings']
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select using (org_id = public.current_org());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (org_id = public.current_org());', t, t);
    execute format('create policy %I_update on public.%I for update using (org_id = public.current_org());', t, t);
    execute format('create policy %I_delete on public.%I for delete using (org_id = public.current_org());', t, t);
  end loop;
end $$;

-- لا منح لـ anon إطلاقًا (درس ترقية 27: لا كتابة مباشرة مجهولة الهوية على القاعدة)
revoke all on public.employees from anon;
revoke all on public.attendance from anon;
revoke all on public.att_settings from anon;
revoke all on public.employees from public;
revoke all on public.attendance from public;
revoke all on public.att_settings from public;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.att_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 5) دالة التعديل اليدوي المسجَّل: mizan_att_edit
--    تمر من هنا كل «تعديلة» على سجل حضور/انصراف (تغيير وقت/حالة/ملاحظات) —
--    تُكتب القيمة القديمة والجديدة وسبب التعديل في audit_logs ثم يُنفَّذ التحديث.
--    الصلاحية: سوبر أدمن / صاحب الشركة (role=admin) / عضو مفعّلة له «attendance» صريحًا.
--    p_id = مفتاح السطر السحابي (uuid). القيم NULL = لا تغيّر هذا الحقل.
-- ---------------------------------------------------------------------------
create or replace function public.mizan_att_edit(
  p_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_status text,
  p_note text,
  p_late_min integer,
  p_early_min integer,
  p_work_min integer,
  p_ot_min integer,
  p_reason text
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid;
  v_name text;
  v_is_super boolean;
  v_role text;
  v_user_feat jsonb;
  v_org_feat jsonb;
  v_allowed boolean;
  v_att public.attendance;
  v_new public.attendance;
  v_old jsonb;
  v_diff jsonb;
  v_reason text;
begin
  select org_id, full_name, is_superadmin, role, coalesce(features,'{}'::jsonb)
    into v_org, v_name, v_is_super, v_role, v_user_feat
  from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'غير مصرح: لا توجد شركة مرتبطة بحسابك';
  end if;
  select coalesce(features,'{}'::jsonb) into v_org_feat
  from public.organizations where id = v_org;

  v_allowed := coalesce(v_is_super,false)
           or v_role = 'admin'
           or (v_user_feat->>'attendance') = 'true'
           or (v_org_feat->>'attendance') = 'true';
  if not v_allowed then
    raise exception 'غير مصرح: صلاحية «الحضور والانصراف» غير مفعّلة لحسابك';
  end if;

  select * into v_att from public.attendance where id = p_id and org_id = v_org;
  if not found then
    raise exception 'سجل الحضور المطلوب تعديله غير موجود';
  end if;

  if p_status is not null and p_status not in
     ('present','absent','late','mission','leave','permit','holiday') then
    raise exception 'حالة حضور غير معروفة';
  end if;
  if p_check_in is not null and p_check_out is not null and p_check_out < p_check_in then
    raise exception 'وقت الانصراف لا يصح أن يسبق وقت الحضور';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')), '');
  if v_reason is null then
    raise exception 'سبب التعديل مطلوب لتسجيله في سجل العمليات';
  end if;

  -- تطبيق التعديل (NULL = إبقاء القيمة الحالية)
  update public.attendance set
    check_in  = coalesce(p_check_in,  check_in),
    check_out = coalesce(p_check_out, check_out),
    status    = coalesce(p_status,    status),
    note      = coalesce(p_note,      note),
    late_min  = coalesce(p_late_min,  late_min),
    early_min = coalesce(p_early_min, early_min),
    work_min  = coalesce(p_work_min,  work_min),
    ot_min    = coalesce(p_ot_min,    ot_min),
    auto_timed = false,                -- أي تعديل يدوي يفقد السجل صفة «التلقائي»
    user_name = coalesce(nullif(trim(coalesce(user_name,'')),''), v_name),
    updated_at = now()
  where id = p_id and org_id = v_org
  returning * into v_new;

  -- إثبات التعديل في سجل العمليات audit_logs (بالمفتاح السحابي لسهولة التتبّع)
  v_old := jsonb_build_object(
    'check_in', v_att.check_in, 'check_out', v_att.check_out,
    'status', v_att.status, 'note', v_att.note,
    'late_min', v_att.late_min, 'early_min', v_att.early_min,
    'work_min', v_att.work_min, 'ot_min', v_att.ot_min);
  v_diff := jsonb_build_object(
    'check_in', v_new.check_in, 'check_out', v_new.check_out,
    'status', v_new.status, 'note', v_new.note,
    'late_min', v_new.late_min, 'early_min', v_new.early_min,
    'work_min', v_new.work_min, 'ot_min', v_new.ot_min);

  insert into public.audit_logs (org_id, ts, user_name, action, detail, local_id)
  values (
    v_org, now(), v_name, 'تعديل سجل حضور',
    jsonb_build_object(
      'attendance_id', p_id::text,
      'employee_id', v_new.employee_id,
      'att_date', v_new.att_date,
      'old', v_old,
      'new', v_diff,
      'reason', v_reason
    )::text,
    coalesce((select max(local_id)+1 from public.audit_logs where org_id = v_org), 1)
  );

  return 'تم';
end $$;

revoke all on function public.mizan_att_edit(uuid, timestamptz, timestamptz, text, text, integer, integer, integer, integer, text) from anon;
revoke all on function public.mizan_att_edit(uuid, timestamptz, timestamptz, text, text, integer, integer, integer, integer, text) from public;
grant execute on function public.mizan_att_edit(uuid, timestamptz, timestamptz, text, text, integer, integer, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) فحص ذاتي: الجدلات الثلاثة والسياسات والدالة موجودة وشغّالة — وإلا فشل ظاهر
-- ---------------------------------------------------------------------------
do $$
begin
  if (select count(*) from information_schema.tables where table_schema='public'
        and table_name in ('employees','attendance','att_settings')) <> 3 then
    raise exception 'ترحيل ٣٥ فشل: أحد الجدلات الثلاثة لم يُنشأ';
  end if;
  if (select count(*) from pg_policies where schemaname='public'
        and tablename in ('employees','attendance','att_settings')) <> 12 then
    raise exception 'ترحيل ٣٥ فشل: سياسات RLS غير مكتملة (المطلوب 12)';
  end if;
  if not exists (select 1 from pg_proc where proname='mizan_att_edit') then
    raise exception 'ترحيل ٣٥ فشل: دالة mizan_att_edit غير موجودة';
  end if;
end $$;
