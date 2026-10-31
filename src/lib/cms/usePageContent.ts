/**
 * usePageContent<T>(docId): the active locale's slice of the CMS page
 * document content/pages/{docId}.json (shape `{ en: T, el: T }`).
 *
 * A thin layer over useContent(), so it shares its cache, seed and fetch:
 * - Server (prerender): read from the eager snapshot and recorded in the
 *   per-render collector as `{ [locale]: slice }` only (a keyed read), so the
 *   page inlines its own locale of its doc in #__content__, not both.
 *   A missing doc (or locale slice) throws: every static page is
 *   prerendered, so a page without its doc must fail the build.
 * - Client: synchronous from the seeded cache (hydration), otherwise
 *   'loading' while /content/pages/{docId}.json is fetched, then 'ready',
 *   'missing' or 'error' (with retry). A seeded doc lacking the active locale
 *   is the other locale's partial (a locale switch): the full file is fetched.
 *   Pages render ContentPending for the body while not ready, never hiding
 *   PageSeo behind it. LocaleLink prefetches the doc on hover/focus.
 *
 * T comes from the doc type's schema via `import type` (z.infer), so zod
 * stays out of the client bundle.
 */
import { useContext } from 'react';
import { useContent, type ContentState } from '../seo/useContent';
import { ContentCollectorContext } from '../seo/contentContext';
import { useLocale } from '../seo/LocaleContext';

export const pageContentPath = (docId: string): string => `pages/${docId}.json`;

export function usePageContent<T>(docId: string): ContentState<T> {
  const path = pageContentPath(docId);
  const locale = useLocale();
  const isServer = useContext(ContentCollectorContext) !== null;
  const state = useContent<Partial<Record<typeof locale, T>>>(path, locale);

  if (state.status === 'ready') {
    const data = state.data[locale];
    if (data !== undefined) return { status: 'ready', data };
    if (isServer) throw new Error(`usePageContent: content/${path} has no "${locale}" content`);
    return { status: 'missing' };
  }
  if (isServer) throw new Error(`usePageContent: content/${path} does not exist`);
  return state;
}
