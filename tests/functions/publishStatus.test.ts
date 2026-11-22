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
