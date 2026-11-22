// @vitest-environment node
// SEO intent written by publish-content (Track 3 P1): _shared/cms/seoIntent.ts,
// github.ts `derived` files and runPublish's wiring.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  appendIntent,
  buildIntentEntry,
  docIntents,
  MAX_INTENTS,
  parseIntentFile,
  SEO_INTENT_FILE,
  type IntentEntry,
} from '../../supabase/functions/_shared/cms/seoIntent';
import { commitFiles, gitBlobSha, type DerivedFiles } from '../../supabase/functions/publish-content/github';
import { runPublish, type PublishDeps } from '../../supabase/functions/publish-content/run';
import type { SnapshotInput } from '../../supabase/functions/publish-content/snapshot';

const FIXTURE = resolve(process.cwd(), 'tests/fixtures/content-live-hub/pages');
const faq = JSON.parse(readFileSync(resolve(FIXTURE, 'faq.json'), 'utf8'));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function withTitle(doc: typeof faq, locale: 'en' | 'el', title: string) {
  const d = clone(doc);
  d[locale].meta.title = title;
  return d;
}

describe('docIntents (fields derived from the doc)', () => {
  it('a title change in one locale allows title and JSON-LD on that locale only', () => {
    expect(docIntents('faq', withTitle(faq, 'en', 'New FAQ title'), faq)).toEqual([
      { doc_id: 'faq', locale: 'en', fields: ['title', 'jsonLd'] },
    ]);
  });

  it('a description change allows description and JSON-LD', () => {
    const d = clone(faq);
    d.el.meta.description = 'Νέα περιγραφή';
    expect(docIntents('faq', d, faq)).toEqual([{ doc_id: 'faq', locale: 'el', fields: ['description', 'jsonLd'] }]);
  });

  it('a body change allows h1 and JSON-LD, never title or description', () => {
    const d = clone(faq);
    d.en.hero.title = 'Another heading';
    expect(docIntents('faq', d, faq)).toEqual([{ doc_id: 'faq', locale: 'en', fields: ['h1', 'jsonLd'] }]);
  });

  it('an unchanged doc allows nothing; a new doc allows the four content fields in both locales', () => {
    expect(docIntents('faq', clone(faq), faq)).toEqual([]);
    const all = ['title', 'description', 'h1', 'jsonLd'];
    expect(docIntents('archive-2005', { en: {}, el: {} }, undefined)).toEqual([
      { doc_id: 'archive-2005', locale: 'en', fields: all },
      { doc_id: 'archive-2005', locale: 'el', fields: all },
    ]);
  });

  it('never allows robots, canonical or hreflang from a doc', () => {
    const d = clone(faq);
    d.en.meta.title = 'x';
    d.en.meta.description = 'y';
    d.en.hero.title = 'z';
    const fields = docIntents('faq', d, faq).flatMap((i) => i.fields);
    expect(fields).not.toContain('robots');
    expect(fields).not.toContain('canonical');
    expect(fields).not.toContain('hreflang');
  });
});

describe('buildIntentEntry', () => {
  const base = { id: 'publish-7', createdAt: '2026-11-22T10:00:00.000Z', committed: { faq } };

  it('lists the changed docs and data files; ignores vercel.json, the index and media', () => {
    const entry = buildIntentEntry({
      ...base,
      drafts: { faq: withTitle(faq, 'en', 'T') },
      changedPaths: ['vercel.json', 'content/pages/index.json', 'public/media/0123456789ab.webp', 'content/pages/faq.json', 'content/contests/2026.json'],
    });
    expect(entry).toEqual({
      id: 'publish-7',
      created_at: '2026-11-22T10:00:00.000Z',
      source: 'publish-content',
      docs: [{ doc_id: 'faq', locale: 'en', fields: ['title', 'jsonLd'] }],
      data: [{ file: 'content/contests/2026.json', fields: ['title', 'description', 'h1', 'jsonLd', 'robots'] }],
    });
  });

  it('is null when nothing SEO-relevant changed', () => {
    expect(buildIntentEntry({ ...base, drafts: {}, changedPaths: ['vercel.json'] })).toBeNull();
  });
});

