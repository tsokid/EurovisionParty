-- ============================================================
-- 085: cms_revisions, the history of every CMS document (CMS P3)
-- ------------------------------------------------------------
-- Spec 2026-11-21-cms-track3-design.md §4 (history) and §7. Owner Q5 = B:
-- published revisions are kept forever, checkpoints for 90 days, pruned
-- inline by cms_save (no cron: crons are off since 068).
--
-- * cms_revisions: one row per kept state of a document.
--     kind 'checkpoint'  an editing session of one author. cms_save keeps
--                        updating the author's open checkpoint while they
--                        keep saving; a pause of over 10 minutes, another
--                        revision of the doc in between, or a different
--                        author opens a new one. So a checkpoint holds the
--                        END state of a session.
--     kind 'published'   what a successful publish run shipped (trigger on
--                        publish_runs below; P5/086 moves it into end_publish).
--     kind 'restored'    cms_restore copied an older revision into the draft.
--     kind 'seed'        the draft as it stood when this migration ran.
--   Revisions never reference cms_documents: discarding a draft keeps its
--   history. Nothing ever deletes a revision except the 90-day checkpoint
--   prune.
-- * cms_save (076) is redefined with the same signature and refusals; after
--   a successful write it records the checkpoint and prunes.
-- * cms_history(doc_id)   (super admin) the timeline, newest first, without
--                         the data: id, kind, author, author_email,
--                         created_at, updated_at, run_id, commit_sha,
--                         restored_from.
-- * cms_revision(rev_id)  (super admin) one revision with its data.
-- * cms_restore(doc_id, rev_id, expected_updated_at) (super admin): writes
--   the revision's data as the draft under the same optimistic concurrency
--   as cms_save (null expected = no draft row may exist), records a
--   'restored' revision, returns the new updated_at. History is untouched.
--
-- RLS on, no policies here (087 adds the read policy); writes only through
-- these security definer RPCs, execute revoked from public/anon (as 069).
-- Idempotent: safe to run twice.
-- ============================================================

begin;

create table if not exists public.cms_revisions (
  id            bigserial primary key,
  doc_id        text not null check (doc_id ~ '^[a-z0-9-]+$'),
  doc_type      text not null,
  data          jsonb not null,
  kind          text not null check (kind in ('checkpoint', 'published', 'restored', 'seed')),
  author        uuid,
  run_id        bigint,
  commit_sha    text,
  restored_from bigint,
  created_at    timestamptz not null default now(),
  -- Last write into this revision (an open checkpoint is updated in place).
  updated_at    timestamptz not null default now()
);

create index if not exists cms_revisions_doc_idx on public.cms_revisions (doc_id, id desc);
create index if not exists cms_revisions_checkpoint_age_idx on public.cms_revisions (updated_at) where kind = 'checkpoint';

alter table public.cms_revisions enable row level security;
revoke all on public.cms_revisions from anon, authenticated;
revoke all on sequence public.cms_revisions_id_seq from anon, authenticated;

-- ── Seed: the drafts that exist today start their history ───
insert into public.cms_revisions (doc_id, doc_type, data, kind, author, created_at, updated_at)
select d.doc_id, d.doc_type, d.data, 'seed', d.updated_by, d.updated_at, d.updated_at
  from public.cms_documents d
 where not exists (select 1 from public.cms_revisions r where r.doc_id = d.doc_id);

