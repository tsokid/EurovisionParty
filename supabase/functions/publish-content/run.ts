// The publish flow (spec §7), with every side effect injected so it can be
// unit-tested; index.ts wires it to Supabase and GitHub.
//
// begin_publish(cms) (caller's JWT) → publish_input (service role) →
// buildSnapshotFiles + cmsFiles (CMS drafts, validated, and titles /
// descriptions unique across the committed pages: one invalid draft
// refuses the whole publish) + vercel.json (merged against the commit's
// parent tree, so a push in between is never reverted) → one commit →
// end_publish. CMS warnings never block; they come back as `warnings`.
// The same commit appends this publish's SEO intent to seo-intent.json
// (_shared/cms/seoIntent.ts): the docs and contest data it changes, with
// the hard SEO fields each may change, for the build's SEO guard.
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
// Per-doc publish (CMS P5, migration 086). The request names the docs it
// ships (doc_ids; null = every unpublished draft plus the contests, the old
// "Publish all") and where (target):
// - main, doc_ids given: only those drafts, one content file each (plus the
//   media they reference and seo-intent.json). No contest snapshot and no
//   vercel.json rewrite: a page publish ships that page only.
// - main, doc_ids null: as before, minus the site-wide docs (Q3 = C: those
//   always go through a preview first).
// - preview (site-wide docs only): the same commit, but on the
//   content-preview branch, cut from main's head; Vercel builds it as a
//   preview deployment. Nothing is published, no media row is marked.
// - promote (a ready preview run): the preview commit's files, by blob sha,
//   committed onto main (the "go live" action), with the intent derived again.
// end_publish gets the versions shipped (doc_id, updated_at, data), so an
// edit saved while the run was in flight stays unpublished.
//
// Pure and Deno-free.
import { buildSnapshotFiles, type SnapshotInput } from './snapshot.ts';
import { cmsFiles, CmsValidationError, type CmsIssue } from './cmsFiles.ts';
import { generatedRedirects, mergeVercelRedirects } from './redirects.ts';
import { draftRefsLeft, imagesWithoutAlt, MEDIA_MAX_NEW_BYTES, MediaError, publishMedia, sweepStorage, type StorageSweepDeps } from './media.ts';
import type { BlobRef, CommitResult, DerivedFiles, FileTransforms } from './github.ts';
import { appendIntent, buildIntentEntry, SEO_INTENT_FILE } from '../_shared/cms/seoIntent.ts';
import { upgradeDocument } from '../_shared/cms/layoutUpgrade.ts';

/** One doc a run shipped: its draft version and the data committed (end_publish's p_shipped). */
export type ShippedDoc = { doc_id: string; updated_at: string | null; data: unknown };

export type EndPublishArgs = {
  id: number;
  status: 'ok' | 'noop' | 'error';
  sha: string | null;
  files: number | null;
  error: string | null;
  /** Present when CMS drafts were shipped (ok / noop). */
  shipped?: ShippedDoc[];
};

/** Where a commit goes: main (the site) or the content-preview branch (cut from main). */
export type PublishTarget = 'main' | 'preview';

/** The preview run a promote ships (publish_runs, service role). */
export type PreviewRun = { id: number; commit_sha: string; doc_ids: string[]; shipped: Array<{ doc_id: string; updated_at: string | null }> };

/** A file the preview commit changed: its blob, and its text for content/pages/*.json. */
export type PreviewFile = BlobRef & { path: string; text?: string };

