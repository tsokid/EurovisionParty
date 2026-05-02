-- 035_dynamic_cron_and_arm.sql
--
-- Supersedes 033 + 034 and removes all hardcoded values:
--
-- 1. arm_parse_job() — idempotent CREATE OR REPLACE (was 034).
--    Resets a job to idle with stopped_at = NULL so the cron guard passes.
--
-- 2. parser-tick cron rewrite (supersedes 025 / 026 / 033):
--    a. stopped_at guard — Hard Stop cannot be overridden by the next cron tick.
--    b. Dynamic function URL — derived at runtime from the parser_service_key
--       Vault secret (JWT issuer field). No project-ref hardcoded anywhere.
--
-- Safe to run even if 033 / 034 were already applied.

begin;

-- ── 1. arm_parse_job ────────────────────────────────────────────────────────
-- "Start on Schedule": flip any terminal state back to idle with
-- stopped_at = NULL so the cron guard passes on the next tick.
-- NOT the same as hard_stop_parse_job, which sets stopped_at = now().

create or replace function public.arm_parse_job(p_year int, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_status text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('participants','results') then
    raise exception 'invalid kind: %', p_kind;
  end if;
  select status into v_status
    from public.parse_jobs where year = p_year and kind = p_kind;
  if v_status is null then
    raise exception 'no job: % %', p_year, p_kind;
  end if;
  if v_status = 'finalized' then
    raise exception 'cannot arm a finalized job';
  end if;

  update public.parse_jobs
     set status       = 'idle',
         started_at   = null,
         stopped_at   = null,     -- must be null so the cron guard passes
         last_poll_at = null,
         poll_count   = 0
   where year = p_year and kind = p_kind;
end;
$fn$;

grant execute on function public.arm_parse_job(int, text) to authenticated;

-- ── 2. parser-tick cron (dynamic URL + stopped_at guard) ────────────────────

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
          -- ── Resolve secrets from Vault ─────────────────────────────────
          select 'Bearer ' || decrypted_secret
            into v_auth
            from vault.decrypted_secrets
           where name = 'parser_service_key';

          -- Derive the Supabase project base URL from the JWT issuer embedded
          -- in the service key — no project ref hardcoded anywhere in SQL.
          -- The `iss` field is like:
          --   https://XXXX.supabase.co/auth/v1
          -- We strip /auth/v1 and append the function path.
          select regexp_replace(
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
            into v_url
            from vault.decrypted_secrets
           where name = 'parser_service_key';

          -- ── Participants: idle → running, then dispatch ────────────────
          -- Guard: stopped_at must be NULL or before the scheduled time so
          -- that Hard Stop (stopped_at = now()) isn't silently overridden.
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

          -- ── Results auto-start: idle → running once we cross start time ─
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

          -- ── Results poll: while running and within window ──────────────
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
