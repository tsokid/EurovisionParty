// publish-content/run.ts: the publish flow with every side effect injected.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPublish, commitMessage, type PublishDeps } from '../../supabase/functions/publish-content/run';
import { buildSnapshotFiles, type SnapshotInput } from '../../supabase/functions/publish-content/snapshot';
import type { ContestRow } from '../../src/content/contests/types';

// LF as in the repo blob, whatever core.autocrlf did to the working copy.
const vercelJson = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8').replace(/\r\n/g, '\n');

function contest(year: number, city_slug: string, stage: ContestRow['stage']): ContestRow {
  return {
    year, host_iso: null, city: city_slug, city_slug,
    semi1_date: null, semi2_date: null, final_date: null,
    stage, indexable: false, cancelled: false,
  };
}

const input: SnapshotInput = {
  contests: [contest(2025, 'basel', 'archived'), contest(2026, 'vienna', 'archived'), contest(2027, 'burgas', 'current')],
  countries: [{ iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία', slug: 'austria', related_iso: [] }],
  entries: [],
  generated_at: '2026-11-01T12:00:00Z',
};

function deps(over: Partial<{
  begin: () => Promise<number>;
  commit: PublishDeps['commitFiles'];
}> = {}) {
  const log: string[] = [];
  const endPublish = vi.fn(async () => { log.push('end'); });
  const commitFiles = vi.fn(over.commit ?? (async (files: Record<string, string>, message: (p: string[]) => string) => {
    log.push('commit');
    const paths = ['content/contests/2026.json', 'vercel.json'];
    message(paths);
    void files;
    return { sha: 'commit1', changed: paths.length, paths };
  }));
  const d: PublishDeps = {
    rpc: {
      beginPublish: vi.fn(over.begin ?? (async () => { log.push('begin'); return 7; })),
      publishInput: vi.fn(async () => { log.push('input'); return input; }),
      endPublish,
    },
    readVercelJson: vi.fn(async () => { log.push('vercel'); return vercelJson; }),
    commitFiles,
  };
  return { d, log, endPublish, commitFiles };
}

describe('runPublish', () => {
  it('success: commits the snapshot plus merged vercel.json and ends the run ok', async () => {
    const { d, log, endPublish, commitFiles } = deps();
    expect(await runPublish(d)).toEqual({ status: 'ok', run_id: 7, sha: 'commit1', files_changed: 2 });
    expect(log).toEqual(['begin', 'input', 'vercel', 'commit', 'end']);
    expect(endPublish).toHaveBeenCalledWith({ id: 7, status: 'ok', sha: 'commit1', files: 2, error: null });

    const files = commitFiles.mock.calls[0][0] as Record<string, string>;
    const snapshot = buildSnapshotFiles(input);
    for (const [p, text] of Object.entries(snapshot)) expect(files[p], p).toBe(text);
    expect(Object.keys(files).sort()).toEqual([...Object.keys(snapshot), 'vercel.json'].sort());
    const sources = JSON.parse(files['vercel.json']).redirects.map((r: { source: string }) => r.source);
    expect(sources).toContain('/eurovision-2026');
    expect(sources).toContain('/eurovision-2025');
    expect(sources).not.toContain('/eurovision-2027');
  });

  it('noop: nothing changed, the run ends noop with no sha', async () => {
    const { d, endPublish } = deps({ commit: async () => ({ sha: null, changed: 0, paths: [] }) });
    expect(await runPublish(d)).toEqual({ status: 'noop', run_id: 7, sha: null, files_changed: 0 });
    expect(endPublish).toHaveBeenCalledWith({ id: 7, status: 'noop', sha: null, files: 0, error: null });
  });

  it('GitHub error: the run ends error with the message', async () => {
    const { d, endPublish } = deps({
      commit: async () => { throw new Error('GitHub 409 PATCH /repos/x/git/refs/heads/main: Update is not a fast forward'); },
    });
    expect(await runPublish(d)).toEqual({
      status: 'error', run_id: 7, sha: null, files_changed: 0,
      error: 'GitHub 409 PATCH /repos/x/git/refs/heads/main: Update is not a fast forward',
    });
    expect(endPublish).toHaveBeenCalledWith({
      id: 7, status: 'error', sha: null, files: null,
      error: 'GitHub 409 PATCH /repos/x/git/refs/heads/main: Update is not a fast forward',
    });
  });

  it('a snapshot error (bad data) also ends the run error and commits nothing', async () => {
    const { d, endPublish, commitFiles } = deps();
    d.rpc.publishInput = async () => ({ ...input, contests: [...input.contests, contest(2026, 'x', 'archived')] });
    const out = await runPublish(d);
    expect(out.status).toBe('error');
    expect(out).toMatchObject({ error: expect.stringMatching(/duplicate contest 2026/) });
    expect(commitFiles).not.toHaveBeenCalled();
    expect(endPublish).toHaveBeenCalledWith(expect.objectContaining({ id: 7, status: 'error' }));
  });

  it('begin_publish refusing a concurrent run: busy, nothing read, committed or ended', async () => {
    const { d, endPublish, commitFiles } = deps({
      begin: async () => { throw new Error('publish already running'); },
    });
    expect(await runPublish(d)).toEqual({ status: 'busy', run_id: null, sha: null, files_changed: 0, error: 'publish already running' });
    expect(d.rpc.publishInput).not.toHaveBeenCalled();
    expect(commitFiles).not.toHaveBeenCalled();
    expect(endPublish).not.toHaveBeenCalled();
  });

  it('any other begin_publish failure (e.g. forbidden) propagates', async () => {
    const { d } = deps({ begin: async () => { throw new Error('forbidden'); } });
    await expect(runPublish(d)).rejects.toThrow('forbidden');
  });
});

describe('commitMessage', () => {
  const trailer = '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

  it('names the changed contest years, collapsing consecutive runs', () => {
    expect(commitMessage(['content/contests/2026.json', 'vercel.json'])).toBe('content: publish 2026' + trailer);
    const all = Array.from({ length: 71 }, (_, i) => `content/contests/${1956 + i}.json`);
    expect(commitMessage([...all, 'content/site.json'])).toBe('content: publish 1956-2026' + trailer);
    expect(commitMessage(['content/contests/2024.json', 'content/contests/1999.json', 'content/contests/2025.json']))
      .toBe('content: publish 1999, 2024-2025' + trailer);
  });

  it('falls back when no contest file changed', () => {
    expect(commitMessage(['content/countries/gr.json'])).toBe('content: publish' + trailer);
  });
});
