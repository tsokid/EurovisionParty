-- ============================================================
-- 047: Auto-flip results from 'running' to 'done' when its polling
--      window closes
-- ------------------------------------------------------------
-- Today the results parser stays at status='running' indefinitely after
-- scheduled_end_at passes. Polling stops (cron's poll branch has a
-- `now() < scheduled_end_at` guard) but the row never moves out of
-- 'running' on its own — admins have to click Finalize / Hard Stop.
--
-- This migration re-deploys the parser-tick cron body with one extra
-- UPDATE: any results job that's still 'running' AFTER its end has
-- passed gets flipped to 'done'. Polling already stops at end_at, so
-- this is a clean "the window closed, we're finished" transition.
--
-- Body otherwise identical to migration 046 (custom cron secret +
-- respect_schedule guards). No edge function change.
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

          -- ── Results auto-done: window closed, polling has stopped ──────
          -- Once scheduled_end_at passes, the poll branch above no longer
          -- fires. Flip the row to 'done' so the UI shows the work is
          -- complete without needing a manual Finalize / Hard Stop click.
          update public.parse_jobs
             set status     = 'done',
                 stopped_at = now()
           where kind = 'results' and status = 'running'
             and respect_schedule = true
             and scheduled_end_at is not null
             and now() >= scheduled_end_at;
        end
        $tick$;
      $cron$
    );
  end if;
end $outer$;

commit;
