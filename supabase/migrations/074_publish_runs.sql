-- ============================================================
-- 074: publish_runs and the publish-content RPCs (spec §7)
-- ------------------------------------------------------------
-- * publish_runs: one row per Publish. status running → ok | noop | error,
--   with the commit SHA, the number of files changed and the error text.
-- * begin_publish() (super admin): serializes publishes. Raises
--   'publish already running' while a run younger than 10 minutes is
--   running; an older running row is closed as error ('timed out') and
--   does not block. Inserts and returns a running row.
-- * end_publish(id, status, sha, files, error) (service_role): closes a
--   running row. ok and noop stamp contests.published_at (every contest
--   is in the snapshot, so every contest is published).
-- * publish_input() (service_role): the buildSnapshotFiles input,
--   { contests, countries, entries, generated_at }, with exactly the
--   columns of ContestRow / CountryRow / EntryRow
--   (src/content/contests/types.ts). generated_at is the latest
--   updated_at of contests and contest_entries, so unchanged data gives a
--   byte-identical site.json and Publish can be a no-op.
-- * unpublished_summary() (super admin): { changed_years, since }. since
--   is started_at of the last successful (ok or noop) run, null before the
--   first. started_at precedes the run's publish_input read, so an edit
--   made while a run is in flight stays unpublished. changed_years are the
--   years whose contest row or any entry has updated_at after since (every
--   year when since is null). Deleted entries leave no updated_at behind
--   and are not detected.
-- * last_publish_run() (super admin): the newest publish_runs row as jsonb
--   (id, started_at, finished_at, status, commit_sha, files_changed,
--   error), null before the first run. Feeds the admin PublishBar.
-- * RLS on publish_runs: super admins read; writes only through the RPCs.
--
-- Idempotent: safe to run twice.
-- ============================================================

begin;

create table if not exists public.publish_runs (
  id            bigserial primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running'
                check (status in ('running', 'ok', 'noop', 'error')),
  commit_sha    text,
  files_changed int,
  error         text,
  started_by    uuid
);

create index if not exists publish_runs_status_idx on public.publish_runs (status, finished_at desc);

alter table public.publish_runs enable row level security;
drop policy if exists publish_runs_admin_read on public.publish_runs;
create policy publish_runs_admin_read on public.publish_runs
  for select to authenticated using (public.is_super_admin());

revoke all on public.publish_runs from anon, authenticated;
grant select on public.publish_runs to authenticated;
grant select on public.publish_runs to service_role;

-- ── begin_publish ───────────────────────────────────────────
create or replace function public.begin_publish()
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id bigint;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  -- Serialize concurrent callers: the second waits here, then sees the
  -- first one's running row.
  lock table public.publish_runs in share row exclusive mode;

  update public.publish_runs
     set status = 'error', finished_at = now(), error = 'timed out (still running after 10 minutes)'
   where status = 'running' and started_at < now() - interval '10 minutes';

  if exists (select 1 from public.publish_runs where status = 'running') then
    raise exception 'publish already running';
  end if;

  insert into public.publish_runs (status, started_by)
  values ('running', auth.uid())
  returning id into v_id;
  return v_id;
end;
$fn$;

revoke execute on function public.begin_publish() from public, anon;
grant execute on function public.begin_publish() to authenticated;

-- ── end_publish ─────────────────────────────────────────────
create or replace function public.end_publish(p_id bigint, p_status text, p_sha text, p_files int, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_status is null or p_status not in ('ok', 'noop', 'error') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.publish_runs
     set status = p_status, finished_at = now(),
         commit_sha = p_sha, files_changed = p_files, error = p_error
   where id = p_id and status = 'running';
  if not found then
    raise exception 'publish run % is not running', p_id;
  end if;

  if p_status in ('ok', 'noop') then
    update public.contests set published_at = now() where true;
  end if;
end;
$fn$;

revoke execute on function public.end_publish(bigint, text, text, int, text) from public, anon, authenticated;
grant execute on function public.end_publish(bigint, text, text, int, text) to service_role;

-- ── publish_input ───────────────────────────────────────────
create or replace function public.publish_input()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'contests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'year', c.year, 'host_iso', c.host_iso, 'city', c.city, 'city_slug', c.city_slug,
               'semi1_date', c.semi1_date, 'semi2_date', c.semi2_date, 'final_date', c.final_date,
               'stage', c.stage, 'indexable', c.indexable, 'cancelled', c.cancelled)
             order by c.year)
        from public.contests c), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'iso', co.iso, 'name_en', co.name_en, 'name_el', co.name_el,
               'slug', co.slug, 'related_iso', to_jsonb(co.related_iso))
             order by co.iso)
        from public.countries co), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'year', e.year, 'iso', e.iso, 'artist', e.artist, 'song', e.song, 'language', e.language,
               'semi', e.semi, 'semi_running_order', e.semi_running_order, 'semi_place', e.semi_place,
               'semi_points', e.semi_points, 'qualified', e.qualified, 'in_final', e.in_final,
               'final_running_order', e.final_running_order, 'final_place', e.final_place,
               'total_points', e.total_points, 'jury_points', e.jury_points,
               'televote_points', e.televote_points, 'source', e.source)
             order by e.year, e.iso)
        from public.contest_entries e), '[]'::jsonb),
    'generated_at', to_char(
      coalesce(greatest((select max(updated_at) from public.contests),
                        (select max(updated_at) from public.contest_entries)),
               'epoch'::timestamptz) at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
$fn$;

revoke execute on function public.publish_input() from public, anon, authenticated;
grant execute on function public.publish_input() to service_role;

-- ── unpublished_summary ─────────────────────────────────────
create or replace function public.unpublished_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_since timestamptz;
  v_years int[];
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select max(started_at) into v_since
    from public.publish_runs
   where status in ('ok', 'noop');

  select coalesce(array_agg(c.year order by c.year), '{}')
    into v_years
    from public.contests c
   where v_since is null
      or c.updated_at > v_since
      or exists (select 1 from public.contest_entries e
                  where e.year = c.year and e.updated_at > v_since);

  return jsonb_build_object('changed_years', to_jsonb(v_years), 'since', v_since);
end;
$fn$;

revoke execute on function public.unpublished_summary() from public, anon;
grant execute on function public.unpublished_summary() to authenticated;

-- ── last_publish_run ────────────────────────────────────────
create or replace function public.last_publish_run()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  return (
    select jsonb_build_object(
             'id', r.id, 'started_at', r.started_at, 'finished_at', r.finished_at,
             'status', r.status, 'commit_sha', r.commit_sha,
             'files_changed', r.files_changed, 'error', r.error)
      from public.publish_runs r
     order by r.id desc
     limit 1
  );
end;
$fn$;

revoke execute on function public.last_publish_run() from public, anon;
grant execute on function public.last_publish_run() to authenticated;

commit;
