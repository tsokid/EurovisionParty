// The publish flow (spec §7), with every side effect injected so it can be
// unit-tested; index.ts wires it to Supabase and GitHub.
//
// begin_publish (caller's JWT) → publish_input (service role) →
// buildSnapshotFiles + cmsFiles (CMS drafts, validated: one invalid draft
// refuses the whole publish) + vercel.json (merged against the commit's
// parent tree, so a push in between is never reverted) → one commit →
// end_publish. CMS warnings never block; they come back as `warnings`.
//
// A failing end_publish never hides the outcome: after a commit the SHA is
// still returned with a warning, and in the error path the original error
// is kept. The run row then stays running until begin_publish's 10-minute
// timeout closes it.
//
// Pure and Deno-free.
import { buildSnapshotFiles, type SnapshotInput } from './snapshot.ts';
import { cmsFiles, type CmsIssue } from './cmsFiles.ts';
import { generatedRedirects, mergeVercelRedirects } from './redirects.ts';
import type { CommitResult, FileTransforms } from './github.ts';

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
  /**
   * Commits the files (add/update only) as one commit. Each transform gets
   * its path's content in the commit's parent tree and returns the new text.
   */
  commitFiles(
    files: Record<string, string>,
    message: (changedPaths: string[]) => string,
    transforms: FileTransforms,
  ): Promise<CommitResult>;
};

/** CMS validation warnings, present only when there are any. */
type Warnings = { warnings?: CmsIssue[] };

export type PublishResult =
  | ({ status: 'ok' | 'noop'; run_id: number; sha: string | null; files_changed: number; warning?: string } & Warnings)
  | ({ status: 'error'; run_id: number; sha: null; files_changed: 0; error: string; warning?: string } & Warnings)
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

/** `content: publish <years>` from the changed contest files. No trailer: the admin authors these commits. */
export function commitMessage(changedPaths: string[]): string {
  const years = changedPaths
    .map((p) => /^content\/contests\/(\d{4})\.json$/.exec(p))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  return years.length ? `content: publish ${yearRanges(years)}` : 'content: publish';
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
  let cms: Warnings = {};
  try {
    const input = await deps.rpc.publishInput();
    // Both built before anything is committed: a bad draft or bad contest data refuses it all.
    const pages = cmsFiles(input.cms_documents);
    if (pages.warnings.length) cms = { warnings: pages.warnings };
    const files = { ...buildSnapshotFiles(input), ...pages.files };
    const redirects = generatedRedirects(input.contests);
    result = await deps.commitFiles(files, commitMessage, {
      'vercel.json': (current) => {
        if (current === null) throw new Error('vercel.json is missing from the branch');
        return mergeVercelRedirects(current, redirects);
      },
    });
  } catch (e) {
    const error = message(e);
    const warning = await tryEnd(deps, { id, status: 'error', sha: null, files: null, error });
    return { status: 'error', run_id: id, sha: null, files_changed: 0, error, ...warning, ...cms };
  }

  const status = result.sha ? 'ok' : 'noop';
  const warning = await tryEnd(deps, { id, status, sha: result.sha, files: result.changed, error: null });
  return { status, run_id: id, sha: result.sha, files_changed: result.changed, ...warning, ...cms };
}

/** end_publish; a failure becomes { warning } instead of an exception. */
async function tryEnd(deps: PublishDeps, args: EndPublishArgs): Promise<{ warning?: string }> {
  try {
    await deps.rpc.endPublish(args);
    return {};
  } catch (e) {
    return { warning: `end_publish failed: ${message(e)}` };
  }
}
