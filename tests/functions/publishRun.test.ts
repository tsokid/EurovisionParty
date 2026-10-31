// publish-content/run.ts: the publish flow with every side effect injected.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPublish, commitMessage, type PublishDeps } from '../../supabase/functions/publish-content/run';
import type { FileTransforms } from '../../supabase/functions/publish-content/github';
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
  const commitFiles = vi.fn(over.commit ?? (async (
    _files: Record<string, string>,
    message: (p: string[]) => string,
    transforms: FileTransforms,
  ) => {
    log.push('commit');
    transforms['vercel.json'](vercelJson);
    const paths = ['content/contests/2026.json', 'vercel.json'];
    message(paths);
    return { sha: 'commit1', changed: paths.length, paths };
  }));
  const d: PublishDeps = {
    rpc: {
      beginPublish: vi.fn(over.begin ?? (async () => { log.push('begin'); return 7; })),
      publishInput: vi.fn(async () => { log.push('input'); return input; }),
      endPublish,
    },
    commitFiles,
    readCommittedPages: vi.fn(async () => ({})),
    media: {
      download: vi.fn(async () => { throw new Error('no media in this test'); }),
      markPublished: vi.fn(async () => {}),
      publishedPaths: vi.fn(async () => new Set<string>()),
      listObjects: vi.fn(async () => []),
      registeredPaths: vi.fn(async () => []),
      removeObjects: vi.fn(async () => {}),
    },
  };
  return { d, log, endPublish, commitFiles };
}

describe('runPublish', () => {
  it('success: commits the snapshot, merges vercel.json against the base, ends the run ok', async () => {
    const { d, log, endPublish, commitFiles } = deps();
    expect(await runPublish(d)).toEqual({ status: 'ok', run_id: 7, sha: 'commit1', files_changed: 2 });
    expect(log).toEqual(['begin', 'input', 'commit', 'end']);
    expect(endPublish).toHaveBeenCalledWith({ id: 7, status: 'ok', sha: 'commit1', files: 2, error: null });

    const [files, , transforms] = commitFiles.mock.calls[0] as unknown as [Record<string, string>, unknown, FileTransforms];
    expect(files).toEqual(buildSnapshotFiles(input));
    expect(Object.keys(transforms)).toEqual(['vercel.json']);
    expect(() => transforms['vercel.json'](null)).toThrow(/missing/);
    const merged = transforms['vercel.json'](vercelJson);
    const redirects = JSON.parse(merged).redirects as Array<{ source: string; destination: string }>;
    const sources = redirects.map((r) => r.source);
    expect(sources).toContain('/eurovision-2026');
    expect(sources).toContain('/eurovision-2025');
    // 2027 is live: only its locale-detect hub redirects, no archive redirect.
    expect(redirects.filter((r) => r.source === '/eurovision-2027').map((r) => r.destination)).toEqual([
      '/el/eurovision-2027',
      '/en/eurovision-2027',
    ]);
  });

  it('noop: nothing changed, the run ends noop with no sha', async () => {
    const { d, endPublish } = deps({ commit: async () => ({ sha: null, changed: 0, paths: [] }) });
    expect(await runPublish(d)).toEqual({ status: 'noop', run_id: 7, sha: null, files_changed: 0 });
    expect(endPublish).toHaveBeenCalledWith({ id: 7, status: 'noop', sha: null, files: 0, error: null });
  });

  it('GitHub error: the run ends error with the message', async () => {
    const { d, endPublish } = deps({
      commit: async () => { throw new Error('GitHub 422 PATCH /repos/x/git/refs/heads/main: Update is not a fast forward'); },
    });
    expect(await runPublish(d)).toEqual({
      status: 'error', run_id: 7, sha: null, files_changed: 0,
      error: 'GitHub 422 PATCH /repos/x/git/refs/heads/main: Update is not a fast forward',
    });
    expect(endPublish).toHaveBeenCalledWith({
      id: 7, status: 'error', sha: null, files: null,
      error: 'GitHub 422 PATCH /repos/x/git/refs/heads/main: Update is not a fast forward',
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

  it('end_publish failing after a commit still returns the commit SHA, with a warning', async () => {
    const { d } = deps();
    d.rpc.endPublish = async () => { throw new Error('network down'); };
    expect(await runPublish(d)).toEqual({
      status: 'ok', run_id: 7, sha: 'commit1', files_changed: 2, warning: 'end_publish failed: network down',
    });
  });

  it('end_publish failing in the error path keeps the original error', async () => {
    const { d } = deps({ commit: async () => { throw new Error('GitHub 500 POST /x: boom'); } });
    d.rpc.endPublish = async () => { throw new Error('network down'); };
    expect(await runPublish(d)).toEqual({
      status: 'error', run_id: 7, sha: null, files_changed: 0,
      error: 'GitHub 500 POST /x: boom', warning: 'end_publish failed: network down',
    });
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
  it('has no trailer: the admin, not Claude, authors publish commits', () => {
    expect(commitMessage(['content/contests/2026.json'])).toBe('content: publish 2026');
  });

  it('names the changed contest years, collapsing consecutive runs', () => {
    expect(commitMessage(['content/contests/2026.json', 'vercel.json'])).toBe('content: publish 2026');
    const all = Array.from({ length: 71 }, (_, i) => `content/contests/${1956 + i}.json`);
    expect(commitMessage([...all, 'content/site.json'])).toBe('content: publish 1956-2026');
    expect(commitMessage(['content/contests/2024.json', 'content/contests/1999.json', 'content/contests/2025.json']))
      .toBe('content: publish 1999, 2024-2025');
  });

  it('falls back when no contest file changed', () => {
    expect(commitMessage(['content/countries/gr.json'])).toBe('content: publish');
  });
});
