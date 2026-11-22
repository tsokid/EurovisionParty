// @vitest-environment node
// publish-status/status.ts: the deploy state of a run from GitHub's
// deployments, and the auto-revert of a failed main build, which happens only
// while main's head is still the failed commit (spec §9). GitHub is mocked;
// nothing here talks to production.
import { describe, it, expect, vi } from 'vitest';
import { checkRun, observeDeploy, blockedNote, type RunRow, type DeployState } from '../../supabase/functions/publish-status/status';

const API = 'https://api.github.com';
const REPO = 'tsokid/EurovisionParty';
const R = `/repos/${REPO}`;

type Call = { method: string; path: string; body: unknown };
type Route = { method: string; path: string; status?: number; body: unknown };

function github(routes: Route[]) {
  const calls: Call[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input).slice(API.length);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes.find((r) => r.method === method && r.path === path);
    if (!route) return new Response(JSON.stringify({ message: `no route ${method} ${path}` }), { status: 404 });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  }) as typeof globalThis.fetch;
  return { cfg: { token: 't', repo: REPO, branch: 'main', fetch }, calls };
}

const FAILED = 'fa11ed0000000000000000000000000000000000';
const run = (over: Partial<RunRow> = {}): RunRow => ({
  id: 51, status: 'ok', target: 'main', commit_sha: FAILED, finished_at: '2026-11-22T10:00:00Z',
  deploy_state: 'building', deploy_url: null, deploy_note: null, reverted_sha: null, doc_ids: ['faq'], ...over,
});

const deployments = (sha: string, env: string, state: string, extra: Record<string, unknown> = {}): Route[] => [
  { method: 'GET', path: `${R}/deployments?sha=${sha}&per_page=20`, body: [{ id: 900, sha, environment: env, created_at: '2026-11-22T10:00:10Z' }] },
  { method: 'GET', path: `${R}/deployments/900/statuses?per_page=1`, body: [{ state, ...extra }] },
];

