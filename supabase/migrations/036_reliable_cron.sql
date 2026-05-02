-- 036_reliable_cron.sql
-- Replace 035's cron body with a simpler, reliable version.
-- The JWT-decode approach for deriving the URL proved fragile.
-- The URL now lives in Vault as 'parser_function_url' (plain text,
-- not a secret — just stored there for DRY access alongside the key).
--
-- If 'parser_function_url' vault secret doesn't exist yet, the cron
-- falls back to reading the project ref from the service key's 'iss'
-- claim via a safe coalesce, OR you can insert it manually:
--
--   insert into vault.secrets (name, secret)
--   values ('parser_function_url',
--           'https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/eurovision-parse');
--
-- The year is NOT hardcoded here — the edge function itself queries
-- parse_jobs by kind+status to find the active year (fixed in 035).

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
          v_url  text;
          v_auth text;
        begin
          -- Auth from Vault (service role key)
          select 'Bearer ' || decrypted_secret
            into v_auth
            from vault.decrypted_secrets
           where name = 'parser_service_key';

          -- URL: prefer explicit 'parser_function_url' secret; fall back to
          -- reconstructing from the service key JWT issuer claim.
          select coalesce(
            -- Option A: explicit URL secret (preferred)
            (select decrypted_secret
               from vault.decrypted_secrets
              where name = 'parser_function_url'),
            -- Option B: derive from JWT iss field
            (select regexp_replace(
                convert_from(
                  decode(
                    translate(split_part(decrypted_secret, '.', 2), '-_', '+/')
                    || repeat('=',
                         (4 - (length(split_part(decrypted_secret, '.', 2)) % 4)) % 4),
                    'base64'
                  ),
                  'utf8'
                )::json->>'iss',
                '/auth/v1$', ''
              ) || '/functions/v1/eurovision-parse'
               from vault.decrypted_secrets
              where name = 'parser_service_key')
          ) into v_url;

          -- Abort tick if we couldn't resolve a URL or auth token
          if v_url is null or v_auth is null then
            raise warning 'parser-tick: missing vault secrets, skipping';
            return;
          end if;

          -- ── Participants: idle → running + dispatch ────────────────────
          -- stopped_at guard: prevents Hard Stop being overridden by cron.
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
