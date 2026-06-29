-- =====================================================================
--  MOCKA CAFE — migration 15: salaries & labour in expenses (run once)
--  Supabase -> SQL Editor -> paste -> Run. Safe to re-run.
--
--  Adds a 'salary' expense type (chef salaries + one-day helper pay) and a
--  small staff salary roster so the owner can define each chef's monthly pay
--  once and post it each cycle with one tap. Salaries flow into net profit.
-- =====================================================================

-- 1) Allow 'salary' as an expense type.
alter table public.expenses drop constraint if exists expenses_type_check;
alter table public.expenses add constraint expenses_type_check
  check (type in ('cylinder','rent','electricity','salary','other'));

-- 2) Staff salary roster (names + monthly pay). Not tied to app logins, so a
--    chef without a login can still be on payroll.
create table if not exists public.staff_salaries (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  role           text not null default 'chef',
  monthly_amount numeric not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
alter table public.staff_salaries enable row level security;
drop policy if exists staff_salaries_all on public.staff_salaries;
create policy staff_salaries_all on public.staff_salaries for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Done. ✅
