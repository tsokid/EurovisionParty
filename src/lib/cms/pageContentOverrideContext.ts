// Context for PageContentOverrideProvider (see PageContentOverride.tsx), kept
// apart so that file exports components only (react-refresh).
import { createContext, useContext } from 'react';

export interface PageContentOverride {
  docId: string;
  /** The draft document, shape `{ en: T, el: T }` (unvalidated). */
  doc: unknown;
}

export const PageContentOverrideContext = createContext<PageContentOverride | null>(null);

export function usePageContentOverride(): PageContentOverride | null {
  return useContext(PageContentOverrideContext);
}
