-- ==============================================================
-- ترقية 10: نسخة احتياطية شاملة للمالك (كل الشركات والبيانات)
-- دالة security definer تعيد كل الجداول كـ jsonb واحد.
-- لا يستدعيها إلا حساب is_superadmin.
-- ==============================================================

drop function if exists public.mizan_admin_export_all();
create or replace function public.mizan_admin_export_all()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_superadmin is true) then
    raise exception 'غير مصرح';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'organizations',      coalesce((select jsonb_agg(to_jsonb(t)) from public.organizations t), '[]'::jsonb),
    'profiles',           coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t), '[]'::jsonb),
    'customers',          coalesce((select jsonb_agg(to_jsonb(t)) from public.customers t), '[]'::jsonb),
    'suppliers',          coalesce((select jsonb_agg(to_jsonb(t)) from public.suppliers t), '[]'::jsonb),
    'products',           coalesce((select jsonb_agg(to_jsonb(t)) from public.products t), '[]'::jsonb),
    'treasury',           coalesce((select jsonb_agg(to_jsonb(t)) from public.treasury t), '[]'::jsonb),
    'accounts',           coalesce((select jsonb_agg(to_jsonb(t)) from public.accounts t), '[]'::jsonb),
    'sales',              coalesce((select jsonb_agg(to_jsonb(t)) from public.sales t), '[]'::jsonb),
    'sale_items',         coalesce((select jsonb_agg(to_jsonb(t)) from public.sale_items t), '[]'::jsonb),
    'purchases',          coalesce((select jsonb_agg(to_jsonb(t)) from public.purchases t), '[]'::jsonb),
    'purchase_items',     coalesce((select jsonb_agg(to_jsonb(t)) from public.purchase_items t), '[]'::jsonb),
    'supplier_txs',       coalesce((select jsonb_agg(to_jsonb(t)) from public.supplier_txs t), '[]'::jsonb),
    'customer_txs',       coalesce((select jsonb_agg(to_jsonb(t)) from public.customer_txs t), '[]'::jsonb),
    'vouchers',           coalesce((select jsonb_agg(to_jsonb(t)) from public.vouchers t), '[]'::jsonb),
    'journal_entries',    coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_entries t), '[]'::jsonb),
    'journal_lines',      coalesce((select jsonb_agg(to_jsonb(t)) from public.journal_lines t), '[]'::jsonb),
    'audit_logs',         coalesce((select jsonb_agg(to_jsonb(t)) from public.audit_logs t), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

grant execute on function public.mizan_admin_export_all() to authenticated;