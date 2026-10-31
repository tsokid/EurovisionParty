// Data side of the editorial layer (see EditorialLayer.tsx): the doc and the
// description override. Its FAQ blocks reach the page's JSON-LD through
// mergeFaqJsonLd (components/cms/extraFaq.ts), as the static pages' do.
// Kept apart from the components (react-refresh).
import type { CmsBlock, CmsImageValue } from '../../components/cms/mediaTypes';
import { usePageContent } from '../../lib/cms/usePageContent';

/** One locale of an editorial doc as published (schemas/editorial.ts). */
export interface Editorial {
  intro: string;
  image?: CmsImageValue;
  blocks: CmsBlock[];
  metaDescription?: string;
}

/** The page's editorial in the active locale, or null (none, or not loaded yet). */
export function useEditorial(docId: string): Editorial | null {
  const state = usePageContent<Editorial>(docId, { optional: true });
  return state.status === 'ready' ? state.data : null;
}

/** metaDescription when the editorial sets one, else the page's own description. */
export function editorialDescription(e: Editorial | null, templated: string): string {
  const own = typeof e?.metaDescription === 'string' ? e.metaDescription.trim() : '';
  return own || templated;
}