describe('appendIntent / parseIntentFile', () => {
  const entry = (id: string): IntentEntry => ({ id, created_at: 'x', source: 'publish-content', docs: [], data: [] });

  it('final review M5: keeps at least 150 entries, so a long red stretch on main never drops an unseen one', () => {
    let text: string | null = null;
    for (let i = 1; i <= 150; i++) text = appendIntent(text, entry(`publish-${i}`));
    expect(JSON.parse(text!).intents).toHaveLength(150);
  });

  it('appends, replaces the same id and keeps the newest MAX_INTENTS', () => {
    let text: string | null = null;
    for (let i = 1; i <= MAX_INTENTS + 3; i++) text = appendIntent(text, entry(`publish-${i}`));
    text = appendIntent(text, entry(`publish-${MAX_INTENTS + 3}`));
    const ids = parseIntentFile(JSON.parse(text!)).intents.map((e) => e.id);
    expect(ids).toHaveLength(MAX_INTENTS);
    expect(ids[0]).toBe('publish-4');
    expect(ids.at(-1)).toBe(`publish-${MAX_INTENTS + 3}`);
  });

  it('replaces an unreadable file', () => {
    expect(parseIntentFile(JSON.parse(appendIntent('not json', entry('a')))).intents.map((e) => e.id)).toEqual(['a']);
  });

  it('refuses bad files: unknown field, routes on a publish entry, duplicate ids', () => {
    const file = (intents: unknown[]) => ({ version: 1, intents });
    expect(() => parseIntentFile(file([{ ...entry('a'), docs: [{ doc_id: 'faq', locale: 'en', fields: ['ogTitle'] }] }]))).toThrow(/fields/);
    expect(() => parseIntentFile(file([{ ...entry('a'), routes: [{ route: '/en/faq', fields: ['canonical'] }] }]))).toThrow(/manual/);
    expect(() => parseIntentFile(file([entry('a'), entry('a')]))).toThrow(/duplicate/);
    expect(() => parseIntentFile({ version: 2, intents: [] })).toThrow(/version/);
    expect(parseIntentFile(file([{ ...entry('m'), source: 'manual', routes: [{ route: '/en/faq', fields: ['canonical', 'removed'] }] }])).intents).toHaveLength(1);
  });
});

// --- github.ts derived files -------------------------------------------------

const API = 'https://api.github.com';
const REPO = 'tsokid/EurovisionParty';

async function github(tree: Record<string, string>) {
  const entries = await Promise.all(Object.entries(tree).map(async ([path, content]) => ({ path, mode: '100644', type: 'blob', sha: await gitBlobSha(content) })));
  const blobs = new Map(await Promise.all(Object.values(tree).map(async (c) => [await gitBlobSha(c), c] as const)));
  const posted: Array<{ path: string; content?: string }>[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input).slice(API.length);
    const method = (init?.method ?? 'GET').toUpperCase();
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (path === `/repos/${REPO}/git/ref/heads/main`) return ok({ object: { sha: 'c0ffee' } });
    if (path === `/repos/${REPO}/git/commits/c0ffee`) return ok({ tree: { sha: 'tree0' } });
    if (path.startsWith(`/repos/${REPO}/git/trees/tree0`)) return ok({ truncated: false, tree: entries });
    const blob = /\/git\/blobs\/([0-9a-f]+)$/.exec(path);
    if (blob && method === 'GET') return ok({ encoding: 'base64', content: Buffer.from(blobs.get(blob[1])!, 'utf8').toString('base64') });
    if (path === `/repos/${REPO}/git/trees` && method === 'POST') {
      posted.push(JSON.parse(String(init!.body)).tree);
      return ok({ sha: 'tree1' });
    }
    if (path === `/repos/${REPO}/git/commits` && method === 'POST') return ok({ sha: 'commit1' });
    if (path === `/repos/${REPO}/git/refs/heads/main` && method === 'PATCH') return ok({});
    return new Response('{}', { status: 404 });
  }) as typeof globalThis.fetch;
  return { fetch, posted };
}

