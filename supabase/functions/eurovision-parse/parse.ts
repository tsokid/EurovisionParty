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
 *   <p ... data-country-name>Country</p>          (always present)
 *   <a href="/.../all-participants/<artist-slug>/">
 *     <p class="...chip-text...">Artist Name</p>  (present once announced)
 *   </a>
 *   <a href="https://www.youtube.com/watch?v=...">
 *     <p class="...chip-text...">Song Title</p>   (present once song dropped)
 *   </a>
 *
 * Two-pass linear scan rather than one mega-regex, because pre-show pages
 * have data-country-name without artist or YouTube links yet — and a single
 * mega-regex with multiple lazy `[\s\S]*?` quantifiers triggers catastrophic
 * backtracking when downstream pieces are missing (parser hangs for minutes
 * on the 125KB Vienna 2026 page).
 *
 * Strategy:
 *   1. Find every `data-country-name>X</p>` (anchor positions)
 *   2. For each anchor, look forward in a bounded window (next anchor or
 *      end-of-document, capped at 4KB) and pick out artist + song from
 *      that slice using simple sub-regexes.
 *   3. Skip non-country values (e.g. page title "Vienna 2026") — they
 *      fail the COUNTRY_TO_ISO lookup.
 *
 * Returns partial entries (empty artist/song strings) for countries
 * announced but not yet given a song — useful pre-show.
 */
export function extractEurovision(html: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();
  const WINDOW_MAX = 4000;

  // Step 1: collect anchor positions (start index of each country block)
  const anchors: { country: string; start: number }[] = [];
  const anchorRe = /data-country-name[^>]*>\s*([^<]+?)\s*<\/p>/g;
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(html)) !== null) {
    anchors.push({ country: decodeHtmlEntities(am[1].trim()), start: am.index });
  }

  // Step 2: for each anchor, derive a slice and scan it for artist + song
  for (let i = 0; i < anchors.length; i++) {
    const { country, start } = anchors[i];
    const next = anchors[i + 1]?.start ?? html.length;
    const end = Math.min(next, start + WINDOW_MAX);
    const slice = html.slice(start, end);

    // Country must map to a known ISO (filters out "Vienna 2026" page title)
    const iso = isoFor(country);
    if (!iso || seen.has(iso)) continue;
    seen.add(iso);

    // Artist — first <p class="...chip-text...">X</p> after an
    // /all-participants/<slug>/ link in the slice
    let artist = '';
    const artistMatch = slice.match(/\/all-participants\/[^"]+"[^>]*>[\s\S]{0,400}?<p[^>]*class="[^"]*chip-text[^"]*"[^>]*>\s*([^<]+?)\s*<\/p>/);
    if (artistMatch) artist = decodeHtmlEntities(artistMatch[1].trim());

    // Song — first <p class="...chip-text...">X</p> after a YouTube link.
    // Site uses both `youtube.com/watch?v=...` (basel-2025) and `youtu.be/...`
    // short form (vienna-2026). Match either.
    let song = '';
    const songMatch = slice.match(/(?:youtube\.com\/watch|youtu\.be)[^"]*"[^>]*>[\s\S]{0,400}?<p[^>]*class="[^"]*chip-text[^"]*"[^>]*>\s*([^<]+?)\s*<\/p>/);
    if (songMatch) song = decodeHtmlEntities(songMatch[1].trim());

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
