-- =====================================================================
--  MOCKA CAFE — migration 12: requote step + food rating
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

-- 1) Customer star rating (1..5) for a delivered order.
alter table public.orders add column if not exists rating int;

-- 2) "requoted" status = admin sent the order back to the customer because
--    some items are unavailable; customer accepts or changes, then resends.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','rejected','accepted','requoted','sent_to_chef','preparing',
                    'ready','out_for_delivery','reached','delivered','done','paid'));

-- Done. ✅
