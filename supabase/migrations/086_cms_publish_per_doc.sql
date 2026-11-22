-- ============================================================
-- 086: per-document publish, deploy state, auto-revert (CMS P5)
-- ------------------------------------------------------------
-- Spec 2026-11-21-cms-track3-design.md §6, §7, §8 P5, §9. Owner Q3 = C:
-- the site-wide docs (site-header, site-footer, site-settings) go through a
-- Vercel preview on the content-preview branch first; every other doc goes
-- straight to main, behind the P1 SEO guard in the build.
--
-- * cms_documents.published_updated_at: the updated_at of the version that
--   is live, per document. A draft is published when updated_at <=
--   published_updated_at. Backfilled ONCE (when the column is added) from
--   the old global rule: updated_at <= started_at of the last ok/noop run
--   that shipped CMS drafts.
-- * publish_runs gains
--     doc_ids        the docs the run ships (null: every unpublished draft,
--                    plus the contests: the old "Publish all")
--     target         'main' (the site) or 'preview' (content-preview branch)
--     promoted_from  the preview run a main run promotes («Βγάλ' το live»)
--     shipped        [{doc_id, updated_at, prev}] stamped by end_publish:
--                    the version shipped and the stamp it replaced (an
--                    auto-revert puts prev back)
--     deploy_state   building | ready | error | reverted | revert_blocked
--     deploy_url     the Vercel deployment (the preview URL for a preview)
--     deploy_note    why a revert did not happen, or what failed
--     deploy_checked_at, reverted_sha
-- * begin_publish(p_cms, p_doc_ids, p_target, p_promote) (super admin)
--   replaces begin_publish(p_cms). Runs stay serialized (table lock, 10-min
--   timeout, 'publish already running'), and a main run is also refused
--   while the previous main deploy is building (under 15 minutes old), so an
--   auto-revert never races the next publish (spec §9). Site-wide docs are
--   refused on a direct main run: they need a preview run, then a promote.
--   p_promote: the ok preview run whose deploy is ready; its doc_ids are
--   used, and it can be promoted once.
-- * publish_input(p_doc_ids, p_skip_site_wide) (service role) replaces
--   publish_input(): only the given docs (null = all), only drafts newer than
--   their own published_updated_at, each with its updated_at. p_skip_site_wide
--   drops the site-wide docs (a direct main "Publish all").
-- * end_publish(..., p_shipped) (service role) replaces the 5-arg one. On ok
--   or noop of a main run it stamps published_updated_at for the docs shipped
--   (p_shipped [{doc_id, updated_at, data}]; without it, the drafts saved no
--   later than the run started, among the run's doc_ids) and inserts their
--   'published' revisions (the run and its commit). This replaces P3's
--   interim trigger cms_revisions_on_publish, which is dropped. A full run
--   (doc_ids null) still stamps contests.published_at. A preview run stamps
--   nothing: its docs go live only when promoted. A commit starts the
--   deploy state at 'building'.
-- * set_deploy_state(run, state, url, reverted_sha, note) (service role,
--   called by the publish-status edge function). 'reverted' puts the shipped
--   docs' previous stamps back (unless a later publish moved them), so the
--   drafts show as unpublished again. A reverted run never changes state.
-- * cms_list.published and unpublished_summary.changed_docs read the per-doc
--   stamp. last_publish_run returns the new columns.
--
-- RLS: unchanged (super admins read publish_runs; writes only via the RPCs).
-- Idempotent: safe to run twice.
-- ============================================================

begin;

-- ── columns ─────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cms_documents' and column_name = 'published_updated_at'
  ) then
    alter table public.cms_documents add column published_updated_at timestamptz;
    -- Backfill from the old global rule, once: a rerun must never re-mark a
    -- draft that a later per-doc run did not ship.
    update public.cms_documents d
       set published_updated_at = d.updated_at
     where d.updated_at <= (select max(r.started_at) from public.publish_runs r
                             where r.status in ('ok', 'noop') and r.cms);
  end if;
end $$;

alter table public.publish_runs add column if not exists doc_ids text[];
alter table public.publish_runs add column if not exists target text not null default 'main';
alter table public.publish_runs add column if not exists promoted_from bigint;
alter table public.publish_runs add column if not exists shipped jsonb;
alter table public.publish_runs add column if not exists deploy_state text;
alter table public.publish_runs add column if not exists deploy_url text;
alter table public.publish_runs add column if not exists deploy_note text;
alter table public.publish_runs add column if not exists deploy_checked_at timestamptz;
alter table public.publish_runs add column if not exists reverted_sha text;

alter table public.publish_runs drop constraint if exists publish_runs_target_check;
alter table public.publish_runs add constraint publish_runs_target_check check (target in ('main', 'preview'));
alter table public.publish_runs drop constraint if exists publish_runs_deploy_state_check;
alter table public.publish_runs add constraint publish_runs_deploy_state_check
  check (deploy_state is null or deploy_state in ('building', 'ready', 'error', 'reverted', 'revert_blocked'));

create index if not exists publish_runs_deploy_idx on public.publish_runs (target, deploy_state, finished_at desc);

-- ── P3's interim published-revision trigger goes: end_publish does it ──
drop trigger if exists cms_revisions_on_publish on public.publish_runs;
drop function if exists public.cms_revisions_on_publish();

-- ── begin_publish ───────────────────────────────────────────
drop function if exists public.begin_publish(boolean);
create or replace function public.begin_publish(
  p_cms boolean default true,
  p_doc_ids text[] default null,
  p_target text default 'main',
  p_promote bigint default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id     bigint;
  v_docs   text[] := p_doc_ids;
  v_target text := coalesce(p_target, 'main');
  v_src    public.publish_runs%rowtype;
  c_site_wide constant text[] := array['site-header', 'site-footer', 'site-settings'];
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if v_target not in ('main', 'preview') then
    raise exception 'invalid target %', p_target;
  end if;
  if v_docs is not null and cardinality(v_docs) = 0 then
    raise exception 'no documents to publish';
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

  if p_promote is not null then
    select * into v_src from public.publish_runs where id = p_promote;
    if not found or v_src.target <> 'preview' or v_src.status <> 'ok' or v_src.commit_sha is null then
      raise exception 'nothing to promote: run % is not a committed preview', p_promote;
    end if;
    if v_src.deploy_state is distinct from 'ready' then
      raise exception 'the preview of run % is not ready', p_promote;
    end if;
    if exists (select 1 from public.publish_runs
                where promoted_from = p_promote and status in ('running', 'ok', 'noop')) then
      raise exception 'run % is already live', p_promote;
    end if;
    v_target := 'main';
    v_docs := v_src.doc_ids;
  elsif v_target = 'preview' then
    if v_docs is null or not coalesce(p_cms, true) then
      raise exception 'a preview needs the documents it shows';
    end if;
    if not v_docs <@ c_site_wide then
      raise exception 'only the site-wide documents go through a preview';
    end if;
  elsif v_docs is not null and v_docs && c_site_wide then
    raise exception 'site-wide documents go through a preview first';
  end if;

  -- A main publish waits for the previous main deploy (spec §9: an auto-revert
  -- must never land on top of a newer publish).
  if v_target = 'main' and exists (
    select 1 from public.publish_runs
     where target = 'main' and commit_sha is not null and deploy_state = 'building'
       and finished_at > now() - interval '15 minutes'
  ) then
    raise exception 'publish already running (the previous deploy is still building)';
  end if;

  insert into public.publish_runs (status, started_by, cms, doc_ids, target, promoted_from)
  values ('running', auth.uid(), coalesce(p_cms, true), v_docs, v_target, p_promote)
  returning id into v_id;
  return v_id;
end;
$fn$;

revoke execute on function public.begin_publish(boolean, text[], text, bigint) from public, anon;
grant execute on function public.begin_publish(boolean, text[], text, bigint) to authenticated;

-- ── end_publish ─────────────────────────────────────────────
drop function if exists public.end_publish(bigint, text, text, int, text);
create or replace function public.end_publish(
  p_id bigint, p_status text, p_sha text, p_files int, p_error text, p_shipped jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_run     public.publish_runs%rowtype;
  v_ship    jsonb;
  v_item    jsonb;
  v_doc     public.cms_documents%rowtype;
  v_at      timestamptz;
  v_data    jsonb;
  v_out     jsonb := '[]'::jsonb;
begin
  if p_status is null or p_status not in ('ok', 'noop', 'error') then
    raise exception 'invalid status %', p_status;
  end if;
  if p_shipped is not null and jsonb_typeof(p_shipped) <> 'array' then
    raise exception 'p_shipped must be a list';
  end if;

  update public.publish_runs
     set status = p_status, finished_at = now(),
         commit_sha = p_sha, files_changed = p_files, error = p_error,
         deploy_state = case when p_status = 'ok' and p_sha is not null then 'building' else null end
   where id = p_id and status = 'running'
  returning * into v_run;
  if not found then
    raise exception 'publish run % is not running', p_id;
  end if;

  if p_status not in ('ok', 'noop') then
    return;
  end if;

  if v_run.target = 'preview' then
    -- Nothing is live yet: remember the versions the preview shows, for the promote.
    update public.publish_runs
       set shipped = (select coalesce(jsonb_agg(jsonb_build_object('doc_id', s->>'doc_id', 'updated_at', s->>'updated_at')), '[]'::jsonb)
                        from jsonb_array_elements(coalesce(p_shipped, '[]'::jsonb)) s)
     where id = p_id;
    return;
  end if;

  -- A full run (the old Publish all, or the contests-only lifecycle publish) ships every contest.
  if v_run.doc_ids is null then
    update public.contests set published_at = now() where true;
  end if;

  if not v_run.cms then
    return;
  end if;

  v_ship := coalesce(p_shipped, (
    select coalesce(jsonb_agg(jsonb_build_object('doc_id', d.doc_id, 'updated_at', d.updated_at) order by d.doc_id), '[]'::jsonb)
      from public.cms_documents d
     where d.updated_at <= v_run.started_at
       and (d.published_updated_at is null or d.updated_at > d.published_updated_at)
       and (v_run.doc_ids is null or d.doc_id = any (v_run.doc_ids))));

  for v_item in select * from jsonb_array_elements(v_ship) loop
    select * into v_doc from public.cms_documents where doc_id = v_item->>'doc_id' for update;
    if not found then
      continue;
    end if;
    v_at := (v_item->>'updated_at')::timestamptz;
    if v_doc.published_updated_at is not null and v_doc.published_updated_at >= v_at then
      continue;
    end if;
    update public.cms_documents set published_updated_at = v_at where doc_id = v_doc.doc_id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'doc_id', v_doc.doc_id, 'updated_at', v_at, 'prev', v_doc.published_updated_at));

    v_data := case when v_item ? 'data' and jsonb_typeof(v_item->'data') = 'object' then v_item->'data'
                   when v_doc.updated_at = v_at then v_doc.data
                   else null end;
    if v_data is not null and not exists (
      select 1 from (
        select r.kind, r.data from public.cms_revisions r
         where r.doc_id = v_doc.doc_id order by r.id desc limit 1
      ) last
       where last.kind = 'published' and last.data = v_data
    ) then
      insert into public.cms_revisions (doc_id, doc_type, data, kind, author, run_id, commit_sha)
      values (v_doc.doc_id, v_doc.doc_type, v_data, 'published', coalesce(v_run.started_by, v_doc.updated_by), p_id, p_sha);
    end if;
  end loop;

  update public.publish_runs set shipped = v_out where id = p_id;
end;
$fn$;

revoke execute on function public.end_publish(bigint, text, text, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.end_publish(bigint, text, text, int, text, jsonb) to service_role;

-- ── set_deploy_state ────────────────────────────────────────
create or replace function public.set_deploy_state(
  p_run_id bigint, p_state text, p_url text default null, p_reverted_sha text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_run  public.publish_runs%rowtype;
  v_item jsonb;
begin
  if p_state is null or p_state not in ('building', 'ready', 'error', 'reverted', 'revert_blocked') then
    raise exception 'invalid deploy state %', p_state;
  end if;
  if p_state = 'reverted' and p_reverted_sha is null then
    raise exception 'a revert needs its commit';
  end if;

  select * into v_run from public.publish_runs where id = p_run_id for update;
  if not found or v_run.commit_sha is null then
    raise exception 'publish run % has no commit', p_run_id;
  end if;
  -- A revert is final.
  if v_run.deploy_state = 'reverted' then
    return to_jsonb(v_run) - 'shipped';
  end if;

  update public.publish_runs
     set deploy_state = p_state,
         deploy_url = coalesce(p_url, deploy_url),
         reverted_sha = coalesce(p_reverted_sha, reverted_sha),
         deploy_note = coalesce(p_note, case when p_state in ('building', 'ready') then null else deploy_note end),
         deploy_checked_at = now()
   where id = p_run_id
  returning * into v_run;

  -- The reverted docs are not live: their drafts are unpublished again.
  if p_state = 'reverted' and v_run.target = 'main' and v_run.shipped is not null then
    for v_item in select * from jsonb_array_elements(v_run.shipped) loop
      update public.cms_documents
         set published_updated_at = nullif(v_item->>'prev', '')::timestamptz
       where doc_id = v_item->>'doc_id'
         and published_updated_at = (v_item->>'updated_at')::timestamptz;
    end loop;
  end if;

  return to_jsonb(v_run) - 'shipped';
end;
$fn$;

revoke execute on function public.set_deploy_state(bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.set_deploy_state(bigint, text, text, text, text) to service_role;

-- ── publish_input ───────────────────────────────────────────
drop function if exists public.publish_input();
create or replace function public.publish_input(p_doc_ids text[] default null, p_skip_site_wide boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_media jsonb := '[]'::jsonb;
  c_site_wide constant text[] := array['site-header', 'site-footer', 'site-settings'];
begin
  if to_regclass('public.cms_media') is not null then
    with drafts as (
      select lower(d.data::text) as t
        from public.cms_documents d
       where (d.published_updated_at is null or d.updated_at > d.published_updated_at)
         and (p_doc_ids is null or d.doc_id = any (p_doc_ids))
         and not (coalesce(p_skip_site_wide, false) and d.doc_id = any (c_site_wide))
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
      select jsonb_agg(jsonb_build_object('doc_id', d.doc_id, 'doc_type', d.doc_type, 'data', d.data,
                                          'updated_at', d.updated_at)
             order by d.doc_id)
        from public.cms_documents d
       where (d.published_updated_at is null or d.updated_at > d.published_updated_at)
         and (p_doc_ids is null or d.doc_id = any (p_doc_ids))
         and not (coalesce(p_skip_site_wide, false) and d.doc_id = any (c_site_wide))), '[]'::jsonb),
    'media', v_media
  );
end;
$fn$;

revoke execute on function public.publish_input(text[], boolean) from public, anon, authenticated;
grant execute on function public.publish_input(text[], boolean) to service_role;

-- ── cms_list ────────────────────────────────────────────────
create or replace function public.cms_list()
returns table (doc_id text, doc_type text, updated_at timestamptz, published boolean)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  return query
    select d.doc_id, d.doc_type, d.updated_at,
           coalesce(d.published_updated_at is not null and d.updated_at <= d.published_updated_at, false)
      from public.cms_documents d
     order by d.doc_id;
end;
$fn$;

revoke execute on function public.cms_list() from public, anon;
grant execute on function public.cms_list() to authenticated;

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
  v_docs  text[];
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  -- Contests: since the last run that shipped them (a full main run).
  select max(started_at) into v_since
    from public.publish_runs
   where status in ('ok', 'noop') and target = 'main' and doc_ids is null;

  select coalesce(array_agg(c.year order by c.year), '{}')
    into v_years
    from public.contests c
   where v_since is null
      or c.updated_at > v_since
      or exists (select 1 from public.contest_entries e
                  where e.year = c.year and e.updated_at > v_since);

  -- Documents: per doc, against the version that is live.
  select coalesce(array_agg(d.doc_id order by d.doc_id), '{}')
    into v_docs
    from public.cms_documents d
   where d.published_updated_at is null
      or d.updated_at > d.published_updated_at;

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
             'files_changed', r.files_changed, 'error', r.error,
             'doc_ids', to_jsonb(r.doc_ids), 'target', r.target, 'promoted_from', r.promoted_from,
             'deploy_state', r.deploy_state, 'deploy_url', r.deploy_url, 'deploy_note', r.deploy_note,
             'reverted_sha', r.reverted_sha)
      from public.publish_runs r
     order by r.id desc
     limit 1
  );
end;
$fn$;

revoke execute on function public.last_publish_run() from public, anon;
grant execute on function public.last_publish_run() to authenticated;

commit;
