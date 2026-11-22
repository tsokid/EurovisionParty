// Context for PageContentOverrideProvider (see PageContentOverride.tsx), kept
// apart so that file exports components only (react-refresh).
import { createContext, useContext } from 'react';

export interface PageContentOverride {
  /**
   * doc_id -> draft document `{ en: T, el: T }` (unvalidated), built with
   * overlayDrafts (_shared/cms/overlay.ts), the rule publish-content uses:
   * a listed doc is replaced as a whole, every other doc is read as committed.
   */
  docs: Readonly<Record<string, unknown>>;
}

export const PageContentOverrideContext = createContext<PageContentOverride | null>(null);

export function usePageContentOverride(): PageContentOverride | null {
  return useContext(PageContentOverrideContext);
}

/** The draft of `docId` when the override holds one ({ doc }), else null (read the committed doc). */
export function overriddenDoc(override: PageContentOverride | null, docId: string): { doc: unknown } | null {
  return override && Object.prototype.hasOwnProperty.call(override.docs, docId) ? { doc: override.docs[docId] } : null;
}
