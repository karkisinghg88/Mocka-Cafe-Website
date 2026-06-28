-- =====================================================================
--  MOCKA CAFE — migration 11: rider role, rider delivery flow, staff vault
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

-- 1) Rider role
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','chef','customer','shopkeeper','rider'));

-- 2) Orders: assign to a rider + a "reached" step. Riders also see/update theirs.
alter table public.orders add column if not exists rider_id uuid references public.profiles(id) on delete set null;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','rejected','accepted','sent_to_chef','preparing',
                    'ready','out_for_delivery','reached','delivered','done','paid'));

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select
  using (public.my_role() in ('admin','chef') or customer_id = auth.uid() or rider_id = auth.uid());
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update
  using (public.my_role() in ('admin','chef') or customer_id = auth.uid() or rider_id = auth.uid());

drop policy if exists order_items_all on public.order_items;
create policy order_items_all on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id
    and (public.my_role() in ('admin','chef') or o.customer_id = auth.uid() or o.rider_id = auth.uid())))
  with check (exists (select 1 from public.orders o where o.id = order_id
    and (public.my_role() in ('admin','chef') or o.customer_id = auth.uid() or o.rider_id = auth.uid())));

-- 3) Staff vault: lets the owner view staff passwords (PIN-gated in the app).
--    NOTE: stores the password the owner set, in plain text, ON PURPOSE so the
--    owner can re-share it. Only the admin can read this table.
create table if not exists public.staff_credentials (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  role       text,
  full_name  text,
  email      text,
  password   text,
  created_at timestamptz not null default now()
);
alter table public.staff_credentials enable row level security;
drop policy if exists staff_cred_all on public.staff_credentials;
create policy staff_cred_all on public.staff_credentials for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- 4) Signup roles: only staff KEYS grant staff roles (admin makes them in-app).
--    Admin can NO LONGER be self-created — owner is the only admin.
--    chef = 0506, shopkeeper = 0707, rider = 0808.
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
  if req_role = 'chef' and signup_key = '0506' then final_role := 'chef';
  elsif req_role = 'shopkeeper' and signup_key = '0707' then final_role := 'shopkeeper';
  elsif req_role = 'rider' and signup_key = '0808' then final_role := 'rider';
  end if;

  insert into public.profiles (id, full_name, phone, role, shop_name)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone',
          final_role, new.raw_user_meta_data->>'shop_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Done. ✅
