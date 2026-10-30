// Contest-year redirects in vercel.json (spec §3).
//
// * Archived year Y: /eurovision-Y and its subpages 301 to the archive page
//   (Un-archive removes them).
// * Live hub year: unprefixed /eurovision-Y (and its subpages) redirect to
//   /en or, for Greek browsers, /el, instead of falling to the SPA shell.
// * Static redirects whose destination is an archived year's hub path (e.g.
//   the flat legacy /:locale/eurovision-2026-schedule → /:locale/eurovision-
//   2026/schedule) are repointed to the archive page, so they stay one hop.
//   Un-archive points them back at the hub root (the subpage they came from
//   is not recorded).
//
// Pure and Deno-free: imported by the publish-content edge function, by
// scripts/snapshot/build-local.ts and by vitest. The only import is type-only.
import type { ContestRow } from '../_shared/contestTypes.ts';

export type VercelRedirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: Array<{ type: string; key: string; value?: string }>;
};

/**
 * Sources this module owns: the hub of a year, prefixed or not, and anything
 * below it. WARNING: every vercel.json redirect matching this is dropped and
 * regenerated on each Publish, so a hand-written /eurovision-YYYY redirect
 * does not survive. Put manual year redirects under another source shape.
 */
const GENERATED_SOURCE = /^(\/:locale\(en\|el\))?\/eurovision-\d{4}(\/|$)/;

/** accept-language condition of the site's other locale-detect redirects. */
const GREEK_BROWSER = { type: 'header', key: 'accept-language', value: '(?<l>.*\\bel\\b.*)' };

const SUBPAGES = ':sub(schedule|semifinals|songs)';

/**
 * Year whose hub is live: the current or finalized contest, else the latest
 * non-archived one, else none. Mirrors the site.json pick in snapshot.ts
 * (minus its "latest archived" fallback, which has no hub).
 */
function liveHubYear(contests: ContestRow[]): number | null {
  const live = contests.find((c) => c.stage === 'current' || c.stage === 'finalized');
  if (live) return live.year;
  const open = contests.filter((c) => c.stage !== 'archived').map((c) => c.year);
  return open.length ? Math.max(...open) : null;
}

/** Archived years (three redirects each, by year), then the live hub (four). */
export function generatedRedirects(contests: ContestRow[]): VercelRedirect[] {
  const archived = contests
    .filter((c) => c.stage === 'archived')
    .sort((a, b) => a.year - b.year)
    .flatMap((c) => {
      const page = `past-contests/eurovision-${c.year}-${c.city_slug}`;
      return [
        { source: `/:locale(en|el)/eurovision-${c.year}`, destination: `/:locale/${page}`, permanent: true },
        {
          source: `/:locale(en|el)/eurovision-${c.year}/${SUBPAGES}`,
          destination: `/:locale/${page}`,
          permanent: true,
        },
        { source: `/eurovision-${c.year}`, destination: `/en/${page}`, permanent: true },
      ];
    });
  const y = liveHubYear(contests);
  const live: VercelRedirect[] = y === null ? [] : [
    { source: `/eurovision-${y}`, has: [GREEK_BROWSER], destination: `/el/eurovision-${y}`, permanent: true },
    { source: `/eurovision-${y}`, destination: `/en/eurovision-${y}`, permanent: true },
    { source: `/eurovision-${y}/${SUBPAGES}`, has: [GREEK_BROWSER], destination: `/el/eurovision-${y}/:sub`, permanent: true },
    { source: `/eurovision-${y}/${SUBPAGES}`, destination: `/en/eurovision-${y}/:sub`, permanent: true },
  ];
  return [...archived, ...live];
}

/** Locale part of a destination (`/:locale`, `/en`, `/el`), then the rest. */
const HUB_DEST = /^(\/:locale|\/en|\/el)\/eurovision-(\d{4})(\/(schedule|semifinals|songs))?$/;
const ARCHIVE_DEST = /^(\/:locale|\/en|\/el)\/past-contests\/eurovision-(\d{4})-[a-z]+(-[a-z]+)*$/;

/** Archive page path (no locale) per archived year, read off `generated`. */
function archivePages(generated: VercelRedirect[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const r of generated) {
    const m = /^\/eurovision-(\d{4})$/.exec(r.source);
    if (m && !r.has && r.destination.startsWith('/en/past-contests/')) {
      out.set(Number(m[1]), r.destination.slice('/en'.length));
    }
  }
  return out;
}

/** M2: a kept redirect's destination after the archive state in `pages`. */
function repoint(destination: string, pages: Map<number, string>): string {
  const hub = HUB_DEST.exec(destination);
  if (hub) {
    const page = pages.get(Number(hub[2]));
    return page ? `${hub[1]}${page}` : destination;
  }
  const arch = ARCHIVE_DEST.exec(destination);
  if (arch && !pages.has(Number(arch[2]))) return `${arch[1]}/eurovision-${arch[2]}`;
  return destination;
}

/**
 * vercel.json text with every generated-shape redirect replaced by
 * `generated` (appended after the others) and the others' destinations
 * repointed for the archived years in `generated`. Everything else keeps
 * its order. Output is 2-space JSON with a trailing newline.
 */
export function mergeVercelRedirects(vercelJson: string, generated: VercelRedirect[]): string {
  const cfg = JSON.parse(vercelJson) as { redirects?: VercelRedirect[] } & Record<string, unknown>;
  const pages = archivePages(generated);
  const kept = (cfg.redirects ?? [])
    .filter((r) => !GENERATED_SOURCE.test(r.source))
    .map((r) => {
      const destination = repoint(r.destination, pages);
      return destination === r.destination ? r : { ...r, destination };
    });
  const redirects = [...kept, ...generated];
  const out = 'redirects' in cfg || redirects.length ? { ...cfg, redirects } : cfg;
  return JSON.stringify(out, null, 2) + '\n';
}
