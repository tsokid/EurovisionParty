-- 033_fix_participants_cron_retrigger.sql
-- Bug: after Hard Stop resets participants job to 'idle', the parser-tick
-- cron fires within 60s and immediately flips it back to 'running' because
-- the condition only checks `now() >= scheduled_start_at` — which stays
-- permanently true after the scheduled time passes.
--
-- Fix: add `AND (stopped_at IS NULL OR stopped_at < scheduled_start_at)`.
-- Hard Stop sets stopped_at = now() (which is > scheduled_start_at), so
-- the cron ignores the job until the user sets a new schedule or Start Now.

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
            select decrypted_secret from vault.decrypted_secrets where name = 'parser_service_key'
          );
          v_r record;
        begin
          -- ── Participants: idle → running, then dispatch ────────────────
          -- Only trigger if the job has never been stopped after its scheduled
          -- start time. This prevents Hard Stop from being overridden by the
          -- next cron tick (stopped_at is set to now() by hard_stop_parse_job,
          -- which is always > scheduled_start_at for past schedules).
          update public.parse_jobs
             set status            = 'running',
                 started_at        = now(),
                 triggered_by_user = false,
                 last_poll_at      = null,
                 poll_count        = 0,
                 stopped_at        = null
           where kind = 'participants' and status = 'idle'
             and scheduled_start_at is not null
             and now() >= scheduled_start_at
             and (stopped_at is null or stopped_at < scheduled_start_at);

          if found then
            perform net.http_post(
              url := v_url,
              headers := jsonb_build_object('content-type','application/json','Authorization', v_auth),
              body := jsonb_build_object('action','participants'),
              timeout_milliseconds := 30000
            );
          end if;

          -- ── Results auto-start: idle → running once we cross start ─────
          update public.parse_jobs
             set status='running', started_at=now(), triggered_by_user=false,
                 last_poll_at=null, poll_count=0, stopped_at=null
           where kind='results' and status='idle' and manual_override = false
             and scheduled_start_at is not null
             and now() >= scheduled_start_at
             and (scheduled_end_at is null or now() < scheduled_end_at);

          -- ── Results poll: while running and within window ─────────────
          select * into v_r from public.parse_jobs
           where kind='results' and status='running' and manual_override = false
             and (scheduled_end_at is null or now() < scheduled_end_at)
             and (last_poll_at is null
                  or last_poll_at <= now() - (poll_interval_minutes || ' minutes')::interval)
           limit 1;
          if found then
            perform net.http_post(
              url := v_url,
              headers := jsonb_build_object('content-type','application/json','Authorization', v_auth),
              body := jsonb_build_object('action','results'),
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
