-- =====================================================================
--  MOCKA CAFE — migration 09: menu variants (Half/Full, Steamed/Fried…)
--  Run once in Supabase -> SQL Editor -> New query -> Run. Safe to re-run.
-- =====================================================================

create table if not exists public.menu_variants (
  id           uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name         text not null,                 -- "Half", "Full", "Steamed"…
  price        numeric(10,2) not null default 0,
  is_available boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists menu_variants_item_idx on public.menu_variants(menu_item_id);

alter table public.menu_variants enable row level security;
drop policy if exists menu_variants_select on public.menu_variants;
create policy menu_variants_select on public.menu_variants for select using (true);
drop policy if exists menu_variants_write on public.menu_variants;
create policy menu_variants_write on public.menu_variants for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Done. ✅
