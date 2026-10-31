/**
 * Admin preview mode. When set, SchemaHead writes nothing to document.head
 * (title, meta, canonical, hreflang, JSON-LD) and records nothing in a head
 * collector, and LocaleLink does not prefetch: a previewed page must leave the
 * admin's document untouched. The public site never sets it.
 */
import { createContext, useContext } from 'react';

export const PreviewModeContext = createContext(false);

export function usePreviewMode(): boolean {
  return useContext(PreviewModeContext);
}
