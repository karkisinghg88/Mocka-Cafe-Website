-- =====================================================================
--  MOCKA CAFE — Supabase schema
--  Run this whole file once in Supabase -> SQL Editor -> New query -> Run.
--  Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES (one row per user, holds the role)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'customer'
                check (role in ('admin','chef','customer','shopkeeper')),
  shop_name   text,
  created_at  timestamptz not null default now()
);

-- Access keys that grant staff roles at signup. Change these to rotate keys.
--   Owner / Admin key : 1999
--   Chef key          : 0506
-- Customers need no key. The keys are checked HERE (server-side), so they
-- cannot be bypassed by calling the API directly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  req_role   text := new.raw_user_meta_data->>'requested_role';
  signup_key text := new.raw_user_meta_data->>'signup_key';
  final_role text := 'customer';
begin
  if req_role = 'admin' and signup_key = '1999' then
    final_role := 'admin';
  elsif req_role = 'chef' and signup_key = '0506' then
    final_role := 'chef';
  elsif req_role = 'shopkeeper' and signup_key = '0707' then
    final_role := 'shopkeeper';
  end if;

  insert into public.profiles (id, full_name, phone, role, shop_name)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    final_role,
    new.raw_user_meta_data->>'shop_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stop a signed-in user from promoting THEMSELVES by editing their profile.
-- Role changes are only honoured for an existing admin, or from the SQL
-- editor / service role (where auth.uid() is null).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and coalesce(public.my_role(), '') <> 'admin' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Returns the current user's role WITHOUT tripping RLS recursion.
create or replace function public.my_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 2. MENU
-- ---------------------------------------------------------------------
create table if not exists public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price        numeric(10,2) not null default 0,
  category     text not null default 'Other',
  stock_qty    numeric,            -- optional ("null" = not tracked)
  is_available boolean not null default true,
  image_url    text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- Variants / sizes for a menu item (Half/Full, Steamed/Fried…). Optional.
create table if not exists public.menu_variants (
  id           uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name         text not null,
  price        numeric(10,2) not null default 0,
  is_available boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists menu_variants_item_idx on public.menu_variants(menu_item_id);

-- ---------------------------------------------------------------------
-- 3. ORDERS + ORDER ITEMS
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  daily_number   int not null,            -- resets each business day (#1, #2 ...)
  business_date  date not null default current_date,
  type           text not null default 'dine_in' check (type in ('dine_in','delivery')),
  status         text not null default 'sent_to_chef'
                   check (status in ('pending','rejected','accepted','sent_to_chef',
                                     'preparing','ready','out_for_delivery',
                                     'delivered','done','paid')),
  customer_id    uuid references auth.users(id) on delete set null,
  customer_name  text,
  customer_phone text,
  address        text,
  lat            numeric,
  lng            numeric,
  table_no       text,
  subtotal        numeric(10,2) not null default 0,
  delivery_charge numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','received')),
  payment_method text default 'cash',          -- 'cash' | 'upi' | 'both' | 'cod'
  cash_amount    numeric(10,2) not null default 0,
  upi_amount     numeric(10,2) not null default 0,
  notes          text,
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists orders_business_date_idx on public.orders(business_date);
create index if not exists orders_customer_idx on public.orders(customer_id);

create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  menu_item_id   uuid references public.menu_items(id) on delete set null,
  name_snapshot  text not null,
  price_snapshot numeric(10,2) not null,
  quantity       int not null default 1,
  is_ready       boolean not null default false,
  is_available   boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ---------------------------------------------------------------------
-- 4. INVENTORY
-- ---------------------------------------------------------------------
create table if not exists public.inventory_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'kitchen' check (category in ('kitchen','fridge')),
  unit        text not null default 'pcs',
  current_qty numeric not null default 0,
  unit_cost   numeric(10,2) not null default 0,
  low_stock_threshold numeric not null default 0,  -- alert when at/below this
  shelf_life_days numeric not null default 0,       -- 1 = daily buy, 0 = long life
  created_at  timestamptz not null default now()
);

create table if not exists public.inventory_purchases (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid references public.inventory_items(id) on delete set null,
  qty          numeric not null default 0,
  total_cost   numeric(10,2) not null default 0,
  purchased_on date not null default current_date,
  created_at   timestamptz not null default now()
);
create index if not exists purchases_date_idx on public.inventory_purchases(purchased_on);

-- ---------------------------------------------------------------------
-- 5. SETTINGS (key/value: delivery_charge, upi_qr_url, upi_id ...)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key   text primary key,
  value text
);
insert into public.settings (key, value) values
  ('delivery_charge', '30'),
  ('upi_qr_url', ''),
  ('upi_id', '')
on conflict (key) do nothing;

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.menu_items          enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.inventory_purchases enable row level security;
alter table public.settings            enable row level security;

-- Helper to (re)create a policy idempotently.
-- (Postgres has no "create policy if not exists", so we drop first.)

-- ---- profiles ----
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.my_role() = 'admin');
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid());

-- ---- menu_items: everyone signed-in can read; admin manages ----
drop policy if exists menu_select on public.menu_items;
create policy menu_select on public.menu_items for select using (true);
drop policy if exists menu_write on public.menu_items;
create policy menu_write on public.menu_items for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

alter table public.menu_variants enable row level security;
drop policy if exists menu_variants_select on public.menu_variants;
create policy menu_variants_select on public.menu_variants for select using (true);
drop policy if exists menu_variants_write on public.menu_variants;
create policy menu_variants_write on public.menu_variants for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ---- orders ----
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select
  using (public.my_role() in ('admin','chef') or customer_id = auth.uid());
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert
  with check (
    public.my_role() = 'admin'
    or (customer_id = auth.uid() and type = 'delivery')
  );
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update
  using (public.my_role() in ('admin','chef') or customer_id = auth.uid());
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete
  using (public.my_role() = 'admin');

