-- =====================================================================
--  MOCKA CAFE — migration 18: schedule the monthly report email
--  RUN THIS ONLY AFTER you have deployed the Edge Function "monthly-report"
--  and set its secrets (see supabase/functions/monthly-report/index.ts).
--
--  Supabase -> SQL Editor. Replace SERVICE_ROLE_KEY_HERE below with your
--  project's service_role key (Project Settings -> API -> service_role).
--  Safe to re-run (it unschedules the old job first).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any previous schedule with this name (ignore error if it does not exist).
do $$
begin
  perform cron.unschedule('mocka-monthly-report');
exception when others then null;
end $$;

-- Run at 01:00 UTC on the 2nd of every month (about 6:30 AM IST), emailing the
-- cycle that just ended. Change the time/day here if you like.
select cron.schedule(
  'mocka-monthly-report',
  '0 1 2 * *',
  $$
    select net.http_post(
      url     := 'https://jfgoyxnuizkgvxprwzlp.supabase.co/functions/v1/monthly-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer SERVICE_ROLE_KEY_HERE'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- To check it is scheduled:   select * from cron.job;
-- To remove it later:         select cron.unschedule('mocka-monthly-report');
-- Done. ✅
