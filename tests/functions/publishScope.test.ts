// @vitest-environment node
// publish-content per-doc publish (CMS P5): one page ships one file (plus the
// SEO intent), site-wide docs go to the content-preview branch, and a ready
// preview is promoted onto main by blob sha. GitHub is mocked.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pageCommitMessage, publishOptions, runPublish, type PublishDeps, type PreviewFile } from '../../supabase/functions/publish-content/run';
import { commitChanges, commitFiles, gitBlobSha, revertHead, type DerivedFiles, type FileTransforms } from '../../supabase/functions/publish-content/github';
import type { CmsDocumentRow, SnapshotInput } from '../../supabase/functions/publish-content/snapshot';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = { en: any; el: any };
const pageDoc = (id: string) => JSON.parse(read(`content/pages/${id}.json`)) as Doc;
const row = (doc_id: string, data: Doc, updated_at = '2026-11-22T10:00:00.123Z'): CmsDocumentRow => ({ doc_id, doc_type: doc_id, data, updated_at });

const base: SnapshotInput = {
  contests: [{ year: 2026, host_iso: null, city: 'vienna', city_slug: 'vienna', semi1_date: null, semi2_date: null, final_date: null, stage: 'archived', indexable: false, cancelled: false }],
  countries: [{ iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία', slug: 'austria', related_iso: [] }],
  entries: [],
  generated_at: '2026-11-01T12:00:00Z',
};

function deps(input: SnapshotInput) {
  const endPublish = vi.fn(async () => {});
  const beginPublish = vi.fn(async () => 12);
  const publishInput = vi.fn(async () => input);
  const commitFiles = vi.fn(async (files: Record<string, string | Uint8Array>, msg: (p: string[]) => string, _t: FileTransforms, _l: unknown, derived?: DerivedFiles, extra?: { blobs?: Record<string, unknown> }) => {
    const paths = [...Object.keys(files), ...Object.keys(extra?.blobs ?? {})].sort();
    const intent = derived?.['seo-intent.json']?.(null, paths);
    return { sha: 'c1', changed: paths.length + (intent ? 1 : 0), paths: [...paths, ...(intent ? ['seo-intent.json'] : [])], message: msg(paths), intent };
  });
  const d: PublishDeps = {
    rpc: { beginPublish, publishInput, endPublish },
    commitFiles,
    readCommittedPages: async () => ({ faq: pageDoc('faq'), 'site-header': pageDoc('site-header'), rules: pageDoc('rules') }),
    media: {
      download: vi.fn(async () => { throw new Error('no media'); }),
      markPublished: vi.fn(async () => {}),
      publishedPaths: vi.fn(async () => new Set<string>()),
      listObjects: vi.fn(async () => []),
      registeredPaths: vi.fn(async () => []),
      removeObjects: vi.fn(async () => {}),
    },
  };
  return { d, endPublish, beginPublish, publishInput, commitFiles };
}

describe('publishOptions: per-doc, preview and promote', () => {
  it('reads doc_ids (sorted, unique), target preview and promote; refuses a bad doc list', () => {
    expect(publishOptions({ doc_ids: ['rules', 'faq', 'faq'] })).toEqual({ cms: true, docIds: ['faq', 'rules'] });
    expect(publishOptions({ doc_ids: ['site-header'], target: 'preview' })).toEqual({ cms: true, docIds: ['site-header'], target: 'preview' });
    expect(publishOptions({ promote: 41 })).toEqual({ cms: true, promote: 41 });
    expect(publishOptions({ target: 'production', promote: -1 })).toEqual({ cms: true });
    expect(() => publishOptions({ doc_ids: [] })).toThrow(/non-empty/);
    expect(() => publishOptions({ doc_ids: ['../vercel'] })).toThrow(/document ids/);
  });

  it('final review M3: cms: false never comes with doc_ids, a preview target or a promote', () => {
    expect(publishOptions({ cms: false })).toEqual({ cms: false });
    for (const body of [{ cms: false, doc_ids: ['faq'] }, { cms: false, promote: 41 }, { cms: false, target: 'preview', doc_ids: ['site-header'] }]) {
      expect(() => publishOptions(body), JSON.stringify(body)).toThrow(/contests-only publish \(cms: false\) ships no documents/);
    }
  });
});

describe('runPublish, one page', () => {
  it('ships only that doc: one content file plus the intent, no contests, no vercel.json', async () => {
    const faq = pageDoc('faq');
    faq.en.hero.title = 'FAQ: every Eurovision Games question, answered';
    const { d, beginPublish, publishInput, commitFiles, endPublish } = deps({ ...base, cms_documents: [row('faq', faq)] });
    const out = await runPublish(d, publishOptions({ doc_ids: ['faq'] }));

    expect(out.status).toBe('ok');
    expect(beginPublish).toHaveBeenCalledWith(true, { docIds: ['faq'], target: 'main', promote: null });
    expect(publishInput).toHaveBeenCalledWith({ docIds: ['faq'], skipSiteWide: false });
    const [files, , transforms, , , extra] = commitFiles.mock.calls[0];
    expect(Object.keys(files)).toEqual(['content/pages/faq.json']);
    expect(transforms).toEqual({});
    expect(extra).toBeUndefined();
    const result = await commitFiles.mock.results[0].value;
    expect(result.message).toBe('content: publish faq');
    expect(JSON.parse(result.intent!).intents[0].docs).toEqual([{ doc_id: 'faq', locale: 'en', fields: ['h1', 'jsonLd'] }]);
    expect(endPublish).toHaveBeenCalledWith({
      id: 12, status: 'ok', sha: 'c1', files: 2, error: null,
      shipped: [{ doc_id: 'faq', updated_at: '2026-11-22T10:00:00.123Z', data: faq }],
    });
  });

  it('nothing to ship (the doc is already live) is a noop without a commit', async () => {
    const { d, commitFiles, endPublish } = deps({ ...base, cms_documents: [] });
    const out = await runPublish(d, publishOptions({ doc_ids: ['faq'] }));
    expect(out).toMatchObject({ status: 'noop', sha: null });
    expect(commitFiles).not.toHaveBeenCalled();
    expect(endPublish).toHaveBeenCalledWith({ id: 12, status: 'noop', sha: null, files: 0, error: null });
  });

  it('the full publish (no doc_ids) skips the site-wide docs and still ships the contests', async () => {
    const { d, publishInput, commitFiles } = deps({ ...base, cms_documents: [] });
    await runPublish(d);
    expect(publishInput).toHaveBeenCalledWith({ docIds: null, skipSiteWide: true });
    expect(Object.keys(commitFiles.mock.calls[0][0])).toContain('content/site.json');
  });

  it('busy while the previous deploy builds says so', async () => {
    const { d, beginPublish } = deps(base);
    beginPublish.mockRejectedValueOnce(new Error('publish already running (the previous deploy is still building)'));
    expect(await runPublish(d, publishOptions({ doc_ids: ['faq'] }))).toMatchObject({ status: 'busy', error: expect.stringMatching(/still building/) });
  });
});

describe('runPublish, a site-wide preview', () => {
  it('commits to the preview target and marks no media published', async () => {
    const header = pageDoc('site-header');
    header.en.cta.createRoom = 'Create a room now';
    const { d, commitFiles, endPublish } = deps({ ...base, cms_documents: [row('site-header', header)] });
    const out = await runPublish(d, publishOptions({ doc_ids: ['site-header'], target: 'preview' }));
    expect(out.status).toBe('ok');
    const [files, , , , , extra] = commitFiles.mock.calls[0];
    expect(Object.keys(files)).toEqual(['content/pages/site-header.json']);
    expect(extra).toEqual({ target: 'preview' });
    expect((await commitFiles.mock.results[0].value).message).toBe('content: preview site-header');
    expect(d.media.markPublished).not.toHaveBeenCalled();
    expect(endPublish).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', shipped: [expect.objectContaining({ doc_id: 'site-header' })] }));
  });
});

describe('runPublish, promote', () => {
  it('commits the preview files by blob sha onto main and ships the versions the preview showed', async () => {
    const header = pageDoc('site-header');
    header.en.cta.createRoom = 'Create a room now';
    const text = JSON.stringify(header, null, 2) + '\n';
    const files: PreviewFile[] = [
      { path: 'content/pages/site-header.json', sha: await gitBlobSha(text), mode: '100644', text },
      { path: 'seo-intent.json', sha: 'intent-sha', mode: '100644' },
    ];
    const { d, beginPublish, commitFiles, endPublish } = deps(base);
    d.rpc.previewRun = vi.fn(async () => ({ id: 40, commit_sha: 'prev0', doc_ids: ['site-header'], shipped: [{ doc_id: 'site-header', updated_at: '2026-11-22T09:00:00.000Z' }] }));
    d.commitChanges = vi.fn(async () => files);
    const out = await runPublish(d, publishOptions({ promote: 40 }));

    expect(out).toMatchObject({ status: 'ok', sha: 'c1' });
    expect(beginPublish).toHaveBeenCalledWith(true, { docIds: null, target: 'main', promote: 40 });
    const [plain, , , , , extra] = commitFiles.mock.calls[0];
    expect(plain).toEqual({});
    expect(extra).toEqual({ blobs: { 'content/pages/site-header.json': { sha: files[0].sha, mode: '100644' } } });
    expect(endPublish).toHaveBeenCalledWith({
      id: 12, status: 'ok', sha: 'c1', files: 2, error: null,
      shipped: [{ doc_id: 'site-header', updated_at: '2026-11-22T09:00:00.000Z', data: header }],
    });
  });

  it('a preview commit with no content files refuses the promote', async () => {
    const { d, endPublish } = deps(base);
    d.rpc.previewRun = vi.fn(async () => ({ id: 40, commit_sha: 'prev0000', doc_ids: ['site-header'], shipped: [] }));
    d.commitChanges = vi.fn(async () => [{ path: 'seo-intent.json', sha: 'x', mode: '100644' }]);
    const out = await runPublish(d, publishOptions({ promote: 40 }));
    expect(out).toMatchObject({ status: 'error', error: expect.stringMatching(/changed no content/) });
    expect(endPublish).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });

  it('pageCommitMessage names the docs', () => {
    expect(pageCommitMessage(['site-footer', 'site-header'], 'main')).toBe('content: publish site-footer, site-header');
  });
});

// ── github.ts: the preview branch, blobs by sha, commit changes, revert ──
const API = 'https://api.github.com';
const REPO = 'tsokid/EurovisionParty';
const R = `/repos/${REPO}`;
type Route = { method: string; path: string; status?: number; body: unknown };

function mock(routes: Route[]) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input).slice(API.length);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = routes.find((x) => x.method === method && x.path === path);
    if (!r) return new Response(JSON.stringify({ message: `no route ${method} ${path}` }), { status: 404 });
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const mainHead: Route[] = [
  { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: 'main0' } } },
  { method: 'GET', path: `${R}/git/commits/main0`, body: { sha: 'main0', tree: { sha: 'tree0' } } },
  { method: 'GET', path: `${R}/git/trees/tree0?recursive=1`, body: { truncated: false, tree: [{ path: 'content/pages/site-header.json', mode: '100644', type: 'blob', sha: 'old' }] } },
  { method: 'POST', path: `${R}/git/trees`, body: { sha: 'tree1' } },
  { method: 'POST', path: `${R}/git/commits`, body: { sha: 'new1' } },
];

