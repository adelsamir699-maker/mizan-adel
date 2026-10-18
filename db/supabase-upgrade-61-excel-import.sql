-- ترقية ٦١ — استيراد Excel آمن ومحصور بشركة يختارها مالك البرنامج.
-- لا تُشغّل قبل موافقة المالك الصريحة. لا يوجد حذف إلا عند اختيار replace صراحةً،
-- ووقتها يُرفض التفريغ إذا كان سيكسر روابط بيانات مالية أو تشغيلية قائمة.
-- الجداول المسموح بها هي جداول البيانات الرئيسية فقط؛ الفواتير والقيود والحركات
-- لا تُستورد مباشرة لأنها تحتاج ترحيلًا محاسبيًا متكاملًا.

create or replace function public.mizan_excel_hash32(p_text text)
returns bigint
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_hash bigint := 2166136261;
  v_i integer;
begin
  for v_i in 1..length(p_text) loop
    v_hash := (v_hash # ascii(substr(p_text, v_i, 1))) % 4294967296;
    v_hash := (v_hash * 16777619) % 4294967296;
  end loop;
  return v_hash;
end
$$;

create or replace function public.mizan_excel_row_uuid(p_org uuid, p_table text, p_local_id bigint)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_org text := p_org::text;
  v_a text;
  v_b text;
  v_c text;
  v_tail text;
begin
  v_a := lpad(to_hex(public.mizan_excel_hash32(v_org)), 8, '0');
  v_b := lpad(to_hex(public.mizan_excel_hash32(v_org || ':' || p_table)), 8, '0');
  v_c := lpad(to_hex(public.mizan_excel_hash32(v_org || ':' || p_table || ':' || p_local_id::text)), 8, '0');
  v_tail := right(lpad(to_hex(p_local_id), 12, '0'), 12);
  return (v_a || '-' || substr(v_b, 1, 4) || '-4' || substr(v_b, 5, 3) || '-' ||
    substr(v_c, 1, 4) || '-' || v_tail)::uuid;
end
$$;

create or replace function public.mizan_admin_excel_replace_has_references(p_org_id uuid, p_table text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if p_table = 'customers' then
    return exists (
      select 1 from public.customer_txs x join public.customers t
        on t.org_id = x.org_id and x.customer_id = t.local_id::text
      where t.org_id = p_org_id
    ) or exists (
      select 1 from public.sales x join public.customers t
        on t.org_id = x.org_id and (x.customer_id = t.local_id::text or x.customer = t.name_ar)
      where t.org_id = p_org_id
    );
  elsif p_table = 'suppliers' then
    return exists (
      select 1 from public.supplier_txs x join public.suppliers t
        on t.org_id = x.org_id and x.supplier_id = t.local_id::text
      where t.org_id = p_org_id
    ) or exists (
      select 1 from public.purchases x join public.suppliers t
        on t.org_id = x.org_id and (x.supplier_id = t.local_id::text or x.supplier = t.name_ar)
      where t.org_id = p_org_id
    );
  elsif p_table = 'products' then
    return exists (
      select 1 from public.sale_items x join public.products t
        on t.org_id = x.org_id and x.product_id = t.local_id::text
      where t.org_id = p_org_id
    ) or exists (
      select 1 from public.purchase_items x join public.products t
        on t.org_id = x.org_id and x.product_id = t.local_id::text
      where t.org_id = p_org_id
    );
  elsif p_table = 'treasury' then
    return exists (
      select 1 from public.vouchers x join public.treasury t
        on t.org_id = x.org_id and x.treasury_id = t.local_id::text
      where t.org_id = p_org_id
    ) or exists (
      select 1 from public.sales x join public.treasury t
        on t.org_id = x.org_id and x.treasury_id = t.local_id::text
      where t.org_id = p_org_id
    ) or exists (
      select 1 from public.purchases x join public.treasury t
        on t.org_id = x.org_id and x.treasury_id = t.local_id::text
      where t.org_id = p_org_id
    );
  elsif p_table = 'accounts' then
    return exists (
      select 1 from public.journal_lines x join public.accounts t
        on t.org_id = x.org_id and x.account_id = t.local_id::text
      where t.org_id = p_org_id
    );
  end if;
  return false;
end
$$;

create or replace function public.mizan_admin_import_excel(
  p_org_id uuid,
  p_table text,
  p_mode text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
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
    if jsonb_object_length(v_row) = 0 then continue; end if;
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
    if v_has_local_id then
      v_next_local := v_next_local + 1;
      v_record := v_row || jsonb_build_object(
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

  return jsonb_build_object(
    'table', p_table,
    'mode', p_mode,
    'inserted', v_inserted,
    'removed', v_removed
  );
end
$$;

revoke all on function public.mizan_excel_hash32(text) from public, anon, authenticated;
revoke all on function public.mizan_excel_row_uuid(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.mizan_admin_excel_replace_has_references(uuid, text) from public, anon, authenticated;
revoke all on function public.mizan_admin_import_excel(uuid, text, text, jsonb) from public, anon;
grant execute on function public.mizan_admin_import_excel(uuid, text, text, jsonb) to authenticated;