/** A fake set_deploy_state that records its calls and echoes the run. */
function recorder(base: RunRow) {
  const calls: Array<{ state: DeployState; url: string | null; revertedSha: string | null; note: string | null }> = [];
  const setDeployState = vi.fn(async (a: { id: number; state: DeployState; url: string | null; revertedSha: string | null; note: string | null }) => {
    calls.push({ state: a.state, url: a.url, revertedSha: a.revertedSha, note: a.note });
    return { ...base, deploy_state: a.state, deploy_url: a.url ?? base.deploy_url, reverted_sha: a.revertedSha ?? base.reverted_sha, deploy_note: a.note };
  });
  return { setDeployState, calls };
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');

describe('observeDeploy', () => {
  it('maps the Production deployment status of a main commit', async () => {
    for (const [gh, expected] of [
      ['in_progress', 'building'], ['queued', 'building'], ['pending', 'building'],
      ['success', 'ready'], ['inactive', 'ready'], ['failure', 'error'], ['error', 'error'],
    ] as const) {
      const { cfg } = github(deployments(FAILED, 'Production', gh, { environment_url: 'https://eurovision.games' }));
      const o = await observeDeploy(cfg, FAILED, 'main');
      expect(o.state, gh).toBe(expected);
    }
  });

  it('a preview reads the Preview deployment and returns its URL', async () => {
    const { cfg } = github(deployments('p1', 'Preview', 'success', { environment_url: 'https://eurovision-git-content-preview-tsokid.vercel.app' }));
    expect(await observeDeploy(cfg, 'p1', 'preview')).toEqual({ state: 'ready', url: 'https://eurovision-git-content-preview-tsokid.vercel.app', detail: null });
  });

  it('a Preview deployment does not count for a main run (and stays building)', async () => {
    const { cfg } = github([
      ...deployments(FAILED, 'Preview', 'failure'),
      { method: 'GET', path: `${R}/commits/${FAILED}/status`, body: { state: 'pending', statuses: [] } },
    ]);
    expect((await observeDeploy(cfg, FAILED, 'main')).state).toBe('building');
  });

  it('falls back to the Vercel commit status when no deployment exists yet', async () => {
    const { cfg } = github([
      { method: 'GET', path: `${R}/deployments?sha=${FAILED}&per_page=20`, body: [] },
      { method: 'GET', path: `${R}/commits/${FAILED}/status`, body: { state: 'failure', statuses: [{ context: 'Vercel', state: 'failure', description: 'Build failed', target_url: 'https://vercel.com/x' }] } },
    ]);
    expect(await observeDeploy(cfg, FAILED, 'main')).toEqual({ state: 'error', url: 'https://vercel.com/x', detail: 'Build failed' });
  });
});

describe('checkRun', () => {
  it('records ready with the deployment URL; a settled run makes no GitHub call', async () => {
    const { cfg, calls } = github(deployments(FAILED, 'Production', 'success', { environment_url: 'https://eurovision.games' }));
    const rec = recorder(run());
    const out = await checkRun({ github: cfg, setDeployState: rec.setDeployState }, run());
    expect(out.deploy_state).toBe('ready');
    expect(rec.calls).toEqual([{ state: 'ready', url: 'https://eurovision.games', revertedSha: null, note: null }]);

    calls.length = 0;
    await checkRun({ github: cfg, setDeployState: rec.setDeployState }, run({ deploy_state: 'ready' }));
    await checkRun({ github: cfg, setDeployState: rec.setDeployState }, run({ deploy_state: 'reverted' }));
    await checkRun({ github: cfg, setDeployState: rec.setDeployState }, run({ deploy_state: 'revert_blocked' }));
    await checkRun({ github: cfg, setDeployState: rec.setDeployState }, run({ status: 'noop', commit_sha: null, deploy_state: null }));
    expect(calls).toEqual([]);
  });

  it('a still-building run with nothing new writes nothing', async () => {
    const { cfg } = github(deployments(FAILED, 'Production', 'in_progress'));
    const rec = recorder(run());
    await checkRun({ github: cfg, setDeployState: rec.setDeployState }, run());
    expect(rec.calls).toEqual([]);
  });

  it('a failed main build is reverted when main HEAD is still the failed commit', async () => {
    const { cfg, calls } = github([
      ...deployments(FAILED, 'Production', 'failure', { description: 'seo:diff: /en/faq title changed without intent' }),
      { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: FAILED } } },
      { method: 'GET', path: `${R}/git/commits/${FAILED}`, body: { sha: FAILED, parents: [{ sha: 'good0' }] } },
      { method: 'GET', path: `${R}/git/commits/good0`, body: { sha: 'good0', tree: { sha: 'tree-good' } } },
      { method: 'POST', path: `${R}/git/commits`, body: { sha: 'rev0' } },
      { method: 'PATCH', path: `${R}/git/refs/heads/main`, body: { object: { sha: 'rev0' } } },
    ]);
    const rec = recorder(run());
    const out = await checkRun({ github: cfg, setDeployState: rec.setDeployState }, run());

    expect(writes(calls)).toEqual([
      { method: 'POST', path: `${R}/git/commits`, body: { message: expect.stringMatching(/^content: revert publish 51/), tree: 'tree-good', parents: [FAILED] } },
      { method: 'PATCH', path: `${R}/git/refs/heads/main`, body: { sha: 'rev0', force: false } },
    ]);
    expect(rec.calls.map((c) => c.state)).toEqual(['error', 'reverted']);
    expect(rec.calls[1]).toMatchObject({ revertedSha: 'rev0', note: 'seo:diff: /en/faq title changed without intent' });
    expect(out).toMatchObject({ deploy_state: 'reverted', reverted_sha: 'rev0' });
  });

  it('when main moved on, nothing is written to GitHub: revert_blocked with the alert', async () => {
    const { cfg, calls } = github([
      ...deployments(FAILED, 'Production', 'failure'),
      { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: 'newer1234567' } } },
    ]);
    const log = vi.fn();
    const rec = recorder(run());
    const out = await checkRun({ github: cfg, setDeployState: rec.setDeployState, log }, run());
    expect(writes(calls)).toEqual([]);
    expect(rec.calls.map((c) => c.state)).toEqual(['error', 'revert_blocked']);
    expect(rec.calls[1].note).toBe(blockedNote('newer1234567'));
    expect(out.deploy_state).toBe('revert_blocked');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('not reverting'));
  });

  it('a race after the head check (the ref update is refused) also ends as revert_blocked', async () => {
    const { cfg } = github([
      ...deployments(FAILED, 'Production', 'error'),
      { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: FAILED } } },
      { method: 'GET', path: `${R}/git/commits/${FAILED}`, body: { sha: FAILED, parents: [{ sha: 'good0' }] } },
      { method: 'GET', path: `${R}/git/commits/good0`, body: { sha: 'good0', tree: { sha: 'tree-good' } } },
      { method: 'POST', path: `${R}/git/commits`, body: { sha: 'rev0' } },
      { method: 'PATCH', path: `${R}/git/refs/heads/main`, status: 422, body: { message: 'Update is not a fast forward' } },
    ]);
    const rec = recorder(run());
    const out = await checkRun({ github: cfg, setDeployState: rec.setDeployState, log: () => {} }, run());
    expect(out.deploy_state).toBe('revert_blocked');
    expect(rec.calls[1].note).toMatch(/revert failed: GitHub 422/);
  });

  it('a run already marked error (its revert did not finish) retries the revert without reading the deploy', async () => {
    const { cfg, calls } = github([
      { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: 'other00' } } },
    ]);
    const rec = recorder(run({ deploy_state: 'error' }));
    await checkRun({ github: cfg, setDeployState: rec.setDeployState, log: () => {} }, run({ deploy_state: 'error' }));
    expect(calls.map((c) => c.path)).toEqual([`${R}/git/ref/heads/main`]);
    expect(rec.calls.map((c) => c.state)).toEqual(['error', 'revert_blocked']);
  });

  it('a failed preview build is reported, never reverted (main is untouched)', async () => {
    const { cfg, calls } = github(deployments('p1', 'Preview', 'failure', { target_url: 'https://vercel.com/p1' }));
    const rec = recorder(run({ target: 'preview', commit_sha: 'p1' }));
    const out = await checkRun({ github: cfg, setDeployState: rec.setDeployState }, run({ target: 'preview', commit_sha: 'p1' }));
    expect(out.deploy_state).toBe('error');
    expect(rec.calls.map((c) => c.state)).toEqual(['error']);
    expect(calls.every((c) => c.method === 'GET' && !c.path.includes('/git/'))).toBe(true);
  });
});

