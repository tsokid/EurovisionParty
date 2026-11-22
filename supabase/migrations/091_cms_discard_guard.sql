-- ============================================================
-- 091: cms_discard refuses when the draft moved (CMS final review M1)
-- ------------------------------------------------------------
-- 076's cms_discard(doc_id) deleted the draft whatever its version: editor
-- A's Discard could delete editor B's autosave that landed a moment
-- earlier, unseen by A (B's work survived only as a History checkpoint).
--
-- cms_discard(p_doc_id, p_expected_updated_at default null):
--   * with the version the caller last saw, deletes the draft only if it
--     is still that version; otherwise raises the same conflict as cms_save
--     ('document changed by someone else; reload'). A draft that is already
--     gone is not an error.
--   * without it (null), deletes as before, so an admin tab loaded before
--     this migration keeps working.
--
-- Super admins only, as before. Idempotent: safe to run twice.
-- ============================================================

begin;

drop function if exists public.cms_discard(text);

create or replace function public.cms_discard(p_doc_id text, p_expected_updated_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  if p_expected_updated_at is null then
    delete from public.cms_documents where doc_id = p_doc_id;
    return;
  end if;

  delete from public.cms_documents where doc_id = p_doc_id and updated_at = p_expected_updated_at;
  if not found and exists (select 1 from public.cms_documents where doc_id = p_doc_id) then
    raise exception 'document changed by someone else; reload';
  end if;
end;
$fn$;

revoke execute on function public.cms_discard(text, timestamptz) from public, anon;
grant execute on function public.cms_discard(text, timestamptz) to authenticated;

commit;
