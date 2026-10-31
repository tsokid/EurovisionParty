// src/admin/modules/Pages.tsx
// Admin Pages module (spec §6): the CMS documents with their draft state, and
// the editor of one document (schema form + live preview). Saving writes a
// draft to the DB (cms_save); nothing goes live until Publish, which is the
// same PublishBar as Contests and counts the changed pages too.
//
// Documents: the site pages, then the optional editorial docs of the data
// pages grouped as Contest years, Countries and Live hub (editorialPages.ts).
// "Add editorial for …" saves a new draft from the schema's empty value
// (cms_save, as a first save) and opens it. The Contests module opens an
// editorial doc here through the admin navigation (adminNav.ts).

import { useCallback, useEffect, useState } from 'react';
import { formatError } from '../lib/formatError';
import { useLeaveGuard } from '../unsavedGuard';
import { useAdminNav } from '../adminNav';
import { PublishBar } from './contests/PublishBar';
import { usePublisher } from './contests/publish';
import { cmsList, cmsSave, fetchPublishedEditorialIds, resetPublishedPages, type CmsListRow } from './pages/cmsApi';
import { PageList, type EditorialListing } from './pages/PageList';
import { PUBLISH_PAGES_TEXT, SITE_PAGES } from './pages/sitePages';
import { PageEditor } from './pages/PageEditor';
import { editorialTargets, editorialTitle, emptyEditorialDoc, loadEditorialSources, type EditorialTarget } from './pages/editorialPages';
import { docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import { isEditorialDocId } from '../../../supabase/functions/_shared/cms/pagesIndex';

type EditorialData = { targets: EditorialTarget[]; published: string[] };

export default function Pages() {
  const publisher = usePublisher();
  const { refresh: refreshPublish } = publisher;
  const guard = useLeaveGuard();
  const nav = useAdminNav();
  const [rows, setRows] = useState<CmsListRow[]>([]);
  const [selected, setSelected] = useState<string | null>(() => nav?.pendingDoc ?? null);
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
  // A document opened from another module (taken once, on mount).
  useEffect(() => { nav?.clearPendingDoc(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After a save or discard: the list badges and the "unpublished changes" count.
  const changed = useCallback(() => {
    load();
    refreshPublish();
  }, [load, refreshPublish]);

  const open = (docId: string | null) => {
    if (docId === selected || !guard.confirmLeave()) return;
    setSelected(docId);
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
  const page = site ?? (selected && isEditorialDocId(selected)
    ? { docId: selected, label: editorialTitle(selected, editorial?.targets ?? []) }
    : null);
  const previewPath = page && !site ? editorial?.targets.find((t) => t.docId === page.docId)?.path : undefined;

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
