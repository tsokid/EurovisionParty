-- ============================================================
-- 077: cms_media, metadata for CMS uploads (CMS 3c)
-- ------------------------------------------------------------
-- * cms_media: one row per file in the private Storage bucket cms-media.
--   storage_path is the object name inside the bucket (no folders):
--   <uuid>.webp | <uuid>-800.webp | <uuid>.mp4 | <uuid>.vtt. The 800 w
--   image variant is its own row with variant_of = the 1600 w image (and
--   goes with it: on delete cascade). The id is the path's uuid: a
--   non-variant row is <id>.<ext>; a variant is <variant_of>-800.webp with
--   a generated id. Drafts reference media as cms-media/<id> (matched
--   case-insensitively). published_path is
--   the repo path (/media/<sha12>.<ext>) set by publish-content.
--   RLS on, no policies: access only through the RPCs below.
-- * media_register(id, kind, storage_path, mime, bytes, width, height,
--   sha256, variant_of) (super admin) → id. storage_path may carry a
--   leading cms-media/, which is stripped. A non-variant row needs id and
--   storage_path = <id>.<ext>; a variant needs id null and storage_path =
--   <variant_of>-800.webp. A duplicate id or path is 'already registered'.
--   Limits:
--     image     image/webp  ≤ 2 MiB    .webp  width and height required
--     video     video/mp4   ≤ 20 MiB   .mp4   width/height optional
--     captions  text/vtt    ≤ 200 KiB  .vtt   width/height optional
--   width/height, when given, are > 0. sha256 is 64 lowercase hex. A
--   variant is an image with a -800 path whose variant_of is an existing
--   non-variant image; a -800 path requires variant_of and vice versa.
--   Call it after the Storage upload succeeded.
-- * media_list(kind default null) (super admin): rows, newest first.
-- * media_delete(id) (super admin) → the storage_paths of the deleted rows
--   (the row and, for an image, its variant). Deletes the rows only: the
--   client removes those Storage objects after the RPC succeeds. Refuses a
--   variant id ('delete the image, not its 800 w variant'). Refuses
--   with 'media in use by <doc_ids>' while any cms_documents draft
--   (published or not) contains cms-media/<id> of the row or
--   its variant. LIMITATION: the published files in the repo (content/)
--   are outside the database's view, so a reference there is not checked.
--   Published files hold /media/<sha12>.<ext> copies committed to the
--   repo, never Storage, so deleting a row and its Storage object does not
--   break the live site. cms_documents is share-locked for the check, so a
--   concurrent cms_save cannot add a reference mid-delete.
-- * media_mark_published(id, path) (service_role): sets published_path,
--   path ~ ^/media/<12 hex>(-800)?.(webp|mp4|vtt)$.
-- * 074's publish_input().media lists the rows referenced by unpublished
--   drafts, plus their variants (074 reads cms_media only if it exists).
-- * Storage: when the storage schema exists (Supabase; not PGlite), the
--   bucket cms-media is created private (20 MiB, the three mimes) and
--   storage.objects gets select/insert/update/delete policies for
--   authenticated super admins on that bucket only.
--
-- Idempotent: safe to run twice.
-- ============================================================

begin;

create table if not exists public.cms_media (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('image', 'video', 'captions')),
  storage_path   text not null unique,
  variant_of     uuid references public.cms_media(id) on delete cascade,
  mime           text not null,
  bytes          int not null,
  width          int,
  height         int,
  sha256         text not null,
  published_path text,
  created_at     timestamptz not null default now(),
  created_by     uuid
);

create index if not exists cms_media_variant_of_idx on public.cms_media (variant_of);

alter table public.cms_media enable row level security;
revoke all on public.cms_media from anon, authenticated;

-- ── media_register ──────────────────────────────────────────
-- The 8-arg form (before the id ruling) must not survive as an overload.
drop function if exists public.media_register(text, text, text, int, int, int, text, uuid);

