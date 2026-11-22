/**
 * Admin preview: serve CMS page documents from in-memory drafts.
 *
 * Inside <PageContentOverrideProvider docId doc drafts?>, usePageContent(id)
 * and useSiteDoc(id) return the active-locale slice of the draft of `id`
 * synchronously and never touch the shared content cache, the prerender
 * collector or the network for that doc. `doc` is the document being edited;
 * `drafts` are other saved drafts the page shows (the header and footer).
 * The drafts are overlaid with overlayDrafts (_shared/cms/overlay.ts), the
 * function publish-content uses for the pages after a publish. Every other
 * doc (site.json, contests/*.json, other pages) still goes through
 * useContent() as usual. The public site never renders this provider.
 */
import { useMemo, type ReactNode } from 'react';
import { overlayDrafts, type DraftDoc } from '../../../supabase/functions/_shared/cms/overlay';
import { PageContentOverrideContext } from './pageContentOverrideContext';

const NO_DRAFTS: readonly DraftDoc[] = [];

export function PageContentOverrideProvider({ docId, doc, drafts = NO_DRAFTS, children }: {
  docId: string;
  doc: unknown;
  drafts?: readonly DraftDoc[];
  children: ReactNode;
}) {
  // The edited doc comes last, so it wins over a saved draft of the same id.
  const value = useMemo(() => ({ docs: overlayDrafts({}, [...drafts, { doc_id: docId, data: doc }]) }), [docId, doc, drafts]);
  return <PageContentOverrideContext.Provider value={value}>{children}</PageContentOverrideContext.Provider>;
}
