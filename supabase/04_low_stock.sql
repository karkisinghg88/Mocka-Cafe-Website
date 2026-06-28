-- =====================================================================
--  MOCKA CAFE — migration 04: low-stock alert threshold per item
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

alter table public.inventory_items
  add column if not exists low_stock_threshold numeric not null default 0;

-- Done. ✅  (Set a per-item limit in Inventory; items at/below it show up in
--           Reports -> "Low in stock" as your next-morning shopping list.)
