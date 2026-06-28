-- =====================================================================
--  MOCKA CAFE — migration 08: delivery GPS pin (lat/lng) on orders
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
--  (Customer note already uses the existing orders.notes column.)
-- =====================================================================

alter table public.orders add column if not exists lat numeric;
alter table public.orders add column if not exists lng numeric;

-- Done. ✅
