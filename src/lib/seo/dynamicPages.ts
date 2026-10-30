/**
 * Data-driven public URLs (hub, archive, countries) computed from the content
 * snapshot. Pure: callers pass the data in, so the same function serves app
 * code (contentData.ts, Vite import.meta.glob) and Node build scripts
 * (scripts/seo/loadContent.ts, fs) — tsx has no import.meta.glob.
 */
import type { ContestSnapshot, CountrySnapshot, SiteSnapshot } from '../../content/contests/types';
import { LOCALES, localizePath, type Locale } from './locale';

export interface ContentData {
  site: SiteSnapshot;
  /** Sorted by year. */
  contests: ContestSnapshot[];
  /** Sorted by ISO. */
  countries: CountrySnapshot[];
}

export type DynamicPageKind = 'hub' | 'archive' | 'archive-index' | 'country' | 'country-index';

export interface DynamicPage {
  locale: Locale;
  /** Locale-prefixed path, e.g. `/en/countries/greece`. */
  path: string;
  indexable: boolean;
  kind: DynamicPageKind;
  /** Repo-relative content files the page is built from (sitemap lastmod). */
  files: string[];
}

/** A country page is indexable from this many (non-cancelled) participations. */
export const COUNTRY_INDEXABLE_MIN = 3;
export const HUB_SUBPAGES = ['schedule', 'semifinals', 'songs'] as const;

const HUB_SLUG = /^eurovision-(\d{4})$/;

/** `eurovision-2026` → 2026; anything else → null. */
export function hubYearFromSlug(slug: string | undefined): number | null {
  const m = slug ? HUB_SLUG.exec(slug) : null;
  return m ? Number(m[1]) : null;
}

/** Unprefixed paths. */
export const hubPath = (year: number) => `/eurovision-${year}`;
export const archiveSlug = (year: number, citySlug: string) => `eurovision-${year}-${citySlug}`;
export const archivePath = (year: number, citySlug: string) => `/past-contests/${archiveSlug(year, citySlug)}`;
export const countryPath = (slug: string) => `/countries/${slug}`;
export const ARCHIVE_INDEX_PATH = '/past-contests';
export const COUNTRY_INDEX_PATH = '/countries';

const contestFile = (year: number) => `content/contests/${year}.json`;
const countryFile = (iso: string) => `content/countries/${iso}.json`;

/** Participations that actually performed (2020 was cancelled). */
export function countedParticipations(country: CountrySnapshot): number {
  return country.participations.filter((p) => !p.cancelled).length;
}

export function isCountryIndexable(country: CountrySnapshot): boolean {
  return countedParticipations(country) >= COUNTRY_INDEXABLE_MIN;
}

/**
 * Every data-driven page, both locales (en then el per page):
 * - the live year's hub + schedule/semifinals/songs (only while that year is not archived);
 * - /past-contests and one page per archived year (indexable = contests.indexable);
 * - /countries and one page per country with ≥ 1 participation
 *   (indexable when ≥ COUNTRY_INDEXABLE_MIN non-cancelled participations).
 */
export function dynamicPageUrls(data: ContentData): DynamicPage[] {
  const out: DynamicPage[] = [];
  const add = (path: string, kind: DynamicPageKind, indexable: boolean, files: string[]) => {
    for (const locale of LOCALES) out.push({ locale, path: localizePath(locale, path), indexable, kind, files });
  };

  const live = data.contests.find((c) => c.year === data.site.current_year);
  if (live && live.stage !== 'archived') {
    const files = [contestFile(live.year)];
    add(hubPath(live.year), 'hub', true, files);
    for (const sub of HUB_SUBPAGES) add(`${hubPath(live.year)}/${sub}`, 'hub', true, files);
  }

  const archived = data.contests.filter((c) => c.stage === 'archived');
  add(ARCHIVE_INDEX_PATH, 'archive-index', true, archived.map((c) => contestFile(c.year)));
  for (const c of archived) add(archivePath(c.year, c.city_slug), 'archive', c.indexable, [contestFile(c.year)]);

  const countries = data.countries.filter((c) => c.participations.length > 0);
  add(COUNTRY_INDEX_PATH, 'country-index', true, countries.map((c) => countryFile(c.iso)));
  for (const c of countries) add(countryPath(c.slug), 'country', isCountryIndexable(c), [countryFile(c.iso)]);

  return out;
}
