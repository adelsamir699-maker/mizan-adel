-- Upgrade 16: ميزة رصيد منفصل لكل مخزن (نقل بين المخازن)
-- يخزن توزيع الأرصدة لكل مخزن كـ JSON في products.stock

alter table public.products add column if not exists stock jsonb default '{}'::jsonb;