// src/admin/modules/Pages.tsx
// Admin Pages module (spec §6): the CMS documents with their draft state, and
// the editor of one document (schema form + live preview). Saving writes a
// draft to the DB (cms_save); nothing goes live until Publish, which is the
// same PublishBar as Contests and counts the changed pages too.
//
// Documents: the site pages, then the optional editorial docs of the data
// pages grouped as Contest years, Countries and Live hub (editorialPages.ts).
// "Add editorial for …" saves a new draft from the schema's empty value
// (cms_save, as a first save) and opens it.
//
// In the admin shell the open document is the URL (/admin/pages/:docId):
// the route passes `docId` and `onOpen`, and the shell's route guard asks
// before leaving unsaved edits. Rendered alone (tests), it keeps the open
// document in local state and asks through the leave guard itself.

import { useCallback, useEffect, useState } from 'react';
import { formatError } from '../lib/formatError';
import { useLeaveGuard } from '../unsavedGuard';
import { useAdminLive } from '../adminMeta';
import { sitePagePath } from '../siteStructure';
import { PublishBar } from './contests/PublishBar';
import { usePublisher } from './contests/publish';
import { cmsList, cmsSave, fetchPublishedEditorialIds, resetPublishedPages, type CmsListRow } from './pages/cmsApi';
import { PageList, type EditorialListing } from './pages/PageList';
import { PUBLISH_PAGES_TEXT, SITE_PAGES } from './pages/sitePages';
import { PageEditor } from './pages/PageEditor';
import { editorialPreviewPath, editorialTargets, editorialTitle, emptyEditorialDoc, loadEditorialSources, type EditorialTarget } from './pages/editorialPages';
import { docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import { isEditorialDocId } from '../../../supabase/functions/_shared/cms/pagesIndex';

type EditorialData = { targets: EditorialTarget[]; published: string[] };

export interface PagesProps {
  /** The open document (from the URL); null: the list. Only read when `onOpen` is given. */
  docId?: string | null;
  /** Opens a document (or the list, with null), e.g. by navigating. */
  onOpen?: (docId: string | null) => void;
}

export default function Pages({ docId, onOpen }: PagesProps = {}) {
  const publisher = usePublisher();
  const { refresh: refreshPublish } = publisher;
  const guard = useLeaveGuard();
  const [rows, setRows] = useState<CmsListRow[]>([]);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selected = onOpen ? docId ?? null : localSelected;
  const [err, setErr] = useState<string | null>(null);
  const [editorial, setEditorial] = useState<EditorialData | null>(null);
  const [editorialErr, setEditorialErr] = useState<string | null>(null);

  const load = useCallback(
    () =>
      cmsList().then(
        (next) => {
          setRows(next);
          setErr(null);
        },
        (e: unknown) => setErr(formatError(e)),
      ),
    [],
  );

  const loadEditorial = useCallback(
    () =>
      Promise.all([loadEditorialSources(), fetchPublishedEditorialIds()]).then(
        ([sources, published]) => {
          setEditorial({ targets: editorialTargets(sources), published });
          setEditorialErr(null);
        },
        (e: unknown) => setEditorialErr(formatError(e)),
      ),
    [],
  );

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadEditorial(); }, [loadEditorial]);
  // A new editor session reads the other pages' published copies afresh (SEO check).
  useEffect(() => { resetPublishedPages(); }, []);

  // After a save or discard: the list badges and the "unpublished changes" count.
  const changed = useCallback(() => {
    load();
    refreshPublish();
  }, [load, refreshPublish]);

  const open = (next: string | null) => {
    if (next === selected) return;
    if (onOpen) onOpen(next);
    else if (guard.confirmLeave()) setLocalSelected(next);
  };

  const add = async (docId: string) => {
    setErr(null);
    try {
      await cmsSave(docId, docTypeFor(docId), emptyEditorialDoc(), null);
      changed();
      open(docId);
    } catch (e) {
      setErr(formatError(e));
    }
  };

  const listing: EditorialListing | null = editorial && {
    targets: editorial.targets,
    existing: new Set([...editorial.published, ...rows.map((r) => r.doc_id).filter(isEditorialDocId)]),
  };

  const site = SITE_PAGES.find((p) => p.docId === selected);
  // Label and the hub's path come from the id alone; an archive year's or a
  // country's path waits for the targets (the preview says so meanwhile).
  const page = site ?? (selected && isEditorialDocId(selected)
    ? { docId: selected, label: editorialTitle(selected, editorial?.targets) }
    : null);
  const previewPath = page && !site ? editorialPreviewPath(page.docId, editorial?.targets ?? null) : undefined;
  useAdminLive(site ? sitePagePath(site.docId) : previewPath);

  return (
    <div className="p-4 space-y-4">
      <header>
        <h2 className="text-xl font-bold text-white">📝 Pages</h2>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">
          The copy of the site pages, in English and Greek, and the optional editorial text of the contest years,
          countries and live hub. Save keeps a draft; nothing goes live until Publish.
        </p>
      </header>

      <PublishBar publisher={publisher} />
      <p className="text-xs text-white/50 max-w-2xl">{PUBLISH_PAGES_TEXT}</p>

      {err && <p className="text-sm text-red-300">{err}</p>}

      {page ? (
        <div className="space-y-3">
          <button type="button" onClick={() => open(null)} className="text-sm text-sky-300 hover:underline cursor-pointer">
            ← All pages
          </button>
          <PageEditor
            key={page.docId}
            docId={page.docId}
            label={page.label}
            previewPath={previewPath}
            onChanged={changed}
          />
        </div>
      ) : (
        <PageList rows={rows} onOpen={open} editorial={listing} editorialError={editorialErr} onAdd={add} />
      )}
    </div>
  );
}
