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
 * Optional docs ({ optional: true }, the editorial layer of the data pages):
 * a doc that does not exist is 'missing', never an error, on the server too,
 * and nothing is recorded, so a page without one inlines exactly what it did
 * before. On the client, a doc not already in the cache is first looked up
 * in content/pages/index.json (the editorial docs that exist): one request
 * per session instead of one per page, and none for the doc when it is not
 * listed. 'loading' until the index answers; an unreadable index falls back
 * to requesting the doc.
 *
 * Admin preview: inside PageContentOverrideProvider for this docId, the draft's
 * slice is returned synchronously; the cache, collector and network are never
 * consulted for that doc (useContent gets a null path). A draft lacking the
 * active locale throws, for the preview's error boundary.
 *
 * Contest fact tokens ({2014.song}, {stats.topCountries}..., see
 * src/lib/cms/facts.ts) are resolved in every string of the returned slice,
 * draft included. A doc using any loads contests/index.json (and
 * countries/index.json only for the facts that need it) through useContent,
 * so the prerender inlines them; 'loading' until they are ready. A doc
 * without tokens loads nothing more.
 *
 * T comes from the doc type's schema via `import type` (z.infer), so zod
 * stays out of the client bundle.
 */
import { useContext } from 'react';
import { peekContent, useContent, type ContentState } from '../seo/useContent';
import { PAGES_INDEX_PATH, readPagesIndex } from '../../../supabase/functions/_shared/cms/pagesIndex';
import { ContentCollectorContext } from '../seo/contentContext';
import { useLocale } from '../seo/LocaleContext';
import { usePageContentOverride } from './pageContentOverrideContext';
import { factNeeds, factValues, resolveFacts } from './facts';
import { SITE_PATH } from '../currentContest';
import type { ContestIndex, CountryIndex, SiteSnapshot } from '../../content/contests/types';

const CONTEST_INDEX_PATH = 'contests/index.json';
const COUNTRY_INDEX_PATH = 'countries/index.json';

export const pageContentPath = (docId: string): string => `pages/${docId}.json`;

export type PageContentOptions = {
  /** The doc may not exist: 'missing' instead of an error (see above). */
  optional?: boolean;
};

/** Whether the index lists `docId`: null while it loads; true when it cannot be read (ask for the doc). */
function listedInIndex(index: ContentState<unknown>, docId: string): boolean | null {
  if (index.status === 'loading') return null;
  if (index.status !== 'ready') return true;
  return readPagesIndex(index.data)?.includes(docId) ?? true;
}

export function usePageContent<T>(docId: string, options: PageContentOptions = {}): ContentState<T> {
  const raw = useRawPageContent<T>(docId, options);
  return useResolvedFacts(raw);
}

/** Resolved slices: slice → contests table → { locale, countries, value }. */
const resolved = new WeakMap<object, WeakMap<object, { locale: string; countries: object | null; value: unknown }>>();

function useResolvedFacts<T>(state: ContentState<T>): ContentState<T> {
  const locale = useLocale();
  const needs = factNeeds(state.status === 'ready' ? state.data : null);
  const contests = useContent<ContestIndex>(needs.any ? CONTEST_INDEX_PATH : null);
  const countries = useContent<CountryIndex>(needs.countries ? COUNTRY_INDEX_PATH : null);
  const site = useContent<SiteSnapshot>(needs.any ? SITE_PATH : null);
  if (state.status !== 'ready' || !needs.any) return state;
  const pending = [contests, site, ...(needs.countries ? [countries] : [])].find((s) => s.status !== 'ready');
  if (pending) return pending as ContentState<T>;
  if (contests.status !== 'ready' || site.status !== 'ready') return { status: 'loading' };
  const tables = { contests: contests.data, countries: countries.status === 'ready' ? countries.data : null, site: site.data };
  const data = state.data as object;
  let byTable = resolved.get(data);
  if (!byTable) resolved.set(data, (byTable = new WeakMap()));
  let hit = byTable.get(tables.contests);
  if (!hit || hit.locale !== locale || hit.countries !== tables.countries) {
    hit = { locale, countries: tables.countries, value: resolveFacts(state.data, factValues(tables, locale)) };
    byTable.set(tables.contests, hit);
  }
  return { status: 'ready', data: hit.value as T };
}

function useRawPageContent<T>(docId: string, { optional = false }: PageContentOptions): ContentState<T> {
  const path = pageContentPath(docId);
  const locale = useLocale();
  const isServer = useContext(ContentCollectorContext) !== null;
  const override = usePageContentOverride();
  const draft = override !== null && override.docId === docId ? override : null;
  // Client only (the server must not record, hence inline, the index).
  const askIndex = optional && !draft && !isServer && peekContent(path) === undefined;
  const index = useContent<unknown>(askIndex ? PAGES_INDEX_PATH : null);
  const listed = askIndex ? listedInIndex(index, docId) : true;
  const state = useContent<Partial<Record<typeof locale, T>>>(draft || listed !== true ? null : path, locale);

  if (draft) {
    const doc = draft.doc;
    const data = doc && typeof doc === 'object' ? (doc as Partial<Record<typeof locale, T>>)[locale] : undefined;
    if (data === undefined) throw new Error(`the draft of ${docId} has no "${locale}" content`);
    return { status: 'ready', data };
  }

  if (listed === null) return { status: 'loading' };
  if (listed === false) return { status: 'missing' };

  if (state.status === 'ready') {
    const data = state.data[locale];
    if (data !== undefined) return { status: 'ready', data };
    if (isServer) throw new Error(`usePageContent: content/${path} has no "${locale}" content`);
    return { status: 'missing' };
  }
  if (isServer) {
    if (optional) return { status: 'missing' };
    throw new Error(`usePageContent: content/${path} does not exist`);
  }
  return state;
}
