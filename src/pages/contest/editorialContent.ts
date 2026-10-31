// Data side of the editorial layer (see EditorialLayer.tsx): the doc, the
// description override and the FAQ JSON-LD. Kept apart from the components
// (react-refresh).
import { faqEntries } from '../../components/cms/faqEntries';
import type { CmsBlock, CmsImageValue } from '../../components/cms/mediaTypes';
import { usePageContent } from '../../lib/cms/usePageContent';
import { buildFaqPage } from '../../lib/seo/schema';

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

/** FAQPage JSON-LD of the editorial's FAQ blocks: none, or one block to append to the page's jsonLd. */
export function editorialJsonLd(e: Editorial | null): object[] {
  const entries = faqEntries(e?.blocks);
  return entries.length ? [buildFaqPage(entries)] : [];
}
