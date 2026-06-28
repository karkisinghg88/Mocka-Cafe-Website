-- =====================================================================
--  MOCKA CAFE — migration: confirm owner + key-gated signup
--  Run this once in Supabase -> SQL Editor -> New query -> Run.
--  Safe to re-run.
-- =====================================================================

-- 1) Confirm the owner's email so they can sign in, and make them admin.
update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where email = 'karkisinghg88@gmail.com';

insert into public.profiles (id, full_name, phone, role)
select id, 'Cafe Owner', '+918954312812', 'admin'
  from auth.users where email = 'karkisinghg88@gmail.com'
on conflict (id) do update set role = 'admin';

-- 2) Key-gated signup. Owner key = 1999, Chef key = 0506, customers free.
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
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    final_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Prevent customers from self-promoting by editing their own profile.
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

-- Done. ✅  (To change keys later, edit '1999' / '0506' above and re-run.)
