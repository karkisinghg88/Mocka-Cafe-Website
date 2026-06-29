-- =====================================================================
--  MOCKA CAFE — migration 16: stock counts (run once)
--  Supabase -> SQL Editor -> paste -> Run. Safe to re-run.
--
--  Lets the owner record a quick physical count of raw items now and then.
--  These counts let the monthly "recipe check" measure real consumption of
--  stored items (flour, oil, masala) accurately, not just perishables.
-- =====================================================================

create table if not exists public.stock_counts (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid references public.inventory_items(id) on delete cascade,
  counted_qty numeric not null default 0,
  count_date  date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists stock_counts_item_idx on public.stock_counts(item_id);
create index if not exists stock_counts_date_idx on public.stock_counts(count_date);

alter table public.stock_counts enable row level security;
drop policy if exists stock_counts_all on public.stock_counts;
create policy stock_counts_all on public.stock_counts for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Done. ✅
