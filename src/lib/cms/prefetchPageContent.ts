/**
 * Link prefetch for CMS page docs: on hover/focus of a link to a registry
 * page, warm content/pages/{docId}.json so a client-side navigation renders
 * the page at once instead of its pending state. Every registry page has a
 * doc (tests/cms/contentPagesComplete.test.ts), keyed by its pageId.
 */
import { PAGE_REGISTRY } from '../seo/registry';
import { localeFromPath, localizePath, oppositeLocale, type Locale } from '../seo/locale';
import { prefetchContent } from '../seo/useContent';
import { pageContentPath } from './usePageContent';

const hasLocale = (p: (typeof PAGE_REGISTRY)[number], l: Locale) =>
  !(l === 'en' && p.greekExclusive) && !(l === 'el' && p.englishExclusive);

const DOC_BY_PATH = new Map<string, string>(
  PAGE_REGISTRY.flatMap((p) =>
    (['en', 'el'] as const)
      .filter((l) => hasLocale(p, l))
      .map((l) => [localizePath(l, p.slugByLocale[l]), p.id] as const),
  ),
);

const PAGE_BY_ID = new Map<string, (typeof PAGE_REGISTRY)[number]>(PAGE_REGISTRY.map((p) => [p.id, p] as const));

/** The page doc behind a localized app path (`/en/faq#x` → faq, en), or null. */
export function pageDocIdForPath(path: string): { docId: string; locale: Locale } | null {
  if (!path.startsWith('/')) return null;
  const clean = path.split(/[?#]/, 1)[0].replace(/(.)\/+$/, '$1');
  const docId = DOC_BY_PATH.get(clean);
  const locale = localeFromPath(clean);
  return docId && locale ? { docId, locale } : null;
}

/** Warm the cache with the target page's doc (its locale), if it is a registry page. */
export function prefetchPageContent(path: string): void {
  const target = pageDocIdForPath(path);
  if (target) prefetchContent(pageContentPath(target.docId), target.locale);
}

/**
 * Language-switcher prefetch: warm the other locale's slice of the page at
 * `path` (the current one), so switching language renders it at once. The doc
 * file holds both locales; keyed on the other locale, a file already cached
 * with it is not refetched. No-op off the registry or for a one-locale page.
 */
export function prefetchOtherLocaleContent(path: string): void {
  const here = pageDocIdForPath(path);
  if (!here) return;
  const other = oppositeLocale(here.locale);
  const page = PAGE_BY_ID.get(here.docId);
  if (page && hasLocale(page, other)) prefetchContent(pageContentPath(here.docId), other);
}
