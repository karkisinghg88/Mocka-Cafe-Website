-- =====================================================================
--  MOCKA CAFE — migration 03: recipes (menu↔inventory sync) + costed sales
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

-- 1) Recipe: which inventory items (and how much) each menu item consumes.
create table if not exists public.recipe_items (
  id               uuid primary key default gen_random_uuid(),
  menu_item_id     uuid not null references public.menu_items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  qty              numeric not null default 0,  -- inventory units used per 1 serving
  created_at       timestamptz not null default now()
);
create index if not exists recipe_menu_idx on public.recipe_items(menu_item_id);

-- 2) Track whether an order already deducted stock, and store each line's cost.
alter table public.orders      add column if not exists inventory_deducted boolean not null default false;
alter table public.order_items add column if not exists cost_snapshot numeric(10,2) not null default 0;

-- 3) Deduct stock for an order + snapshot the cost of goods. Runs once per order.
create or replace function public.consume_inventory_for_order(p_order uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  oi record;
begin
  if coalesce((select inventory_deducted from public.orders where id = p_order), true) then
    return;  -- already done (or order missing)
  end if;

  for oi in
    select id, menu_item_id, quantity
    from public.order_items
    where order_id = p_order and is_available is not false
  loop
    -- record this line's cost = recipe cost per serving (at current unit costs)
    update public.order_items
      set cost_snapshot = coalesce((
        select sum(ri.qty * inv.unit_cost)
        from public.recipe_items ri
        join public.inventory_items inv on inv.id = ri.inventory_item_id
        where ri.menu_item_id = oi.menu_item_id
      ), 0)
      where id = oi.id;

    -- subtract used quantities from inventory
    update public.inventory_items inv
      set current_qty = inv.current_qty - (ri.qty * oi.quantity)
      from public.recipe_items ri
      where ri.inventory_item_id = inv.id
        and ri.menu_item_id = oi.menu_item_id;
  end loop;

  update public.orders set inventory_deducted = true where id = p_order;
end;
$$;

grant execute on function public.consume_inventory_for_order(uuid) to authenticated;

-- 4) RLS for recipe_items: staff can read, admin manages.
alter table public.recipe_items enable row level security;
drop policy if exists recipe_select on public.recipe_items;
create policy recipe_select on public.recipe_items for select
  using (public.my_role() in ('admin','chef'));
drop policy if exists recipe_write on public.recipe_items;
create policy recipe_write on public.recipe_items for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Done. ✅
