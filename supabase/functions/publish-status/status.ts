// The deploy state of a publish run (CMS P5, spec §6 "Triggering Vercel",
// "Failure handling", §9), with every side effect injected so it can be
// unit-tested; index.ts wires it to Supabase and GitHub.
//
// Vercel's GitHub integration records every build of a commit as a GitHub
// Deployment (environment "Production" for main, "Preview" for a branch) and
// posts its statuses there, with the deployment URL. So the state is read
// with the token publish-content already has (GitHub permission "Deployments:
// read"; no Vercel token). When a commit has no deployment yet, the combined
// commit status is read as a fallback (the "Vercel" context, permission
// "Commit statuses: read"); with neither, the run stays «building».
//
//   GitHub deployment status          deploy_state
//   queued, pending, in_progress      building
//   success, inactive (superseded)    ready (deploy_url = environment_url)
//   failure, error                    error
//
// Auto-revert (main content runs only; a contests-only run, the results, is
// never reverted): when the build of a run's commit failed,
// Vercel keeps the previous production deployment, but main is red. The run's
// commit is reverted (a new commit with its parent's tree) ONLY IF main's
// head is still that commit; otherwise nothing is written, the state becomes
// revert_blocked with a note, and the admin shows the alert (spec §9: never
// revert someone else's work). A preview's failed build is only reported:
// the content-preview branch is scratch space and main is untouched.
//
// Pure and Deno-free.
import { revertFilesOnHead, revertHead } from '../publish-content/github.ts';

export type DeployState = 'building' | 'ready' | 'error' | 'reverted' | 'revert_blocked';

/** The publish_runs columns this module reads. */
export type RunRow = {
  id: number;
  status: 'running' | 'ok' | 'noop' | 'error';
  target: 'main' | 'preview';
  commit_sha: string | null;
  finished_at: string | null;
  deploy_state: DeployState | null;
  deploy_url: string | null;
  deploy_note: string | null;
  reverted_sha: string | null;
  doc_ids: string[] | null;
  /** false: a contests-only publish (the lifecycle / parser auto-publish). */
  cms?: boolean;
  deploy_checked_at?: string | null;
};

export type GitHubConfig = {
  token: string;
  repo: string;
  /** main */
  branch: string;
  fetch: typeof fetch;
  apiBase?: string;
};

export type Observed = { state: 'building' | 'ready' | 'error'; url: string | null; detail: string | null };

type Deployment = { id: number; sha: string; environment: string; created_at: string };
type DeploymentStatus = { state: string; environment_url?: string | null; target_url?: string | null; description?: string | null };
type CombinedStatus = { state: string; statuses: Array<{ context: string; state: string; target_url?: string | null; description?: string | null }> };