export type PublishDeps = {
  rpc: {
    /**
     * begin_publish(p_cms, p_doc_ids, p_target, p_promote) as the calling
     * super admin. Returns the run id. `scope` is passed only when the
     * request is not the default full publish to main.
     */
    beginPublish(cms: boolean, scope?: PublishScope): Promise<number>;
    /** publish_input(p_doc_ids, p_skip_site_wide) as service role. */
    publishInput(filter?: { docIds: string[] | null; skipSiteWide: boolean }): Promise<SnapshotInput>;
    /** end_publish(...) as service role. */
    endPublish(args: EndPublishArgs): Promise<void>;
    /** The preview run a promote ships (service role). Only promotes call it. */
    previewRun?(id: number): Promise<PreviewRun>;
    /**
     * Whether run `id` is still running (service role). Asked just before
     * main moves: a run that a results publish took over (090) must not
     * commit late. Without it, no check.
     */
    stillRunning?(id: number): Promise<boolean>;
  };
  /** The files a commit changed against its first parent (promote). */
  commitChanges?(sha: string): Promise<PreviewFile[]>;
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
   * `derived` files (seo-intent.json) are computed from the changed paths
   * and added only when something else changed (github.ts).
   */
  commitFiles(
    files: Record<string, string | Uint8Array>,
    message: (changedPaths: string[]) => string,
    transforms: FileTransforms,
    limits: { maxNewBinaryBytes: number },
    derived?: DerivedFiles,
    /**
     * A preview commit goes to content-preview; existing blobs (a promote)
     * are referenced by sha; `guard` runs just before the branch moves and
     * refuses the commit by throwing.
     */
    extra?: { target?: PublishTarget; blobs?: Record<string, BlobRef>; guard?: () => Promise<void> },
  ): Promise<CommitResult>;
  /** CMS media: Storage (bucket cms-media, service role) and cms_media. */
  media: StorageSweepDeps & {
    /** The bytes of a cms-media object. */
    download(storagePath: string): Promise<Uint8Array>;
    /** media_mark_published(id, path) as service role. */
    markPublished(id: string, path: string): Promise<void>;
    /**
     * The public/media/ paths in the branch head. Read only when a referenced
     * row is already published: its file is then not downloaded again.
     */
    publishedPaths(): Promise<ReadonlySet<string>>;
  };
  /** Clock of the Storage sweep. Default: the current time. */
  now?: () => Date;
  /** Waits between a contests run's begin_publish retries (090). Default: setTimeout. */
  sleep?: (ms: number) => Promise<void>;
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
/**
 * A contests-only run retries begin_publish this many times, this far apart,
 * while another run is in flight: 100 s, longer than the 90 s after which
 * begin_publish lets the results take over a stuck run (090, final review I1).
 */
export const CONTESTS_RETRIES = 25;
export const CONTESTS_RETRY_MS = 4000;
/** begin_publish's takeover of a stuck "Publish all" or contests run (090). */
export const TAKEOVER_MS = 90_000;
/** begin_publish's refusal while the previous main deploy builds (086). */
export const DEPLOY_BUSY = 'publish already running (the previous deploy is still building)';

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

/** What a run ships beyond the default (every draft and the contests, to main). */
export type PublishScope = {
  /** Only these docs (086 begin_publish p_doc_ids); null: every unpublished draft and the contests. */
  docIds: string[] | null;
  target: PublishTarget;
  /** Promote this ready preview run to main. */
  promote: number | null;
};

export type PublishOptions = {
  /** Ship the CMS drafts too (default). false: contests only (lifecycle auto-publish). */
  cms: boolean;
} & Partial<PublishScope>;

const DOC_ID = /^[a-z0-9-]+$/;

/**
 * The options of a request body. `{ cms: false }` skips the CMS drafts;
 * `doc_ids` (a non-empty list of doc ids) ships only those; `target:
 * 'preview'` commits to content-preview; `promote: <run id>` ships a ready
 * preview. An invalid doc id list throws; anything else unknown is ignored.
 */
export function publishOptions(body: unknown): PublishOptions {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const out: PublishOptions = { cms: b.cms !== false };
  if (b.doc_ids !== undefined && b.doc_ids !== null) {
    if (!Array.isArray(b.doc_ids) || b.doc_ids.length === 0 || !b.doc_ids.every((d) => typeof d === 'string' && DOC_ID.test(d))) {
      throw new Error('doc_ids must be a non-empty list of document ids');
    }
    out.docIds = [...new Set(b.doc_ids as string[])].sort();
  }
  if (b.target === 'preview') out.target = 'preview';
  if (typeof b.promote === 'number' && Number.isInteger(b.promote) && b.promote > 0) out.promote = b.promote;
  return out;
}

/** The scope of a request, or undefined for the default full publish to main. */
function scopeOf(o: PublishOptions): PublishScope | undefined {
  const scope: PublishScope = { docIds: o.docIds ?? null, target: o.target ?? 'main', promote: o.promote ?? null };
  return scope.docIds === null && scope.target === 'main' && scope.promote === null ? undefined : scope;
}

export async function runPublish(deps: PublishDeps, options: PublishOptions = { cms: true }): Promise<PublishResult> {
  const { cms } = options;
  const scope = scopeOf(options);
  let id: number;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      id = await (scope ? deps.rpc.beginPublish(cms, scope) : deps.rpc.beginPublish(cms));
      break;
    } catch (e) {
      const m = message(e);
      if (!m.includes(BUSY)) throw e;
      // A contests-only run (the night-of auto-publish) never waits behind a
      // building deploy (090), only behind a run in flight, which takes
      // seconds: retry for a while instead of answering busy.
      if (!cms && !m.includes('deploy') && attempt < CONTESTS_RETRIES) {
        await sleep(CONTESTS_RETRY_MS);
        continue;
      }
      return { status: 'busy', run_id: null, sha: null, files_changed: 0, error: m.includes('deploy') ? DEPLOY_BUSY : BUSY };
    }
  }
  if (scope?.promote) return promote(deps, id, scope.promote);
  const docScoped = scope?.docIds != null;
  const target: PublishTarget = scope?.target ?? 'main';

  let result: CommitResult;
  let found: Warnings = {};
  let marks: Array<{ id: string; path: string }> = [];
  let shippedDocs: ShippedDoc[] = [];
  try {
    // A direct "publish all" to main never ships the site-wide docs (Q3 = C).
    const input = await deps.rpc.publishInput({ docIds: scope?.docIds ?? null, skipSiteWide: target === 'main' && !docScoped });
    // All built before anything is committed: a bad draft, a bad media
    // reference or bad contest data refuses it all.
    // A draft saved before the P6 page layouts ships with its extraBlocks folded into the layout.
    const drafts = cms ? (input.cms_documents ?? []).map((d) => ({ ...d, data: upgradeDocument(d.doc_id, d.data) as typeof d.data })) : [];
    const committed = drafts.length ? await deps.readCommittedPages() : {};
    // The drafts as saved are validated first, so media is only resolved for valid drafts.
    let pages = cmsFiles(drafts, committed);
    if (pages.warnings.length) found = { warnings: pages.warnings };
    const media = await publishMedia(drafts, input.media ?? [], (path) => deps.media.download(path), () => deps.media.publishedPaths());
    if (media.rewritten) pages = cmsFiles(media.drafts, committed);
    // Every image ships with alt text, its block's or the library's (088).
    const noAlt = imagesWithoutAlt(media.rewritten ? media.drafts : drafts);
    if (noAlt.length) throw new MediaError(noAlt);
    marks = media.marks;
    // A doc-scoped run ships those docs only: no contest snapshot.
    const files = { ...(docScoped ? {} : buildSnapshotFiles(input)), ...pages.files, ...media.files };
    // A cms-media/ left outside a media field would ship unrewritten and fail every build.
    const left = draftRefsLeft(files);
    if (left.length) throw new MediaError(left);
    const redirects = generatedRedirects(input.contests);
    const shipped = Object.fromEntries((media.rewritten ? media.drafts : drafts).map((d) => [d.doc_id, d.data]));
    shippedDocs = drafts.map((d) => ({ doc_id: d.doc_id, updated_at: d.updated_at ?? null, data: d.data }));
    const createdAt = (deps.now ?? (() => new Date()))().toISOString();
    const transforms: FileTransforms = docScoped ? {} : {
      'vercel.json': (current) => {
        if (current === null) throw new Error('vercel.json is missing from the branch');
        return mergeVercelRedirects(current, redirects);
      },
    };
    const msg = docScoped ? () => pageCommitMessage(drafts.map((d) => d.doc_id), target) : commitMessage;
    result = Object.keys(files).length === 0 ? { sha: null, changed: 0, paths: [] } : await deps.commitFiles(files, msg, transforms, { maxNewBinaryBytes: MEDIA_MAX_NEW_BYTES }, {
      // The SEO intent of this commit (spec §6): what the build's SEO guard may see change.
      [SEO_INTENT_FILE]: (current, changedPaths) => {
        const entry = buildIntentEntry({ id: `publish-${id}`, createdAt, changedPaths, drafts: shipped, committed });
        return entry ? appendIntent(current, entry) : null;
      },
    }, ...extraOf({ ...(target === 'preview' ? { target } : {}), guard: runGuard(deps, id) }));
  } catch (e) {
    if (e instanceof CmsValidationError && e.warnings.length) found = { warnings: e.warnings };
    const error = message(e);
    const warning = await tryEnd(deps, { id, status: 'error', sha: null, files: null, error });
    return { status: 'error', run_id: id, sha: null, files_changed: 0, error, ...warning, ...found };
  }

  const status = result.sha ? 'ok' : 'noop';
  const warnings: string[] = [];
  // A preview publishes nothing: its media rows are marked when it is promoted.
  const marked = target === 'preview' ? undefined : await markPublished(deps, marks);
  if (marked) warnings.push(marked);
  const ended = await tryEnd(deps, {
    id, status, sha: result.sha, files: result.changed, error: null,
    ...(shippedDocs.length ? { shipped: shippedDocs } : {}),
  });
  if (ended.warning) warnings.push(ended.warning);
  // After end_publish (I1): the sweep lists the whole bucket and must not
  // keep the run slot, which a results publish may be waiting for.
  if (cms) await sweep(deps);
  const warning = warnings.length ? { warning: warnings.join('; ') } : {};
  return { status, run_id: id, sha: result.sha, files_changed: result.changed, ...warning, ...found };
}

