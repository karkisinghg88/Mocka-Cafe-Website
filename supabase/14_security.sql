-- =====================================================================
--  MOCKA CAFE — migration 14: security hardening (run once)
--  Supabase -> SQL Editor -> New query -> paste -> Run. Safe to re-run.
--
--  WHAT THIS FIXES
--  Before: staff roles (chef / shopkeeper / rider) were granted at signup
--  using short numeric keys (0506 / 0707 / 0808) that were shipped INSIDE
--  the website code. Anyone could read those keys from the page and sign
--  themselves up as staff. A "chef" can see every order, including the
--  customer name, phone and delivery address. That is a real leak.
--
--  After: every new signup is ALWAYS a customer. Only the owner (admin),
--  from inside the app, can turn an account into staff. There is no secret
--  key left in the website to steal.
-- =====================================================================

-- 1) New signups are always customers. Any "key" in the request is ignored.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, shop_name)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    'customer',
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

-- 2) Admin-only role assignment. SECURITY DEFINER with an explicit admin
--    check, so ONLY the owner can promote an account, and only to a valid
--    staff role. The app calls this from the owner's signed-in session.
create or replace function public.admin_set_role(
  p_user uuid,
  p_role text,
  p_full_name text default null,
  p_shop text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if public.my_role() <> 'admin' then
    raise exception 'Only the owner can assign roles.';
  end if;
  if p_role not in ('customer','chef','shopkeeper','rider') then
    raise exception 'Invalid role.';
  end if;
  insert into public.profiles (id, role, full_name, shop_name)
  values (p_user, p_role, p_full_name, p_shop)
  on conflict (id) do update
    set role      = excluded.role,
        full_name = coalesce(excluded.full_name, profiles.full_name),
        shop_name = coalesce(excluded.shop_name, profiles.shop_name);
end;
$$;
revoke all on function public.admin_set_role(uuid,text,text,text) from public, anon;
grant execute on function public.admin_set_role(uuid,text,text,text) to authenticated;

-- 3) Keep the self-promotion guard: a non-admin editing their own profile
--    can never change their own role. Re-assert in case it was dropped.
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

-- 4) Make sure the owner stays admin.
insert into public.profiles (id, full_name, role)
select id, 'Cafe Owner', 'admin'
  from auth.users where email = 'karkisinghg88@gmail.com'
on conflict (id) do update set role = 'admin';

-- Done. ✅  No staff key lives in the website anymore.
