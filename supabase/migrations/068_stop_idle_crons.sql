-- ============================================================
-- 068: Stop idle per-minute crons and cap cron log growth
-- ------------------------------------------------------------
-- parser-tick and send-email-drain each fired every minute, writing one
-- row per run into cron.job_run_details (never pruned). That table grew to
-- 1.33 GB (97% of the DB) and pushed the project over its quota.
--
-- * send-email-drain: nothing in the app calls queue_email; admin OTP goes
--   through Supabase Auth SMTP, not this queue. Always drained zero rows.
-- * parser-tick: only needed during the contest window ("Start on schedule"
--   and live results polling). Re-create it from migration 047 before the
--   May final.
--
-- Run outside a transaction (TRUNCATE on cron schema is fine either way).
-- ============================================================

do $$
begin
  begin perform cron.unschedule('parser-tick');      exception when others then null; end;
  begin perform cron.unschedule('send-email-drain'); exception when others then null; end;
  begin perform cron.unschedule('purge-cron-logs');  exception when others then null; end;
end $$;

truncate cron.job_run_details;

select cron.schedule(
  'purge-cron-logs',
  '0 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$
);
