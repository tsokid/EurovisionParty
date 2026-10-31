// The media RPCs of migration 077 and the private Storage bucket cms-media.
// Every call throws on failure (show it with formatError).
//
// Two caches, shared by the picker, the form widgets and the preview:
// - the library (media_list), refetched on demand (the picker opens, an
//   upload or a delete finished, a reference is not in it yet);
// - signed URLs, reused while they have more than SIGNED_URL_MIN_LEFT_MS left
//   (useMediaInfo re-signs them then, while a form or preview stays open).
import { supabase } from '../../../../lib/supabase';
import { formatError } from '../../../lib/formatError';
import type { MediaKind } from '../../../../../supabase/functions/_shared/cms/fields';

export const BUCKET = 'cms-media';

/** A row of media_list(). */
export type MediaRow = {
  id: string;
  kind: MediaKind;
  /** Object name in the bucket: <id>.webp, <parent>-800.webp, <id>.mp4, <id>.vtt. */
  storage_path: string;
  variant_of: string | null;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  published_path: string | null;
  created_at: string;
};

export type RegisterArgs = {
  /** The upload's uuid; null for an 800 w variant (its id is generated). */
  id: string | null;
  kind: MediaKind;
  storagePath: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  variantOf: string | null;
};

/** media_register: returns the row id. */
export async function mediaRegister(a: RegisterArgs): Promise<string> {
  const { data, error } = await supabase.rpc('media_register', {
    p_id: a.id,
    p_kind: a.kind,
    p_storage_path: a.storagePath,
    p_mime: a.mime,
    p_bytes: a.bytes,
    p_width: a.width,
    p_height: a.height,
    p_sha256: a.sha256,
    p_variant_of: a.variantOf,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('media_register returned no id');
  return data;
}

/** Uploads one object; never overwrites (a uuid name is new by construction). */
export async function uploadObject(path: string, body: Blob, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw error;
}

/**
 * Deletes a library file (never a variant id: media_delete refuses one) and,
 * for an image, its 800 w variant: media_delete removes the rows, refusing
 * with 'media in use by <doc_ids>' while a draft references them, and
 * returns their Storage paths, which are then removed from the bucket.
 */
export async function mediaDelete(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('media_delete', { p_id: id });
  if (error) throw error;
  invalidateLibrary();
  const paths = (data ?? []) as string[];
  for (const p of paths) signed.delete(p);
  if (!paths.length) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) {
    // The rows are gone, so the publish sweep removes the orphaned objects later.
    throw new Error(
      `The file was deleted from the library, but Storage could not remove it yet (${formatError(removeError)}); the next publish cleans it up`,
    );
  }
}

// ---- Library ---------------------------------------------------------------

let library: Promise<MediaRow[]> | null = null;

/** Every row of media_list(), newest first. `refresh` refetches. */
export function libraryRows(refresh = false): Promise<MediaRow[]> {
  if (!library || refresh) {
    const p = (async () => {
      const { data, error } = await supabase.rpc('media_list', { p_kind: null });
      if (error) throw error;
      return (data ?? []) as MediaRow[];
    })();
    library = p;
    p.catch(() => {
      if (library === p) library = null; // try again next time
    });
  }
  return library;
}

/** The library changed (an upload): the next libraryRows() refetches. */
export function invalidateLibrary(): void {
  library = null;
}

// ---- Signed URLs -----------------------------------------------------------

export const SIGNED_URL_TTL_S = 3600;
/** A cached URL with less than this left is signed again. */
export const SIGNED_URL_MIN_LEFT_MS = 300 * 1000;

const signed = new Map<string, { url: string; expires: number }>();

/**
 * Signed URLs of `paths` (bucket object names), { path: url }, and the
 * earliest expiry (ms epoch) among them, null when none. A URL reused from
 * the cache keeps its own expiry. A path Storage refuses is left out.
 */
export async function signedUrlsWithExpiry(paths: readonly string[]): Promise<{ urls: Record<string, string>; expires: number | null }> {
  const now = Date.now();
  const fresh = (p: string) => {
    const s = signed.get(p);
    return !!s && s.expires - now > SIGNED_URL_MIN_LEFT_MS;
  };
  const missing = [...new Set(paths)].filter((p) => !fresh(p));
  if (missing.length) {
    // A stale entry Storage refuses to re-sign is dropped, never returned (its expiry would schedule an immediate refresh).
    for (const p of missing) signed.delete(p);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_TTL_S);
    if (error) throw error;
    for (const d of data ?? []) {
      if (d.path && d.signedUrl && !d.error) signed.set(d.path, { url: d.signedUrl, expires: now + SIGNED_URL_TTL_S * 1000 });
    }
  }
  const urls: Record<string, string> = {};
  let expires: number | null = null;
  for (const p of paths) {
    const s = signed.get(p);
    if (!s) continue;
    urls[p] = s.url;
    expires = expires === null ? s.expires : Math.min(expires, s.expires);
  }
  return { urls, expires };
}

/** Signed URLs of `paths` (bucket object names), { path: url }; a path Storage refuses is left out. */
export async function signedUrls(paths: readonly string[]): Promise<Record<string, string>> {
  return (await signedUrlsWithExpiry(paths)).urls;
}

/** Test-only: forget the library and the signed URLs. */
export function __resetMediaCacheForTests(): void {
  library = null;
  signed.clear();
}

// ---- References ------------------------------------------------------------

const DRAFT_REF = /^cms-media\/([0-9a-f-]{36})$/;

/** The cms_media id of a draft reference `cms-media/<uuid>`, else null. */
export const draftId = (ref: unknown): string | null => (typeof ref === 'string' ? DRAFT_REF.exec(ref)?.[1] ?? null : null);

export const draftRef = (id: string) => `cms-media/${id.toLowerCase()}`;

/** Every draft media id referenced anywhere in `value` (a document or part of one). */
export function draftIdsIn(value: unknown): string[] {
  const json = JSON.stringify(value ?? null);
  return [...new Set([...json.matchAll(/"cms-media\/([0-9a-f-]{36})"/g)].map((m) => m[1]))].sort();
}
