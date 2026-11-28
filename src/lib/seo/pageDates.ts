/**
 * When a page's copy or layout last changed (28 Nov 2026): the date its
 * sitemap entry carries, from git (scripts/seo/generate-sitemap.ts writes
 * src/generated/pageDates.json on every build). Pages use it for the
 * Article/WebPage dateModified instead of a hard-coded date.
 */
import type { PageId } from './registry';
import dates from '../../generated/pageDates.json';

/** First publication of the static pages (fact, unchanged). */
export const FIRST_PUBLISHED = '2026-04-30T00:00:00Z';

export function pageModified(id: PageId): string {
  const d = (dates as Partial<Record<PageId, string>>)[id];
  return d ? `${d}T00:00:00Z` : FIRST_PUBLISHED;
}
