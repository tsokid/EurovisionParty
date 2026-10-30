// The publish flow (spec §7), with every side effect injected so it can be
// unit-tested; index.ts wires it to Supabase and GitHub.
//
// begin_publish (caller's JWT) → publish_input (service role) →
// buildSnapshotFiles + merged vercel.json → one commit → end_publish.
//
// Pure and Deno-free.
import { buildSnapshotFiles, type SnapshotInput } from './snapshot.ts';
import { generatedRedirects, mergeVercelRedirects } from './redirects.ts';
import type { CommitResult } from './github.ts';

export const COMMIT_TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

export type EndPublishArgs = {
  id: number;
  status: 'ok' | 'noop' | 'error';
  sha: string | null;
  files: number | null;
  error: string | null;
};

export type PublishDeps = {
  rpc: {
    /** begin_publish() as the calling super admin. Returns the run id. */
    beginPublish(): Promise<number>;
    /** publish_input() as service role. */
    publishInput(): Promise<SnapshotInput>;
    /** end_publish(...) as service role. */
    endPublish(args: EndPublishArgs): Promise<void>;
  };
  /** Current vercel.json text on the target branch. */
  readVercelJson(): Promise<string>;
  /** Commits the files (add/update only) as one commit. */
  commitFiles(files: Record<string, string>, message: (changedPaths: string[]) => string): Promise<CommitResult>;
};

export type PublishResult =
  | { status: 'ok' | 'noop'; run_id: number; sha: string | null; files_changed: number }
  | { status: 'error'; run_id: number; sha: null; files_changed: 0; error: string }
  | { status: 'busy'; run_id: null; sha: null; files_changed: 0; error: string };

const BUSY = 'publish already running';

/** Years as "1956-1958, 1999". */
function yearRanges(years: number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

/** `content: publish <years>` from the changed contest files, plus the trailer. */
export function commitMessage(changedPaths: string[]): string {
  const years = changedPaths
    .map((p) => /^content\/contests\/(\d{4})\.json$/.exec(p))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  const subject = years.length ? `content: publish ${yearRanges(years)}` : 'content: publish';
  return `${subject}\n\n${COMMIT_TRAILER}`;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runPublish(deps: PublishDeps): Promise<PublishResult> {
  let id: number;
  try {
    id = await deps.rpc.beginPublish();
  } catch (e) {
    if (message(e).includes(BUSY)) return { status: 'busy', run_id: null, sha: null, files_changed: 0, error: BUSY };
    throw e;
  }

  let result: CommitResult;
  try {
    const input = await deps.rpc.publishInput();
    const files = buildSnapshotFiles(input);
    const vercelJson = await deps.readVercelJson();
    files['vercel.json'] = mergeVercelRedirects(vercelJson, generatedRedirects(input.contests));
    result = await deps.commitFiles(files, commitMessage);
  } catch (e) {
    const error = message(e);
    await deps.rpc.endPublish({ id, status: 'error', sha: null, files: null, error });
    return { status: 'error', run_id: id, sha: null, files_changed: 0, error };
  }

  const status = result.sha ? 'ok' : 'noop';
  await deps.rpc.endPublish({ id, status, sha: result.sha, files: result.changed, error: null });
  return { status, run_id: id, sha: result.sha, files_changed: result.changed };
}
