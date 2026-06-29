-- =====================================================================
--  MOCKA CAFE — schedule the monthly report email (run once)
--  Supabase -> SQL Editor. Do ONE thing: replace
--  PASTE_YOUR_SERVICE_ROLE_KEY_HERE with your service_role key
--  (Project Settings -> API -> service_role -> Reveal). Then press Run.
--  Safe to run again (it just updates the schedule).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'mocka-monthly-report',
  '0 1 2 * *',                       -- 2nd of every month, ~6:30 AM IST
  $$
  select net.http_post(
    url     := 'https://jfgoyxnuizkgvxprwzlp.supabase.co/functions/v1/monthly-report',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer PASTE_YOUR_SERVICE_ROLE_KEY_HERE"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Check it worked:        select jobname, schedule from cron.job;
-- Turn it off later:      select cron.unschedule('mocka-monthly-report');
