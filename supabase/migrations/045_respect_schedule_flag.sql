-- ============================================================
-- 045: Respect-schedule opt-in flag for parsers
-- ------------------------------------------------------------
-- Today the parser-tick cron auto-fires whenever
--   status='idle' AND now() >= scheduled_start_at
--   AND (stopped_at IS NULL OR stopped_at < scheduled_start_at)
-- That condition is permanently true once `scheduled_start_at` is in
-- the past (e.g. a row left over from 2025) — the cron then re-fires
-- every minute. Same shape for results' auto-start.
--
-- Fix:
--   1. Persisted opt-in `respect_schedule boolean default false`. The
--      cron tick only auto-fires when this is TRUE for the row.
--   2. `arm_parse_job` rejects when the scheduled time is in the past
--      (and for results, when the end time has already passed).
--   3. New `set_respect_schedule(year, kind, on)` so the admin UI can
--      toggle the flag without a full schedule save.
--   4. Re-deploy the parser-tick cron with the AND respect_schedule = TRUE
--      guard added to every fire branch.
-- ============================================================

begin;

-- ── 1. New column ──────────────────────────────────────────────────────────
alter table public.parse_jobs
  add column if not exists respect_schedule boolean not null default false;

comment on column public.parse_jobs.respect_schedule is
  'Opt-in: when TRUE, the parser-tick cron may auto-fire once the schedule '
  'arrives. When FALSE (default), only manual triggers run the parser. '
  'Killswitch for stale schedules left in past dates.';

-- ── 2. Toggle RPC ──────────────────────────────────────────────────────────
create or replace function public.set_respect_schedule(
  p_year int, p_kind text, p_on boolean
) returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('participants','results') then
    raise exception 'invalid kind: %', p_kind;
  end if;
  update public.parse_jobs
     set respect_schedule = coalesce(p_on, false)
   where year = p_year and kind = p_kind;
  if not found then
    raise exception 'no parse_jobs row for year=% kind=%', p_year, p_kind;
  end if;
end;
$fn$;

grant execute on function public.set_respect_schedule(int, text, boolean) to authenticated;

-- ── 3. arm_parse_job: validate the schedule is in the future ───────────────
create or replace function public.arm_parse_job(p_year int, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_status            text;
  v_scheduled_start   timestamptz;
  v_scheduled_end     timestamptz;
  v_respect           boolean;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('participants','results') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  select status, scheduled_start_at, scheduled_end_at, respect_schedule
    into v_status, v_scheduled_start, v_scheduled_end, v_respect
    from public.parse_jobs
   where year = p_year and kind = p_kind;

  if v_status is null then
    raise exception 'no job: % %', p_year, p_kind;
  end if;
  if v_status = 'finalized' then
    raise exception 'cannot arm a finalized job';
  end if;
  if not coalesce(v_respect, false) then
    raise exception 'respect-schedule is OFF — enable it before arming';
  end if;
  if v_scheduled_start is null then
    raise exception 'no scheduled_start_at — set the schedule first';
  end if;
  if v_scheduled_start <= now() then
    raise exception 'scheduled start is in the past — pick a future time or use Start Now';
  end if;
  if p_kind = 'results' and v_scheduled_end is not null and v_scheduled_end <= now() then
    raise exception 'scheduled end is in the past — pick a future end time';
  end if;

  update public.parse_jobs
     set status       = 'idle',
         started_at   = null,
         stopped_at   = null,   -- null so the cron-tick guard passes
         last_poll_at = null,
         poll_count   = 0
   where year = p_year and kind = p_kind;
end;
$fn$;

-- ── 4. Re-deploy parser-tick with respect_schedule gate ───────────────────
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
          -- All four conditions must hold:
          --   • respect_schedule opted in
          --   • a scheduled time is set
          --   • that time has arrived
          --   • the job hasn't been stopped after the scheduled time
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
