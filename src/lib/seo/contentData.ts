/**
 * The committed content snapshot (content/**), loaded eagerly with Vite's
 * import.meta.glob. Works in the client build, the SSR build and vitest.
 * Node build scripts (tsx, no import.meta.glob) use scripts/seo/loadContent.ts,
 * which returns the same ContentData shape.
 */
import type { ContestSnapshot, CountrySnapshot, SiteSnapshot } from '../../content/contests/types';
import type { ContentData } from './dynamicPages';
import site from '../../../content/site.json';

const contestModules = import.meta.glob<ContestSnapshot>('../../../content/contests/*.json', { eager: true, import: 'default' });
const countryModules = import.meta.glob<CountrySnapshot>('../../../content/countries/*.json', { eager: true, import: 'default' });

const contests: ContestSnapshot[] = Object.values(contestModules).sort((a, b) => a.year - b.year);
const countries: CountrySnapshot[] = Object.values(countryModules).sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
const contestByYear = new Map(contests.map((c) => [c.year, c]));
const countryBySlug = new Map(countries.map((c) => [c.slug, c]));

export const getSite = (): SiteSnapshot => site as SiteSnapshot;
export const getContest = (year: number): ContestSnapshot | undefined => contestByYear.get(year);
export const allContests = (): ContestSnapshot[] => contests;
export const getCountryBySlug = (slug: string): CountrySnapshot | undefined => countryBySlug.get(slug);
export const allCountries = (): CountrySnapshot[] => countries;
export const contentData = (): ContentData => ({ site: getSite(), contests, countries });
