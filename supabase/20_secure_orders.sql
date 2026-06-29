-- =====================================================================
--  MOCKA CAFE — migration 20: server-side order pricing (run once)
--  Supabase -> SQL Editor -> paste -> Run. Safe to re-run.
--
--  Stops a tampered device from faking prices or totals. For orders placed by
--  customers: each item price must be a real menu price, the order is forced to
--  pending + unpaid with the real delivery charge, and the order total is always
--  recomputed on the server from the items. Staff (admin/chef) are trusted.
-- =====================================================================

-- 1) Customer item prices must match the live menu (base price, or a variant
--    price if the item has sizes). Staff are trusted (billing / edits).
create or replace function public.guard_order_item_price()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  role text := public.my_role();
  has_variants boolean;
  ok boolean;
begin
  if role in ('admin','chef') then return new; end if;
  if new.menu_item_id is null then raise exception 'Invalid item.'; end if;
  new.quantity := greatest(1, coalesce(new.quantity, 1));
  if coalesce(new.price_snapshot, 0) <= 0 then
    raise exception 'Invalid price.';
  end if;

  select exists(select 1 from public.menu_variants where menu_item_id = new.menu_item_id) into has_variants;
  if has_variants then
    select exists(
      select 1 from public.menu_variants v
      where v.menu_item_id = new.menu_item_id and abs(v.price - new.price_snapshot) < 0.01
    ) into ok;
  else
    select exists(
      select 1 from public.menu_items m
      where m.id = new.menu_item_id and m.price > 0 and abs(m.price - new.price_snapshot) < 0.01
    ) into ok;
  end if;

  if not ok then
    raise exception 'Price does not match the menu. Please refresh and try again.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_order_item_price on public.order_items;
create trigger guard_order_item_price
  before insert or update on public.order_items
  for each row execute function public.guard_order_item_price();

-- 2) Customer orders are always delivery + pending + unpaid, with the real
--    delivery charge from settings (cannot be faked from the device).
create or replace function public.guard_order_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare role text := public.my_role(); dc numeric;
begin
  if role in ('admin','chef') then return new; end if;
  new.type := 'delivery';
  new.status := 'pending';
  new.payment_status := 'unpaid';
  new.cash_amount := 0; new.upi_amount := 0; new.paid_at := null; new.rider_id := null;
  if new.payment_method is null or new.payment_method not in ('upi','cod','cash') then
    new.payment_method := 'cod';
  end if;
  select coalesce((select value::numeric from public.settings where key = 'delivery_charge'), 0) into dc;
  new.delivery_charge := coalesce(dc, 0);
  return new;
end;
$$;
drop trigger if exists guard_order_insert on public.orders;
create trigger guard_order_insert
  before insert on public.orders
  for each row execute function public.guard_order_insert();

-- 3) Always recompute an order's subtotal/total on the server from its items, so
--    the total can never be faked regardless of what the device sent.
create or replace function public.recompute_order_total()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare oid uuid; sub numeric; dc numeric;
begin
  oid := coalesce(new.order_id, old.order_id);
  select coalesce(sum(price_snapshot * quantity), 0) into sub
    from public.order_items where order_id = oid and is_available is not false;
  select coalesce(delivery_charge, 0) into dc from public.orders where id = oid;
  update public.orders set subtotal = sub, total = sub + coalesce(dc, 0) where id = oid;
  return null;
end;
$$;
drop trigger if exists recompute_order_total on public.order_items;
create trigger recompute_order_total
  after insert or update or delete on public.order_items
  for each row execute function public.recompute_order_total();

-- Done. ✅  Customer prices and totals are now decided by the server.
