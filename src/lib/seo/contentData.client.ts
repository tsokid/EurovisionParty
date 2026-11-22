/**
 * Client-build stand-in for ./contentData.ts (swapped in by the
 * `europarty-content` plugin in vite.config.ts). Same exports, no snapshot:
 * lookups answer from the content cache (inlined JSON + fetched files), and
 * the whole-snapshot accessors are unavailable in the browser.
 * Components should use useContent(), which also fetches on a cache miss.
 *
 * Exception: site.json (under 1 KB: current year, live stage and the live
 * contest's facts) is bundled, so the nav, guide pages and game UI render it
 * synchronously on every client navigation, prerendered or not. The bundle is
 * rebuilt with every content publish, so it always matches the inlined copy.
 * So are the site-wide CMS docs (header, footer, settings; a few KB): every
 * page renders them, so they are never inlined per page or fetched.
 */
import type * as Server from './contentData';
import type { ContestSnapshot, SiteSnapshot } from '../../content/contests/types';
import { getCachedContent } from './contentCache';
import bundledSite from '../../../content/site.json';
import siteHeader from '../../../content/pages/site-header.json';
import siteFooter from '../../../content/pages/site-footer.json';
import siteSettings from '../../../content/pages/site-settings.json';

function serverOnly(name: string): never {
  throw new Error(`contentData.${name}() is not available in the client bundle; use useContent()`);
}

const SITE = bundledSite as SiteSnapshot;

const BUNDLED: Record<string, unknown> = {
  'site.json': SITE,
  'pages/site-header.json': siteHeader,
  'pages/site-footer.json': siteFooter,
  'pages/site-settings.json': siteSettings,
};

export const bundledContent: typeof Server.bundledContent = (path) => BUNDLED[path];

export const getSite: typeof Server.getSite = () => (getCachedContent('site.json') as SiteSnapshot | undefined) ?? SITE;

export const getContest: typeof Server.getContest = (year) =>
  getCachedContent(`contests/${year}.json`) as ContestSnapshot | undefined;

export const getCountryBySlug: typeof Server.getCountryBySlug = () => serverOnly('getCountryBySlug');
export const allContests: typeof Server.allContests = () => serverOnly('allContests');
export const allCountries: typeof Server.allCountries = () => serverOnly('allCountries');
export const contentData: typeof Server.contentData = () => serverOnly('contentData');
