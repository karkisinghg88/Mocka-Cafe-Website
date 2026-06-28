-- =====================================================================
--  MOCKA CAFE — migration 07: expenses + report cycle + flexible raw categories
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

-- 1) Extra expenses (cylinders, electricity, other one-offs). Rent + a default
--    electricity are kept in settings as fixed monthly amounts.
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('cylinder','rent','electricity','other')),
  label        text,
  qty          numeric not null default 1,
  amount       numeric not null default 0,   -- total amount for this entry
  expense_date date not null default current_date,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses(expense_date);

alter table public.expenses enable row level security;
drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- 2) Raw-item categories become free text (e.g. "Cold Drink", "Vegetables", "Dairy").
alter table public.inventory_items drop constraint if exists inventory_items_category_check;

-- 3) Seed report settings (cycle day + fixed monthly bills).
insert into public.settings (key, value) values
  ('report_cycle_day', '1'),
  ('monthly_rent', '0'),
  ('monthly_electricity', '0')
on conflict (key) do nothing;

-- Done. ✅