describe('commitFiles derived files', () => {
  const base = (fetch: typeof globalThis.fetch, files: Record<string, string>, derived: DerivedFiles) =>
    commitFiles({ token: 't', repo: REPO, branch: 'main', fetch, files, message: 'm', derived });

  it('derives from the current text and the other changed paths, in the same commit', async () => {
    const { fetch, posted } = await github({ 'content/a.json': '1\n', [SEO_INTENT_FILE]: 'old\n' });
    const derive = vi.fn((current: string | null, paths: string[]) => `${current?.trim()}+${paths.join(',')}\n`);
    const res = await base(fetch, { 'content/a.json': '2\n' }, { [SEO_INTENT_FILE]: derive });
    expect(derive).toHaveBeenCalledWith('old\n', ['content/a.json']);
    expect(res.paths).toEqual(['content/a.json', SEO_INTENT_FILE]);
    expect(posted[0].map((e) => [e.path, e.content])).toEqual([
      ['content/a.json', '2\n'],
      [SEO_INTENT_FILE, 'old+content/a.json\n'],
    ]);
  });

  it('a derived file alone never makes a commit, and null leaves it alone', async () => {
    const { fetch, posted } = await github({ 'content/a.json': '1\n' });
    const derive = vi.fn(() => 'x\n');
    expect(await base(fetch, { 'content/a.json': '1\n' }, { [SEO_INTENT_FILE]: derive })).toEqual({ sha: null, changed: 0, paths: [] });
    expect(derive).not.toHaveBeenCalled();
    const res = await base(fetch, { 'content/a.json': '3\n' }, { [SEO_INTENT_FILE]: () => null });
    expect(res.paths).toEqual(['content/a.json']);
    expect(posted).toHaveLength(1);
  });
});

// --- runPublish ---------------------------------------------------------------

describe('runPublish writes the SEO intent', () => {
  const input: SnapshotInput = {
    contests: [{ year: 2026, host_iso: null, city: 'Vienna', city_slug: 'vienna', semi1_date: null, semi2_date: null, final_date: null, stage: 'archived', indexable: false, cancelled: false }],
    countries: [],
    entries: [],
    generated_at: '2026-11-01T12:00:00Z',
    cms_documents: [{ doc_id: 'faq', doc_type: 'faq', data: withTitle(faq, 'en', 'A new FAQ title') }],
  };

  it('derives seo-intent.json from the changed paths and the drafts against the committed docs', async () => {
    const commit = vi.fn<PublishDeps['commitFiles']>(async (_files, _message, _transforms, _limits, derived) => {
      const text = derived![SEO_INTENT_FILE](null, ['content/pages/faq.json']);
      return { sha: 'c1', changed: 2, paths: ['content/pages/faq.json', SEO_INTENT_FILE], text };
    });
    const deps: PublishDeps = {
      rpc: { beginPublish: async () => 42, publishInput: async () => input, endPublish: async () => {} },
      readCommittedPages: async () => ({ faq }),
      commitFiles: commit,
      media: {
        download: async () => new Uint8Array(),
        markPublished: async () => {},
        publishedPaths: async () => new Set<string>(),
        listObjects: async () => [],
        registeredPaths: async () => [],
        removeObjects: async () => {},
      },
      now: () => new Date('2026-11-22T10:00:00Z'),
    };
    const result = await runPublish(deps);
    expect(result.status).toBe('ok');
    const text = (await commit.mock.results[0].value as unknown as { text: string }).text;
    expect(parseIntentFile(JSON.parse(text)).intents).toEqual([{
      id: 'publish-42',
      created_at: '2026-11-22T10:00:00.000Z',
      source: 'publish-content',
      docs: [{ doc_id: 'faq', locale: 'en', fields: ['title', 'jsonLd'] }],
      data: [],
    }]);
  });
});
