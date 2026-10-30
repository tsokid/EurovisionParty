// @vitest-environment node
// publish-content/github.ts: one commit via the Git Data API, fetch mocked.
import { describe, it, expect } from 'vitest';
import { commitFiles, gitBlobSha, readRepoFile } from '../../supabase/functions/publish-content/github';

type Call = { method: string; url: string; body: unknown; headers: Record<string, string> };
type Route = { method: string; path: string | RegExp; status?: number; body: unknown };

const API = 'https://api.github.com';
const REPO = 'tsokid/EurovisionParty';

/** fetch mock: answers the first matching route and records every call. */
function mockFetch(routes: Route[]) {
  const calls: Call[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers });
    const path = url.slice(API.length);
    const route = routes.find(
      (r) => r.method === method && (typeof r.path === 'string' ? r.path === path : r.path.test(path)),
    );
    if (!route) return new Response(JSON.stringify({ message: `no route ${method} ${path}` }), { status: 404 });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

async function baseRoutes(files: Record<string, string>): Promise<Route[]> {
  const tree = await Promise.all(
    Object.entries(files).map(async ([path, content]) => ({ path, mode: '100644', type: 'blob', sha: await gitBlobSha(content) })),
  );
  return [
    { method: 'GET', path: `/repos/${REPO}/git/ref/heads/main`, body: { object: { sha: 'c0ffee', type: 'commit' } } },
    { method: 'GET', path: `/repos/${REPO}/git/commits/c0ffee`, body: { sha: 'c0ffee', tree: { sha: 'tree0' } } },
    {
      method: 'GET',
      path: `/repos/${REPO}/git/trees/tree0?recursive=1`,
      body: { sha: 'tree0', truncated: false, tree: [{ path: 'content', mode: '040000', type: 'tree', sha: 'd1' }, ...tree] },
    },
  ];
}

const opts = (fetch: typeof globalThis.fetch, files: Record<string, string>) => ({
  token: 'tkn',
  repo: REPO,
  branch: 'main',
  files,
  message: 'content: publish 2026',
  fetch,
});

