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

// Decode common HTML entities found in eurovision.com markup (apostrophes,
// ampersands, common diacritics). The site emits e.g. `C&#x27;est La Vie`.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Extract participants from the eurovision.com grand-final page.
 *
 * Current (2025+) markup pattern per participant:
 *   <p ... data-country-name>Country</p>
 *   ... (some chrome) ...
 *   <a href="/.../all-participants/<artist-slug>/">
 *     <p class="...chip-text...">Artist Name</p>
 *   </a>
 *   ... (some chrome) ...
 *   <a href="https://www.youtube.com/watch?v=...">
 *     <p class="...chip-text...">Song Title</p>
 *   </a>
 *
 * Country → ISO via COUNTRY_TO_ISO. Falls back to [] if any of the three
 * fields can't be matched in order.
 */
export function extractEurovision(html: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();
  const re =
    /data-country-name[^>]*>\s*([^<]+?)\s*<\/p>[\s\S]{0,2000}?\/all-participants\/[^"]+"[\s\S]{0,800}?<p[^>]*class="[^"]*chip-text[^"]*"[^>]*>\s*([^<]+?)\s*<\/p>[\s\S]{0,2000}?youtube\.com\/watch[\s\S]{0,800}?<p[^>]*class="[^"]*chip-text[^"]*"[^>]*>\s*([^<]+?)\s*<\/p>/g;

  for (const m of html.matchAll(re)) {
    const country = decodeHtmlEntities(m[1].trim());
    const artist = decodeHtmlEntities(m[2].trim());
    const song = decodeHtmlEntities(m[3].trim());
    const iso = isoFor(country);
    if (!iso || seen.has(iso)) continue;
    seen.add(iso);
    entries.push({ iso, name: country, artist, song, runningOrder: null });
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
    const rows = tbl.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
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