// 090: on the night of the final a contests-only publish no longer waits
// behind a building page deploy. If that page build fails, only the page's
// files are put back on top of the contests commit; the results are never
// reverted.
describe('contests published on top of a building content run (090)', () => {
  const PAGE = 'fa11ed0000000000000000000000000000000000';
  const CONT = 'c0e5750000000000000000000000000000000000';
  const REV = 'feed000000000000000000000000000000000000';
  const deployOf = (sha: string, id: number, state: string, extra: Record<string, unknown> = {}): Route[] => [
    { method: 'GET', path: `${R}/deployments?sha=${sha}&per_page=20`, body: [{ id, sha, environment: 'Production', created_at: '2026-11-22T10:00:10Z' }] },
    { method: 'GET', path: `${R}/deployments/${id}/statuses?per_page=1`, body: [{ state, ...extra }] },
  ];
  const page = run({ id: 51, commit_sha: PAGE, cms: true, doc_ids: ['faq'] });
  const contests = run({ id: 52, commit_sha: CONT, cms: false, doc_ids: null, finished_at: '2026-11-22T10:01:00Z' });

  /** set_deploy_state over several runs. */
  function store(...rows: RunRow[]) {
    const byId = new Map(rows.map((r) => [r.id, { ...r }]));
    const calls: Array<{ id: number; state: DeployState; revertedSha: string | null; note: string | null }> = [];
    const setDeployState = vi.fn(async (a: { id: number; state: DeployState; url: string | null; revertedSha: string | null; note: string | null }) => {
      calls.push({ id: a.id, state: a.state, revertedSha: a.revertedSha, note: a.note });
      const prev = byId.get(a.id)!;
      const next = { ...prev, deploy_state: a.state, reverted_sha: a.revertedSha ?? prev.reverted_sha, deploy_note: a.note };
      byId.set(a.id, next);
      return next;
    });
    return { setDeployState, calls, row: (id: number) => byId.get(id)! };
  }

  // The page commit changed faq.json and the intent file; the contests commit 2027.json and the intent file.
  const scopedRevert: Route[] = [
    { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: CONT } } },
    { method: 'GET', path: `${R}/compare/${PAGE}...${CONT}`, body: { status: 'ahead', commits: [{ sha: CONT }], files: [{ filename: 'content/contests/2027.json' }, { filename: 'seo-intent.json' }] } },
    { method: 'GET', path: `${R}/git/commits/${PAGE}`, body: { sha: PAGE, tree: { sha: 'tree-page' }, parents: [{ sha: 'good0' }] } },
    { method: 'GET', path: `${R}/git/commits/good0`, body: { sha: 'good0', tree: { sha: 'tree-good' } } },
    { method: 'GET', path: `${R}/git/trees/tree-page?recursive=1`, body: { truncated: false, tree: [
      { path: 'content/pages/faq.json', mode: '100644', type: 'blob', sha: 'faq-new' },
      { path: 'seo-intent.json', mode: '100644', type: 'blob', sha: 'intent-2' },
      { path: 'content/contests/2027.json', mode: '100644', type: 'blob', sha: 'y-old' },
    ] } },
    { method: 'GET', path: `${R}/git/trees/tree-good?recursive=1`, body: { truncated: false, tree: [
      { path: 'content/pages/faq.json', mode: '100644', type: 'blob', sha: 'faq-old' },
      { path: 'seo-intent.json', mode: '100644', type: 'blob', sha: 'intent-1' },
      { path: 'content/contests/2027.json', mode: '100644', type: 'blob', sha: 'y-old' },
    ] } },
    { method: 'GET', path: `${R}/git/commits/${CONT}`, body: { sha: CONT, tree: { sha: 'tree-cont' } } },
    { method: 'POST', path: `${R}/git/trees`, body: { sha: 'tree-rev' } },
    { method: 'POST', path: `${R}/git/commits`, body: { sha: REV } },
    { method: 'PATCH', path: `${R}/git/refs/heads/main`, body: { object: { sha: REV } } },
  ];

  it('a failed page build under a failed contests build: only the page file is put back, on top of the results', async () => {
    const { cfg, calls } = github([...deployOf(PAGE, 901, 'failure'), ...deployOf(CONT, 902, 'failure'), ...scopedRevert]);
    const db = store(page, contests);
    const out = await checkRun({ github: cfg, setDeployState: db.setDeployState, laterMainRuns: async () => [contests] }, page);

    expect(writes(calls)).toEqual([
      { method: 'POST', path: `${R}/git/trees`, body: { base_tree: 'tree-cont', tree: [{ path: 'content/pages/faq.json', mode: '100644', type: 'blob', sha: 'faq-old' }] } },
      { method: 'POST', path: `${R}/git/commits`, body: { message: expect.stringMatching(/^content: revert the files of publish 51/), tree: 'tree-rev', parents: [CONT] } },
      { method: 'PATCH', path: `${R}/git/refs/heads/main`, body: { sha: REV, force: false } },
    ]);
    expect(out).toMatchObject({ deploy_state: 'reverted', reverted_sha: REV });
  });

  it('the contests run never reverts itself: it follows the page revert commit to live', async () => {
    const { cfg, calls } = github([
      ...deployOf(CONT, 902, 'failure'), ...deployOf(PAGE, 901, 'failure'), ...scopedRevert,
      ...deployOf(REV, 903, 'success', { environment_url: 'https://eurovision.games' }),
    ]);
    const db = store(page, contests);
    const out = await checkRun({
      github: cfg,
      setDeployState: db.setDeployState,
      laterMainRuns: async (r) => (r.id === 51 ? [contests] : []),
      earlierContentRun: async () => page,
    }, contests);

    // One revert commit, the page's, on top of the contests commit.
    const commits = writes(calls).filter((c) => c.method === 'POST' && c.path.endsWith('/git/commits'));
    expect(commits).toHaveLength(1);
    expect(commits[0].body).toMatchObject({ parents: [CONT] });
    expect(db.row(51)).toMatchObject({ deploy_state: 'reverted', reverted_sha: REV });
    expect(out).toMatchObject({ deploy_state: 'ready' });
    expect(out.deploy_note).toMatch(/because of publish 51.*put back in feed000/);
  });

  it('when the contests build on top went live, the page is live with it: ready, nothing reverted', async () => {
    const { cfg, calls } = github([...deployOf(PAGE, 901, 'failure'), ...deployOf(CONT, 902, 'success'),
      { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: CONT } } }]);
    const db = store(page, contests);
    const out = await checkRun({ github: cfg, setDeployState: db.setDeployState, laterMainRuns: async () => [contests] }, page);
    expect(writes(calls)).toEqual([]);
    expect(out.deploy_state).toBe('ready');
    expect(out.deploy_note).toMatch(/live with publish 52/);
  });

  it('while the contests build on top is still building, nothing is decided or written', async () => {
    const { cfg, calls } = github([...deployOf(PAGE, 901, 'failure'), ...deployOf(CONT, 902, 'in_progress'),
      { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: CONT } } }]);
    const db = store(page, contests);
    const out = await checkRun({ github: cfg, setDeployState: db.setDeployState, laterMainRuns: async () => [contests] }, page);
    expect(writes(calls)).toEqual([]);
    expect(out.deploy_state).toBe('error');
  });

  it('a content publish on top (not contests-only) still blocks: revert_blocked, nothing written', async () => {
    const other = run({ id: 53, commit_sha: 'beef', cms: true });
    const { cfg, calls } = github([...deployOf(PAGE, 901, 'failure'),
      { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: 'beef' } } }]);
    const db = store(page, other);
    const out = await checkRun({ github: cfg, setDeployState: db.setDeployState, laterMainRuns: async () => [contests, other], log: () => {} }, page);
    expect(writes(calls)).toEqual([]);
    expect(out.deploy_state).toBe('revert_blocked');
  });

  it('a contests commit that touched one of the page files blocks the scoped revert', async () => {
    const routes = scopedRevert.map((r) => (r.path.includes('/compare/')
      ? { ...r, body: { status: 'ahead', commits: [{ sha: CONT }], files: [{ filename: 'content/pages/faq.json' }] } }
      : r));
    const { cfg, calls } = github([...deployOf(PAGE, 901, 'failure'), ...deployOf(CONT, 902, 'failure'), ...routes]);
    const db = store(page, contests);
    const out = await checkRun({ github: cfg, setDeployState: db.setDeployState, laterMainRuns: async () => [contests], log: () => {} }, page);
    expect(writes(calls)).toEqual([]);
    expect(out.deploy_state).toBe('revert_blocked');
  });

  it('a contests run whose own build failed (the run below went live) keeps the P5 rule: revert only while it is the head', async () => {
    const { cfg } = github([...deployOf(CONT, 902, 'failure'),
      { method: 'GET', path: `${R}/git/ref/heads/main`, body: { object: { sha: 'later000' } } }]);
    const live = { ...page, deploy_state: 'ready' as const };
    const db = store(live, contests);
    const out = await checkRun({
      github: cfg, setDeployState: db.setDeployState, log: () => {},
      laterMainRuns: async () => [], earlierContentRun: async () => live,
    }, contests);
    expect(out.deploy_state).toBe('revert_blocked');
  });
});
