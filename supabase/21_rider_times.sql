-- =====================================================================
--  MOCKA CAFE — migration 21: rider delivery timings (run once)
--  Supabase -> SQL Editor -> paste -> Run. Safe to re-run.
--
--  Records three times per delivery, set by the rider:
--    left_cafe_at    - rider left the cafe with the order
--    reached_at      - rider reached the customer
--    back_at_cafe_at - rider collected payment and returned to the cafe
--  Riders can already update their own orders (RLS from migration 11), so no
--  new policy is needed.
-- =====================================================================

alter table public.orders add column if not exists left_cafe_at    timestamptz;
alter table public.orders add column if not exists reached_at      timestamptz;
alter table public.orders add column if not exists back_at_cafe_at timestamptz;

-- Done. ✅