create or replace function public.media_register(
  p_id uuid, p_kind text, p_storage_path text, p_mime text, p_bytes int,
  p_width int, p_height int, p_sha256 text, p_variant_of uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_mime    text;
  v_max     int;
  v_ext     text;
  v_variant boolean;
  v_parent  public.cms_media%rowtype;
  v_path    text;
  v_id      uuid;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  case p_kind
    when 'image'    then v_mime := 'image/webp'; v_max := 2 * 1024 * 1024;  v_ext := 'webp';
    when 'video'    then v_mime := 'video/mp4';  v_max := 20 * 1024 * 1024; v_ext := 'mp4';
    when 'captions' then v_mime := 'text/vtt';   v_max := 200 * 1024;       v_ext := 'vtt';
    else raise exception 'invalid kind %', p_kind;
  end case;

  if p_mime is distinct from v_mime then
    raise exception 'invalid mime % for %: expected %', p_mime, p_kind, v_mime;
  end if;
  if p_bytes is null or p_bytes <= 0 then
    raise exception 'invalid bytes %', p_bytes;
  end if;
  if p_bytes > v_max then
    raise exception '% too large: % bytes (max %)', p_kind, p_bytes, v_max;
  end if;
  if (p_kind = 'image' and (p_width is null or p_height is null))
     or p_width <= 0 or p_height <= 0 then
    raise exception 'invalid width and height';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid sha256';
  end if;
  -- The bare object name inside the bucket.
  v_path := regexp_replace(p_storage_path, '^cms-media/', '');
  if v_path is null
     or v_path !~ ('^[0-9a-f-]{36}(-800)?\.' || v_ext || '$') then
    raise exception 'invalid storage_path %', p_storage_path;
  end if;

  v_variant := v_path ~ '-800\.webp$';
  if v_variant and p_variant_of is null then
    raise exception 'a -800 path is a variant and needs variant_of';
  end if;
  if p_variant_of is not null then
    if not v_variant then
      raise exception 'a variant needs a -800 storage_path';
    end if;
    if p_id is not null then
      raise exception 'a variant gets a generated id; p_id must be null';
    end if;
    if v_path <> p_variant_of::text || '-800.webp' then
      raise exception 'variant storage_path % must be %-800.webp', v_path, p_variant_of;
    end if;
    select * into v_parent from public.cms_media m where m.id = p_variant_of;
    if not found then
      raise exception 'variant_of % not found', p_variant_of;
    end if;
    if v_parent.kind <> 'image' or v_parent.variant_of is not null then
      raise exception 'variant_of must be an image that is not itself a variant';
    end if;
  else
    if p_id is null then
      raise exception 'p_id is required';
    end if;
    if v_path <> p_id::text || '.' || v_ext then
      raise exception 'storage_path % must be %.%', v_path, p_id, v_ext;
    end if;
  end if;

  -- No conflict target: a duplicate id or path both land here.
  insert into public.cms_media (id, kind, storage_path, variant_of, mime, bytes, width, height, sha256, created_by)
  values (coalesce(p_id, gen_random_uuid()), p_kind, v_path, p_variant_of, p_mime, p_bytes,
          p_width, p_height, p_sha256, auth.uid())
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'media % already registered', v_path;
  end if;
  return v_id;
end;
$fn$;

revoke execute on function public.media_register(uuid, text, text, text, int, int, int, text, uuid) from public, anon;
grant execute on function public.media_register(uuid, text, text, text, int, int, int, text, uuid) to authenticated;

-- ── media_list ──────────────────────────────────────────────
create or replace function public.media_list(p_kind text default null)
returns table (
  id uuid, kind text, storage_path text, variant_of uuid, mime text, bytes int,
  width int, height int, sha256 text, published_path text, created_at timestamptz)
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
    select m.id, m.kind, m.storage_path, m.variant_of, m.mime, m.bytes,
           m.width, m.height, m.sha256, m.published_path, m.created_at
      from public.cms_media m
     where p_kind is null or m.kind = p_kind
     order by m.created_at desc, m.storage_path;
end;
$fn$;

revoke execute on function public.media_list(text) from public, anon;
grant execute on function public.media_list(text) to authenticated;

-- ── media_delete ────────────────────────────────────────────
create or replace function public.media_delete(p_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row   public.cms_media%rowtype;
  v_ids   uuid[];
  v_docs  text;
  v_paths text[];
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select * into v_row from public.cms_media m where m.id = p_id for update;
  if not found then
    raise exception 'media % not found', p_id;
  end if;

  -- An image and its 800 w variant are one unit: deleting the variant alone
  -- would leave an image that publish refuses ("incomplete upload").
  if v_row.variant_of is not null then
    raise exception 'delete the image, not its 800 w variant';
  end if;

  -- The row and its variants: a reference to any of them keeps the row in use.
  select array_agg(distinct x) into v_ids
    from (
      select p_id as x
      union all select m.id from public.cms_media m where m.variant_of = p_id
    ) s;

  -- Block concurrent cms_save until this transaction ends.
  lock table public.cms_documents in share mode;

  select string_agg(d.doc_id, ', ' order by d.doc_id) into v_docs
    from public.cms_documents d
   where exists (select 1 from unnest(v_ids) i
                  where strpos(lower(d.data::text), 'cms-media/' || i::text) > 0);
  if v_docs is not null then
    raise exception 'media in use by %', v_docs;
  end if;

  select array_agg(m.storage_path order by m.storage_path) into v_paths
    from public.cms_media m
   where m.id = p_id or m.variant_of = p_id;

  delete from public.cms_media m where m.id = p_id;
  return v_paths;
end;
$fn$;

revoke execute on function public.media_delete(uuid) from public, anon;
grant execute on function public.media_delete(uuid) to authenticated;

-- ── media_mark_published ────────────────────────────────────
create or replace function public.media_mark_published(p_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_path is null or p_path !~ '^/media/[0-9a-f]{12}(-800)?\.(webp|mp4|vtt)$' then
    raise exception 'invalid published path %', p_path;
  end if;

  update public.cms_media set published_path = p_path where id = p_id;
  if not found then
    raise exception 'media % not found', p_id;
  end if;
end;
$fn$;

revoke execute on function public.media_mark_published(uuid, text) from public, anon, authenticated;
grant execute on function public.media_mark_published(uuid, text) to service_role;

-- ── Storage bucket and policies (Supabase only) ─────────────
do $storage$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('cms-media', 'cms-media', false)
  on conflict (id) do nothing;
  -- A bucket made earlier by hand must not stay public.
  update storage.buckets set public = false where id = 'cms-media' and public;

  -- Defence in depth: per-bucket size and mime limits, where supported.
  if exists (select 1 from information_schema.columns
              where table_schema = 'storage' and table_name = 'buckets'
                and column_name = 'file_size_limit')
     and exists (select 1 from information_schema.columns
                  where table_schema = 'storage' and table_name = 'buckets'
                    and column_name = 'allowed_mime_types') then
    execute $q$update storage.buckets
                  set file_size_limit = 20971520,
                      allowed_mime_types = array['image/webp', 'video/mp4', 'text/vtt']
                where id = 'cms-media'$q$;
  end if;

  drop policy if exists cms_media_admin_select on storage.objects;
  create policy cms_media_admin_select on storage.objects
    for select to authenticated
    using (bucket_id = 'cms-media' and public.is_super_admin());

  drop policy if exists cms_media_admin_insert on storage.objects;
  create policy cms_media_admin_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'cms-media' and public.is_super_admin());

  drop policy if exists cms_media_admin_update on storage.objects;
  create policy cms_media_admin_update on storage.objects
    for update to authenticated
    using (bucket_id = 'cms-media' and public.is_super_admin())
    with check (bucket_id = 'cms-media' and public.is_super_admin());

  drop policy if exists cms_media_admin_delete on storage.objects;
  create policy cms_media_admin_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'cms-media' and public.is_super_admin());
end
$storage$;

commit;
