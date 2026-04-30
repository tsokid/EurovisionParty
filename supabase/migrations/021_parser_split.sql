-- 021_parser_split.sql
-- Split the single Eurovision parser job into two: participants (one-off) and
-- results (continuous polling). Rename the live table for clarity, add a new
-- results table, generalize parse_jobs / parse_runs with a kind column, and
-- replace the cron rows.
--
-- Spec:  docs/superpowers/specs/2026-04-30-parser-redesign-design.md
-- Plan:  docs/superpowers/plans/2026-04-30-parser-redesign.md
-- Replaces parts of 020_eurovision_parser.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Rename eurovision_2026_live → eurovision_2026_participants
-- ---------------------------------------------------------------------------
-- Idempotent: only rename if the old table still exists. Same for the policies
-- (they follow the rename, but get renamed too for clarity).
do $rename$
begin
  if exists (
    select 1 from pg_tables
     where schemaname = 'public' and tablename = 'eurovision_2026_live'
  ) then
    execute 'alter table public.eurovision_2026_live rename to eurovision_2026_participants';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'eurovision_2026_participants'
       and policyname = 'live_read'
  ) then
    execute 'alter policy live_read on public.eurovision_2026_participants rename to participants_read';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'eurovision_2026_participants'
       and policyname = 'live_admin'
  ) then
    execute 'alter policy live_admin on public.eurovision_2026_participants rename to participants_admin';
  end if;
end
$rename$;

-- ---------------------------------------------------------------------------
-- 2. Create eurovision_2026_results
-- ---------------------------------------------------------------------------
create table if not exists public.eurovision_2026_results (
  iso              text primary key
    references public.eurovision_2026_participants(iso) on delete cascade,
  ranking          int  not null check (ranking between 1 and 50),
  total_points     int  not null check (total_points >= 0),
  jury_points      int  not null check (jury_points >= 0),
  televote_points  int  not null check (televote_points >= 0),
  source           text not null,
  updated_at       timestamptz not null default now()
);

alter table public.eurovision_2026_results enable row level security;

drop policy if exists results_read  on public.eurovision_2026_results;
drop policy if exists results_admin on public.eurovision_2026_results;

create policy results_read on public.eurovision_2026_results
  for select using (true);
create policy results_admin on public.eurovision_2026_results
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 3. parse_jobs: collapse to one row per (year, kind)
-- ---------------------------------------------------------------------------

-- 3a. Add kind column
alter table public.parse_jobs
  add column if not exists kind text;

-- 3b. Backfill existing rows: any pre-021 row was a "results"-style job
update public.parse_jobs set kind = 'results' where kind is null;

alter table public.parse_jobs
  alter column kind set not null,
  alter column kind set default 'results';

-- 3c. Expand status enum
alter table public.parse_jobs
  drop constraint if exists parse_jobs_status_check;
alter table public.parse_jobs
  add constraint parse_jobs_status_check
  check (status in ('idle','running','stopped','finalized','done','error'));

-- 3d. Collapse duplicates: keep the most recent row per (year, kind), delete the rest
with ranked as (
  select id,
         row_number() over (partition by year, kind order by started_at desc nulls last) as rn
    from public.parse_jobs
)
delete from public.parse_jobs
 where id in (select id from ranked where rn > 1);

-- 3e. Add unique constraint on (year, kind). Idempotent.
do $uniq$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'parse_jobs_year_kind_key'
       and conrelid = 'public.parse_jobs'::regclass
  ) then
    execute 'alter table public.parse_jobs add constraint parse_jobs_year_kind_key unique (year, kind)';
  end if;
end
$uniq$;

-- 3f. status default → 'idle'  (was 'running' in 020)
alter table public.parse_jobs alter column status set default 'idle';

-- ---------------------------------------------------------------------------
-- 4. parse_runs: add kind so the run log is filterable per parser
-- ---------------------------------------------------------------------------
alter table public.parse_runs
  add column if not exists kind text not null default 'results';

create index if not exists parse_runs_year_kind_finished_idx
  on public.parse_runs(year, kind, finished_at desc);

