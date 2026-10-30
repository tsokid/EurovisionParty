// Fetches Wikipedia article wikitext through the MediaWiki API, with a disk
// cache under .cache/wikipedia/ and at least 1 s between network requests.
//
// Some contest articles keep their scoreboards in a separate page or a
// template. fetchContestWikitext() returns the main article and appends the
// wikitext of every transcluded page whose name suggests it holds results
// ("Template:...", "...#Final", "... – Grand final"), so the parser sees one
// combined document.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(here, '../../.cache/wikipedia');
const API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'EurovisionGamesImporter/1.0 (+https://eurovision.games)';
const MIN_GAP_MS = 1100;

let lastRequest = 0;

function cacheFile(page: string): string {
  return path.join(CACHE_DIR, page.replace(/[^A-Za-z0-9_.-]+/g, '_') + '.json');
}

async function throttle(): Promise<void> {
  const wait = lastRequest + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

/** Raw wikitext of one page (redirects followed), or null when it does not exist. */
export async function fetchPage(page: string): Promise<string | null> {
  const file = cacheFile(page);
  if (existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, 'utf8')) as { wikitext: string | null };
    return cached.wikitext;
  }
  const url =
    `${API}?action=parse&page=${encodeURIComponent(page)}` +
    '&prop=wikitext&redirects=1&format=json&formatversion=2';
  let wikitext: string | null = null;
  for (let attempt = 1; ; attempt++) {
    await throttle();
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 4) throw new Error(`fetchPage ${page}: HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`fetchPage ${page}: HTTP ${res.status}`);
    const body = (await res.json()) as { parse?: { wikitext: string }; error?: { code: string; info: string } };
    if (body.error) {
      if (body.error.code !== 'missingtitle') throw new Error(`fetchPage ${page}: ${body.error.info}`);
    } else {
      wikitext = body.parse?.wikitext ?? null;
    }
    break;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify({ page, retrieved: new Date().toISOString(), wikitext }), 'utf8');
  return wikitext;
}

/** Transcluded page names in `wikitext` that may hold result tables. */
export function resultTransclusions(wikitext: string, year: number): string[] {
  const out = new Set<string>();
  // {{:Page name}} article transclusions and {{Template name|...}} calls whose
  // name mentions the year and a results-like word.
  for (const m of wikitext.matchAll(/\{\{\s*(:?)([^{}|\n]+?)\s*(?:\||\}\})/g)) {
    const name = m[2].trim();
    const isArticle = m[1] === ':';
    if (!name.includes(String(year))) continue;
    if (!/(result|scoreboard|final|semi|vot|point|score)/i.test(name)) continue;
    out.add(isArticle ? name : name.startsWith('Template:') ? name : `Template:${name}`);
  }
  // {{main|...}} / {{see also|...}} links to a separate results article.
  for (const m of wikitext.matchAll(/\{\{\s*(?:main|further|see also)\s*\|([^{}]+)\}\}/gi)) {
    for (const part of m[1].split('|')) {
      const name = part.split('#')[0].trim();
      if (name.includes(String(year)) && /(final|semi|result|scoreboard)/i.test(name) && !name.includes('=')) out.add(name);
    }
  }
  return [...out].sort();
}

/**
 * Wikitext of the contest article for `year`, followed by the wikitext of
 * every transcluded results page (each prefixed with a marker comment).
 */
export async function fetchContestWikitext(year: number): Promise<string> {
  const main = await fetchPage(`Eurovision_Song_Contest_${year}`);
  if (main == null) throw new Error(`no Wikipedia article for ${year}`);
  const parts = [main];
  for (const page of resultTransclusions(main, year)) {
    const text = await fetchPage(page.replace(/ /g, '_'));
    if (text != null) parts.push(`\n<!-- transcluded: ${page} -->\n${text}`);
  }
  return parts.join('\n');
}
