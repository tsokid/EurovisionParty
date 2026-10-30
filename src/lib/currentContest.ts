/**
 * The live contest (content/site.json → current_year, then contests/{year}.json):
 * the facts that change every year (year, city, dates, host, line-up) for the
 * guide pages, the nav and the game UI. Reads exactly two small content files,
 * never the whole snapshot.
 *
 * - currentContest(): sync. Server render / vitest read the eager snapshot; in
 *   the browser it answers from the content cache (seeded from the inlined
 *   #__content__ script) and returns null when the files are not cached yet.
 *   It does not record the files for inlining: components use the hooks.
 * - useCurrentContest() / useCurrentYear(): hooks over useContent(), so a
 *   prerendered page inlines the files it read and client-side navigation
 *   fetches them. null while loading (or when the files are missing).
 */
import type { ContestSnapshot, ContestStage, EntrySnapshot, SiteSnapshot } from '../content/contests/types';
import type { Locale } from './seo/locale';
import { getContest, getSite } from './seo/contentData';
import { useContent, type ContentState } from './seo/useContent';

export const SITE_PATH = 'site.json';
export const contestPath = (year: number): string => `contests/${year}.json`;

export interface CurrentContest {
  year: number;
  /** English city name, e.g. "Vienna". */
  city: string;
  citySlug: string;
  finalDate: string | null;
  semi1Date: string | null;
  semi2Date: string | null;
  hostIso: string | null;
  /** Host country names; empty strings when the host has no entry. */
  hostName: Record<Locale, string>;
  stage: ContestStage;
  /** Number of competing countries. */
  lineupSize: number;
  entries: EntrySnapshot[];
}

const cache = new WeakMap<ContestSnapshot, CurrentContest>();

/** Facts of one contest snapshot (memoized per snapshot object, so hook results are stable). */
export function toCurrentContest(c: ContestSnapshot): CurrentContest {
  let cc = cache.get(c);
  if (!cc) {
    const host = c.entries.find((e) => e.iso === c.host_iso);
    cc = {
      year: c.year,
      city: c.city,
      citySlug: c.city_slug,
      finalDate: c.dates.final,
      semi1Date: c.dates.semi1,
      semi2Date: c.dates.semi2,
      hostIso: c.host_iso,
      hostName: { en: host?.name_en ?? '', el: host?.name_el ?? '' },
      stage: c.stage,
      lineupSize: c.entries.length,
      entries: c.entries,
    };
    cache.set(c, cc);
  }
  return cc;
}

function siteOrNull(): SiteSnapshot | null {
  try {
    return getSite();
  } catch {
    return null; // client bundle, site.json not cached yet
  }
}

/** The live contest, synchronously; null only in the browser before its files are cached. */
export function currentContest(): CurrentContest | null {
  const site = siteOrNull();
  const contest = site ? getContest(site.current_year) : undefined;
  return contest ? toCurrentContest(contest) : null;
}

/** current_year from site.json (tiny; every prerendered page inlines it via the header). */
export function useCurrentYear(): number | null {
  const site = useContent<SiteSnapshot>(SITE_PATH);
  return site.status === 'ready' ? site.data.current_year : null;
}

/** The live contest with its load state (for a page that shows loading / error states). */
export function useCurrentContestState(): ContentState<CurrentContest> {
  const site = useContent<SiteSnapshot>(SITE_PATH);
  const year = site.status === 'ready' ? site.data.current_year : null;
  const contest = useContent<ContestSnapshot>(year ? contestPath(year) : null);
  if (site.status !== 'ready') return site;
  if (contest.status !== 'ready') return contest;
  return { status: 'ready', data: toCurrentContest(contest.data) };
}

/** The live contest for a component; null while its files load (or when they cannot). */
export function useCurrentContest(): CurrentContest | null {
  const state = useCurrentContestState();
  return state.status === 'ready' ? state.data : null;
}
