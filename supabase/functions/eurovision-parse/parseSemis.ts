// supabase/functions/eurovision-parse/parseSemis.ts
// Pure extractor for a eurovision.com semi-final scoreboard page. HTML in,
// rows out: no Deno APIs, no network, so vitest can import it
// (tests/functions/parseSemis.test.ts, fixture semi-basel-2025-sf1.html).
//
// The page's classes are unstable, so only these markers are used:
//   * aria-label="Scoreboard entry for <Country>"   one per entry (the
//     entry repeats its points and details for mobile and desktop)
//   * the first <div> holding a bare number          the semi place
//   * "N points"                                      the semi points
//   * the "Running Order" label and the number after it
//   * the <h2> headings "Qualified for the Grand Final" / "Did not qualify",
//     which set `qualified` for every entry after them (null before any)
// Points and running order are read from the entry's text with all tags
// stripped, so attributes cannot interfere. Tags are matched with quoted
// attribute values skipped, as real class lists contain '>' (e.g. [&>svg]).
// Artist and song are the two <p> texts after the one naming the country
// (matched through isoFor, so case and extra text do not matter) that are
// not "N points"; the artist is not always a link.
//
// semiProblem() is the sanity gate the edge function applies before writing.

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

// One HTML tag, skipping '>' inside quoted attribute values.
const TAG = String.raw`<\/?[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>`;
const OPEN = (name: string) => String.raw`<${name}\b(?:[^>"']|"[^"]*"|'[^']*')*>`;

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

const text = (html: string) => decode(html.replace(new RegExp(TAG, 'g'), ' ')).replace(/\s+/g, ' ').trim();

const toInt = (m: RegExpMatchArray | null) => (m ? parseInt(m[1], 10) : null);

/** Leading words of a <p> text that name a country, e.g. "UKRAINE 🇺🇦" → UA. */
function isoOfText(t: string): string | null {
  const words = t.split(' ');
  for (let n = words.length; n > 0; n--) {
    const iso = isoFor(words.slice(0, n).join(' '));
    if (iso) return iso;
  }
  return null;
}

export function parseSemis(html: string): SemiRow[] {
  const doc = html.replace(/<!--[\s\S]*?-->/g, '');

  // Section headings, in document order.
  const sections: { at: number; qualified: boolean }[] = [];
  for (const m of doc.matchAll(new RegExp(String.raw`${OPEN('h2')}([\s\S]*?)<\/h2>`, 'gi'))) {
    const t = text(m[1]).toLowerCase();
    if (/qualified for the grand final/.test(t)) sections.push({ at: m.index!, qualified: true });
    else if (/did not qualify/.test(t)) sections.push({ at: m.index!, qualified: false });
  }

  const anchors = [...doc.matchAll(/aria-label="Scoreboard entry for ([^"]+)"/g)].map((m) => ({
    at: m.index!,
    country: decode(m[1]).trim(),
  }));

  const placeRe = new RegExp(String.raw`${OPEN('div')}\s*(\d+)\s*<\/div>`);
  const pRe = new RegExp(String.raw`${OPEN('p')}([\s\S]*?)<\/p>`, 'g');
  const isPoints = (t: string) => /^\d+ points?$/i.test(t);

  const rows: SemiRow[] = [];
  const seen = new Set<string>();
  anchors.forEach(({ at, country }, i) => {
    const iso = isoFor(country);
    if (!iso) throw new Error(`unknown country ${country}`);
    if (seen.has(iso)) return;
    seen.add(iso);

    // The slice starts at the aria-label attribute, inside the entry's
    // opening tag: drop the rest of that tag before reading.
    let slice = doc.slice(at, anchors[i + 1]?.at ?? doc.length);
    slice = slice.slice(slice.search(/>/) + 1);
    const plain = text(slice);
    const section = sections.filter((s) => s.at < at).pop();

    // <p> texts after the one naming the country, minus the "N points" ones.
    const ps = [...slice.matchAll(pRe)].map((m) => text(m[1])).filter((t) => t !== '');
    const ci = ps.findIndex((t) => isoOfText(t) === iso);
    const names = (ci >= 0 ? ps.slice(ci + 1) : ps).filter((t) => !isPoints(t) && isoOfText(t) !== iso);

    rows.push({
      iso,
      country,
      artist: names[0] ?? '',
      song: names[1] ?? '',
      runningOrder: toInt(plain.match(/Running Order\s*(\d+)/i)),
      place: toInt(slice.match(placeRe)),
      points: toInt(plain.match(/(\d+)\s*points?\b/i)),
      qualified: section ? section.qualified : null,
    });
  });
  return rows;
}

const MIN_SEMI_ENTRIES = 10;

/**
 * Sanity gate before a semi-final is written: null when the rows look like a
 * complete, published semi-final, else the reason. Refuses fewer than 10
 * rows, any row without place, points or running order, and a page with no
 * qualifier (results not out yet, or the headings were not found).
 */
export function semiProblem(rows: SemiRow[]): string | null {
  if (rows.length < MIN_SEMI_ENTRIES) {
    return `only ${rows.length} entries parsed (expected at least ${MIN_SEMI_ENTRIES})`;
  }
  for (const r of rows) {
    if (r.place === null) return `${r.iso} has no place`;
    if (r.points === null) return `${r.iso} has no points`;
    if (r.runningOrder === null) return `${r.iso} has no running order`;
  }
  if (!rows.some((r) => r.qualified === true)) return 'no qualifiers found (results not published yet?)';
  return null;
}
