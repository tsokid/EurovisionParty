// The publish flow (spec §7), with every side effect injected so it can be
// unit-tested; index.ts wires it to Supabase and GitHub.
//
// begin_publish(cms) (caller's JWT) → publish_input (service role) →
// buildSnapshotFiles + cmsFiles (CMS drafts, validated, and titles /
// descriptions unique across the committed pages: one invalid draft
// refuses the whole publish) + vercel.json (merged against the commit's
// parent tree, so a push in between is never reverted) → one commit →
// end_publish. CMS warnings never block; they come back as `warnings`.
//
// CMS drafts (I3): publish_input returns only the drafts saved since the
// last publish that shipped CMS drafts, so a published draft is never
// re-validated or re-written. With { cms: false } (the contest lifecycle
// auto-publish) drafts are skipped entirely: contests only, and the run is
// recorded as cms = false so the drafts stay unpublished.
//
// CMS media (media.ts), with the drafts and gated the same way: the files
// the drafts reference (cms-media/<uuid>) are downloaded, verified and
// committed as public/media/<sha12>.<ext> binary blobs in the same commit,
// with the references rewritten to /media/... . A missing or wrong-kind
// row, an incomplete image upload or a sha256 mismatch refuses the publish;
// so does more than MEDIA_MAX_NEW_BYTES of media new to the repo. Only after
// the commit succeeded are the rows marked published (a failure there is a
// warning) and the orphaned Storage objects swept (a failure there is only
// logged).
//
// A failing end_publish never hides the outcome: after a commit the SHA is
// still returned with a warning, and in the error path the original error
// is kept. The run row then stays running until begin_publish's 10-minute
// timeout closes it.
//
// Pure and Deno-free.
import { buildSnapshotFiles, type SnapshotInput } from './snapshot.ts';
import { cmsFiles, CmsValidationError, type CmsIssue } from './cmsFiles.ts';
import { generatedRedirects, mergeVercelRedirects } from './redirects.ts';
import { MEDIA_MAX_NEW_BYTES, publishMedia, sweepStorage, type StorageSweepDeps } from './media.ts';
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
    /** begin_publish(p_cms) as the calling super admin. Returns the run id. */
    beginPublish(cms: boolean): Promise<number>;
    /** publish_input() as service role. */
    publishInput(): Promise<SnapshotInput>;
    /** end_publish(...) as service role. */
    endPublish(args: EndPublishArgs): Promise<void>;
  };
  /**
   * The committed content/pages/*.json of the branch head, as { doc_id:
   * document }: the base of the cross-page title/description check. Read
   * only when there are drafts to ship.
   */
  readCommittedPages(): Promise<Record<string, unknown>>;
  /**
   * Commits the files (add/update only; text, or bytes for media) as one
   * commit. Each transform gets its path's content in the commit's parent
   * tree and returns the new text. Refuses, writing nothing, when the binary
   * files new to the tree total more than limits.maxNewBinaryBytes.
   */
  commitFiles(
    files: Record<string, string | Uint8Array>,
    message: (changedPaths: string[]) => string,
    transforms: FileTransforms,
    limits: { maxNewBinaryBytes: number },
  ): Promise<CommitResult>;
  /** CMS media: Storage (bucket cms-media, service role) and cms_media. */
  media: StorageSweepDeps & {
    /** The bytes of a cms-media object. */
    download(storagePath: string): Promise<Uint8Array>;
    /** media_mark_published(id, path) as service role. */
    markPublished(id: string, path: string): Promise<void>;
  };
  /** Clock of the Storage sweep. Default: the current time. */
  now?: () => Date;
  /** Where a failed Storage sweep is reported. Default: console.error. */
  log?: (message: string) => void;
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

export type PublishOptions = {
  /** Ship the CMS drafts too (default). false: contests only (lifecycle auto-publish). */
  cms: boolean;
};

/** The options of a request body: `{ cms: false }` skips the CMS drafts; anything else ships them. */
export function publishOptions(body: unknown): PublishOptions {
  const cms = body && typeof body === 'object' ? (body as Record<string, unknown>).cms : undefined;
  return { cms: cms !== false };
}

export async function runPublish(deps: PublishDeps, { cms }: PublishOptions = { cms: true }): Promise<PublishResult> {
  let id: number;
  try {
    id = await deps.rpc.beginPublish(cms);
  } catch (e) {
    if (message(e).includes(BUSY)) return { status: 'busy', run_id: null, sha: null, files_changed: 0, error: BUSY };
    throw e;
  }

  let result: CommitResult;
  let found: Warnings = {};
  let marks: Array<{ id: string; path: string }> = [];
  try {
    const input = await deps.rpc.publishInput();
    // All built before anything is committed: a bad draft, a bad media
    // reference or bad contest data refuses it all.
    const drafts = cms ? input.cms_documents ?? [] : [];
    const committed = drafts.length ? await deps.readCommittedPages() : {};
    // The drafts as saved are validated first, so media is only resolved for valid drafts.
    let pages = cmsFiles(drafts, committed);
    if (pages.warnings.length) found = { warnings: pages.warnings };
    const media = await publishMedia(drafts, input.media ?? [], (path) => deps.media.download(path));
    if (media.marks.length) pages = cmsFiles(media.drafts, committed);
    marks = media.marks;
    const files = { ...buildSnapshotFiles(input), ...pages.files, ...media.files };
    const redirects = generatedRedirects(input.contests);
    result = await deps.commitFiles(files, commitMessage, {
      'vercel.json': (current) => {
        if (current === null) throw new Error('vercel.json is missing from the branch');
        return mergeVercelRedirects(current, redirects);
      },
    }, { maxNewBinaryBytes: MEDIA_MAX_NEW_BYTES });
  } catch (e) {
    if (e instanceof CmsValidationError && e.warnings.length) found = { warnings: e.warnings };
    const error = message(e);
    const warning = await tryEnd(deps, { id, status: 'error', sha: null, files: null, error });
    return { status: 'error', run_id: id, sha: null, files_changed: 0, error, ...warning, ...found };
  }

  const status = result.sha ? 'ok' : 'noop';
  const warnings: string[] = [];
  const marked = await markPublished(deps, marks);
  if (marked) warnings.push(marked);
  if (cms) await sweep(deps);
  const ended = await tryEnd(deps, { id, status, sha: result.sha, files: result.changed, error: null });
  if (ended.warning) warnings.push(ended.warning);
  const warning = warnings.length ? { warning: warnings.join('; ') } : {};
  return { status, run_id: id, sha: result.sha, files_changed: result.changed, ...warning, ...found };
}

/**
 * media_mark_published for every media row in the publish (after the commit;
 * idempotent, so a no-op publish re-marks harmlessly). A failure becomes a
 * warning: the files are committed either way.
 */
async function markPublished(deps: PublishDeps, marks: Array<{ id: string; path: string }>): Promise<string | undefined> {
  const failed: string[] = [];
  for (const { id, path } of marks) {
    try {
      await deps.media.markPublished(id, path);
    } catch (e) {
      failed.push(`${id}: ${message(e)}`);
    }
  }
  return failed.length ? `media_mark_published failed: ${failed.join(', ')}` : undefined;
}

/** Deletes orphaned cms-media objects; a failure is logged, never fails the publish. */
async function sweep(deps: PublishDeps): Promise<void> {
  try {
    await sweepStorage(deps.media, (deps.now ?? (() => new Date()))());
  } catch (e) {
    (deps.log ?? console.error)(`publish-content: storage sweep failed: ${message(e)}`);
  }
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
