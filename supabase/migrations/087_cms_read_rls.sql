-- ============================================================
-- 087: read access for the CMS editors (CMS P3)
-- ------------------------------------------------------------
-- Spec 2026-11-21-cms-track3-design.md §5 and §7.
--
-- * Select policies on cms_documents, cms_media and cms_revisions for an
--   authenticated super admin (is_super_admin()). Only SELECT is granted:
--   insert, update and delete stay revoked, so every write still goes
--   through the security definer RPCs (076, 077, 085).
-- * cms_documents joins the supabase_realtime publication, so an editor
--   (and the P4 preview iframe) sees the other editor's saves live via
--   postgres_changes, which applies these RLS policies per subscriber.
-- * The editors' presence channel is a private Realtime channel named
--   cms:doc:{doc_id}. Realtime Authorization reads realtime.messages RLS:
--   only a super admin may join, read or send on cms:doc:* topics, so a
--   visitor holding the anon key cannot see who is editing. Skipped where
--   the realtime schema does not exist (local test databases).
--
-- Idempotent: safe to run twice.
-- ============================================================

begin;

-- ── table reads ─────────────────────────────────────────────
grant select on public.cms_documents to authenticated;
drop policy if exists cms_documents_admin_select on public.cms_documents;
create policy cms_documents_admin_select on public.cms_documents
  for select to authenticated
  using (public.is_super_admin());

grant select on public.cms_media to authenticated;
drop policy if exists cms_media_admin_select on public.cms_media;
create policy cms_media_admin_select on public.cms_media
  for select to authenticated
  using (public.is_super_admin());

grant select on public.cms_revisions to authenticated;
drop policy if exists cms_revisions_admin_select on public.cms_revisions;
create policy cms_revisions_admin_select on public.cms_revisions
  for select to authenticated
  using (public.is_super_admin());

-- ── realtime publication ────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cms_documents') then
    alter publication supabase_realtime add table public.cms_documents;
  end if;
end $$;

-- ── presence channel authorization ──────────────────────────
do $$
begin
  if to_regclass('realtime.messages') is null then
    return;
  end if;

  execute 'drop policy if exists cms_doc_channel_read on realtime.messages';
  execute $p$
    create policy cms_doc_channel_read on realtime.messages
      for select to authenticated
      using (realtime.topic() like 'cms:doc:%' and public.is_super_admin())
  $p$;

  execute 'drop policy if exists cms_doc_channel_write on realtime.messages';
  execute $p$
    create policy cms_doc_channel_write on realtime.messages
      for insert to authenticated
      with check (realtime.topic() like 'cms:doc:%' and public.is_super_admin())
  $p$;
end $$;

commit;
