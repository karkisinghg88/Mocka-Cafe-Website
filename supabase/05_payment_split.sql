-- =====================================================================
--  MOCKA CAFE — migration 05: split each payment into cash vs UPI
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

alter table public.orders add column if not exists cash_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists upi_amount  numeric(10,2) not null default 0;

-- Done. ✅  (Reports now tracks how much came in via cash vs UPI.)
