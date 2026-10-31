-- ============================================================
-- 076: cms_documents, the CMS editor's drafts (CMS 3b)
-- ------------------------------------------------------------
-- * cms_documents: one draft per document, data in the 3a {en, el}
--   shape. A missing row means the document is the published file in
--   the repo. RLS on, no policies: access only through the RPCs below.
-- * The schema of data is NOT validated here (the editor and Publish do
--   that); the RPC only requires a jsonb object with keys en and el.
-- * cms_list() (super admin): doc_id, doc_type, updated_at, published.
--   published = updated_at <= started_at of the last ok/noop publish run
--   (the since of unpublished_summary(), 074); false before the first.
-- * cms_get(doc_id) (super admin): {doc_id, doc_type, data, updated_at}
--   or null.
-- * cms_save(doc_id, doc_type, data, expected_updated_at) (super admin):
--   optimistic concurrency. expected null inserts (the row must not
--   exist); otherwise updates only where updated_at = expected exactly.
--   Anything else raises 'document changed by someone else; reload'.
--   Returns the stored updated_at. updated_at is kept at millisecond
--   precision (rounded up, and always > the previous value), so a client
--   holding it as a JS Date or an ISO string round-trips it exactly, and
--   rounding up never marks an edit made after a run started as published.
--   doc_type cannot change on update.
-- * cms_discard(doc_id) (super admin): deletes the draft, reverting the
--   document to the published file.
-- * 074's publish_input() and unpublished_summary() read this table
--   (cms_documents, changed_docs); both are plpgsql so 074 applies first.
--
-- Idempotent: safe to run twice.
-- ============================================================

begin;

create table if not exists public.cms_documents (
  doc_id     text primary key check (doc_id ~ '^[a-z0-9-]+$'),
  doc_type   text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.cms_documents enable row level security;
revoke all on public.cms_documents from anon, authenticated;

-- ── cms_list ────────────────────────────────────────────────
create or replace function public.cms_list()
returns table (doc_id text, doc_type text, updated_at timestamptz, published boolean)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_since timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select max(r.started_at) into v_since
    from public.publish_runs r
   where r.status in ('ok', 'noop');

  return query
    select d.doc_id, d.doc_type, d.updated_at,
           coalesce(d.updated_at <= v_since, false)
      from public.cms_documents d
     order by d.doc_id;
end;
$fn$;

revoke execute on function public.cms_list() from public, anon;
grant execute on function public.cms_list() to authenticated;

-- ── cms_get ─────────────────────────────────────────────────
create or replace function public.cms_get(p_doc_id text)
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
    select jsonb_build_object('doc_id', d.doc_id, 'doc_type', d.doc_type,
                              'data', d.data, 'updated_at', d.updated_at)
      from public.cms_documents d
     where d.doc_id = p_doc_id
  );
end;
$fn$;

revoke execute on function public.cms_get(text) from public, anon;
grant execute on function public.cms_get(text) to authenticated;

-- ── cms_save ────────────────────────────────────────────────
create or replace function public.cms_save(
  p_doc_id text, p_doc_type text, p_data jsonb, p_expected_updated_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $fn$
declare
  -- Rounded up to the millisecond: never earlier than the real write time.
  v_now  timestamptz := date_trunc('milliseconds', clock_timestamp()) + interval '1 millisecond';
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

  if p_expected_updated_at is null then
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
  return v_at;
end;
$fn$;

revoke execute on function public.cms_save(text, text, jsonb, timestamptz) from public, anon;
grant execute on function public.cms_save(text, text, jsonb, timestamptz) to authenticated;

-- ── cms_discard ─────────────────────────────────────────────
create or replace function public.cms_discard(p_doc_id text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  delete from public.cms_documents where doc_id = p_doc_id;
end;
$fn$;

revoke execute on function public.cms_discard(text) from public, anon;
grant execute on function public.cms_discard(text) to authenticated;

commit;
