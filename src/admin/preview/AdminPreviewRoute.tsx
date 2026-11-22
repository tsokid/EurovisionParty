// /admin/preview/:docId/:locale (spec §3, not in any menu): the page inside the
// editor's preview iframe. It is the admin chunk (signed in through the same
// Supabase session: same origin), without the admin's shell.
//
// - In the editor's iframe, the draft as typed arrives over the bridge.
// - Before that, and when the URL is opened on its own, it shows the saved
//   draft (cms_get, read under the admin's RLS), else the published doc.
// - The saved drafts of the header and footer are shown on every page, so
//   the page looks the way the next publish would make it.
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isLocale, type Locale } from '../../lib/seo/locale';
import { publishedSiteDoc } from '../../lib/cms/siteChrome';
import type { DraftDoc } from '../../../supabase/functions/_shared/cms/overlay';
import { SITE_WIDE_DOC_IDS, type SiteWideDocId } from '../../../supabase/functions/_shared/cms/siteLinks';
import { cmsGet } from '../modules/pages/cmsApi';
import { pageRemote } from '../modules/pages/PageEditor';
import { PreviewFrame } from './PreviewFrame';
import { windowPort, type FramePort, type FrameMessage, type HostMessage } from './protocol';
import { t } from '../i18n';

export const PREVIEW_ROUTE = /^\/admin\/preview\/([^/]+)\/([^/]+)\/?$/;

/** The doc id and locale of a preview URL, or null. */
export function parsePreviewPath(pathname: string): { docId: string; locale: Locale } | null {
  const m = PREVIEW_ROUTE.exec(pathname);
  if (!m) return null;
  let docId: string;
  try {
    docId = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return /^[a-z0-9-]+$/.test(docId) && isLocale(m[2]) ? { docId, locale: m[2] } : null;
}

const CHROME_DOCS = ['site-header', 'site-footer'] as const;

const isSiteWideDocId = (id: string): id is SiteWideDocId => (SITE_WIDE_DOC_IDS as readonly string[]).includes(id);

async function savedOrPublished(docId: string): Promise<unknown> {
  if (isSiteWideDocId(docId)) {
    const row = await cmsGet(docId).catch(() => null);
    return row ? row.data : publishedSiteDoc(docId);
  }
  return (await pageRemote(docId)).value;
}

export default function AdminPreviewRoute() {
  const { pathname } = useLocation();
  const parsed = parsePreviewPath(pathname);
  const port = useMemo<FramePort>(() => windowPort<HostMessage, FrameMessage>(window, () => window.parent), []);
  const [initial, setInitial] = useState<{ doc: unknown; locale: Locale } | null>(null);
  const [drafts, setDrafts] = useState<DraftDoc[]>([]);
  const docId = parsed?.docId ?? null;
  const locale = parsed?.locale ?? 'en';

  useEffect(() => {
    if (!docId) return;
    let live = true;
    savedOrPublished(docId).then((doc) => { if (live) setInitial({ doc, locale }); }, () => {});
    Promise.all(CHROME_DOCS.filter((id) => id !== docId).map((id) => cmsGet(id).catch(() => null)))
      .then((rows) => {
        if (live) setDrafts(rows.flatMap((r) => (r ? [{ doc_id: r.doc_id, data: r.data }] : [])));
      });
    return () => { live = false; };
  }, [docId, locale]);

  if (!parsed) return <p className="m-6 t-small">{t.preview.badUrl}</p>;
  return <PreviewFrame port={port} docId={parsed.docId} initial={initial} drafts={drafts} />;
}