/** `content: publish faq` (a page publish) or `content: preview site-header` (a site-wide preview). */
export function pageCommitMessage(docIds: string[], target: PublishTarget): string {
  return `content: ${target === 'preview' ? 'preview' : 'publish'} ${[...docIds].sort().join(', ')}`;
}

const PAGE_PATH = /^content\/pages\/([a-z0-9-]+)\.json$/;

/**
 * Go live with a ready preview: the files of the preview commit, by blob sha,
 * as one commit on main; the SEO intent is derived again against main. The
 * run ships the versions the preview showed (an edit since stays unpublished).
 */
async function promote(deps: PublishDeps, id: number, previewId: number): Promise<PublishResult> {
  let result: CommitResult;
  let shipped: ShippedDoc[] = [];
  try {
    if (!deps.rpc.previewRun || !deps.commitChanges) throw new Error('promote is not wired');
    const preview = await deps.rpc.previewRun(previewId);
    const changed = (await deps.commitChanges(preview.commit_sha)).filter((f) => f.path !== SEO_INTENT_FILE);
    if (changed.length === 0) throw new Error(`preview commit ${preview.commit_sha.slice(0, 7)} changed no content`);
    const docs: Record<string, unknown> = {};
    for (const f of changed) {
      const m = PAGE_PATH.exec(f.path);
      if (m && f.text !== undefined) docs[m[1]] = JSON.parse(f.text);
    }
    const committed = await deps.readCommittedPages();
    const versions = new Map(preview.shipped.map((s) => [s.doc_id, s.updated_at]));
    shipped = preview.doc_ids.filter((d) => d in docs).map((d) => ({ doc_id: d, updated_at: versions.get(d) ?? null, data: docs[d] }));
    const blobs = Object.fromEntries(changed.map((f) => [f.path, { sha: f.sha, mode: f.mode }]));
    const createdAt = (deps.now ?? (() => new Date()))().toISOString();
    result = await deps.commitFiles({}, () => pageCommitMessage(preview.doc_ids, 'main'), {}, { maxNewBinaryBytes: MEDIA_MAX_NEW_BYTES }, {
      [SEO_INTENT_FILE]: (current, changedPaths) => {
        const entry = buildIntentEntry({ id: `publish-${id}`, createdAt, changedPaths, drafts: docs, committed });
        return entry ? appendIntent(current, entry) : null;
      },
    }, ...extraOf({ blobs, guard: runGuard(deps, id) }));
  } catch (e) {
    const error = message(e);
    const warning = await tryEnd(deps, { id, status: 'error', sha: null, files: null, error });
    return { status: 'error', run_id: id, sha: null, files_changed: 0, error, ...warning };
  }
  const status = result.sha ? 'ok' : 'noop';
  const ended = await tryEnd(deps, { id, status, sha: result.sha, files: result.changed, error: null, ...(shipped.length ? { shipped } : {}) });
  return { status, run_id: id, sha: result.sha, files_changed: result.changed, ...ended };
}

type CommitExtra = { target?: PublishTarget; blobs?: Record<string, BlobRef>; guard?: () => Promise<void> };

/** commitFiles' last argument, left out when it carries nothing. */
function extraOf(extra: CommitExtra): [CommitExtra] | [] {
  const set = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)) as CommitExtra;
  return Object.keys(set).length ? [set] : [];
}

/** The commit guard of run `id`: refuses when the run was closed while it ran (090 takeover, timeout). */
function runGuard(deps: PublishDeps, id: number): (() => Promise<void>) | undefined {
  const still = deps.rpc.stillRunning;
  if (!still) return undefined;
  return async () => {
    if (!(await still(id))) throw new Error(`publish ${id} was closed while it ran (timed out or taken over by a results publish); nothing was committed`);
  };
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
