-- =====================================================================
--  MOCKA CAFE — migration 10: saved delivery addresses per customer
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

create table if not exists public.customer_addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text,
  address    text not null,
  lat        numeric,
  lng        numeric,
  created_at timestamptz not null default now()
);
create index if not exists customer_addresses_user_idx on public.customer_addresses(user_id);

alter table public.customer_addresses enable row level security;
drop policy if exists addresses_own on public.customer_addresses;
create policy addresses_own on public.customer_addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Done. ✅