function client(gh: GitHubConfig) {
  const base = gh.apiBase ?? 'https://api.github.com';
  return async function get<T>(path: string): Promise<T> {
    const res = await gh.fetch(base + path, {
      method: 'GET',
      headers: { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`GitHub ${res.status} GET ${path}: ${text.slice(0, 200) || res.statusText}`);
    return (text ? JSON.parse(text) : null) as T;
  };
}

const READY = new Set(['success', 'inactive']);
const FAILED = new Set(['failure', 'error']);

/** Production for a main run, anything else (Preview) for a preview run. */
const fits = (target: RunRow['target'], env: string) => (target === 'main' ? /^production$/i.test(env) : !/^production$/i.test(env));

/** The state of the Vercel build of `sha`, from GitHub. */
export async function observeDeploy(gh: GitHubConfig, sha: string, target: RunRow['target']): Promise<Observed> {
  const get = client(gh);
  const repo = `/repos/${gh.repo}`;
  const all = await get<Deployment[]>(`${repo}/deployments?sha=${encodeURIComponent(sha)}&per_page=20`);
  const mine = (all ?? []).filter((d) => d.sha === sha && fits(target, d.environment));
  const deployment = [...mine].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (deployment) {
    const statuses = await get<DeploymentStatus[]>(`${repo}/deployments/${deployment.id}/statuses?per_page=1`);
    const s = statuses?.[0];
    if (!s) return { state: 'building', url: null, detail: null };
    const url = s.environment_url || s.target_url || null;
    if (READY.has(s.state)) return { state: 'ready', url, detail: null };
    if (FAILED.has(s.state)) return { state: 'error', url, detail: s.description ?? null };
    return { state: 'building', url, detail: null };
  }
  // No deployment recorded yet: the commit status of the Vercel integration, if any.
  const combined = await get<CombinedStatus>(`${repo}/commits/${encodeURIComponent(sha)}/status`);
  const vercel = (combined?.statuses ?? []).find((s) => /vercel/i.test(s.context));
  if (!vercel) return { state: 'building', url: null, detail: null };
  if (vercel.state === 'success') return { state: 'ready', url: null, detail: null };
  if (FAILED.has(vercel.state)) return { state: 'error', url: vercel.target_url ?? null, detail: vercel.description ?? null };
  return { state: 'building', url: null, detail: null };
}

export type StatusDeps = {
  github: GitHubConfig;
  /** set_deploy_state(run, state, url, reverted_sha, note) as service role; returns the run. */
  setDeployState(args: { id: number; state: DeployState; url: string | null; revertedSha: string | null; note: string | null }): Promise<RunRow>;
  /** The ok main runs with a commit after `run` (id order). Without it, a failed run is reverted only while it is main's head. */
  laterMainRuns?(run: RunRow): Promise<RunRow[]>;
  /**
   * For a contests-only run: the content run committed before it, whatever
   * its age, whose deploy had not gone live when it landed (culpritBelow), or
   * null.
   */
  earlierContentRun?(run: RunRow): Promise<RunRow | null>;
  log?: (message: string) => void;
};

/** States that never change again (a failed main build may still need its revert). */
const settled = (run: RunRow) =>
  run.deploy_state === 'ready' || run.deploy_state === 'reverted' || run.deploy_state === 'revert_blocked' ||
  (run.deploy_state === 'error' && run.target === 'preview');

export const revertMessage = (run: RunRow) =>
  `content: revert publish ${run.id} (the Vercel build of ${run.commit_sha!.slice(0, 7)} failed)`;

export const scopedRevertMessage = (run: RunRow) =>
  `content: revert the files of publish ${run.id} (the Vercel build of ${run.commit_sha!.slice(0, 7)} failed; the contests published since stay)`;

export const liveViaNote = (later: RunRow) =>
  `live with publish ${later.id} (${later.commit_sha!.slice(0, 7)}), which built on top of this one`;

export const inheritedNote = (below: RunRow, via: string) =>
  `this build failed because of publish ${below.id}; its files were put back in ${via.slice(0, 7)}, which carries these results`;

export const waitingNote = (below: RunRow) =>
  `this build includes publish ${below.id}, whose deploy is not settled yet`;

export const blockedBelowNote = (below: RunRow) =>
  `this build failed because of publish ${below.id}, which could not be reverted automatically. Fix it; these results are not reverted.`;

export const ownFailureNote =
  'the build of these results failed, and no content publish below it is broken. Results are never reverted automatically: fix the data or the build, then publish the results again.';

/**
 * The content run a failed contests-only run inherited its failure from
 * (B1): `below` are the content runs committed before it on main, newest
 * first, whatever their age. The first one that went live (ready, or an old
 * run with no deploy state) means main was green under the contests run:
 * null. A run reverted before the contests run landed is skipped (the
 * contests run built on the revert). Anything else (building, error,
 * revert_blocked, or reverted after the contests run landed) is the culprit.
 */
export function culpritBelow(run: Pick<RunRow, 'finished_at'>, below: readonly RunRow[]): RunRow | null {
  for (const b of below) {
    if (b.deploy_state === 'ready' || b.deploy_state == null) return null;
    if (b.deploy_state === 'reverted' && b.deploy_checked_at && run.finished_at && b.deploy_checked_at < run.finished_at) continue;
    return b;
  }
  return null;
}

export const blockedNote = (head: string) =>
  `main moved on to ${head.slice(0, 7)} after this publish: not reverting automatically. Fix the content or revert by hand.`;

/**
 * Reads the deploy of one run and records it; on a failed main build,
 * reverts the run's commit if main's head is still that commit. Returns the
 * run as recorded. A run without a commit (noop, error, running) is returned
 * as it is.
 */
export async function checkRun(deps: StatusDeps, run: RunRow): Promise<RunRow> {
  if (run.status !== 'ok' || !run.commit_sha || settled(run)) return run;

  let observed: Observed;
  if (run.deploy_state === 'error') {
    observed = { state: 'error', url: run.deploy_url, detail: run.deploy_note };
  } else {
    observed = await observeDeploy(deps.github, run.commit_sha, run.target);
  }

  if (observed.state !== 'error') {
    if (observed.state === run.deploy_state && (observed.url ?? null) === (run.deploy_url ?? null)) return run;
    return deps.setDeployState({ id: run.id, state: observed.state, url: observed.url, revertedSha: null, note: null });
  }

  const failed = await deps.setDeployState({ id: run.id, state: 'error', url: observed.url, revertedSha: null, note: observed.detail });
  if (run.target !== 'main') return failed;

  // A contests-only run (the results) is never reverted (B1), whether or not
  // it is main's head. On top of a content run that had not gone live, the
  // build failed because of that run: that run is dealt with instead.
  // Otherwise the failure is the results' own: revert_blocked, for a human.
  if (run.cms === false) {
    const below = deps.earlierContentRun ? await deps.earlierContentRun(run) : null;
    const outcome = below ? await inherited(deps, run, below, observed) : null;
    if (outcome) return outcome;
    (deps.log ?? console.error)(`publish-status: run ${run.id}: ${ownFailureNote}`);
    return deps.setDeployState({ id: run.id, state: 'revert_blocked', url: observed.url, revertedSha: null, note: ownFailureNote });
  }

  try {
    const outcome = await revertHead({ ...deps.github, sha: run.commit_sha, message: revertMessage(run) });
    if ('reverted' in outcome) {
      return deps.setDeployState({ id: run.id, state: 'reverted', url: observed.url, revertedSha: outcome.reverted, note: observed.detail });
    }
    const scoped = await revertUnderContests(deps, run, observed, failed);
    if (scoped) return scoped;
    (deps.log ?? console.error)(`publish-status: run ${run.id}: ${blockedNote(outcome.blocked)}`);
    return deps.setDeployState({ id: run.id, state: 'revert_blocked', url: observed.url, revertedSha: null, note: blockedNote(outcome.blocked) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    (deps.log ?? console.error)(`publish-status: run ${run.id}: revert failed: ${msg}`);
    return deps.setDeployState({ id: run.id, state: 'revert_blocked', url: observed.url, revertedSha: null, note: `revert failed: ${msg}` });
  }
}

/**
 * A failed content run that only contests-only publishes landed on top of
 * (090: they do not wait for its build). If the latest of them built, this
 * run's content is live with it: ready. While it builds: undecided (the run
 * stays error and is checked again). If it failed too: this run's files are
 * put back on top of main (revertFilesOnHead; the contests never share a
 * file with a page), so the results go live with the revert commit.
 * Returns null when anything else landed on top (then revert_blocked).
 */
async function revertUnderContests(deps: StatusDeps, run: RunRow, observed: Observed, failed: RunRow): Promise<RunRow | null> {
  if (run.cms === false || !deps.laterMainRuns) return null;
  const later = (await deps.laterMainRuns(run)).filter((r) => r.commit_sha);
  if (!later.length || !later.every((r) => r.cms === false)) return null;
  const last = later[later.length - 1];
  const top = await observeDeploy(deps.github, last.commit_sha!, 'main');
  if (top.state === 'ready') return deps.setDeployState({ id: run.id, state: 'ready', url: top.url, revertedSha: null, note: liveViaNote(last) });
  if (top.state === 'building') return failed;
  const contests = new Set(later.map((r) => r.commit_sha!));
  const outcome = await revertFilesOnHead({
    ...deps.github,
    sha: run.commit_sha!,
    message: scopedRevertMessage(run),
    allowAbove: (shas) => shas.every((s) => contests.has(s)),
  });
  if (!('reverted' in outcome)) return null;
  return deps.setDeployState({ id: run.id, state: 'reverted', url: observed.url, revertedSha: outcome.reverted, note: observed.detail });
}

/** A contests-only run whose build failed because of the content run below it (see checkRun). */
async function inherited(deps: StatusDeps, run: RunRow, below: RunRow, observed: Observed): Promise<RunRow | null> {
  const p = await checkRun(deps, below);
  // The run below went live: this failure is the contests run's own.
  if (p.deploy_state === 'ready') return null;
  if (p.deploy_state === 'reverted' && p.reverted_sha) {
    const via = await observeDeploy(deps.github, p.reverted_sha, 'main');
    const note = inheritedNote(p, p.reverted_sha);
    if (via.state === 'error') {
      return deps.setDeployState({ id: run.id, state: 'revert_blocked', url: observed.url, revertedSha: null, note: `${note}; that build failed too. These results are not reverted.` });
    }
    return deps.setDeployState({ id: run.id, state: via.state, url: via.url, revertedSha: null, note });
  }
  if (p.deploy_state === 'revert_blocked') {
    return deps.setDeployState({ id: run.id, state: 'revert_blocked', url: observed.url, revertedSha: null, note: blockedBelowNote(p) });
  }
  // The run below is still undecided: stay failed (checked again on the next poll), never revert the results.
  return deps.setDeployState({ id: run.id, state: 'error', url: observed.url, revertedSha: null, note: waitingNote(p) });
}
