// Archived-year hub redirects in vercel.json (spec §3: after Archive of
// year Y, /eurovision-Y and its subpages 301 to the archive page;
// Un-archive removes them).
//
// Pure and Deno-free: imported by the publish-content edge function and by
// vitest. The only import is type-only.
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

/** Three redirects per archived year, ordered by year. */
export function generatedRedirects(contests: ContestRow[]): VercelRedirect[] {
  return contests
    .filter((c) => c.stage === 'archived')
    .sort((a, b) => a.year - b.year)
    .flatMap((c) => {
      const page = `past-contests/eurovision-${c.year}-${c.city_slug}`;
      return [
        { source: `/:locale(en|el)/eurovision-${c.year}`, destination: `/:locale/${page}`, permanent: true },
        {
          source: `/:locale(en|el)/eurovision-${c.year}/:sub(schedule|semifinals|songs)`,
          destination: `/:locale/${page}`,
          permanent: true,
        },
        { source: `/eurovision-${c.year}`, destination: `/en/${page}`, permanent: true },
      ];
    });
}

/**
 * vercel.json text with every generated-shape redirect replaced by
 * `generated` (appended after the others). Everything else keeps its
 * order. Output is 2-space JSON with a trailing newline.
 */
export function mergeVercelRedirects(vercelJson: string, generated: VercelRedirect[]): string {
  const cfg = JSON.parse(vercelJson) as { redirects?: VercelRedirect[] } & Record<string, unknown>;
  const kept = (cfg.redirects ?? []).filter((r) => !GENERATED_SOURCE.test(r.source));
  const redirects = [...kept, ...generated];
  const out = 'redirects' in cfg || redirects.length ? { ...cfg, redirects } : cfg;
  return JSON.stringify(out, null, 2) + '\n';
}