describe('gitBlobSha', () => {
  it('matches git hash-object', async () => {
    expect(await gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    expect(await gitBlobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });

  it('hashes UTF-8 bytes, not UTF-16 code units', async () => {
    // printf 'Ελλάδα\n' | git hash-object --stdin
    expect(await gitBlobSha('Ελλάδα\n')).toBe('a60d5208555cf2046291a7d64ca2fd465d078ab0');
  });
});

describe('commitFiles', () => {
  it('commits nothing when every file is unchanged', async () => {
    const files = { 'content/site.json': '{}\n', 'vercel.json': '{\n  "a": 1\n}\n' };
    const { fetch, calls } = mockFetch(await baseRoutes(files));
    expect(await commitFiles(opts(fetch, files))).toEqual({ sha: null, changed: 0, paths: [] });
    expect(calls.map((c) => c.method)).toEqual(['GET', 'GET', 'GET']);
  });

  it('sends the GitHub auth and version headers', async () => {
    const files = { 'content/site.json': '{}\n' };
    const { fetch, calls } = mockFetch(await baseRoutes(files));
    await commitFiles(opts(fetch, files));
    for (const c of calls) {
      expect(c.headers.authorization).toBe('Bearer tkn');
      expect(c.headers.accept).toBe('application/vnd.github+json');
      expect(c.headers['x-github-api-version']).toBe('2022-11-28');
    }
  });

  it('creates blobs, a tree on base_tree with only the changed paths, a commit and a fast-forward ref update, in order', async () => {
    const base = { 'content/site.json': '{}\n', 'content/contests/2026.json': 'old\n', 'vercel.json': 'v\n' };
    const routes = await baseRoutes(base);
    routes.push(
      { method: 'POST', path: `/repos/${REPO}/git/blobs`, status: 201, body: { sha: 'blob1' } },
      { method: 'POST', path: `/repos/${REPO}/git/trees`, status: 201, body: { sha: 'tree1' } },
      { method: 'POST', path: `/repos/${REPO}/git/commits`, status: 201, body: { sha: 'commit1' } },
      { method: 'PATCH', path: `/repos/${REPO}/git/refs/heads/main`, body: { object: { sha: 'commit1' } } },
    );
    const { fetch, calls } = mockFetch(routes);
    const files = { 'content/site.json': '{}\n', 'content/contests/2026.json': 'new\n', 'content/countries/gr.json': 'gr\n', 'vercel.json': 'v\n' };
    const out = await commitFiles(opts(fetch, files));
    expect(out).toEqual({ sha: 'commit1', changed: 2, paths: ['content/contests/2026.json', 'content/countries/gr.json'] });

    expect(calls.map((c) => `${c.method} ${c.url.slice(API.length)}`)).toEqual([
      `GET /repos/${REPO}/git/ref/heads/main`,
      `GET /repos/${REPO}/git/commits/c0ffee`,
      `GET /repos/${REPO}/git/trees/tree0?recursive=1`,
      `POST /repos/${REPO}/git/blobs`,
      `POST /repos/${REPO}/git/blobs`,
      `POST /repos/${REPO}/git/trees`,
      `POST /repos/${REPO}/git/commits`,
      `PATCH /repos/${REPO}/git/refs/heads/main`,
    ]);
    expect(calls[3].body).toEqual({ content: 'new\n', encoding: 'utf-8' });
    expect(calls[4].body).toEqual({ content: 'gr\n', encoding: 'utf-8' });
    expect(calls[5].body).toEqual({
      base_tree: 'tree0',
      tree: [
        { path: 'content/contests/2026.json', mode: '100644', type: 'blob', sha: 'blob1' },
        { path: 'content/countries/gr.json', mode: '100644', type: 'blob', sha: 'blob1' },
      ],
    });
    expect(calls[6].body).toEqual({ message: 'content: publish 2026', tree: 'tree1', parents: ['c0ffee'] });
    expect(calls[7].body).toEqual({ sha: 'commit1', force: false });
  });

  it('builds the message from the changed paths when given a function', async () => {
    const routes = await baseRoutes({});
    routes.push(
      { method: 'POST', path: `/repos/${REPO}/git/blobs`, status: 201, body: { sha: 'blob1' } },
      { method: 'POST', path: `/repos/${REPO}/git/trees`, status: 201, body: { sha: 'tree1' } },
      { method: 'POST', path: `/repos/${REPO}/git/commits`, status: 201, body: { sha: 'commit1' } },
      { method: 'PATCH', path: `/repos/${REPO}/git/refs/heads/main`, body: {} },
    );
    const { fetch, calls } = mockFetch(routes);
    await commitFiles({ ...opts(fetch, { 'a.json': 'a\n' }), message: (paths: string[]) => `m ${paths.join(',')}` });
    expect((calls.find((c) => c.url.endsWith('/git/commits'))!.body as { message: string }).message).toBe('m a.json');
  });

  it('treats a new tree equal to the base tree as no change', async () => {
    const routes = await baseRoutes({});
    routes.push(
      { method: 'POST', path: `/repos/${REPO}/git/blobs`, status: 201, body: { sha: 'blob1' } },
      { method: 'POST', path: `/repos/${REPO}/git/trees`, status: 201, body: { sha: 'tree0' } },
    );
    const { fetch, calls } = mockFetch(routes);
    expect(await commitFiles(opts(fetch, { 'a.json': 'a\n' }))).toEqual({ sha: null, changed: 0, paths: [] });
    expect(calls.some((c) => c.url.endsWith('/git/commits'))).toBe(false);
  });

  it('throws with the status and GitHub message when the ref update is refused (409)', async () => {
    const routes = await baseRoutes({});
    routes.push(
      { method: 'POST', path: `/repos/${REPO}/git/blobs`, status: 201, body: { sha: 'blob1' } },
      { method: 'POST', path: `/repos/${REPO}/git/trees`, status: 201, body: { sha: 'tree1' } },
      { method: 'POST', path: `/repos/${REPO}/git/commits`, status: 201, body: { sha: 'commit1' } },
      { method: 'PATCH', path: `/repos/${REPO}/git/refs/heads/main`, status: 409, body: { message: 'Update is not a fast forward' } },
    );
    const { fetch } = mockFetch(routes);
    await expect(commitFiles(opts(fetch, { 'a.json': 'a\n' }))).rejects.toThrow(
      'GitHub 409 PATCH /repos/tsokid/EurovisionParty/git/refs/heads/main: Update is not a fast forward',
    );
  });

  it('throws on a failed read (401) before writing anything', async () => {
    const { fetch, calls } = mockFetch([
      { method: 'GET', path: `/repos/${REPO}/git/ref/heads/main`, status: 401, body: { message: 'Bad credentials' } },
    ]);
    await expect(commitFiles(opts(fetch, { 'a.json': 'a\n' }))).rejects.toThrow(/GitHub 401 .*Bad credentials/);
    expect(calls).toHaveLength(1);
  });

  it('refuses a truncated base tree', async () => {
    const routes = await baseRoutes({});
    (routes[2].body as { truncated: boolean }).truncated = true;
    const { fetch } = mockFetch(routes);
    await expect(commitFiles(opts(fetch, { 'a.json': 'a\n' }))).rejects.toThrow(/truncated/);
  });

  it('keeps an existing file mode', async () => {
    const routes = await baseRoutes({});
    (routes[2].body as { tree: unknown[] }).tree.push({ path: 'run.sh', mode: '100755', type: 'blob', sha: 'x' });
    routes.push(
      { method: 'POST', path: `/repos/${REPO}/git/blobs`, status: 201, body: { sha: 'blob1' } },
      { method: 'POST', path: `/repos/${REPO}/git/trees`, status: 201, body: { sha: 'tree1' } },
      { method: 'POST', path: `/repos/${REPO}/git/commits`, status: 201, body: { sha: 'commit1' } },
      { method: 'PATCH', path: `/repos/${REPO}/git/refs/heads/main`, body: {} },
    );
    const { fetch, calls } = mockFetch(routes);
    await commitFiles(opts(fetch, { 'run.sh': 'echo\n' }));
    const tree = calls.find((c) => c.url.endsWith('/git/trees'))!.body as { tree: Array<{ mode: string }> };
    expect(tree.tree[0].mode).toBe('100755');
  });
});

describe('readRepoFile', () => {
  it('reads and UTF-8 decodes a file from the contents API at the branch', async () => {
    const text = '{\n  "ά": 1\n}\n';
    const b64 = Buffer.from(text, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
    const { fetch, calls } = mockFetch([
      { method: 'GET', path: `/repos/${REPO}/contents/vercel.json?ref=main`, body: { encoding: 'base64', content: b64 } },
    ]);
    expect(await readRepoFile({ token: 'tkn', repo: REPO, branch: 'main', path: 'vercel.json', fetch })).toBe(text);
    expect(calls[0].headers.authorization).toBe('Bearer tkn');
  });

  it('throws on 404', async () => {
    const { fetch } = mockFetch([]);
    await expect(readRepoFile({ token: 'tkn', repo: REPO, branch: 'main', path: 'vercel.json', fetch })).rejects.toThrow(/GitHub 404/);
  });
});
