-- =====================================================================
--  MOCKA CAFE — migration 17: one-tap recipe calibration (run once)
--  Supabase -> SQL Editor -> paste -> Run. Safe to re-run.
--
--  Lets the owner apply the monthly "recipe check" with one tap: each
--  ingredient's recipe quantity is scaled so the total it implies matches
--  what was actually bought/used. Admin only.
-- =====================================================================

create or replace function public.scale_recipe_ingredient(p_item uuid, p_factor numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if public.my_role() <> 'admin' then
    raise exception 'Only the owner can adjust recipes.';
  end if;
  if p_factor is null or p_factor <= 0 then
    return;
  end if;
  update public.recipe_items
    set qty = qty * p_factor
    where inventory_item_id = p_item;
end;
$$;
revoke all on function public.scale_recipe_ingredient(uuid,numeric) from public, anon;
grant execute on function public.scale_recipe_ingredient(uuid,numeric) to authenticated;

-- Done. ✅
