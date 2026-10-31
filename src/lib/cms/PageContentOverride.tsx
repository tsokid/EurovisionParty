/**
 * Admin preview: serve one CMS page document from an in-memory draft.
 *
 * Inside <PageContentOverrideProvider docId doc>, usePageContent(docId)
 * returns the draft's active-locale slice synchronously and never touches the
 * shared content cache, the prerender collector or the network for that doc.
 * Other docs the page reads (site.json, contests/*.json, other pages) still go
 * through useContent() as usual. The public site never renders this provider.
 */
import { useMemo, type ReactNode } from 'react';
import { PageContentOverrideContext, type PageContentOverride } from './pageContentOverrideContext';

export function PageContentOverrideProvider({ docId, doc, children }: PageContentOverride & { children: ReactNode }) {
  const value = useMemo(() => ({ docId, doc }), [docId, doc]);
  return <PageContentOverrideContext.Provider value={value}>{children}</PageContentOverrideContext.Provider>;
}
