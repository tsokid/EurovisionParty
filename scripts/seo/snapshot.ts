/**
 * SEO snapshot: extracts every SEO-relevant field from the prerendered HTML in
 * dist/ into one stable JSON file, so a redesign can be diffed against a baseline
 * (see snapshot-diff.ts).
 *
 *   npx tsx scripts/seo/snapshot.ts [out.json] [distDir]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export interface PageSnapshot {
  route: string;
  title: string | null;
  description: string | null;
  robots: string | null;
  canonical: string | null;
  hreflang: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  h1: string[];
  h2Count: number;
  jsonLd: string[];
  internalLinks: string[];
}

export type Snapshot = Record<string, PageSnapshot>;

const collapse = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  }
  return value;
}

const SELF_ORIGIN = /^https?:\/\/(www\.)?eurovision\.games(?=\/|$)/i;

export function extractPage(html: string, route: string): PageSnapshot {
  const doc = new JSDOM(html).window.document;
  const meta = (sel: string): string | null => doc.querySelector(sel)?.getAttribute('content') ?? null;
  const titleEl = doc.querySelector('title');
  const hreflang = [...doc.querySelectorAll('link[rel="alternate"][hreflang]')]
    .map((l) => `${l.getAttribute('hreflang')} ${l.getAttribute('href') ?? ''}`)
    .sort();
  const jsonLd = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
    const raw = s.textContent ?? '';
    try {
      return JSON.stringify(sortKeys(JSON.parse(raw)));
    } catch {
      return `INVALID:${collapse(raw)}`;
    }
  });
  const root = doc.querySelector('main') ?? doc.body;
  const links = new Set<string>();
  for (const a of root.querySelectorAll('a[href]')) {
    const href = (a.getAttribute('href') ?? '').trim();
    if (href.startsWith('/') && !href.startsWith('//')) links.add(href);
    else if (SELF_ORIGIN.test(href)) links.add(href.replace(SELF_ORIGIN, '') || '/');
  }
  return {
    route,
    title: titleEl ? collapse(titleEl.textContent) : null,
    description: meta('meta[name="description"]'),
    robots: meta('meta[name="robots"]'),
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    hreflang,
    ogTitle: meta('meta[property="og:title"]'),
    ogDescription: meta('meta[property="og:description"]'),
    h1: [...doc.querySelectorAll('h1')].map((h) => collapse(h.textContent)),
    h2Count: doc.querySelectorAll('h2').length,
    jsonLd,
    internalLinks: [...links].sort(),
  };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Prerendered pages are dist/<path>.html; dist/index.html is the SPA shell, 404.html the fallback. */
export function routeForFile(distDir: string, file: string): string | null {
  const rel = relative(distDir, file).split(sep).join('/');
  if (rel === 'index.html' || rel === '404.html') return null;
  const route = '/' + rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
  if (route === '/admin' || route.startsWith('/admin/')) return null;
  // Only locale-prefixed pages are prerendered by scripts/prerender.ts; other
  // dist/*.html files are static public/ mockups copied verbatim.
  if (!/^\/(en|el)(\/|$)/.test(route)) return null;
  return route;
}

export function collectSnapshot(distDir: string): Snapshot {
  const snap: Snapshot = {};
  for (const file of walk(distDir)) {
    const route = routeForFile(distDir, file);
    if (route) snap[route] = extractPage(readFileSync(file, 'utf8'), route);
  }
  return sortKeys(snap) as Snapshot;
}

/** Format tag of the deployed snapshot (/_seo/snapshot.json, written by guard.ts). */
export const LIVE_SNAPSHOT_FORMAT = 'eurovision-games/seo-snapshot@1';

/**
 * The deployed snapshot: the routes plus what the build knew, so the next
 * build can compare against what is live. `intents`: the seo-intent.json
 * entry ids present when this deploy was built (they are live now).
 */
export interface LiveSnapshot {
  format: typeof LIVE_SNAPSHOT_FORMAT;
  built_at: string;
  commit: string | null;
  intents: string[];
  routes: Snapshot;
}

/**
 * A baseline in either format: a deployed LiveSnapshot, or a bare Snapshot
 * (snapshot.ts output, docs/design/stage/seo-baseline.json), whose
 * `intents` is then null (nothing known to be live). Throws unless it looks
 * like a real snapshot with at least one route, so a wrong or truncated
 * response can never pass as an empty baseline.
 */
export function readBaseline(value: unknown): { routes: Snapshot; intents: string[] | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('baseline is not a JSON object');
  const v = value as Record<string, unknown>;
  let routes: unknown = value;
  let intents: string[] | null = null;
  if ('format' in v) {
    if (v.format !== LIVE_SNAPSHOT_FORMAT) throw new Error(`baseline format ${JSON.stringify(v.format)} is not ${LIVE_SNAPSHOT_FORMAT}`);
    if (!Array.isArray(v.intents) || !v.intents.every((x) => typeof x === 'string')) throw new Error('baseline intents is not a list of ids');
    routes = v.routes;
    intents = v.intents as string[];
  }
  if (!routes || typeof routes !== 'object' || Array.isArray(routes)) throw new Error('baseline routes is not an object');
  const entries = Object.entries(routes as Record<string, unknown>);
  if (entries.length === 0) throw new Error('baseline has no routes');
  for (const [route, page] of entries) {
    const p = page as Partial<PageSnapshot> | null;
    if (!p || p.route !== route || !Array.isArray(p.hreflang) || !Array.isArray(p.jsonLd) || !Array.isArray(p.h1)) {
      throw new Error(`baseline route ${route} is not a page snapshot`);
    }
  }
  return { routes: routes as Snapshot, intents };
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const out = resolve(process.argv[2] ?? 'seo-snapshot.json');
  const dist = resolve(process.argv[3] ?? join(root, 'dist'));
  const snap = collectSnapshot(dist);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snap, null, 2) + '\n', 'utf8');
  console.log(`seo snapshot: ${Object.keys(snap).length} routes -> ${out}`);
}
