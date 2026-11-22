/**
 * SEO intent → what the build's SEO guard lets change (Track 3 spec §6, P1).
 *
 * seo-intent.json (supabase/functions/_shared/cms/seoIntent.ts) names what a
 * commit changed: CMS docs per locale with their fields, contest data files,
 * and (manual entries only) routes. This module maps those to the routes of
 * the site, with the site's own route table, into a DiffPolicy for
 * snapshot-diff.ts:
 *
 * - a static page doc (faq, home...) → its registry route in that locale;
 * - an editorial doc (archive-2005, country-gr, hub-2027) → the data page
 *   built from it (dynamicPageUrls `files`);
 * - a contest data file → every data page built from it (title,
 *   description, h1, JSON-LD, robots: a contest can turn indexable), and the
 *   static pages that render contest data (their doc holds a {placeholder}
 *   or {year.fact} token, or the page reads the tables: winners,
 *   predictions) for title, description, h1 and JSON-LD only;
 * - a manual route entry → exactly that route and those fields.
 *
 * A removed route passes only with a permanent redirect in vercel.json that
 * lands on a built page, and only when the intent explains it: a manual
 * entry marks it `removed`, or contest data changed (a year moving from the
 * live hub to the archive).
 *
 * Anything not covered stays an error: mapping too little fails the build
 * (safe), never the other way round.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { dynamicPageUrls, type ContentData, type DynamicPage } from '../../src/lib/seo/dynamicPages';
import { localizePath, type Locale } from '../../src/lib/seo/locale';
import { placeholdersIn } from '../../supabase/functions/_shared/cms/placeholders';
import { factTokensIn } from '../../supabase/functions/_shared/cms/facts';
import {
  parseIntentFile,
  type HardField,
  type IntentEntry,
  type RouteAllowance,
} from '../../supabase/functions/_shared/cms/seoIntent';
import { compileSource, resolveUrl, type VercelConfig } from './resolveUrl';
import { loadContent, CONTENT_DIR } from './loadContent';
import type { DiffPolicy } from './snapshot-diff';

/** Static pages that read the contest tables directly (not only through tokens in their doc). */
export const DATA_READING_PAGES: readonly string[] = ['winners', 'eurovision-predictions'];

/** What a contest-data change may touch on a static page (never robots, canonical or hreflang). */
const STATIC_DATA_FIELDS: readonly HardField[] = ['title', 'description', 'h1', 'jsonLd'];

/** content/pages/*.json under `contentDir` (index.json skipped), as doc_id → document. */
export function loadPageDocs(contentDir: string): Record<string, unknown> {
  const dir = resolve(contentDir, 'pages');
  if (!existsSync(dir)) return {};
  const out: Record<string, unknown> = {};
  for (const f of readdirSync(dir)) {
    const m = /^([a-z0-9-]+)\.json$/.exec(f);
    if (m && m[1] !== 'index') out[m[1]] = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
  }
  return out;
}

/** The intent entries of `path`, [] when the file does not exist. Throws on an invalid file (the guard fails closed). */
export function readIntentFile(path: string): IntentEntry[] {
  if (!existsSync(path)) return [];
  return parseIntentFile(JSON.parse(readFileSync(path, 'utf8'))).intents;
}

/** Whether any string in `doc` uses a {placeholder} or a {year.fact} token (its page renders contest data). */
export function docUsesData(doc: unknown): boolean {
  const walk = (v: unknown): boolean => {
    if (typeof v === 'string') return placeholdersIn(v).length > 0 || factTokensIn(v).length > 0;
    if (Array.isArray(v)) return v.some(walk);
    if (v && typeof v === 'object') return Object.values(v).some(walk);
    return false;
  };
  return walk(doc);
}

const routeLocale = (route: string): Locale => (route.startsWith('/el') ? 'el' : 'en');

/** The data pages a data file feeds. Summary files feed the page kinds that list them. */
function pagesOfDataFile(file: string, pages: DynamicPage[]): DynamicPage[] {
  if (file === 'content/site.json') return pages.filter((p) => p.kind === 'hub');
  if (file === 'content/contests/index.json' || file === 'content/contests/years.json') {
    return pages.filter((p) => p.kind === 'archive-index' || p.kind === 'archive' || p.kind === 'hub');
  }
  if (file === 'content/countries/index.json') return pages.filter((p) => p.kind === 'country-index' || p.kind === 'country');
  return pages.filter((p) => p.files.includes(file));
}

export type IntentContext = {
  content: ContentData;
  /** content/pages docs, doc_id → { en, el } (the build's committed docs). */
  pageDocs: Record<string, unknown>;
  vercel: VercelConfig;
};

export type IntentPolicy = DiffPolicy & {
  /** route → allowed fields, for the build log. */
  allowances: Map<string, Set<RouteAllowance>>;
};

/** The policy of the pending intent `entries` (all of them apply together). */
export function intentPolicy(entries: readonly IntentEntry[], ctx: IntentContext): IntentPolicy {
  const allowances = new Map<string, Set<RouteAllowance>>();
  const allow = (route: string, fields: Iterable<RouteAllowance>) => {
    const set = allowances.get(route) ?? new Set<RouteAllowance>();
    for (const f of fields) set.add(f);
    allowances.set(route, set);
  };
  const dynamic = dynamicPageUrls(ctx.content);
  let dataChanged = false;

  for (const entry of entries) {
    for (const d of entry.docs) {
      const page = PAGE_REGISTRY.find((p) => p.id === d.doc_id);
      if (page) {
        const exclusive = d.locale === 'en' ? page.greekExclusive : page.englishExclusive;
        if (!exclusive) allow(localizePath(d.locale, page.slugByLocale[d.locale]), d.fields);
        continue;
      }
      const file = `content/pages/${d.doc_id}.json`;
      for (const p of dynamic) if (p.locale === d.locale && p.files.includes(file)) allow(p.path, d.fields);
    }
    for (const d of entry.data) {
      dataChanged = true;
      for (const p of pagesOfDataFile(d.file, dynamic)) allow(p.path, d.fields);
      const staticFields = d.fields.filter((f) => STATIC_DATA_FIELDS.includes(f));
      for (const page of PAGE_REGISTRY) {
        if (!DATA_READING_PAGES.includes(page.id) && !docUsesData(ctx.pageDocs[page.id])) continue;
        if (!page.greekExclusive) allow(localizePath('en', page.slugByLocale.en), staticFields);
        if (!page.englishExclusive) allow(localizePath('el', page.slugByLocale.el), staticFields);
      }
    }
    for (const r of entry.routes ?? []) allow(r.route, r.fields);
  }

  const redirects = (ctx.vercel.redirects ?? []).filter((r) => !r.has?.length && !r.missing?.length);
  return {
    allowances,
    allows: (route, field) => allowances.get(route)?.has(field) ?? false,
    allowsRemoval: (route, builtRoutes) => {
      if (!(allowances.get(route)?.has('removed') || dataChanged)) return false;
      const first = redirects.find((r) => compileSource(r.source)(route));
      if (!first || first.permanent !== true) return false;
      try {
        const res = resolveUrl(route, ctx.vercel, builtRoutes);
        return res.hops > 0 && res.status === 200 && res.via === 'file' && routeLocale(res.final) === routeLocale(route);
      } catch {
        return false;
      }
    },
  };
}

/** The build's context: the committed content (loadContent's root), its page docs and vercel.json under `root`. */
export function intentContext(root: string): IntentContext {
  return {
    content: loadContent(),
    pageDocs: loadPageDocs(CONTENT_DIR),
    vercel: JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as VercelConfig,
  };
}