-- ── checkpoint helper (internal) ────────────────────────────
-- The author's open checkpoint is the doc's newest revision when it is a
-- checkpoint by the same author written in the last 10 minutes.
create or replace function public.cms_record_checkpoint(p_doc_id text, p_doc_type text, p_data jsonb, p_author uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_last public.cms_revisions%rowtype;
begin
  select * into v_last
    from public.cms_revisions r
   where r.doc_id = p_doc_id
   order by r.id desc
   limit 1;

  if found and v_last.kind = 'checkpoint'
     and v_last.author is not distinct from p_author
     and v_last.updated_at > now() - interval '10 minutes' then
    update public.cms_revisions
       set data = p_data, doc_type = p_doc_type, updated_at = now()
     where id = v_last.id;
  else
    insert into public.cms_revisions (doc_id, doc_type, data, kind, author)
    values (p_doc_id, p_doc_type, p_data, 'checkpoint', p_author);
  end if;

  -- Q5 = B: checkpoints live 90 days; published, restored and seed forever.
  delete from public.cms_revisions
   where kind = 'checkpoint' and updated_at < now() - interval '90 days';
end;
$fn$;

revoke execute on function public.cms_record_checkpoint(text, text, jsonb, uuid) from public, anon, authenticated;

-- ── cms_save (076 + checkpoint) ─────────────────────────────
create or replace function public.cms_save(
  p_doc_id text, p_doc_type text, p_data jsonb, p_expected_updated_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_now  timestamptz;
  v_type text;
  v_at   timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  if p_doc_id is null or p_doc_id !~ '^[a-z0-9-]+$' then
    raise exception 'invalid doc_id %', p_doc_id;
  end if;
  if p_doc_type is null or btrim(p_doc_type) = '' then
    raise exception 'doc_type is required';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or not (p_data ? 'en') or not (p_data ? 'el') then
    raise exception 'data must be an object with keys en and el';
  end if;
  if pg_column_size(p_data) >= 1048576 then
    raise exception 'document too large';
  end if;

  if p_expected_updated_at is null then
    v_now := date_trunc('milliseconds', clock_timestamp()) + interval '1 millisecond';
    insert into public.cms_documents (doc_id, doc_type, data, updated_at, updated_by)
    values (p_doc_id, p_doc_type, p_data, v_now, auth.uid())
    on conflict (doc_id) do nothing
    returning updated_at into v_at;
  else
    select d.doc_type into v_type
      from public.cms_documents d
     where d.doc_id = p_doc_id
       for update;
    if found and v_type <> p_doc_type then
      raise exception 'doc_type mismatch: % is a %, not a %', p_doc_id, v_type, p_doc_type;
    end if;
    v_now := date_trunc('milliseconds', clock_timestamp()) + interval '1 millisecond';

    update public.cms_documents d
       set data = p_data,
           updated_at = greatest(v_now, d.updated_at + interval '1 millisecond'),
           updated_by = auth.uid()
     where d.doc_id = p_doc_id
       and d.updated_at = p_expected_updated_at
    returning d.updated_at into v_at;
  end if;

  if v_at is null then
    raise exception 'document changed by someone else; reload';
  end if;

  perform public.cms_record_checkpoint(p_doc_id, p_doc_type, p_data, auth.uid());
  return v_at;
end;
$fn$;

revoke execute on function public.cms_save(text, text, jsonb, timestamptz) from public, anon;
grant execute on function public.cms_save(text, text, jsonb, timestamptz) to authenticated;

-- ── cms_history ─────────────────────────────────────────────
create or replace function public.cms_history(p_doc_id text)
returns table (
  id bigint, kind text, author uuid, author_email text,
  created_at timestamptz, updated_at timestamptz,
  run_id bigint, commit_sha text, restored_from bigint)
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
    select r.id, r.kind, r.author, sa.email::text,
           r.created_at, r.updated_at, r.run_id, r.commit_sha, r.restored_from
      from public.cms_revisions r
      left join public.super_admins sa on sa.user_id = r.author
     where r.doc_id = p_doc_id
     order by r.id desc
     limit 500;
end;
$fn$;

revoke execute on function public.cms_history(text) from public, anon;
grant execute on function public.cms_history(text) to authenticated;

-- ── cms_revision ────────────────────────────────────────────
create or replace function public.cms_revision(p_rev_id bigint)
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
    select jsonb_build_object('id', r.id, 'doc_id', r.doc_id, 'doc_type', r.doc_type, 'kind', r.kind,
                              'data', r.data, 'created_at', r.created_at, 'updated_at', r.updated_at)
      from public.cms_revisions r
     where r.id = p_rev_id
  );
end;
$fn$;

revoke execute on function public.cms_revision(bigint) from public, anon;
grant execute on function public.cms_revision(bigint) to authenticated;

-- ── cms_restore ─────────────────────────────────────────────
create or replace function public.cms_restore(p_doc_id text, p_rev_id bigint, p_expected_updated_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_rev  public.cms_revisions%rowtype;
  v_now  timestamptz;
  v_at   timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_rev from public.cms_revisions r where r.id = p_rev_id;
  if not found or v_rev.doc_id is distinct from p_doc_id then
    raise exception 'revision % of % not found', p_rev_id, p_doc_id;
  end if;

  if p_expected_updated_at is null then
    v_now := date_trunc('milliseconds', clock_timestamp()) + interval '1 millisecond';
    insert into public.cms_documents (doc_id, doc_type, data, updated_at, updated_by)
    values (p_doc_id, v_rev.doc_type, v_rev.data, v_now, auth.uid())
    on conflict (doc_id) do nothing
    returning updated_at into v_at;
  else
    perform 1 from public.cms_documents d where d.doc_id = p_doc_id for update;
    v_now := date_trunc('milliseconds', clock_timestamp()) + interval '1 millisecond';
    update public.cms_documents d
       set data = v_rev.data,
           updated_at = greatest(v_now, d.updated_at + interval '1 millisecond'),
           updated_by = auth.uid()
     where d.doc_id = p_doc_id
       and d.updated_at = p_expected_updated_at
       and d.doc_type = v_rev.doc_type
    returning d.updated_at into v_at;
  end if;

  if v_at is null then
    raise exception 'document changed by someone else; reload';
  end if;

  insert into public.cms_revisions (doc_id, doc_type, data, kind, author, restored_from)
  values (p_doc_id, v_rev.doc_type, v_rev.data, 'restored', auth.uid(), v_rev.id);
  return v_at;
end;
$fn$;

revoke execute on function public.cms_restore(text, bigint, timestamptz) from public, anon;
grant execute on function public.cms_restore(text, bigint, timestamptz) to authenticated;

-- ── published revisions ─────────────────────────────────────
-- A run that finishes 'ok' with CMS drafts shipped the drafts saved after
-- the previous CMS publish started and no later than this run started (the
-- same rule as cms_list.published). Each gets a 'published' revision with
-- the run and its commit, unless its newest revision is already that exact
-- published state. P5 (086) replaces this with a per-doc stamp in end_publish.
create or replace function public.cms_revisions_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_prev timestamptz;
begin
  if new.status <> 'ok' or old.status <> 'running' or not new.cms then
    return new;
  end if;

  select max(r.started_at) into v_prev
    from public.publish_runs r
   where r.id <> new.id and r.status in ('ok', 'noop') and r.cms
     and r.started_at < new.started_at;

  insert into public.cms_revisions (doc_id, doc_type, data, kind, author, run_id, commit_sha)
  select d.doc_id, d.doc_type, d.data, 'published', d.updated_by, new.id, new.commit_sha
    from public.cms_documents d
   where d.updated_at <= new.started_at
     and (v_prev is null or d.updated_at > v_prev)
     and not exists (
       select 1 from (
         select r.kind, r.data from public.cms_revisions r
          where r.doc_id = d.doc_id order by r.id desc limit 1
       ) last
        where last.kind = 'published' and last.data = d.data);
  return new;
end;
$fn$;

revoke execute on function public.cms_revisions_on_publish() from public, anon, authenticated;

drop trigger if exists cms_revisions_on_publish on public.publish_runs;
create trigger cms_revisions_on_publish
  after update of status on public.publish_runs
  for each row execute function public.cms_revisions_on_publish();

commit;
