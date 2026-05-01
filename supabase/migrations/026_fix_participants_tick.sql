-- 026_fix_participants_tick.sql
-- Fix: parser-tick was dispatching the participants HTTP call without
-- transitioning the parse_jobs row from 'idle' to 'running' first. The
-- edge function then rejected with 409 "job not running" — visible in
-- net._http_response as id=7,8 fired at 13:03/13:04 with status_code 409.
--
-- Same `idle → running` transition the results path already had is now
-- mirrored on the participants path, then the HTTP dispatch fires.

begin;

do $outer$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('parser-tick'); exception when others then null; end;

    if exists (select 1 from pg_extension where extname = 'pg_net') then
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
            v_p record;
            v_r record;
          begin
            -- ── Participants: idle → running, then dispatch ────────────
            -- Transition first so the edge function gate (status='running')
            -- passes. Without this the function returns 409 every minute.
            update public.parse_jobs
               set status            = 'running',
                   started_at        = now(),
                   triggered_by_user = false,
                   last_poll_at      = null,
                   poll_count        = 0,
                   stopped_at        = null
             where kind = 'participants' and status = 'idle'
               and scheduled_start_at is not null
               and now() >= scheduled_start_at;

            if found then
              perform net.http_post(
                url := v_url,
                headers := jsonb_build_object('content-type','application/json','Authorization', v_auth),
                body := jsonb_build_object('action','participants'),
                timeout_milliseconds := 30000
              );
            end if;

            -- ── Results auto-start: idle → running once we cross start ─
            update public.parse_jobs
               set status='running', started_at=now(), triggered_by_user=false,
                   last_poll_at=null, poll_count=0, stopped_at=null
             where kind='results' and status='idle' and manual_override = false
               and scheduled_start_at is not null
               and now() >= scheduled_start_at
               and (scheduled_end_at is null or now() < scheduled_end_at);

            -- ── Results poll: while running and within window ─────────
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
  end if;
end $outer$;

-- ─────────────────────────────────────────────────────────────────────────
-- Cleanup: any participants row that's been stuck in 'idle' past its
-- scheduled time will get picked up on the next tick after this migration.
-- Optionally let admin reset participants stuck in 'running' from a
-- previous failed run.
-- (no-op if not stuck)
-- ─────────────────────────────────────────────────────────────────────────

commit;
