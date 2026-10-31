/**
 * The committed content snapshot (content/**), loaded eagerly with Vite's
 * import.meta.glob. SERVER ONLY: used by the SSR build (prerender) and vitest.
 *
 * The client build never contains this module: the `europarty-content` plugin
 * in vite.config.ts resolves it to ./contentData.client.ts for every non-SSR
 * import, so the ~1.7 MB snapshot stays out of the JS. Client pages read
 * content through useContent() (inlined JSON, then fetch /content/<path>).
 *
 * Node build scripts (tsx, no import.meta.glob) use scripts/seo/loadContent.ts,
 * which returns the same ContentData shape.
 */
import type { ContestSnapshot, CountrySnapshot, SiteSnapshot } from '../../content/contests/types';
import type { ContentData } from './dynamicPages';

const PREFIX = '../../../content/';
const modules = import.meta.glob<unknown>('../../../content/**/*.json', { eager: true, import: 'default' });

/**
 * Every content file keyed by its path relative to content/ (`contests/2026.json`),
 * CMS page documents included (`pages/about.json`, read by usePageContent()).
 */
const files = new Map<string, unknown>(
  Object.entries(modules).map(([key, data]) => [key.slice(PREFIX.length), data]),
);

const site = files.get('site.json') as SiteSnapshot;
const contests: ContestSnapshot[] = [...files]
  .filter(([path]) => /^contests\/\d{4}\.json$/.test(path))
  .map(([, data]) => data as ContestSnapshot)
  .sort((a, b) => a.year - b.year);
const countries: CountrySnapshot[] = [...files]
  .filter(([path]) => /^countries\/[A-Z]{2}\.json$/.test(path))
  .map(([, data]) => data as CountrySnapshot)
  .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
const contestByYear = new Map(contests.map((c) => [c.year, c]));
const countryBySlug = new Map(countries.map((c) => [c.slug, c]));

/** One content file by path relative to content/, or undefined. */
export const bundledContent = (path: string): unknown => files.get(path);
export const getSite = (): SiteSnapshot => site;
export const getContest = (year: number): ContestSnapshot | undefined => contestByYear.get(year);
export const allContests = (): ContestSnapshot[] => contests;
export const getCountryBySlug = (slug: string): CountrySnapshot | undefined => countryBySlug.get(slug);
export const allCountries = (): CountrySnapshot[] => countries;
export const contentData = (): ContentData => ({ site: getSite(), contests, countries });
