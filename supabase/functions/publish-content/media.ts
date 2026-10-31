// CMS media at publish (spec §7 "On Publish").
//
// A draft references an upload as cms-media/<uuid> (the cms_media row id) in
// its mediaRef fields. Publishing it:
//   1. collectMediaRefs finds those references by walking each draft with its
//      schema (a blocks() value only through the variant its `type` names).
//   2. Each reference must resolve to a cms_media row of the field's kind
//      (not an 800 w variant), and an image must have its variant row: else
//      the publish is refused (MediaError), before anything is downloaded.
//   3. The bytes to download (the rows' `bytes`, variants included) must not
//      exceed MEDIA_MAX_NEW_BYTES, checked before any download so an edge
//      function never holds more than that in memory. Each row's object is
//      then downloaded from Storage (injected) and its sha256 checked.
//   4. The file goes to public/media/<sha12>.<ext>, sha12 being the first 12
//      hex of its sha256; an image's variant goes beside it as
//      public/media/<sha12 of the image>-800.webp (the public CmsImage
//      derives the variant URL from the image's).
//   5. The references are rewritten to /media/<sha12>.<ext>; an image group
//      gets the image row's width and height, a video group its poster's.
// The rows to mark published (media_mark_published) are returned; the caller
// marks them only after the commit succeeded. A row whose file and any
// variant are already in the branch head under its content name is not
// downloaded again (nor counted): its reference is rewritten to that path,
// and it is marked when its published_path is not set yet. The branch is read
// only when a referenced row is published or the downloads exceed the cap.
//
// An image or video group that already holds a /media/ reference must carry
// its width and height (publish cannot recompute them without the row).
// draftRefsLeft refuses content still holding cms-media/ after the rewrite
// (a reference typed into a text, rich text or link field).
//
// sweepStorage deletes cms-media objects that have no cms_media row and are
// older than a day (an upload in flight has its object before its row).
//
// Pure and Deno-free: Storage and the database are injected.
import { CMS_DOC_TYPES, docTypeFor } from '../_shared/cms/registry.ts';
import { walkSchema, type Segment } from '../_shared/cms/walk.ts';
import type { MediaKind } from '../_shared/cms/fields.ts';
import type { CmsDocumentRow, MediaRow } from './snapshot.ts';
import { tooMuchNewMedia } from './github.ts';

export type { MediaRow };

/** A publish refuses to add more new media than this (bytes not yet in the repo). */
export const MEDIA_MAX_NEW_BYTES = 50 * 1024 * 1024;

/** An object without a cms_media row is swept only once it is this old. */
export const SWEEP_MIN_AGE_MS = 24 * 60 * 60 * 1000;

const EXT: Record<MediaKind, string> = { image: 'webp', video: 'mp4', captions: 'vtt' };

/** A draft reference: cms-media/<uuid>, lowercase (the schema's mediaRef rule). */
const DRAFT_REF = /^cms-media\/([0-9a-f-]{36})$/;

/** Errors listed in the message; the rest are counted ("+N more"). */
const LISTED = 20;

export class MediaError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    const head = `Media check failed: ${errors.length} error${errors.length === 1 ? '' : 's'}`;
    const more = errors.length > LISTED ? [`+${errors.length - LISTED} more`] : [];
    super([head, ...errors.slice(0, LISTED), ...more].join('\n'));
    this.name = 'MediaError';
    this.errors = errors;
  }
}

/** One cms-media/<uuid> reference in a draft. `path` is inside the locale (refs are locale-shared). */
export type MediaRef = { doc_id: string; path: string; id: string; kind: MediaKind };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The schema of a draft whose doc_type is registered and matches its doc_id (cmsFiles reports the rest). */
function schemaOf(doc: CmsDocumentRow) {
  if (doc.doc_type !== docTypeFor(doc.doc_id)) return undefined;
  return Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, doc.doc_type) ? CMS_DOC_TYPES[doc.doc_type].schema : undefined;
}

const LOCALES = ['en', 'el'] as const;

/** Every node of interest in one locale of a draft: its mediaRef strings and its image / video groups. */
function visitLocale(
  doc: CmsDocumentRow,
  value: unknown,
  onRef: (segments: Segment[], path: string, id: string, kind: MediaKind) => void,
  onGroup: (segments: Segment[], kind: 'image' | 'video', value: Record<string, unknown>) => void,
): void {
  const schema = schemaOf(doc);
  if (!schema || value === undefined) return;
  walkSchema(schema, (n) => {
    const v = n.values[0];
    if (n.meta.kind === 'mediaRef' && n.type === 'string' && typeof v === 'string') {
      const m = DRAFT_REF.exec(v);
      if (m) onRef(n.segments, n.path, m[1], n.meta.mediaKind!);
    } else if ((n.meta.kind === 'image' || n.meta.kind === 'video') && n.type === 'object' && isRecord(v)) {
      onGroup(n.segments, n.meta.kind, v);
    }
  }, [value]);
}

