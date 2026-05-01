-- 025_configurable_schedule.sql
-- Move parser scheduling from hardcoded cron expressions into parse_jobs
-- columns the admin can edit. One generic "parser-tick" cron fires every
-- minute and dispatches based on the saved start/end/interval values.
--
-- Times stored as timestamptz so DST is handled automatically; admin UI
-- accepts/displays Athens (Europe/Athens) local time and converts on
-- save via the SQL `... at time zone 'Europe/Athens'` trick.

begin;

-- ---------------------------------------------------------------------------
-- 1. Schedule columns on parse_jobs
-- ---------------------------------------------------------------------------
alter table public.parse_jobs
  add column if not exists scheduled_start_at  timestamptz,
  add column if not exists scheduled_end_at    timestamptz,
  add column if not exists poll_interval_minutes int not null default 2;

-- Seed current 2026 defaults (matches the values previously inlined in
-- migration 021's cron expressions).
update public.parse_jobs
   set scheduled_start_at = coalesce(scheduled_start_at,
       (timestamp '2026-05-15 03:00') at time zone 'Europe/Athens')
 where year = 2026 and kind = 'participants';

update public.parse_jobs
   set scheduled_start_at = coalesce(scheduled_start_at,
       (timestamp '2026-05-16 23:30') at time zone 'Europe/Athens'),
       scheduled_end_at = coalesce(scheduled_end_at,
       (timestamp '2026-05-17 03:00') at time zone 'Europe/Athens'),
       poll_interval_minutes = coalesce(poll_interval_minutes, 2)
 where year = 2026 and kind = 'results';

-- ---------------------------------------------------------------------------
-- 2. set_parse_schedule(...) — admin updates settings
-- ---------------------------------------------------------------------------
create or replace function public.set_parse_schedule(
  p_year                int,
  p_kind                text,
  p_start_at_athens     text,                -- 'YYYY-MM-DD HH:MM' in Athens local time, or null to keep
  p_end_at_athens       text default null,   -- same; null for participants
  p_poll_interval_min   int  default null    -- null to keep current
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_start_utc timestamptz;
  v_end_utc   timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('participants', 'results') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  -- Convert "YYYY-MM-DD HH:MM" interpreted-as-Athens to UTC timestamptz
  if p_start_at_athens is not null and p_start_at_athens <> '' then
    v_start_utc := p_start_at_athens::timestamp at time zone 'Europe/Athens';
  end if;
  if p_end_at_athens is not null and p_end_at_athens <> '' then
    v_end_utc := p_end_at_athens::timestamp at time zone 'Europe/Athens';
  end if;

  update public.parse_jobs
     set scheduled_start_at = coalesce(v_start_utc, scheduled_start_at),
         scheduled_end_at   = coalesce(v_end_utc,   scheduled_end_at),
         poll_interval_minutes = coalesce(p_poll_interval_min, poll_interval_minutes)
   where year = p_year and kind = p_kind;
  if not found then
    raise exception 'no parse_jobs row for year=% kind=%', p_year, p_kind;
  end if;
end;
$fn$;

grant execute on function public.set_parse_schedule(int, text, text, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Replace the three hardcoded cron jobs with one generic "parser-tick"
--    that fires every minute and decides what to do based on rows.
-- ---------------------------------------------------------------------------
do $outer$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Drop the old per-task crons (idempotent, ignore missing)
    begin perform cron.unschedule('parser-participants-2026-fallback'); exception when others then null; end;
    begin perform cron.unschedule('parser-results-2026-start');         exception when others then null; end;
    begin perform cron.unschedule('parser-results-2026-poll');          exception when others then null; end;
    begin perform cron.unschedule('parser-tick');                       exception when others then null; end;

    -- Generic dispatch tick. Only schedule when pg_net is also present
    -- since the body fires net.http_post.
    if exists (select 1 from pg_extension where extname = 'pg_net') then
      perform cron.schedule(
        'parser-tick',
        '* * * * *',
        $cron$
          do $tick$
          declare
            v_url text := 'https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/eurovision-parse';
            v_auth text := 'Bearer ' || (
              select decrypted_secret from vault.decrypted_secrets where name = 'parser_service_key'
            );
            v_p record;
            v_r record;
          begin
            -- Participants: one-shot when scheduled time arrives and job is still idle
            select * into v_p from public.parse_jobs
             where kind = 'participants' and status = 'idle'
               and scheduled_start_at is not null
               and now() >= scheduled_start_at
             limit 1;
            if found then
              perform net.http_post(
                url := v_url,
                headers := jsonb_build_object('content-type','application/json','Authorization', v_auth),
                body := jsonb_build_object('action','participants'),
                timeout_milliseconds := 30000
              );
            end if;

            -- Results auto-start: idle → running once we cross start time
            update public.parse_jobs
               set status='running', started_at=now(), triggered_by_user=false,
                   last_poll_at=null, poll_count=0, stopped_at=null
             where kind='results' and status='idle' and manual_override = false
               and scheduled_start_at is not null
               and now() >= scheduled_start_at
               and (scheduled_end_at is null or now() < scheduled_end_at);

            -- Results poll: running and within window and last poll > interval ago
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

commit;
