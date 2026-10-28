-- ترقية ٦٢ — القيد الافتتاحي التلقائي للمخزون.
-- القاعدة: أي شركة تُستورد لها شيت «الأصناف» من Excel، يتكوّن لها قيد واحد:
--     مدين  المخزون (1.1.4)        بقيمة البضاعة بالتكلفة
--     دائن  رأس المال (3.1)        نفس القيمة
-- الضمانات:
--   • مرة واحدة لكل شركة — مفتاح ref_id = 'OPENINV'.
--   • ما يشتغلش لو قيمة المخزون = صفر (يعني الملف بلا أسعار شراء).
--   • ما يشتغلش لو فيه أي حركة بيع/شراء/مرتجع/تكلفة مبيعات (عشان ما يلخبطش التكلفة).
--   • لو أُعيد استيراد الأصناف قبل أي حركة ⇒ يحدّث نفس القيد بنفس رقمه (بلا تكرار).
--   • هوية القيد وأسطره بنفس بصمة العميل (mizan_excel_row_uuid) ⇒ ما يتكررش على أي جهاز.
-- لا تُشغّل قبل موافقة المالك الصريحة.

create or replace function public.mizan_admin_opening_inventory_journal(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric := 0;
  v_items integer := 0;
  v_stock public.accounts%rowtype;
  v_cap public.accounts%rowtype;
  v_existing public.journal_entries%rowtype;
  v_has boolean := false;
  v_moved boolean := false;
  v_entry_local bigint;
  v_entry_id uuid;
  v_jrn_no text;
  v_desc text;
  v_action text;
begin
  if not exists (select 1 from public.organizations where id = p_org_id) then
    return jsonb_build_object('action', 'skipped', 'reason', 'org', 'total', 0);
  end if;

  -- قيمة المخزون بنفس معادلة شاشة المركز المالي بالحرف (avgPriceOf):
  --   متوسط سعر الشراء، وإلا سعر الشراء.
  select coalesce(sum(coalesce(stock_qty, 0) *
                      coalesce(nullif(avg_purchase_price, 0), nullif(purchase_price, 0), 0)), 0),
         count(*) filter (where coalesce(stock_qty, 0) <> 0)
    into v_total, v_items
    from public.products
   where org_id = p_org_id;
  v_total := round(v_total, 2);

  if v_total <= 0 then
    return jsonb_build_object('action', 'skipped', 'reason', 'zero', 'total', v_total);
  end if;

  -- الحسابان: بالمطابقة الكاملة (كود + اسم) عشان الشجرة المكرّرة ما تلخبطش الاختيار
  select * into v_stock from public.accounts
   where org_id = p_org_id and code = '1.1.4'
   order by (coalesce(name_ar, '') like 'المخزون%') desc, local_id
   limit 1;
  select * into v_cap from public.accounts
   where org_id = p_org_id and code = '3.1'
   order by (coalesce(name_ar, '') = 'رأس المال') desc, local_id
   limit 1;

  if v_stock.id is null or v_cap.id is null then
    return jsonb_build_object('action', 'skipped', 'reason', 'accounts', 'total', v_total);
  end if;

  -- «فيه حركة» = بيع/شراء/مرتجع/تكلفة مبيعات. بعد كده ممنوع نلمس القيد.
  select exists (select 1 from public.sales          where org_id = p_org_id)
      or exists (select 1 from public.purchases      where org_id = p_org_id)
      or exists (select 1 from public.sale_returns   where org_id = p_org_id)
      or exists (select 1 from public.purchase_returns where org_id = p_org_id)
      or exists (select 1 from public.journal_entries
                  where org_id = p_org_id
                    and ref_type in ('تكلفة المبيعات', 'مرتجع تكلفة مبيعات'))
    into v_moved;

  select * into v_existing from public.journal_entries
   where org_id = p_org_id and ref_id = 'OPENINV'
   order by local_id
   limit 1;
  v_has := v_existing.id is not null;

  if v_moved then
    return jsonb_build_object('action', 'skipped', 'reason', 'locked',
                              'total', v_total, 'had_entry', v_has);
  end if;

  if v_has then
    -- تراجع أثر القيد القديم على أرصدة الحسابات قبل إعادة كتابته
    update public.accounts a
       set opening_debit  = coalesce(a.opening_debit, 0)  - coalesce(x.d, 0),
           opening_credit = coalesce(a.opening_credit, 0) - coalesce(x.c, 0)
      from (select l.account_id,
                   sum(coalesce(l.debit, 0))  as d,
                   sum(coalesce(l.credit, 0)) as c
              from public.journal_lines l
             where l.org_id = p_org_id and l.entry_id = v_existing.id
             group by l.account_id) x
     where a.org_id = p_org_id and a.local_id::text = x.account_id;

    delete from public.journal_lines
     where org_id = p_org_id and entry_id = v_existing.id;

    v_entry_id := v_existing.id;
    v_entry_local := coalesce(v_existing.local_id,
                              (select coalesce(max(local_id), 0) + 1
                                 from public.journal_entries where org_id = p_org_id));
    v_jrn_no := coalesce(v_existing.jrn_no,
                         'JRN-' || lpad(v_entry_local::text, 4, '0'));
    v_action := 'updated';
  else
    select coalesce(max(local_id), 0) + 1 into v_entry_local
      from public.journal_entries where org_id = p_org_id;
    v_entry_id := public.mizan_excel_row_uuid(p_org_id, 'journal_entries', v_entry_local);
    v_jrn_no := 'JRN-' || lpad(v_entry_local::text, 4, '0');
    v_action := 'created';
  end if;

  v_desc := 'قيد افتتاحي للمخزون — عدد الأصناف: ' || v_items::text || ' — القيمة ' ||
            to_char(v_total, 'FM999,999,999,990.00') || ' ج.م';

  insert into public.journal_entries
      (id, org_id, jrn_no, doc_date, ref_type, ref_id, description, local_id)
  values
      (v_entry_id, p_org_id, v_jrn_no, current_date,
       'قيد افتتاحي للمخزون', 'OPENINV', v_desc, v_entry_local)
  on conflict (id) do update
     set jrn_no      = excluded.jrn_no,
         doc_date    = excluded.doc_date,
         ref_type    = excluded.ref_type,
         ref_id      = excluded.ref_id,
         description = excluded.description,
         local_id    = excluded.local_id;

  insert into public.journal_lines
      (id, org_id, entry_id, account_id, account_name, debit, credit, local_id)
  values
      (public.mizan_excel_row_uuid(p_org_id, 'journal_lines', v_entry_local * 1000 + 1),
       p_org_id, v_entry_id, v_stock.local_id::text, v_stock.name_ar,
       v_total, 0, v_entry_local * 1000 + 1),
      (public.mizan_excel_row_uuid(p_org_id, 'journal_lines', v_entry_local * 1000 + 2),
       p_org_id, v_entry_id, v_cap.local_id::text, v_cap.name_ar,
       0, v_total, v_entry_local * 1000 + 2)
  on conflict (id) do update
     set account_id   = excluded.account_id,
         account_name = excluded.account_name,
         debit        = excluded.debit,
         credit       = excluded.credit,
         local_id     = excluded.local_id;

  update public.accounts
     set opening_debit = coalesce(opening_debit, 0) + v_total
   where org_id = p_org_id and local_id = v_stock.local_id;

  update public.accounts
     set opening_credit = coalesce(opening_credit, 0) + v_total
   where org_id = p_org_id and local_id = v_cap.local_id;

  return jsonb_build_object('action', v_action, 'total', v_total, 'items', v_items,
                            'entry_id', v_entry_id, 'entry_no', v_jrn_no);
end
$$;

revoke all on function public.mizan_admin_opening_inventory_journal(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mizan_admin_import_excel(p_org_id uuid, p_table text, p_mode text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_allowed text[];
  v_required text;
  v_has_local_id boolean;
  v_row jsonb;
  v_input jsonb;
  v_value jsonb;
  v_key text;
  v_clean_rows jsonb[] := array[]::jsonb[];
  v_record jsonb;
  v_columns text;
  v_values text;
  v_sql text;
  v_local_id bigint;
  v_next_local bigint := 0;
  v_removed integer := 0;
  v_inserted integer := 0;
  v_rows integer := 0;
  v_opening jsonb;
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and is_superadmin is true
  ) then
    raise exception 'غير مصرح — رفع Excel متاح لمالك البرنامج فقط';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'الشركة المختارة غير موجودة';
  end if;
  if p_mode is null or p_mode not in ('append', 'replace') then
    raise exception 'طريقة الرفع غير صحيحة';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'الملف غير صالح أو يحتوي على أكثر من ٥٠٠٠ صف';
  end if;

  case p_table
    when 'customers' then
      v_allowed := array['code','name_ar','name_en','phone','address','opening_balance','credit_limit','is_active'];
      v_required := 'name_ar';
    when 'suppliers' then
      v_allowed := array['code','name_ar','phone','address','opening_balance','current_balance','is_active'];
      v_required := 'name_ar';
    when 'products' then
      v_allowed := array['code','name_ar','name_en','barcode','category','unit','purchase_price','last_purchase_price','avg_purchase_price','sale_price','stock_qty','min_stock','is_active'];
      v_required := 'name_ar';
    when 'treasury' then
      v_allowed := array['name','type','account_no','opening_balance','balance','is_active'];
      v_required := 'name';
    when 'accounts' then
      v_allowed := array['code','name_ar','type','parent_id','opening_debit','opening_credit','balance','is_active'];
      v_required := 'name_ar';
    else
      raise exception 'هذا الجدول غير متاح للاستيراد من Excel';
  end case;

  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':' || p_table, 0));
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'local_id'
  ) into v_has_local_id;

  for v_input in select value from jsonb_array_elements(p_rows) as rows(value)
  loop
    if jsonb_typeof(v_input) <> 'object' then
      raise exception 'يوجد صف غير صالح في ملف Excel';
    end if;
    v_row := v_input - 'id' - 'org_id' - 'local_id' - 'created_at' - 'deleted';
    for v_key, v_value in select key, value from jsonb_each(v_row)
    loop
      if not (v_key = any(v_allowed)) then
        raise exception 'العمود % غير مسموح به في هذا الجدول', v_key;
      end if;
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = p_table and column_name = v_key
      ) then
        raise exception 'العمود % غير موجود في قاعدة البيانات الحالية', v_key;
      end if;
      if v_value = 'null'::jsonb or coalesce(v_value #>> '{}', '') = '' then
        v_row := v_row - v_key;
      end if;
    end loop;
    if (select count(*) from jsonb_object_keys(v_row)) = 0 then continue; end if;
    if not (v_row ? v_required) or coalesce(v_row->>v_required, '') = '' then
      raise exception 'هناك صف ينقصه الحقل المطلوب: %', v_required;
    end if;
    v_clean_rows := array_append(v_clean_rows, v_row);
  end loop;

  v_rows := coalesce(array_length(v_clean_rows, 1), 0);
  if v_rows = 0 then raise exception 'لم أجد صفوفًا صالحة للرفع'; end if;

  if v_has_local_id then
    execute format('select coalesce(max(local_id), 0) from public.%I where org_id = $1', p_table)
      into v_next_local using p_org_id;
  end if;

  if p_mode = 'replace' then
    if public.mizan_admin_excel_replace_has_references(p_org_id, p_table) then
      raise exception 'لا يمكن تفريغ هذا الجدول لأن بيانات موجودة مرتبطة به؛ لم يتغير أي سجل';
    end if;
    execute format('select count(*) from public.%I where org_id = $1', p_table)
      into v_removed using p_org_id;
    execute format('delete from public.%I where org_id = $1', p_table) using p_org_id;
  end if;

  foreach v_row in array v_clean_rows
  loop
    v_record := v_row;
    if p_table = 'products' and v_row ? 'stock_qty' then
      v_record := v_record || jsonb_build_object(
        'stock',
        case when (v_row->>'stock_qty')::numeric > 0
          then jsonb_build_object('المخزن الرئيسي', (v_row->>'stock_qty')::numeric)
          else '{}'::jsonb
        end
      );
    end if;
    if v_has_local_id then
      v_next_local := v_next_local + 1;
      v_record := v_record || jsonb_build_object(
        'id', public.mizan_excel_row_uuid(p_org_id, p_table, v_next_local),
        'org_id', p_org_id,
        'local_id', v_next_local
      );
    else
      v_record := v_row || jsonb_build_object('id', gen_random_uuid(), 'org_id', p_org_id);
    end if;

    select string_agg(format('%I', key), ', ' order by key),
           string_agg(format('x.%I', key), ', ' order by key)
      into v_columns, v_values
      from jsonb_object_keys(v_record) as keys(key);
    v_sql := format(
      'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) as x',
      p_table, v_columns, v_values, p_table
    );
    execute v_sql using v_record;
    v_inserted := v_inserted + 1;
  end loop;

  /* 🆕 ترقية ٦٢ — القيد الافتتاحي التلقائي للمخزون بعد أي استيراد لشيت الأصناف.
     يشتغل مرة واحدة لكل شركة (مفتاح OPENINV)، وما يشتغلش لو فيه حركة بيع/شراء،
     ولو أُعيد الاستيراد قبل أي حركة يحدّث نفس القيد بدل ما يكرّره. */
  if p_table = 'products' then
    v_opening := public.mizan_admin_opening_inventory_journal(p_org_id);
  else
    v_opening := null;
  end if;

  return jsonb_build_object(
    'table', p_table,
    'mode', p_mode,
    'inserted', v_inserted,
    'removed', v_removed
  ) || case when v_opening is null then '{}'::jsonb
            else jsonb_build_object('opening', v_opening) end;
end
$function$;

revoke all on function public.mizan_admin_import_excel(uuid, text, text, jsonb) from public, anon;
grant execute on function public.mizan_admin_import_excel(uuid, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