/** The cms-media/<uuid> references of the drafts, in document order, each (doc_id, path) once. */
export function collectMediaRefs(drafts: readonly CmsDocumentRow[]): MediaRef[] {
  const out: MediaRef[] = [];
  const seen = new Set<string>();
  for (const doc of drafts) {
    if (!isRecord(doc.data)) continue;
    for (const locale of LOCALES) {
      visitLocale(doc, doc.data[locale], (_s, path, id, kind) => {
        const key = `${doc.doc_id}\n${path}\n${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ doc_id: doc.doc_id, path, id, kind });
      }, () => {});
    }
  }
  return out;
}

const article = (kind: string) => (/^[aeiou]/.test(kind) ? `an ${kind}` : `a ${kind}`);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Cast: Uint8Array's generic buffer type differs across TS versions (Node vs Deno).
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type PublishedMedia = {
  /** public/media/... → the bytes to commit. */
  files: Record<string, Uint8Array>;
  /** The drafts with every reference rewritten and dimensions written (unchanged when they hold none). */
  drafts: CmsDocumentRow[];
  /** Whether any reference was rewritten (`drafts` then differ from the input). */
  rewritten: boolean;
  /** Every row written (main files and variants) with its /media/ path, for media_mark_published. */
  marks: Array<{ id: string; path: string }>;
};

const isDim = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0;

/** `doc_id path` of each image / video group whose published (/media/) source lacks width or height. */
function groupsWithoutDimensions(drafts: readonly CmsDocumentRow[]): string[] {
  const out = new Set<string>();
  for (const doc of drafts) {
    if (!isRecord(doc.data)) continue;
    for (const locale of LOCALES) {
      visitLocale(doc, doc.data[locale], () => {}, (segments, kind, value) => {
        const source = kind === 'image' ? value.media : value.poster;
        if (typeof source !== 'string' || !source.startsWith('/media/')) return;
        if (isDim(value.width) && isDim(value.height)) return;
        const what = kind === 'image' ? 'image' : 'video poster';
        out.add(`${doc.doc_id} ${segments.join('.')}: published ${what} ${source} has no width/height: pick the media again`);
      });
    }
  }
  return [...out];
}

/** /media/<sha12>.<ext>: the name a row's file is published under (sha12 = the first 12 hex of its sha256). */
const contentName = (row: MediaRow) => `/media/${row.sha256.toLowerCase().slice(0, 12)}.${EXT[row.kind]}`;

/** The /media/<sha12>.<ext> a row was published under, if it matches its own sha (else null: publish it again). */
function publishedName(row: MediaRow): string | null {
  const want = contentName(row);
  return row.published_path === want ? want : null;
}

/**
 * Resolves, downloads, verifies and names the media the drafts reference,
 * and rewrites the drafts to the published references. Throws MediaError
 * listing every problem; reference problems, and more than
 * MEDIA_MAX_NEW_BYTES to download, are found before any download.
 * `drafts` is not modified.
 */
export async function publishMedia(
  drafts: readonly CmsDocumentRow[],
  rows: readonly MediaRow[],
  download: (storagePath: string) => Promise<Uint8Array>,
  /** The public/media/ paths in the branch head; read only when a referenced row is already published. */
  publishedPaths: () => Promise<ReadonlySet<string>> = async () => new Set(),
): Promise<PublishedMedia> {
  const errors: string[] = groupsWithoutDimensions(drafts);
  const refs = collectMediaRefs(drafts);
  if (!refs.length) {
    if (errors.length) throw new MediaError(errors);
    return { files: {}, drafts: [...drafts], rewritten: false, marks: [] };
  }

  const byId = new Map(rows.map((r) => [r.id.toLowerCase(), r]));
  const variantOf = new Map(rows.filter((r) => r.variant_of).map((r) => [r.variant_of!.toLowerCase(), r]));

  // 1. Every reference resolves to a complete upload of the right kind.
  const used = new Map<string, MediaRow>();
  for (const ref of refs) {
    const at = `${ref.doc_id} ${ref.path}`;
    const row = byId.get(ref.id);
    if (!row) {
      errors.push(`${at}: media ${ref.id} not found`);
    } else if (row.variant_of) {
      errors.push(`${at}: media ${ref.id} is an 800 w variant, not an upload: pick the image itself`);
    } else if (row.kind !== ref.kind) {
      errors.push(`${at}: media ${ref.id} is ${article(row.kind)}, expected ${article(ref.kind)}`);
    } else if (row.kind === 'image' && !variantOf.has(ref.id)) {
      errors.push(`${at}: image ${ref.id} has no 800 w variant: the upload is incomplete, re-upload it`);
    } else {
      used.set(ref.id, row);
    }
  }
  if (errors.length) throw new MediaError(errors);

  // 2. Download and verify each file once, main rows before their variants.
  const files: Record<string, Uint8Array> = {};
  const marks: PublishedMedia['marks'] = [];
  const published = new Map<string, string>(); // row id → /media/<sha12>.<ext>
  const fetchVerified = async (row: MediaRow): Promise<Uint8Array | null> => {
    let bytes: Uint8Array;
    try {
      bytes = await download(row.storage_path);
    } catch (e) {
      errors.push(`media ${row.id} (${row.storage_path}): download failed: ${message(e)}`);
      return null;
    }
    const actual = await sha256Hex(bytes);
    if (actual !== row.sha256.toLowerCase()) {
      errors.push(`media ${row.id} (${row.storage_path}): sha256 mismatch: Storage has ${actual}, the row says ${row.sha256}`);
      return null;
    }
    return bytes;
  };
  const write = (row: MediaRow, name: string, bytes: Uint8Array) => {
    files[`public${name}`] = bytes;
    marks.push({ id: row.id, path: name });
  };
  // A row whose file (and an image's variant) is already in the branch under
  // its content name is reused: no download. The branch is read when a row
  // is published, or when the downloads would pass the cap (a file committed
  // by a run whose media_mark_published failed still counts as in the branch).
  const variantName = (name: string) => name.replace(/\.webp$/, '-800.webp');
  let inTree: ReadonlySet<string> | null = null;
  const inBranch = (row: MediaRow) => {
    const name = contentName(row);
    return !!inTree?.has(`public${name}`) && (row.kind !== 'image' || inTree.has(`public${variantName(name)}`));
  };
  const toDownload = () => [...used.values()].filter((r) => !inBranch(r));
  const downloadBytes = (list: MediaRow[]) =>
    list.reduce((n, r) => n + r.bytes + (r.kind === 'image' ? variantOf.get(r.id.toLowerCase())!.bytes : 0), 0);
  if ([...used.values()].some((r) => publishedName(r))) inTree = await publishedPaths();
  let pending = toDownload();
  if (downloadBytes(pending) > MEDIA_MAX_NEW_BYTES && inTree === null) {
    inTree = await publishedPaths();
    pending = toDownload();
  }
  const added = downloadBytes(pending);
  if (added > MEDIA_MAX_NEW_BYTES) throw new MediaError([tooMuchNewMedia(added, MEDIA_MAX_NEW_BYTES)]);

  for (const [id, row] of used) {
    const name = contentName(row);
    const variant = row.kind === 'image' ? variantOf.get(id)! : undefined;
    if (inBranch(row)) {
      published.set(id, name);
      // Not yet marked (a failed media_mark_published): mark it now, nothing to commit.
      if (row.published_path !== name) {
        marks.push({ id: row.id, path: name });
        if (variant) marks.push({ id: variant.id, path: variantName(name) });
      }
      continue;
    }
    const bytes = await fetchVerified(row);
    if (!bytes) continue;
    write(row, name, bytes);
    published.set(id, name);
    if (variant) {
      const vbytes = await fetchVerified(variant);
      if (vbytes) write(variant, variantName(name), vbytes);
    }
  }
  if (errors.length) throw new MediaError(errors);

  // 3. Rewrite the references; image and video groups get their dimensions.
  const rewritten = drafts.map((doc) => {
    if (!isRecord(doc.data)) return doc;
    const data = structuredClone(doc.data) as Record<string, unknown>;
    for (const locale of LOCALES) {
      const root = data[locale];
      const edits: Array<[Segment[], unknown]> = [];
      visitLocale(doc, root, (segments, _p, id) => {
        edits.push([segments, published.get(id)!]);
      }, (segments, kind, value) => {
        const source = kind === 'image' ? value.media : value.poster;
        const m = typeof source === 'string' ? DRAFT_REF.exec(source) : null;
        if (!m) return; // a published reference keeps the dimensions it carries
        const row = used.get(m[1])!;
        if (row.width) edits.push([[...segments, 'width'], row.width]);
        if (row.height) edits.push([[...segments, 'height'], row.height]);
      });
      for (const [segments, value] of edits) setAt(root, segments, value);
    }
    return { ...doc, data: data as CmsDocumentRow['data'] };
  });

  return { files, drafts: rewritten, rewritten: true, marks };
}

/** Sets `value` at `segments` inside `root` (whose containers exist). */
function setAt(root: unknown, segments: Segment[], value: unknown): void {
  let node = root as Record<string | number, unknown>;
  for (const seg of segments.slice(0, -1)) node = node[seg] as Record<string | number, unknown>;
  node[segments[segments.length - 1]] = value;
}

export type StorageSweepDeps = {
  /** The cms-media bucket's objects (files only). created_at null: age unknown, never swept. */
  listObjects(): Promise<Array<{ name: string; created_at: string | null }>>;
  /** Every cms_media.storage_path. */
  registeredPaths(): Promise<string[]>;
  removeObjects(names: string[]): Promise<void>;
};

/**
 * Deletes the cms-media objects that have no cms_media row and are older
 * than SWEEP_MIN_AGE_MS (orphans of an abandoned or failed upload, or of a
 * media_delete whose Storage removal failed). A registered object is never
 * deleted. Returns the names removed, sorted.
 */
export async function sweepStorage(deps: StorageSweepDeps, now: Date): Promise<string[]> {
  const [objects, registered] = await Promise.all([deps.listObjects(), deps.registeredPaths()]);
  // Case-insensitive on purpose: a name matching a row in any case is kept (errs toward keeping objects).
  const keep = new Set(registered.map((p) => p.toLowerCase()));
  const cutoff = now.getTime() - SWEEP_MIN_AGE_MS;
  const orphans = objects
    .filter((o) => !keep.has(o.name.toLowerCase()))
    .filter((o) => {
      const created = o.created_at ? Date.parse(o.created_at) : NaN;
      return Number.isFinite(created) && created < cutoff;
    })
    .map((o) => o.name)
    .sort();
  if (orphans.length) await deps.removeObjects(orphans);
  return orphans;
}

/** One page of cms_media.storage_path, ascending, after `after` (null: from the start), and the table's row count. */
export type StoragePathPage = (after: string | null) => Promise<{ paths: string[]; count: number | null }>;

/**
 * Every cms_media.storage_path, read by keyset pages (storage_path > the last
 * one) until an empty page. Throws unless the set collected has exactly the
 * row count the first page reported: the sweep then deletes nothing, never
 * an object whose row was missed.
 */
export async function collectRegisteredPaths(page: StoragePathPage): Promise<string[]> {
  const out = new Set<string>();
  let expected: number | null | undefined;
  let after: string | null = null;
  for (;;) {
    const { paths, count } = await page(after);
    if (expected === undefined) expected = count;
    if (!paths.length) break;
    for (const p of paths) out.add(p);
    const last = paths[paths.length - 1];
    if (after !== null && last <= after) throw new Error('cms_media: paging did not advance');
    after = last;
  }
  if (expected === null || expected === undefined || out.size !== expected) {
    throw new Error(`cms_media: read ${out.size} storage paths, expected ${expected ?? 'an unknown count'}`);
  }
  return [...out];
}

const DRAFT_ANYWHERE = /cms-media\//i;

/**
 * `doc_id path` (or the file path, outside content/pages) of every string
 * still holding a draft media reference (cms-media/, any case) in the
 * content/ files about to be committed: a reference outside a media field,
 * which publish does not rewrite and validate-content would fail the build on.
 */
export function draftRefsLeft(files: Record<string, string | Uint8Array>): string[] {
  const out: string[] = [];
  const msg = 'draft media reference (cms-media/) outside a media field: pick the file in an image, video or media field instead';
  for (const path of Object.keys(files).sort()) {
    const text = files[path];
    if (!path.startsWith('content/') || typeof text !== 'string' || !DRAFT_ANYWHERE.test(text)) continue;
    const where: string[] = [];
    const walk = (v: unknown, at: string[]) => {
      if (typeof v === 'string') {
        if (DRAFT_ANYWHERE.test(v)) where.push(at.join('.'));
      } else if (Array.isArray(v)) {
        v.forEach((x, i) => walk(x, [...at, String(i)]));
      } else if (isRecord(v)) {
        for (const [k, x] of Object.entries(v)) walk(x, [...at, k]);
      }
    };
    try {
      walk(JSON.parse(text), []);
    } catch {
      // not JSON: reported by file below
    }
    const page = /^content\/pages\/([a-z0-9-]+)\.json$/.exec(path);
    const label = page ? page[1] : path;
    if (where.length) for (const w of where) out.push(`${label} ${w}: ${msg}`);
    else out.push(`${label}: ${msg}`);
  }
  return out;
}