-- ---- order_items (access follows the parent order) ----
drop policy if exists order_items_all on public.order_items;
create policy order_items_all on public.order_items for all
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (public.my_role() in ('admin','chef') or o.customer_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (public.my_role() in ('admin','chef') or o.customer_id = auth.uid())
    )
  );

-- ---- inventory (admin only) ----
drop policy if exists inventory_items_all on public.inventory_items;
create policy inventory_items_all on public.inventory_items for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
drop policy if exists inventory_purchases_all on public.inventory_purchases;
create policy inventory_purchases_all on public.inventory_purchases for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ---- customer saved addresses (each user manages their own) ----
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text, address text not null, lat numeric, lng numeric,
  created_at timestamptz not null default now()
);
create index if not exists customer_addresses_user_idx on public.customer_addresses(user_id);
alter table public.customer_addresses enable row level security;
drop policy if exists addresses_own on public.customer_addresses;
create policy addresses_own on public.customer_addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- expenses (admin only) ----
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('cylinder','rent','electricity','other')),
  label text, qty numeric not null default 1, amount numeric not null default 0,
  expense_date date not null default current_date, note text,
  created_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ---- settings: anyone signed-in reads; admin writes ----
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- =====================================================================
--  STORAGE BUCKETS (menu images + UPI QR)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('menu','menu',true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('public-assets','public-assets',true)
  on conflict (id) do nothing;

-- Public read for both buckets.
drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select
  using (bucket_id in ('menu','public-assets'));

-- Only admins may upload / change / delete images.
drop policy if exists "admin write images" on storage.objects;
create policy "admin write images" on storage.objects for all
  using (bucket_id in ('menu','public-assets') and public.my_role() = 'admin')
  with check (bucket_id in ('menu','public-assets') and public.my_role() = 'admin');

-- =====================================================================
--  RECIPES (menu ↔ inventory sync) + costed sales   [see also 03_*.sql]
-- =====================================================================
create table if not exists public.recipe_items (
  id               uuid primary key default gen_random_uuid(),
  menu_item_id     uuid not null references public.menu_items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  qty              numeric not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists recipe_menu_idx on public.recipe_items(menu_item_id);

alter table public.orders      add column if not exists inventory_deducted boolean not null default false;
alter table public.order_items add column if not exists cost_snapshot numeric(10,2) not null default 0;

create or replace function public.consume_inventory_for_order(p_order uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare oi record;
begin
  if coalesce((select inventory_deducted from public.orders where id = p_order), true) then
    return;
  end if;
  for oi in
    select id, menu_item_id, quantity from public.order_items
    where order_id = p_order and is_available is not false
  loop
    update public.order_items
      set cost_snapshot = coalesce((
        select sum(ri.qty * inv.unit_cost)
        from public.recipe_items ri
        join public.inventory_items inv on inv.id = ri.inventory_item_id
        where ri.menu_item_id = oi.menu_item_id), 0)
      where id = oi.id;
    update public.inventory_items inv
      set current_qty = inv.current_qty - (ri.qty * oi.quantity)
      from public.recipe_items ri
      where ri.inventory_item_id = inv.id and ri.menu_item_id = oi.menu_item_id;
  end loop;
  update public.orders set inventory_deducted = true where id = p_order;
end;
$$;
grant execute on function public.consume_inventory_for_order(uuid) to authenticated;

alter table public.recipe_items enable row level security;
drop policy if exists recipe_select on public.recipe_items;
create policy recipe_select on public.recipe_items for select
  using (public.my_role() in ('admin','chef'));
drop policy if exists recipe_write on public.recipe_items;
create policy recipe_write on public.recipe_items for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- =====================================================================
--  PROCUREMENT (buy list shared by chef, admin, shopkeepers)  [see 06_*.sql]
-- =====================================================================
create table if not exists public.purchase_items (
  id                uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  name              text not null,
  unit              text default 'pcs',
  qty               numeric not null default 1,
  source            text not null default 'shop' check (source in ('shop','store')),
  shopkeeper_id     uuid references public.profiles(id) on delete set null,
  status            text not null default 'pending'
                      check (status in ('pending','assigned','packed','unavailable','purchased')),
  unit_price        numeric not null default 0,
  paid              boolean not null default false,
  payment_method    text,
  added_by          uuid references public.profiles(id) on delete set null,
  added_role        text,
  business_date     date not null default current_date,
  note              text,
  packed_at         timestamptz,
  purchased_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists purchase_items_date_idx on public.purchase_items(business_date);
create index if not exists purchase_items_shop_idx on public.purchase_items(shopkeeper_id);

alter table public.purchase_items enable row level security;
drop policy if exists purchase_select on public.purchase_items;
create policy purchase_select on public.purchase_items for select
  using (public.my_role() in ('admin','chef') or shopkeeper_id = auth.uid());
drop policy if exists purchase_insert on public.purchase_items;
create policy purchase_insert on public.purchase_items for insert
  with check (public.my_role() in ('admin','chef'));
drop policy if exists purchase_update on public.purchase_items;
create policy purchase_update on public.purchase_items for update
  using (public.my_role() = 'admin' or shopkeeper_id = auth.uid());
drop policy if exists purchase_delete on public.purchase_items;
create policy purchase_delete on public.purchase_items for delete
  using (public.my_role() in ('admin','chef'));

-- =====================================================================
--  REALTIME (chef + admin see orders update live)
-- =====================================================================
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.orders'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.order_items'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.purchase_items'; exception when duplicate_object then null; end;
end $$;

-- Done. ✅
