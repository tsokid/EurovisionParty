-- 037_cron_hardcoded_url.sql
-- Replaces 035/036's fragile dynamic-URL approaches with the proven
-- pattern from 026: URL comes from a vault secret if available,
-- falls back to the hardcoded constant. The service key auth still
-- comes from Vault (never hardcoded).
--
-- The edge function no longer hardcodes year=2026 (fixed in 035),
-- so this cron is year-agnostic even with a hardcoded function URL.

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
          v_url  text := coalesce(
            (select decrypted_secret from vault.decrypted_secrets
              where name = 'parser_function_url'),
            'https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/eurovision-parse'
          );
          v_auth text := 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets
             where name = 'parser_service_key'
          );
        begin
          -- ── Participants: idle → running + dispatch ────────────────────
          -- stopped_at guard prevents Hard Stop being overridden by cron.
          -- arm_parse_job sets stopped_at = NULL; Hard Stop sets it = now().
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
              url     := v_url,
              headers := jsonb_build_object(
                           'content-type', 'application/json',
                           'Authorization', v_auth),
              body    := '{"action":"participants"}'::jsonb,
              timeout_milliseconds := 30000
            );
          end if;

          -- ── Results auto-start ─────────────────────────────────────────
          update public.parse_jobs
             set status            = 'running',
                 started_at        = now(),
                 triggered_by_user = false,
                 last_poll_at      = null,
                 poll_count        = 0,
                 stopped_at        = null
           where kind = 'results' and status = 'idle' and manual_override = false
             and scheduled_start_at is not null
             and now() >= scheduled_start_at
             and (scheduled_end_at is null or now() < scheduled_end_at);

          -- ── Results poll ───────────────────────────────────────────────
          if exists (
            select 1 from public.parse_jobs
             where kind = 'results' and status = 'running' and manual_override = false
               and (scheduled_end_at is null or now() < scheduled_end_at)
               and (last_poll_at is null
                    or last_poll_at <= now() - (poll_interval_minutes || ' minutes')::interval)
          ) then
            perform net.http_post(
              url     := v_url,
              headers := jsonb_build_object(
                           'content-type', 'application/json',
                           'Authorization', v_auth),
              body    := '{"action":"results"}'::jsonb,
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
