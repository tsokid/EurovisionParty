/**
 * Client-build stand-in for ./contentData.ts (swapped in by the
 * `europarty-content` plugin in vite.config.ts). Same exports, no snapshot:
 * lookups answer from the content cache (inlined JSON + fetched files), and
 * the whole-snapshot accessors are unavailable in the browser.
 * Components should use useContent(), which also fetches on a cache miss.
 */
import type * as Server from './contentData';
import type { ContestSnapshot, SiteSnapshot } from '../../content/contests/types';
import { getCachedContent } from './contentCache';

function serverOnly(name: string): never {
  throw new Error(`contentData.${name}() is not available in the client bundle; use useContent()`);
}

export const bundledContent: typeof Server.bundledContent = () => undefined;

export const getSite: typeof Server.getSite = () => {
  const site = getCachedContent('site.json') as SiteSnapshot | undefined;
  return site ?? serverOnly('getSite');
};

export const getContest: typeof Server.getContest = (year) =>
  getCachedContent(`contests/${year}.json`) as ContestSnapshot | undefined;

export const getCountryBySlug: typeof Server.getCountryBySlug = () => serverOnly('getCountryBySlug');
export const allContests: typeof Server.allContests = () => serverOnly('allContests');
export const allCountries: typeof Server.allCountries = () => serverOnly('allCountries');
export const contentData: typeof Server.contentData = () => serverOnly('contentData');
