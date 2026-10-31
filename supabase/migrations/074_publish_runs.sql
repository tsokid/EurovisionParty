-- ============================================================
-- 074: publish_runs and the publish-content RPCs (spec §7)
-- ------------------------------------------------------------
-- * publish_runs: one row per Publish. status running → ok | noop | error,
--   with the commit SHA, the number of files changed and the error text.
-- * begin_publish(p_cms default true) (super admin): serializes publishes.
--   Raises 'publish already running' while a run younger than 10 minutes
--   is running; an older running row is closed as error ('timed out') and
--   does not block. Inserts and returns a running row. p_cms (stored as
--   publish_runs.cms) says whether the run ships CMS drafts: false for the
--   contest lifecycle auto-publish (Finalize / Archive / Un-archive), which
--   ships contests only, so it never counts as publishing the drafts.
-- * end_publish(id, status, sha, files, error) (service_role): closes a
--   running row. ok and noop stamp contests.published_at (every contest
--   is in the snapshot, so every contest is published).
-- * publish_input() (service_role): the buildSnapshotFiles input,
--   { contests, countries, entries, generated_at, cms_documents, media },
--   with exactly the columns of ContestRow / CountryRow / EntryRow
--   (src/content/contests/types.ts). generated_at is the latest
--   updated_at of contests and contest_entries, so unchanged data gives a
--   byte-identical site.json and Publish can be a no-op. cms_documents is
--   [{doc_id, doc_type, data}] from 076's draft table, by doc_id: only the
--   drafts saved after the CMS since (below), every draft before the first
--   CMS publish. An already-published draft is neither re-validated nor
--   re-written (a schema change can never make it block a publish).
--   media is [{id, kind, storage_path, mime, bytes, sha256, published_path,
--   variant_of, width, height}] from 077's cms_media, by storage_path:
--   every row whose cms-media/<id> appears (case-insensitively) in one of
--   those cms_documents drafts, plus the variants of those rows. [] while cms_media does not
--   exist (077 not applied yet).
-- * unpublished_summary() (super admin): { changed_years, changed_docs,
--   since }. since is started_at of the last successful (ok or noop)
--   run, null before the first. started_at precedes the run's publish_input read, so an edit
--   made while a run is in flight stays unpublished. changed_years are the
--   years whose contest row or any entry has updated_at after since (every
--   year when since is null). Deleted entries leave no updated_at behind
--   and are not detected. changed_docs are the cms_documents doc_ids with
--   updated_at after the CMS since: started_at of the last ok/noop run with
--   cms = true (every draft before the first). A contests-only run moves
--   since but not the CMS since. A discarded draft is not listed.
-- * publish_input() and unpublished_summary() read cms_documents, which
--   076 creates (and publish_input reads 077's cms_media). Both are
--   plpgsql (bodies resolved at call time), so this file applies before
--   076; neither is called before 076 is in place.
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
  started_by    uuid,
  -- Whether the run ships CMS drafts (begin_publish(p_cms)).
  cms           boolean not null default true
);

-- A database where an earlier 074 ran has the table without cms.
alter table public.publish_runs add column if not exists cms boolean not null default true;

create index if not exists publish_runs_status_idx on public.publish_runs (status, finished_at desc);

alter table public.publish_runs enable row level security;
drop policy if exists publish_runs_admin_read on public.publish_runs;
create policy publish_runs_admin_read on public.publish_runs
  for select to authenticated using (public.is_super_admin());

revoke all on public.publish_runs from anon, authenticated;
grant select on public.publish_runs to authenticated;
grant select on public.publish_runs to service_role;

-- ── begin_publish ───────────────────────────────────────────
-- The earlier 074's 0-arg begin_publish() would otherwise stay as an
-- overload and make begin_publish() ambiguous.
drop function if exists public.begin_publish();
create or replace function public.begin_publish(p_cms boolean default true)
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

  insert into public.publish_runs (status, started_by, cms)
  values ('running', auth.uid(), coalesce(p_cms, true))
  returning id into v_id;
  return v_id;
end;
$fn$;

revoke execute on function public.begin_publish(boolean) from public, anon;
grant execute on function public.begin_publish(boolean) to authenticated;

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
-- plpgsql, not sql: a sql body would resolve cms_documents (076) now.
create or replace function public.publish_input()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_cms_since timestamptz;
  v_media     jsonb := '[]'::jsonb;
begin
  select max(r.started_at) into v_cms_since
    from public.publish_runs r
   where r.status in ('ok', 'noop') and r.cms;

  -- 077 may not be applied yet; this statement is planned only when run.
  if to_regclass('public.cms_media') is not null then
    with drafts as (
      select lower(d.data::text) as t
        from public.cms_documents d
       where v_cms_since is null or d.updated_at > v_cms_since
    ), referenced as (
      select m.id
        from public.cms_media m
       where exists (select 1 from drafts where strpos(drafts.t, 'cms-media/' || m.id::text) > 0)
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', m.id, 'kind', m.kind, 'storage_path', m.storage_path, 'mime', m.mime,
             'bytes', m.bytes, 'sha256', m.sha256, 'published_path', m.published_path,
             'variant_of', m.variant_of, 'width', m.width, 'height', m.height)
           order by m.storage_path), '[]'::jsonb)
      into v_media
      from public.cms_media m
     where m.id in (select id from referenced)
        or m.variant_of in (select id from referenced);
  end if;

  return jsonb_build_object(
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
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'cms_documents', coalesce((
      select jsonb_agg(jsonb_build_object('doc_id', d.doc_id, 'doc_type', d.doc_type, 'data', d.data)
             order by d.doc_id)
        from public.cms_documents d
       where v_cms_since is null or d.updated_at > v_cms_since), '[]'::jsonb),
    'media', v_media
  );
end;
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
  v_cms_since timestamptz;
  v_years int[];
  v_docs  text[];
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select max(started_at) into v_since
    from public.publish_runs
   where status in ('ok', 'noop');

  select max(started_at) into v_cms_since
    from public.publish_runs
   where status in ('ok', 'noop') and cms;

  select coalesce(array_agg(c.year order by c.year), '{}')
    into v_years
    from public.contests c
   where v_since is null
      or c.updated_at > v_since
      or exists (select 1 from public.contest_entries e
                  where e.year = c.year and e.updated_at > v_since);

  select coalesce(array_agg(d.doc_id order by d.doc_id), '{}')
    into v_docs
    from public.cms_documents d
   where v_cms_since is null
      or d.updated_at > v_cms_since;

  return jsonb_build_object('changed_years', to_jsonb(v_years),
                            'changed_docs', to_jsonb(v_docs),
                            'since', v_since);
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
