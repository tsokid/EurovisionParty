// SEO intent (Track 3 spec §6, P1): which hard SEO changes a commit means to
// make, so the build's SEO guard (scripts/seo/guard.ts) can tell an intended
// change from a regression.
//
// The file is seo-intent.json at the repo root (outside content/, so it is
// never deployed, globbed into the SSR content or validated as a document).
// It holds the last MAX_INTENTS entries. publish-content appends one entry
// per commit that changes content, in that same commit; a developer may
// append one by hand (source 'manual') for a deliberate SEO change in code.
//
// Every deploy's /_seo/snapshot.json records the entry ids that were in the
// file when it was built. The guard applies only the entries the live
// snapshot has not seen, so an entry stops applying once its commit is live
// and a later commit cannot ride on it. Several commits that reach Vercel as
// one build still carry all their entries.
//
// An entry never names routes for CMS docs or contest data: it names what
// changed (docs per locale with the fields the change can touch, contest
// data files), and the guard maps those to routes with the site's own route
// table (src/lib/seo). Only a manual entry lists routes directly, and only a
// manual entry can allow canonical or hreflang changes.
//
// Pure and Deno-free.
import { docTypeFor } from './registry.ts';
import { seoFields } from './seo.ts';
import type { Locale } from './validate.ts';
import { stableJson } from '../stableJson.ts';

/** The snapshot fields whose change fails the build unless intended (scripts/seo/snapshot-diff.ts HARD). */
export const HARD_FIELDS = ['title', 'description', 'robots', 'canonical', 'h1', 'hreflang', 'jsonLd'] as const;
export type HardField = (typeof HARD_FIELDS)[number];

/** What a manual route entry may allow: a hard field, or the route's removal (still needs a 301). */
export type RouteAllowance = HardField | 'removed';

/** Repo path of the intent file. */
export const SEO_INTENT_FILE = 'seo-intent.json';

/** Entries kept in the file (oldest dropped first). */
export const MAX_INTENTS = 20;

/** The fields a contest-data change may touch on the pages built from that data. */
export const DATA_FIELDS: readonly HardField[] = ['title', 'description', 'h1', 'jsonLd', 'robots'];

export type DocIntent = { doc_id: string; locale: Locale; fields: HardField[] };
export type DataIntent = { file: string; fields: HardField[] };
export type RouteIntent = { route: string; fields: RouteAllowance[] };

export type IntentEntry = {
  /** Unique: `publish-<run_id>` from publish-content, anything unique for a manual entry. */
  id: string;
  created_at: string;
  source: 'publish-content' | 'manual';
  /** Changed CMS docs, one per changed locale. */
  docs: DocIntent[];
  /** Changed contest data files (content/site.json, content/contests/*, content/countries/*). */
  data: DataIntent[];
  /** Manual entries only: routes with the fields they may change. */
  routes?: RouteIntent[];
  /** Why (manual entries). */
  note?: string;
};

export type IntentFile = { version: 1; intents: IntentEntry[] };

const LOCALES: readonly Locale[] = ['en', 'el'];
const PAGE_FILE = /^content\/pages\/([a-z0-9-]+)\.json$/;
const DATA_FILE = /^content\/(site\.json|contests\/[^/]+\.json|countries\/[^/]+\.json)$/;

function valueAt(root: unknown, path: string): unknown {
  let v = root;
  for (const seg of path.split('.')) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    v = (v as Record<string, unknown>)[seg];
  }
  return v;
}

/** A deep copy of `root` without the value at `path`. */
function without(root: unknown, path: string): unknown {
  const copy = root === undefined ? undefined : JSON.parse(JSON.stringify(root));
  const segs = path.split('.');
  let v: unknown = copy;
  for (const seg of segs.slice(0, -1)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return copy;
    v = (v as Record<string, unknown>)[seg];
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) delete (v as Record<string, unknown>)[segs[segs.length - 1]];
  return copy;
}

const same = (a: unknown, b: unknown) => stableJson(a ?? null) === stableJson(b ?? null);

const order = (fields: Iterable<HardField>): HardField[] => {
  const set = new Set(fields);
  return HARD_FIELDS.filter((f) => set.has(f));
};

/**
 * The hard fields a doc's change can touch, per changed locale, from the
 * doc's own fields: its seoTitle() field → title, its metaDescription()
 * field → description, anything else → h1. Every change may touch JSON-LD
 * (pages build it from the doc: headline, name, FAQ items...). A doc new to
 * the repo may touch all four. Robots, canonical and hreflang never come
 * from a doc.
 */
export function docIntents(docId: string, draft: unknown, committed: unknown): DocIntent[] {
  const paths = seoFields(docTypeFor(docId)) ?? {};
  const out: DocIntent[] = [];
  for (const locale of LOCALES) {
    const a = draft && typeof draft === 'object' ? (draft as Record<string, unknown>)[locale] : undefined;
    const b = committed && typeof committed === 'object' ? (committed as Record<string, unknown>)[locale] : undefined;
    if (b === undefined) {
      out.push({ doc_id: docId, locale, fields: order(['title', 'description', 'h1', 'jsonLd']) });
      continue;
    }
    if (same(a, b)) continue;
    const fields = new Set<HardField>(['jsonLd']);
    let restA: unknown = a;
    let restB: unknown = b;
    for (const [kind, field] of [['title', 'title'], ['description', 'description']] as const) {
      const p = paths[kind];
      if (p === undefined) continue;
      if (!same(valueAt(a, p), valueAt(b, p))) fields.add(field);
      restA = without(restA, p);
      restB = without(restB, p);
    }
    if (!same(restA, restB)) fields.add('h1');
    out.push({ doc_id: docId, locale, fields: order(fields) });
  }
  return out;
}