-- ---------------------------------------------------------------------------
-- 5. Drop the old schedule table (replaced by hardcoded cron expressions)
-- ---------------------------------------------------------------------------
drop policy if exists schedule_admin_all on public.eurovision_parse_schedule;
drop table if exists public.eurovision_parse_schedule;

-- ---------------------------------------------------------------------------
-- 6. Seed 2026 jobs at idle
-- ---------------------------------------------------------------------------

-- 6a. Drop NOT NULL + default on started_at FIRST. The seed inserts below
--     leave started_at null (idle jobs have never started). In migration 020
--     this column was NOT NULL DEFAULT now(); we relax both before any insert
--     can collide with the constraint.
alter table public.parse_jobs alter column started_at drop not null;
alter table public.parse_jobs alter column started_at drop default;

-- 6b. Upsert participants and results jobs at idle. Explicitly write
--     started_at = null so any residual default behaviour is overridden.
--     If a finalized results row already exists, leave it alone (never resurrect).
insert into public.parse_jobs (year, kind, status, triggered_by_user, started_at)
values (2026, 'participants', 'idle', false, null)
on conflict (year, kind) do update
  set status = case when public.parse_jobs.status = 'finalized'
                    then 'finalized'
                    else 'idle' end,
      poll_count = 0, last_poll_at = null,
      started_at = null, stopped_at = null, started_by = null;

insert into public.parse_jobs (year, kind, status, triggered_by_user, started_at)
values (2026, 'results', 'idle', false, null)
on conflict (year, kind) do update
  set status = case when public.parse_jobs.status = 'finalized'
                    then 'finalized'
                    else 'idle' end,
      poll_count = 0, last_poll_at = null,
      started_at = null, stopped_at = null, started_by = null;

-- ---------------------------------------------------------------------------
-- 7. Replace RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.start_parse_job(int);
drop function if exists public.stop_parse_job(int);

-- start_parse_job(p_year, p_kind): idle → running. Forbidden from any other state.
create or replace function public.start_parse_job(p_year int, p_kind text)
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
  if v_status <> 'idle' then
    raise exception 'invalid state transition: % -> running (kind=%)', v_status, p_kind;
  end if;
  update public.parse_jobs
    set status='running', started_at=now(), started_by=auth.uid(),
        triggered_by_user=true, last_poll_at=null, poll_count=0,
        stopped_at=null
    where year = p_year and kind = p_kind;
end;
$fn$;

-- stop_parse_job(p_year): results only, running → stopped.
create or replace function public.stop_parse_job(p_year int)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_status text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  select status into v_status
    from public.parse_jobs where year = p_year and kind = 'results';
  if v_status <> 'running' then
    raise exception 'invalid state transition: % -> stopped',
      coalesce(v_status, '<null>');
  end if;
  update public.parse_jobs
    set status='stopped', stopped_at=now()
    where year = p_year and kind = 'results';
end;
$fn$;

-- resume_parse_job(p_year): results only, stopped → running.
create or replace function public.resume_parse_job(p_year int)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_status text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  select status into v_status
    from public.parse_jobs where year = p_year and kind = 'results';
  if v_status <> 'stopped' then
    raise exception 'invalid state transition: % -> running (resume)',
      coalesce(v_status, '<null>');
  end if;
  update public.parse_jobs
    set status='running', stopped_at=null
    where year = p_year and kind = 'results';
end;
$fn$;

-- finalize_results(p_year): any non-finalized state → finalized (terminal).
create or replace function public.finalize_results(p_year int)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_status text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  select status into v_status
    from public.parse_jobs where year = p_year and kind = 'results';
  if v_status is null then
    raise exception 'no results job for year %', p_year;
  end if;
  if v_status = 'finalized' then return; end if;
  update public.parse_jobs
    set status='finalized', stopped_at=now()
    where year = p_year and kind = 'results';
end;
$fn$;

