-- ============================================================
-- 046: Stop relying on Supabase's auto-injected SERVICE_ROLE_KEY
-- ------------------------------------------------------------
-- Background: the parser-tick cron used to authenticate by sending
-- Bearer ${vault.parser_service_key} and the edge function compared
-- that to its env var SUPABASE_SERVICE_ROLE_KEY. In this project the
-- two have drifted apart (the vault has the dashboard's current
-- service_role key, but Supabase's auto-injected env var on the
-- function is a different value), so every cron-driven call returns
-- 403 silently. Multiple redeploys did not realign them.
--
-- Fix: switch the cron to a custom shared secret we control on both
-- ends — vault holds it under name 'parser_cron_secret', the edge
-- function reads the same value from its own PARSER_CRON_SECRET env
-- var, and the function accepts that as a valid auth path.
--
-- The user (admin) seeds the secret via the SQL editor BEFORE applying
-- this migration, because storing the actual secret value here would
-- commit it to git. This migration only re-deploys the cron with the
-- new vault key name; if vault.parser_cron_secret is missing, the
-- cron will still fail (and pg_net responses will show that), so it's
-- safe to apply in any order — just won't work until the secret is
-- seeded and the function is redeployed with PARSER_CRON_SECRET set.
-- ============================================================

begin;

do $outer$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    begin perform cron.unschedule('parser-tick'); exception when others then null; end;

    perform cron.schedule(
      'parser-tick',
      '* * * * *',
      $cron$
        do $tick$
        declare
          v_url  text := 'https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/eurovision-parse';
          -- Read the NEW custom secret. The old parser_service_key is
          -- left in place but no longer used by this cron.
          v_auth text := 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets where name = 'parser_cron_secret'
          );
          v_r record;
        begin
          -- ── Participants: idle → running, then dispatch ────────────────
          update public.parse_jobs
             set status            = 'running',
                 started_at        = now(),
                 triggered_by_user = false,
                 last_poll_at      = null,
                 poll_count        = 0,
                 stopped_at        = null
           where kind = 'participants' and status = 'idle'
             and respect_schedule = true
             and scheduled_start_at is not null
             and now() >= scheduled_start_at
             and (stopped_at is null or stopped_at < scheduled_start_at);

          if found then
            perform net.http_post(
              url     := v_url,
              headers := jsonb_build_object('content-type','application/json','Authorization', v_auth),
              body    := jsonb_build_object('action','participants'),
              timeout_milliseconds := 30000
            );
          end if;

          -- ── Results auto-start: idle → running once start arrives ──────
          update public.parse_jobs
             set status='running', started_at=now(), triggered_by_user=false,
                 last_poll_at=null, poll_count=0, stopped_at=null
           where kind='results' and status='idle' and manual_override = false
             and respect_schedule = true
             and scheduled_start_at is not null
             and now() >= scheduled_start_at
             and (scheduled_end_at is null or now() < scheduled_end_at);

          -- ── Results poll: while running and within window ──────────────
          select * into v_r from public.parse_jobs
           where kind='results' and status='running' and manual_override = false
             and respect_schedule = true
             and (scheduled_end_at is null or now() < scheduled_end_at)
             and (last_poll_at is null
                  or last_poll_at <= now() - (poll_interval_minutes || ' minutes')::interval)
           limit 1;
          if found then
            perform net.http_post(
              url     := v_url,
              headers := jsonb_build_object('content-type','application/json','Authorization', v_auth),
              body    := jsonb_build_object('action','results'),
              timeout_milliseconds := 30000
            );
          end if;
        end
        $tick$;
      $cron$
    );
  end if;
end $outer$;

commit;