/**
 * The intent of one publish commit, from the paths it changes, or null when
 * none of them can change SEO (only vercel.json, the editorial index, media).
 * `drafts` / `committed`: doc_id → { en, el } as shipped and as in the
 * commit's parent.
 */
export function buildIntentEntry(args: {
  id: string;
  createdAt: string;
  changedPaths: readonly string[];
  drafts: Record<string, unknown>;
  committed: Record<string, unknown>;
}): IntentEntry | null {
  const docs: DocIntent[] = [];
  const data: DataIntent[] = [];
  for (const path of [...args.changedPaths].sort()) {
    const page = PAGE_FILE.exec(path);
    if (page && page[1] !== 'index') {
      const docId = page[1];
      if (Object.prototype.hasOwnProperty.call(args.drafts, docId)) {
        docs.push(...docIntents(docId, args.drafts[docId], args.committed[docId]));
      }
      continue;
    }
    if (DATA_FILE.test(path)) data.push({ file: path, fields: [...DATA_FIELDS] });
  }
  if (!docs.length && !data.length) return null;
  return { id: args.id, created_at: args.createdAt, source: 'publish-content', docs, data };
}

/** Throws a descriptive error unless `value` is a valid intent file. */
export function parseIntentFile(value: unknown): IntentFile {
  const fail = (msg: string): never => {
    throw new Error(`${SEO_INTENT_FILE}: ${msg}`);
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('not an object');
  const v = value as Record<string, unknown>;
  if (v.version !== 1) fail(`unsupported version ${JSON.stringify(v.version)}`);
  if (!Array.isArray(v.intents)) fail('intents is not a list');
  const ids = new Set<string>();
  const isField = (f: unknown): f is HardField => typeof f === 'string' && (HARD_FIELDS as readonly string[]).includes(f);
  const fieldList = (x: unknown, where: string, extra: string[] = []): void => {
    if (!Array.isArray(x) || !x.every((f) => isField(f) || extra.includes(f as string))) fail(`${where}: fields must be a list of ${[...HARD_FIELDS, ...extra].join(', ')}`);
  };
  (v.intents as unknown[]).forEach((e, i) => {
    const where = `intents[${i}]`;
    if (!e || typeof e !== 'object') fail(`${where} is not an object`);
    const entry = e as Record<string, unknown>;
    if (typeof entry.id !== 'string' || entry.id === '') fail(`${where}.id must be a non-empty string`);
    if (ids.has(entry.id as string)) fail(`duplicate id ${JSON.stringify(entry.id)}`);
    ids.add(entry.id as string);
    if (entry.source !== 'publish-content' && entry.source !== 'manual') fail(`${where}.source must be publish-content or manual`);
    if (!Array.isArray(entry.docs)) fail(`${where}.docs is not a list`);
    for (const d of entry.docs as Array<Record<string, unknown>>) {
      if (!d || typeof d.doc_id !== 'string' || !LOCALES.includes(d.locale as Locale)) fail(`${where}.docs: each needs doc_id and locale (en|el)`);
      fieldList(d.fields, `${where}.docs[${d.doc_id}]`);
    }
    if (!Array.isArray(entry.data)) fail(`${where}.data is not a list`);
    for (const d of entry.data as Array<Record<string, unknown>>) {
      if (!d || typeof d.file !== 'string' || !DATA_FILE.test(d.file)) fail(`${where}.data: file must be content/site.json, content/contests/*.json or content/countries/*.json`);
      fieldList(d.fields, `${where}.data[${d.file}]`);
    }
    if (entry.routes !== undefined) {
      if (entry.source !== 'manual') fail(`${where}.routes: only a manual entry may list routes`);
      if (!Array.isArray(entry.routes)) fail(`${where}.routes is not a list`);
      for (const r of entry.routes as Array<Record<string, unknown>>) {
        if (!r || typeof r.route !== 'string' || !/^\/(en|el)(\/|$)/.test(r.route)) fail(`${where}.routes: route must be a locale-prefixed path`);
        fieldList(r.fields, `${where}.routes[${r.route}]`, ['removed']);
      }
    }
  });
  return value as IntentFile;
}

/**
 * The intent file with `entry` appended (an entry with the same id replaced),
 * keeping the newest MAX_INTENTS. `current`: the file's text in the parent
 * commit, or null. An unreadable current file is replaced (the guard would
 * refuse it anyway).
 */
export function appendIntent(current: string | null, entry: IntentEntry): string {
  let intents: IntentEntry[] = [];
  if (current !== null) {
    try {
      intents = parseIntentFile(JSON.parse(current)).intents;
    } catch {
      intents = [];
    }
  }
  const next = [...intents.filter((e) => e.id !== entry.id), entry].slice(-MAX_INTENTS);
  const file: IntentFile = { version: 1, intents: next };
  return JSON.stringify(file, null, 2) + '\n';
}
