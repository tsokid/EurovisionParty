/**
 * The live contest's yearly facts (year, city, dates, host, line-up size) for
 * the guide pages, the nav and the game UI. They come from site.json's
 * `current` block only, never from the 20 KB contest file:
 * - server render: read from the eager snapshot and recorded, so every
 *   prerendered page inlines site.json (under 1 KB);
 * - client: site.json is bundled (contentData.client.ts), so the hooks are
 *   ready synchronously on every navigation. No loading state, no gate.
 * Only the predictions page's line-up block reads contests/{year}.json.
 */
import type { ContestStage, SiteCurrentContest, SiteSnapshot } from '../content/contests/types';
import type { Locale } from './seo/locale';
import { useContent } from './seo/useContent';

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
  /** Host country names; empty strings when the host is unknown. */
  hostName: Record<Locale, string>;
  stage: ContestStage;
  /** Number of competing countries. */
  lineupSize: number;
  /** Countries in the grand final (0 until known). */
  finalists: number;
}

const cache = new WeakMap<SiteCurrentContest, CurrentContest>();

/** Facts of site.json's `current` block (memoized per object, so hook results are stable). */
export function toCurrentContest(c: SiteCurrentContest): CurrentContest {
  let cc = cache.get(c);
  if (!cc) {
    cc = {
      year: c.year,
      city: c.city,
      citySlug: c.city_slug,
      finalDate: c.dates.final,
      semi1Date: c.dates.semi1,
      semi2Date: c.dates.semi2,
      hostIso: c.host?.iso ?? null,
      hostName: { en: c.host?.name_en ?? '', el: c.host?.name_el ?? '' },
      stage: c.stage,
      lineupSize: c.entry_count,
      finalists: c.finalist_count,
    };
    cache.set(c, cc);
  }
  return cc;
}

/** site.json for a component; always present (eager on the server, bundled on the client). */
function useSite(): SiteSnapshot {
  const site = useContent<SiteSnapshot>(SITE_PATH);
  if (site.status !== 'ready') throw new Error('site.json is not available');
  return site.data;
}

/** current_year from site.json. */
export function useCurrentYear(): number {
  return useSite().current_year;
}

/** The live contest's facts from site.json. */
export function useCurrentContest(): CurrentContest {
  const site = useSite();
  if (!site.current) throw new Error('site.json has no `current` block; rebuild the content snapshot');
  return toCurrentContest(site.current);
}
