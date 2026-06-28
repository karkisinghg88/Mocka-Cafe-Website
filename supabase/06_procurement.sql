-- =====================================================================
--  MOCKA CAFE — migration 06: procurement system + Shopkeeper role
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

-- 1) New role: shopkeeper
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','chef','customer','shopkeeper'));

-- A shop label on the profile (the shop's name).
alter table public.profiles add column if not exists shop_name text;

-- 2) Shelf life (expiry length in days) on raw inventory items.
alter table public.inventory_items add column if not exists shelf_life_days numeric not null default 0;

-- 3) Procurement / buy list. One row = one item to source.
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
  payment_method    text,                 -- 'cash' | 'upi'
  added_by          uuid references public.profiles(id) on delete set null,
  added_role        text,                 -- 'chef' | 'admin'
  business_date     date not null default current_date,
  note              text,
  packed_at         timestamptz,
  purchased_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists purchase_items_date_idx on public.purchase_items(business_date);
create index if not exists purchase_items_shop_idx on public.purchase_items(shopkeeper_id);
create index if not exists purchase_items_status_idx on public.purchase_items(status);

-- 4) Signup roles now include shopkeeper (key 0707).
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
  if req_role = 'admin' and signup_key = '1999' then final_role := 'admin';
  elsif req_role = 'chef' and signup_key = '0506' then final_role := 'chef';
  elsif req_role = 'shopkeeper' and signup_key = '0707' then final_role := 'shopkeeper';
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

-- 5) RLS for purchase_items
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

-- Admins must be able to list shopkeeper profiles to assign work.
-- (profiles_select already allows admins to read all rows.)

-- 6) Realtime so chef / admin / shopkeeper see the list update live.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.purchase_items'; exception when duplicate_object then null; end;
end $$;

-- Done. ✅