-- reset_parse_job(p_year, p_kind): admin escape hatch.
-- Participants:  done|error → idle.
-- Results:       error|stopped → idle. (Use Resume to go stopped→running.)
-- Never resets a finalized job.
create or replace function public.reset_parse_job(p_year int, p_kind text)
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
  if v_status = 'finalized' then
    raise exception 'cannot reset a finalized job';
  end if;
  if p_kind = 'participants' and v_status not in ('error','done') then
    raise exception 'reset only allowed from error|done (participants), was %',
      coalesce(v_status,'<null>');
  end if;
  if p_kind = 'results' and v_status not in ('error','stopped') then
    raise exception 'reset only allowed from error|stopped (results), was %',
      coalesce(v_status,'<null>');
  end if;
  update public.parse_jobs
    set status='idle', started_at=null, stopped_at=null,
        last_poll_at=null, poll_count=0
    where year = p_year and kind = p_kind;
end;
$fn$;

-- increment_poll_count(p_year, p_kind): tiny helper called by the edge function
-- after each successful poll. Atomic and trivially cheap.
create or replace function public.increment_poll_count(p_year int, p_kind text)
returns void
language sql security definer set search_path = public
as $$
  update public.parse_jobs
    set poll_count = coalesce(poll_count, 0) + 1,
        last_poll_at = now()
    where year = p_year and kind = p_kind and status = 'running';
$$;

grant execute on function public.start_parse_job(int, text)        to authenticated;
grant execute on function public.stop_parse_job(int)               to authenticated;
grant execute on function public.resume_parse_job(int)             to authenticated;
grant execute on function public.finalize_results(int)             to authenticated;
grant execute on function public.reset_parse_job(int, text)        to authenticated;
grant execute on function public.increment_poll_count(int, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Cron rows: drop old, create new
-- ---------------------------------------------------------------------------

-- 8a. Drop old crons (idempotent — safe if pg_cron is missing or names absent).
do $outer$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    -- silently swallow "could not find job" for first-run idempotency
    begin perform cron.unschedule('eurovision-2026-fallback'); exception when others then null; end;
    begin perform cron.unschedule('eurovision-parse-poll');   exception when others then null; end;
  end if;
end $outer$;

-- 8b. Participants fallback — Fri 15 May 00:00 UTC (= 03:00 Athens EEST).
--     One-off body: only fires when the participants job is still 'idle'.
do $outer$
begin
  if exists (select 1 from pg_extension where extname='pg_cron')
     and exists (select 1 from pg_extension where extname='pg_net') then
    begin perform cron.unschedule('parser-participants-2026-fallback'); exception when others then null; end;
    perform cron.schedule(
      'parser-participants-2026-fallback',
      '0 0 15 5 *',
      $cron$
        select net.http_post(
          url := current_setting('app.settings.functions_url', true) || '/eurovision-parse',
          headers := jsonb_build_object(
            'content-type','application/json',
            'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := jsonb_build_object('action','participants')
        )
        where (select status from public.parse_jobs
                where year=2026 and kind='participants') = 'idle';
      $cron$
    );
  end if;
end $outer$;

-- 8c. Results auto-start — Sat 16 May 20:30 UTC (= 23:30 Athens EEST).
--     Pure SQL transition, no edge function call.
do $outer$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule('parser-results-2026-start'); exception when others then null; end;
    perform cron.schedule(
      'parser-results-2026-start',
      '30 20 16 5 *',
      $cron$
        update public.parse_jobs
          set status='running', started_at=now(),
              triggered_by_user=false,
              last_poll_at=null, poll_count=0, stopped_at=null
          where year=2026 and kind='results' and status='idle';
      $cron$
    );
  end if;
end $outer$;

-- 8d. Results poller — every 2 min while running and before Sun 17 May 00:00 UTC.
do $outer$
begin
  if exists (select 1 from pg_extension where extname='pg_cron')
     and exists (select 1 from pg_extension where extname='pg_net') then
    begin perform cron.unschedule('parser-results-2026-poll'); exception when others then null; end;
    perform cron.schedule(
      'parser-results-2026-poll',
      '*/2 * * * *',
      $cron$
        select net.http_post(
          url := current_setting('app.settings.functions_url', true) || '/eurovision-parse',
          headers := jsonb_build_object(
            'content-type','application/json',
            'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := jsonb_build_object('action','results')
        )
        where (select status from public.parse_jobs
                where year=2026 and kind='results') = 'running'
          and now() < timestamptz '2026-05-17 00:00:00+00';
      $cron$
    );
  end if;
end $outer$;

commit;
