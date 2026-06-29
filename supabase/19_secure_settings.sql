-- =====================================================================
--  MOCKA CAFE — migration 19: lock the secret settings (run once)
--  Supabase -> SQL Editor -> paste -> Run. Safe to re-run.
--
--  Before: the whole settings table was readable by anyone (so customers can
--  see delivery charge, UPI id, opening status). That also exposed the Gemini
--  API key. After: every public setting stays readable, but the Gemini key is
--  readable by the owner only. The app and the email function still work
--  (admin is logged in; the email function uses the service role).
-- =====================================================================

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select
  using ( key <> 'gemini_key' or public.my_role() = 'admin' );

-- Done. ✅  Public settings stay public; the Gemini key is now owner-only.
