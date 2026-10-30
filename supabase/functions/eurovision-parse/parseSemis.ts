// supabase/functions/eurovision-parse/parseSemis.ts
// Pure extractor for a eurovision.com semi-final scoreboard page. HTML in,
// rows out: no Deno APIs, no network, so vitest can import it
// (tests/functions/parseSemis.test.ts, fixture semi-basel-2025-sf1.html).
//
// The page's classes are unstable, so only these markers are used:
//   * aria-label="Scoreboard entry for <Country>"   one per entry (the
//     entry repeats its points and details for mobile and desktop)
//   * the first <div> holding a bare number          the semi place
//   * <p>N points</p>                                the semi points
//   * the "Running Order" label and the value after it
//   * the <h2> headings "Qualified for the Grand Final" / "Did not qualify",
//     which set `qualified` for every entry after them (null before any)
// Artist and song are the two <p> texts after the country name that are
// not "N points" (the artist is not always a link).

import { isoFor } from './parse.ts';

export interface SemiRow {
  iso: string;
  country: string;
  artist: string;
  song: string;
  runningOrder: number | null;
  place: number | null;
  points: number | null;
  qualified: boolean | null;
}

const BASE = 'https://www.eurovision.com/eurovision-song-contest';

/** eurovision.com URL of semi-final 1 or 2, e.g. …/basel-2025/basel-2025-first-semi-final/. */
export function semiUrl(citySlug: string, year: number, semi: 1 | 2): string {
  const edition = `${citySlug}-${year}`;
  return `${BASE}/${edition}/${edition}-${semi === 1 ? 'first' : 'second'}-semi-final/`;
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

const text = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const toInt = (m: RegExpMatchArray | null) => (m ? parseInt(m[1], 10) : null);

export function parseSemis(html: string): SemiRow[] {
  const doc = html.replace(/<!--[\s\S]*?-->/g, '');

  // Section headings, in document order.
  const sections: { at: number; qualified: boolean }[] = [];
  for (const m of doc.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)) {
    const t = text(m[1]).toLowerCase();
    if (/qualified for the grand final/.test(t)) sections.push({ at: m.index!, qualified: true });
    else if (/did not qualify/.test(t)) sections.push({ at: m.index!, qualified: false });
  }

  const anchors = [...doc.matchAll(/aria-label="Scoreboard entry for ([^"]+)"/g)].map((m) => ({
    at: m.index!,
    country: decode(m[1]).trim(),
  }));

  const rows: SemiRow[] = [];
  const seen = new Set<string>();
  anchors.forEach(({ at, country }, i) => {
    const iso = isoFor(country);
    if (!iso) throw new Error(`unknown country ${country}`);
    if (seen.has(iso)) return;
    seen.add(iso);

    const slice = doc.slice(at, anchors[i + 1]?.at ?? doc.length);
    const section = sections.filter((s) => s.at < at).pop();

    const ro = slice.indexOf('Running Order');
    const runningOrder = ro < 0 ? null : toInt(text(slice.slice(ro + 'Running Order'.length, ro + 200)).match(/^(\d+)/));

    // <p> texts after the country name, minus the "N points" ones.
    const ps = [...slice.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1]));
    const after = ps.slice(ps.indexOf(country) + 1).filter((t) => !/^\d+ points?$/i.test(t));

    rows.push({
      iso,
      country,
      artist: after[0] ?? '',
      song: after[1] ?? '',
      runningOrder,
      place: toInt(slice.match(/<div\b[^>]*>\s*(\d+)\s*<\/div>/)),
      points: toInt(slice.match(/<p\b[^>]*>\s*(\d+)\s*points?\s*<\/p>/i)),
      qualified: section ? section.qualified : null,
    });
  });
  return rows;
}
