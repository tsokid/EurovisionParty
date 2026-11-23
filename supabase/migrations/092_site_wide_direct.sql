-- ============================================================
-- 092: the header, footer and settings may go live without a preview
-- ------------------------------------------------------------
-- Owner, 23 Nov 2026 (option C): the Vercel preview of a site-wide doc
-- becomes optional. The publish screen offers «Φτιάξε προεπισκόπηση» (as
-- before) and «Κατευθείαν live», which ships the named site-wide doc to
-- main like a page publish. A failed build is reverted by publish-status,
-- as for any content run.
--
-- begin_publish is 090's, minus the refusal of site-wide docs on main.
-- Unchanged: a preview still takes only site-wide docs; "Publish all"
-- (doc_ids null) still skips them; the building hold and the fast lane.
--
-- Idempotent: safe to run twice. Same signature and grants as 086/090.
-- ============================================================

begin;

-- ── begin_publish ───────────────────────────────────────────
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
  v_fast   boolean := not coalesce(p_cms, true);
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
  if v_fast and (v_docs is not null or p_promote is not null or v_target <> 'main') then
    raise exception 'a contests-only publish ships no documents';
  end if;

  -- Serialize concurrent callers: the second waits here, then sees the
  -- first one's running row.
  lock table public.publish_runs in share row exclusive mode;

  update public.publish_runs
     set status = 'error', finished_at = now(), error = 'timed out (still running after 10 minutes)'
   where status = 'running' and started_at < now() - interval '10 minutes';

  -- The results take over a "Publish all" or contests run stuck for 90 s.
  if v_fast then
    update public.publish_runs
       set status = 'error', finished_at = now(), error = 'timed out (a results publish took over after 90 seconds)'
     where status = 'running' and started_at < now() - interval '90 seconds'
       and not (cms and doc_ids is not null);
  end if;

  -- A page / promote run in flight never blocks the results (disjoint files).
  if exists (select 1 from public.publish_runs
              where status = 'running' and not (v_fast and cms and doc_ids is not null)) then
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
  end if;
  -- 092: a site-wide doc named in doc_ids may also go straight to main (the
  -- owner's «Κατευθείαν live»). "Publish all" (doc_ids null) still leaves
  -- them out (cms_publish_input skip_site_wide).

  -- A content publish (pages, site-wide docs, "Publish all") waits for the
  -- previous main deploy (spec §9: an auto-revert must never land on top of a
  -- newer publish). A contests-only run (p_cms false: the lifecycle and
  -- parser auto-publish) never waits: on the night of the final the results
  -- must not sit behind a page build. If that page build then fails, the
  -- publish-status function reverts only the page's files on top of the
  -- contests commit (they never share a file), so the results stay.
  if v_target = 'main' and (coalesce(p_cms, true) or p_promote is not null) and exists (
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

commit;
