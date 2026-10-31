// src/admin/modules/Pages.tsx
// Admin Pages module (spec §6): the static site pages with their draft state,
// and the editor of one page (schema form + live preview). Saving writes a
// draft to the DB (cms_save); nothing goes live until Publish, which is the
// same PublishBar as Contests and counts the changed pages too.

import { useCallback, useEffect, useState } from 'react';
import { formatError } from '../lib/formatError';
import { useLeaveGuard } from '../unsavedGuard';
import { PublishBar } from './contests/PublishBar';
import { usePublisher } from './contests/publish';
import { cmsList, resetPublishedPages, type CmsListRow } from './pages/cmsApi';
import { PageList } from './pages/PageList';
import { SITE_PAGES } from './pages/sitePages';
import { PageEditor } from './pages/PageEditor';

export default function Pages() {
  const publisher = usePublisher();
  const { refresh: refreshPublish } = publisher;
  const guard = useLeaveGuard();
  const [rows, setRows] = useState<CmsListRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  useEffect(() => { load(); }, [load]);
  // A new editor session reads the other pages' published copies afresh (SEO check).
  useEffect(() => { resetPublishedPages(); }, []);

  // After a save or discard: the list badges and the "unpublished changes" count.
  const changed = useCallback(() => {
    load();
    refreshPublish();
  }, [load, refreshPublish]);

  const open = (docId: string | null) => {
    if (docId === selected || !guard.confirmLeave()) return;
    setSelected(docId);
  };

  const page = SITE_PAGES.find((p) => p.docId === selected);

  return (
    <div className="p-4 space-y-4">
      <header>
        <h2 className="text-xl font-bold text-white">📝 Pages</h2>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">
          The copy of the site pages, in English and Greek. Save keeps a draft; nothing goes live until Publish.
        </p>
      </header>

      <PublishBar publisher={publisher} />

      {err && <p className="text-sm text-red-300">{err}</p>}

      {page ? (
        <div className="space-y-3">
          <button type="button" onClick={() => open(null)} className="text-sm text-sky-300 hover:underline cursor-pointer">
            ← All pages
          </button>
          <PageEditor key={page.docId} docId={page.docId} label={page.label} onChanged={changed} />
        </div>
      ) : (
        <PageList rows={rows} onOpen={open} />
      )}
    </div>
  );
}
