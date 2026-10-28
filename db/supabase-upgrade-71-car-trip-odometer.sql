-- ترقية ٦٣ — عدّاد البنزين والمسافة على رحلات سيارات المناديب.
-- ليه: بناء 262 بيسجّل «عدّاد أول الرحلة» و«عدّاد آخر الرحلة» ويحسب المسافة،
-- وشاشة «متابعة مناديب السيارات» لازم تشوف الأرقام دي من أي جهاز.
-- قبل كده الجدول `car_trips` مالوش أعمدة للعدّاد ⇒ الرقم كان بيفضل على جهاز اللي سجّله بس.
--
-- آمنة تمامًا: `add column if not exists` — لا تلمس صفًا واحدًا، ولا تضيف قيدًا،
-- والقراءات القديمة (اللي مالهاش عدّاد) تفضل NULL زي ما هي.
-- لا تُشغّل قبل موافقة المالك الصريحة.

alter table public.car_trips add column if not exists odo_start numeric;
alter table public.car_trips add column if not exists odo_end   numeric;
alter table public.car_trips add column if not exists km        numeric;

comment on column public.car_trips.odo_start is 'عدّاد البنزين أول الرحلة (كم) — بناء 262';
comment on column public.car_trips.odo_end   is 'عدّاد البنزين آخر الرحلة (كم) — بناء 262';
comment on column public.car_trips.km        is 'المسافة المقطوعة = odo_end − odo_start — بناء 262';

notify pgrst, 'reload schema';
