-- =====================================================================
--  MOCKA CAFE — FRESH START (run once in Supabase, SQL Editor)
--  WARNING: this DELETES all accounts except the owner, and all sale /
--  order / purchase / expense data. It KEEPS the menu (with images),
--  menu variants, and settings. Make sure you want this before running.
-- =====================================================================

-- A) Repair: ensure the expenses table + report settings exist (migration 07
--    had not applied). Safe if it already exists.
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('cylinder','rent','electricity','other')),
  label        text,
  qty          numeric not null default 1,
  amount       numeric not null default 0,
  expense_date date not null default current_date,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses(expense_date);
alter table public.expenses enable row level security;
drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- raw-item categories become free text; seed report settings
alter table public.inventory_items drop constraint if exists inventory_items_category_check;
insert into public.settings (key, value) values
  ('report_cycle_day', '1'), ('monthly_rent', '0'), ('monthly_electricity', '0')
on conflict (key) do nothing;

-- B) Delete every account except the owner (cascades profiles, addresses,
--    saved staff passwords for those users).
delete from auth.users where email <> 'karkisinghg88@gmail.com';

-- C) Wipe all transactional + demo data. Menu, variants and settings stay.
delete from public.orders              where true;   -- cascades order_items
delete from public.purchase_items      where true;
delete from public.inventory_purchases where true;
delete from public.expenses            where true;
delete from public.recipe_items        where true;
delete from public.inventory_items     where true;
delete from public.staff_credentials   where true;
delete from public.customer_addresses  where true;

-- Done. Only the owner account + the menu (with images) remain. ✅
