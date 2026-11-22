-- ============================================================
-- 088: media alt text and title (CMS P6)
-- ------------------------------------------------------------
-- Spec 2026-11-21-cms-track3-design.md §2 (Media), §4.1 (missing alt), §7.
-- Alt text moves from each image block to a default on the media row that a
-- block can override: an image block whose alt is empty uses the media
-- row's alt for that locale (publish-content writes it into the committed
-- file, the admin preview shows it). An image with no alt in either place
-- is refused at publish and flagged in the SEO panel.
--
-- * cms_media.alt   jsonb {en?, el?}: the default alt per locale ('{}' = none)
-- * cms_media.title text: a name for the library (not rendered on the site)
-- * media_set_meta(id, alt, title) (super admin): the only write. Refuses a
--   variant (the 800 w copy follows its image), keys other than en/el,
--   non-string values and alt over 300 or a title over 120 characters.
--   Blank strings are stored as absent. Returns the row as media_list does.
-- * media_list(kind) also returns alt and title (dropped and recreated: the
--   result type changes).
-- * media_usage(id) (super admin): the doc ids whose saved draft references
--   the file or its variant (the published usage is read from the
--   committed files by the admin).
-- * publish_input also returns each media row's alt (redefined from 086
--   with that one key added). Apply after 086.
--
-- RLS: unchanged (087's admin select policy covers the new columns).
-- Idempotent: safe to run twice.
-- ============================================================

begin;

alter table public.cms_media add column if not exists alt jsonb not null default '{}'::jsonb;
alter table public.cms_media add column if not exists title text;
alter table public.cms_media drop constraint if exists cms_media_alt_object;
alter table public.cms_media add constraint cms_media_alt_object check (jsonb_typeof(alt) = 'object');

-- ── media_set_meta ──────────────────────────────────────────
create or replace function public.media_set_meta(p_id uuid, p_alt jsonb, p_title text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row   public.cms_media%rowtype;
  v_alt   jsonb := '{}'::jsonb;
  v_key   text;
  v_val   jsonb;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_alt is null or jsonb_typeof(p_alt) <> 'object' then
    raise exception 'alt must be an object {en, el}';
  end if;
  for v_key, v_val in select * from jsonb_each(p_alt) loop
    if v_key not in ('en', 'el') then
      raise exception 'alt has an unknown language %', v_key;
    end if;
    if jsonb_typeof(v_val) <> 'string' then
      raise exception 'alt.% must be text', v_key;
    end if;
    if char_length(v_val #>> '{}') > 300 then
      raise exception 'alt.% is longer than 300 characters', v_key;
    end if;
    if btrim(v_val #>> '{}') <> '' then
      v_alt := v_alt || jsonb_build_object(v_key, btrim(v_val #>> '{}'));
    end if;
  end loop;
  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'title is longer than 120 characters';
  end if;

  select * into v_row from public.cms_media m where m.id = p_id for update;
  if not found then
    raise exception 'media % not found', p_id;
  end if;
  if v_row.variant_of is not null then
    raise exception 'edit the image, not its 800 w variant';
  end if;

  update public.cms_media m set alt = v_alt, title = v_title where m.id = p_id returning * into v_row;
  return jsonb_build_object(
    'id', v_row.id, 'kind', v_row.kind, 'storage_path', v_row.storage_path, 'variant_of', v_row.variant_of,
    'mime', v_row.mime, 'bytes', v_row.bytes, 'width', v_row.width, 'height', v_row.height,
    'sha256', v_row.sha256, 'published_path', v_row.published_path, 'created_at', v_row.created_at,
    'alt', v_row.alt, 'title', v_row.title);
end;
$fn$;

revoke execute on function public.media_set_meta(uuid, jsonb, text) from public, anon;
grant execute on function public.media_set_meta(uuid, jsonb, text) to authenticated;

-- ── media_list (+ alt, title) ───────────────────────────────
drop function if exists public.media_list(text);
create or replace function public.media_list(p_kind text default null)
returns table (
  id uuid, kind text, storage_path text, variant_of uuid, mime text, bytes int,
  width int, height int, sha256 text, published_path text, created_at timestamptz,
  alt jsonb, title text)
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
           m.width, m.height, m.sha256, m.published_path, m.created_at,
           m.alt, m.title
      from public.cms_media m
     where p_kind is null or m.kind = p_kind
     order by m.created_at desc, m.storage_path;
end;
$fn$;

revoke execute on function public.media_list(text) from public, anon;
grant execute on function public.media_list(text) to authenticated;

-- ── media_usage ─────────────────────────────────────────────
create or replace function public.media_usage(p_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_docs text[];
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  select coalesce(array_agg(d.doc_id order by d.doc_id), '{}') into v_docs
    from public.cms_documents d
   where exists (
     select 1 from public.cms_media m
      where (m.id = p_id or m.variant_of = p_id)
        and strpos(lower(d.data::text), 'cms-media/' || m.id::text) > 0);
  return v_docs;
end;
$fn$;

revoke execute on function public.media_usage(uuid) from public, anon;
grant execute on function public.media_usage(uuid) to authenticated;

-- ── publish_input ───────────────────────────────────────────
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
             'variant_of', m.variant_of, 'width', m.width, 'height', m.height,
             'alt', m.alt)
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

commit;
