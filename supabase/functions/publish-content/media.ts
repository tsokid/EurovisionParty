// CMS media at publish (spec §7 "On Publish").
//
// A draft references an upload as cms-media/<uuid> (the cms_media row id) in
// its mediaRef fields. Publishing it:
//   1. collectMediaRefs finds those references by walking each draft with its
//      schema (a blocks() value only through the variant its `type` names).
//   2. Each reference must resolve to a cms_media row of the field's kind
//      (not an 800 w variant), and an image must have its variant row: else
//      the publish is refused (MediaError), before anything is downloaded.
//   3. Each row's object is downloaded from Storage (injected) and its
//      sha256 checked against the row.
//   4. The file goes to public/media/<sha12>.<ext>, sha12 being the first 12
//      hex of its sha256; an image's variant goes beside it as
//      public/media/<sha12 of the image>-800.webp (the public CmsImage
//      derives the variant URL from the image's).
//   5. The references are rewritten to /media/<sha12>.<ext>; an image group
//      gets the image row's width and height, a video group its poster's.
// The rows to mark published (media_mark_published) are returned; the caller
// marks them only after the commit succeeded.
//
// sweepStorage deletes cms-media objects that have no cms_media row and are
// older than a day (an upload in flight has its object before its row).
//
// Pure and Deno-free: Storage and the database are injected.
import { CMS_DOC_TYPES, docTypeFor } from '../_shared/cms/registry.ts';
import { walkSchema, type Segment } from '../_shared/cms/walk.ts';
import type { MediaKind } from '../_shared/cms/fields.ts';
import type { CmsDocumentRow, MediaRow } from './snapshot.ts';

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
  /** Every row written (main files and variants) with its /media/ path, for media_mark_published. */
  marks: Array<{ id: string; path: string }>;
};

/**
 * Resolves, downloads, verifies and names the media the drafts reference,
 * and rewrites the drafts to the published references. Throws MediaError
 * listing every problem; reference problems are found before any download.
 * `drafts` is not modified.
 */
export async function publishMedia(
  drafts: readonly CmsDocumentRow[],
  rows: readonly MediaRow[],
  download: (storagePath: string) => Promise<Uint8Array>,
): Promise<PublishedMedia> {
  const refs = collectMediaRefs(drafts);
  if (!refs.length) return { files: {}, drafts: [...drafts], marks: [] };

  const byId = new Map(rows.map((r) => [r.id.toLowerCase(), r]));
  const variantOf = new Map(rows.filter((r) => r.variant_of).map((r) => [r.variant_of!.toLowerCase(), r]));

  // 1. Every reference resolves to a complete upload of the right kind.
  const errors: string[] = [];
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
  for (const [id, row] of used) {
    const bytes = await fetchVerified(row);
    if (!bytes) continue;
    const sha12 = row.sha256.toLowerCase().slice(0, 12);
    const name = `/media/${sha12}.${EXT[row.kind]}`;
    write(row, name, bytes);
    published.set(id, name);
    const variant = row.kind === 'image' ? variantOf.get(id)! : undefined;
    if (variant) {
      const vbytes = await fetchVerified(variant);
      if (vbytes) write(variant, `/media/${sha12}-800.webp`, vbytes);
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

  return { files, drafts: rewritten, marks };
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