describe('github.ts for P5', () => {
  it('a preview commit is cut from main and force-moves content-preview (main is never written)', async () => {
    const { fetch, calls } = mock([...mainHead, { method: 'PATCH', path: `${R}/git/refs/heads/content-preview`, body: {} }]);
    const out = await commitFiles({ token: 't', repo: REPO, branch: 'content-preview', base: 'main', fetch, files: { 'content/pages/site-header.json': '{}\n' }, message: 'm' });
    expect(out.sha).toBe('new1');
    expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/git/commits'))!.body).toMatchObject({ parents: ['main0'] });
    expect(calls.filter((c) => c.method === 'PATCH')).toEqual([{ method: 'PATCH', path: `${R}/git/refs/heads/content-preview`, body: { sha: 'new1', force: true } }]);
  });

  it('creates content-preview when it does not exist yet', async () => {
    const { fetch, calls } = mock([...mainHead, { method: 'PATCH', path: `${R}/git/refs/heads/content-preview`, status: 422, body: { message: 'Reference does not exist' } }, { method: 'POST', path: `${R}/git/refs`, body: {} }]);
    await commitFiles({ token: 't', repo: REPO, branch: 'content-preview', base: 'main', fetch, files: { 'content/pages/site-header.json': '{}\n' }, message: 'm' });
    expect(calls.at(-1)).toEqual({ method: 'POST', path: `${R}/git/refs`, body: { ref: 'refs/heads/content-preview', sha: 'new1' } });
  });

  it('existing blobs go into the tree by sha; an unchanged blob is skipped', async () => {
    const { fetch, calls } = mock([...mainHead, { method: 'PATCH', path: `${R}/git/refs/heads/main`, body: {} }]);
    await commitFiles({ token: 't', repo: REPO, branch: 'main', fetch, files: {}, message: 'm', blobs: {
      'content/pages/site-header.json': { sha: 'previewed', mode: '100644' },
      'public/media/abc.webp': { sha: 'img', mode: '100644' },
    } });
    expect(calls.find((c) => c.path === `${R}/git/trees`)!.body).toEqual({ base_tree: 'tree0', tree: [
      { path: 'content/pages/site-header.json', mode: '100644', type: 'blob', sha: 'previewed' },
      { path: 'public/media/abc.webp', mode: '100644', type: 'blob', sha: 'img' },
    ] });
    const { fetch: f2 } = mock(mainHead);
    expect(await commitFiles({ token: 't', repo: REPO, branch: 'main', fetch: f2, files: {}, message: 'm', blobs: { 'content/pages/site-header.json': { sha: 'old', mode: '100644' } } }))
      .toEqual({ sha: null, changed: 0, paths: [] });
  });

  it('commitChanges lists what a commit changed against its parent, with the text of selected paths', async () => {
    const b64 = Buffer.from('{"en":{},"el":{}}\n').toString('base64');
    const { fetch } = mock([
      { method: 'GET', path: `${R}/git/commits/p1`, body: { tree: { sha: 'tp1' }, parents: [{ sha: 'p0' }] } },
      { method: 'GET', path: `${R}/git/commits/p0`, body: { tree: { sha: 'tp0' } } },
      { method: 'GET', path: `${R}/git/trees/tp1?recursive=1`, body: { truncated: false, tree: [
        { path: 'a.txt', mode: '100644', type: 'blob', sha: 'same' },
        { path: 'content/pages/site-header.json', mode: '100644', type: 'blob', sha: 'h2' },
        { path: 'seo-intent.json', mode: '100644', type: 'blob', sha: 'i2' },
      ] } },
      { method: 'GET', path: `${R}/git/trees/tp0?recursive=1`, body: { truncated: false, tree: [
        { path: 'a.txt', mode: '100644', type: 'blob', sha: 'same' },
        { path: 'content/pages/site-header.json', mode: '100644', type: 'blob', sha: 'h1' },
      ] } },
      { method: 'GET', path: `${R}/git/blobs/h2`, body: { encoding: 'base64', content: b64 } },
    ]);
    expect(await commitChanges({ token: 't', repo: REPO, branch: 'main', fetch, sha: 'p1', textOf: (p) => p.startsWith('content/') })).toEqual([
      { path: 'content/pages/site-header.json', sha: 'h2', mode: '100644', text: '{"en":{},"el":{}}\n' },
      { path: 'seo-intent.json', sha: 'i2', mode: '100644' },
    ]);
  });

  it('revertHead writes nothing when main moved on', async () => {
    const { fetch, calls } = mock([{ method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: 'later' } } }]);
    expect(await revertHead({ token: 't', repo: REPO, branch: 'main', fetch, sha: 'bad', message: 'm' })).toEqual({ blocked: 'later' });
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
});
