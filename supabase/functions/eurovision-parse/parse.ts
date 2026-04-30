// supabase/functions/eurovision-parse/parse.ts
// Pure HTML extractors for Eurovision pages. The action router in index.ts
// handles fetching, auth, DB writes, and run logging. This module is HTML-in
// rows-out and is import-safe to call from tests with no network.

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface ParsedEntry {
  iso: string;
  name: string;
  artist: string;
  song: string;
  runningOrder: number | null;
}

// ---------------------------------------------------------------------------
// COUNTRY_TO_ISO — used by both participants (Wikipedia fallback) and results
// extractors. Lower-cased keys; consumers must lowercase before lookup.
// ---------------------------------------------------------------------------
export const COUNTRY_TO_ISO: Record<string, string> = {
  albania: 'AL', armenia: 'AM', australia: 'AU', austria: 'AT', azerbaijan: 'AZ',
  belgium: 'BE', bulgaria: 'BG', croatia: 'HR', cyprus: 'CY', czechia: 'CZ',
  'czech republic': 'CZ',
  denmark: 'DK', estonia: 'EE', finland: 'FI', france: 'FR', georgia: 'GE',
  germany: 'DE', greece: 'GR', iceland: 'IS', ireland: 'IE', israel: 'IL',
  italy: 'IT', latvia: 'LV', lithuania: 'LT', luxembourg: 'LU', malta: 'MT',
  moldova: 'MD', montenegro: 'ME', netherlands: 'NL', 'north macedonia': 'MK',
  norway: 'NO', poland: 'PL', portugal: 'PT', romania: 'RO', 'san marino': 'SM',
  serbia: 'RS', slovenia: 'SI', spain: 'ES', sweden: 'SE', switzerland: 'CH',
  ukraine: 'UA', 'united kingdom': 'GB', uk: 'GB',
};

export function isoFor(country: string): string | null {
  return COUNTRY_TO_ISO[country.trim().toLowerCase()] ?? null;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------
export function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

// ---------------------------------------------------------------------------
// Participants extractors
// ---------------------------------------------------------------------------

/**
 * Extract participants from the eurovision.com grand-final page.
 * Looks for `data-iso="XX" data-name="..." data-artist="..." data-song="..."`
 * style markup. Returns [] when the page doesn't carry these attributes.
 */
export function extractEurovision(html: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const re =
    /data-iso="([A-Z]{2})"[^>]*data-name="([^"]+)"[^>]*data-artist="([^"]+)"[^>]*data-song="([^"]+)"(?:[^>]*data-order="(\d+)")?/g;
  for (const m of html.matchAll(re)) {
    entries.push({
      iso: m[1],
      name: m[2],
      artist: m[3],
      song: m[4],
      runningOrder: m[5] ? parseInt(m[5], 10) : null,
    });
  }
  return entries;
}

/**
 * Extract participants from a Wikipedia "Eurovision Song Contest YYYY" page.
 * Walks every `wikitable`, picks rows with at least three cells (country,
 * artist, song), maps country → ISO, dedupes by ISO.
 */
export function extractWikipedia(html: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const tables = html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/g) ?? [];
  const seen = new Set<string>();
  for (const tbl of tables) {
    const rows = tbl.matchAll(/<tr>([\s\S]*?)<\/tr>/g);
    for (const r of rows) {
      const cells = [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) =>
        stripTags(c[1]).trim(),
      );
      if (cells.length < 3) continue;
      const country = cells[0];
      const artist = cells[1];
      const song = cells[2].replace(/^"|"$/g, '');
      const iso = isoFor(country);
      if (iso && artist && song && !seen.has(iso)) {
        seen.add(iso);
        entries.push({ iso, name: country, artist, song, runningOrder: null });
      }
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Network — kept here so the action router can call a single function for the
// fetch + extract + Wikipedia-fallback flow.
// ---------------------------------------------------------------------------

export interface FetchedHtml {
  html: string;
  httpStatus: number;
}

export async function fetchHtml(url: string): Promise<FetchedHtml> {
  const r = await fetch(url, {
    headers: {
      'user-agent': BROWSER_UA,
      accept: 'text/html,application/xhtml+xml',
    },
  });
  return { html: await r.text(), httpStatus: r.status };
}

export interface ParticipantsParseResult {
  entries: ParsedEntry[];
  httpStatus: number;
  source: 'eurovision' | 'wikipedia';
}

/**
 * Fetch + extract participants. Tries the official URL first; if the page
 * doesn't carry data-iso markup yet (true before semi-2 each year), falls back
 * to Wikipedia.
 */
export async function fetchParticipants(
  url: string,
  wikiUrl = 'https://en.wikipedia.org/wiki/Eurovision_Song_Contest_2026',
): Promise<ParticipantsParseResult> {
  const primary = await fetchHtml(url);
  if (primary.httpStatus === 200) {
    const entries = extractEurovision(primary.html);
    if (entries.length > 0) {
      return { entries, httpStatus: 200, source: 'eurovision' };
    }
  }
  const wiki = await fetchHtml(wikiUrl);
  return {
    entries: extractWikipedia(wiki.html),
    httpStatus: primary.httpStatus,
    source: 'wikipedia',
  };
}
