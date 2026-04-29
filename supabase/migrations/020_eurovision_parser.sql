-- 020_eurovision_parser.sql
-- Eurovision parser: per-year config, manual job control, cron fallback, run log,
-- and the live entries table that the edge function upserts into.

create table if not exists public.eurovision_parse_schedule (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  source_url text not null,
  scheduled_parse_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.eurovision_parse_schedule(year, source_url, scheduled_parse_at)
values (2026, 'https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/',
        '2026-05-15 00:00:00+00')
on conflict (year) do nothing;

create table if not exists public.parse_jobs (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  status text not null check (status in ('running','stopped','error')) default 'running',
  triggered_by_user boolean not null default true,
  started_by uuid references auth.users(id),
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  last_poll_at timestamptz,
  poll_count int not null default 0
);

create table if not exists public.parse_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.parse_jobs(id) on delete cascade,
  year int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  http_status int,
  status text check (status in ('ok','error','blocked')) default null,
  rows_upserted int default 0,
  payload_hash text,
  error text
);

create table if not exists public.eurovision_2026_live (
  iso text primary key,
  name text,
  artist text,
  song text,
  running_order int,
  source text,
  updated_at timestamptz not null default now()
);

alter table public.eurovision_parse_schedule enable row level security;
alter table public.parse_jobs enable row level security;
alter table public.parse_runs enable row level security;
alter table public.eurovision_2026_live enable row level security;

drop policy if exists schedule_admin_all on public.eurovision_parse_schedule;
drop policy if exists jobs_admin_all on public.parse_jobs;
drop policy if exists runs_admin_all on public.parse_runs;
drop policy if exists live_read on public.eurovision_2026_live;
drop policy if exists live_admin on public.eurovision_2026_live;

create policy schedule_admin_all on public.eurovision_parse_schedule
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy jobs_admin_all on public.parse_jobs
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy runs_admin_all on public.parse_runs
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy live_read on public.eurovision_2026_live for select using (true);
create policy live_admin on public.eurovision_2026_live for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create or replace function public.start_parse_job(p_year int)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  update public.parse_jobs set status='stopped', stopped_at=now()
    where year=p_year and status='running';
  insert into public.parse_jobs(year, started_by) values (p_year, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.stop_parse_job(p_year int)
returns void language plpgsql security definer as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  update public.parse_jobs set status='stopped', stopped_at=now()
    where year=p_year and status='running';
end;
$$;

-- Cron fallback: at 2026-05-15 00:00 UTC (= 03:00 Athens EEST), if no manual job
-- already exists for 2026, kick one. Guarded so it no-ops if pg_cron isn't enabled.
do $outer$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule(
      'eurovision-2026-fallback',
      '0 0 15 5 *',
      $cron$
      do $body$
      begin
        if not exists (select 1 from public.parse_jobs where year=2026 and triggered_by_user=true) then
          insert into public.parse_jobs(year, triggered_by_user) values (2026, false);
        end if;
      end;
      $body$;
      $cron$
    );
  end if;
end $outer$;

-- Every 2 minutes, ping the edge function so it picks up running jobs.
do $outer$
begin
  if exists (select 1 from pg_extension where extname='pg_cron')
     and exists (select 1 from pg_extension where extname='pg_net') then
    perform cron.schedule(
      'eurovision-parse-poll', '*/2 * * * *',
      $cron$
      select net.http_post(
        url := current_setting('app.settings.functions_url', true) || '/eurovision-parse',
        headers := jsonb_build_object(
          'content-type','application/json',
          'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
        )
      );
      $cron$
    );
  end if;
end $outer$;
