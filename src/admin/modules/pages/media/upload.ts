// Uploads to the media library (spec §7 "Media upload"). Each returns the
// draft reference `cms-media/<uuid>` of the new file.
//
// Image: decoded and resized in the browser to WebP, min(1600, source) and
// min(800, source) wide (never upscaled; both files always exist), each at
// most 2 MB. Order: upload the main file, register it, upload the 800 w copy,
// register it (variant_of = the main id). A failed step stops with an error
// naming it; objects already in Storage without a row are removed by the
// publish sweep, so nothing is rolled back here.
//
// Video: MP4 only, at most 20 MB (its poster is a separate image field).
// Captions: WebVTT, at most 200 KB.
//
// Limits mirror media_register (migration 077), which enforces them again.
import type { MediaKind } from '../../../../../supabase/functions/_shared/cms/fields';
import { formatError } from '../../../lib/formatError';
import { decodeImage, encodeWebp, sha256Hex } from './imageResize';
import { draftRef, invalidateLibrary, mediaRegister, uploadObject } from './mediaApi';

const MB = 1024 * 1024;
export const IMAGE_INPUT_MAX_BYTES = 15 * MB;
export const IMAGE_OUTPUT_MAX_BYTES = 2 * MB;
export const VIDEO_MAX_BYTES = 20 * MB;
export const CAPTIONS_MAX_BYTES = 200 * 1024;
export const IMAGE_WIDTH = 1600;
export const IMAGE_VARIANT_WIDTH = 800;

/** What the file input of each kind accepts. */
export const ACCEPT: Record<MediaKind, string> = {
  image: 'image/*',
  video: 'video/mp4,.mp4',
  captions: 'text/vtt,.vtt',
};

const fail = (file: File, message: string) => new Error(`Could not upload ${file.name}: ${message}`);

/** Runs one named step; a failure is reported with the file and the step. */
async function step<T>(file: File, name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw fail(file, `${name} failed: ${formatError(e)}`);
  }
}

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw fail(file, 'not an image');
  if (file.size > IMAGE_INPUT_MAX_BYTES) throw fail(file, 'larger than 15 MB');

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file);
  } catch {
    throw new Error(`Could not read ${file.name}: not an image this browser can open`);
  }
  let main, small;
  try {
    main = await encodeWebp(bitmap, IMAGE_WIDTH);
    small = await encodeWebp(bitmap, IMAGE_VARIANT_WIDTH);
  } catch (e) {
    throw fail(file, formatError(e));
  } finally {
    bitmap.close?.();
  }
  for (const f of [main, small]) {
    if (f.blob.size > IMAGE_OUTPUT_MAX_BYTES) throw fail(file, `the ${f.width} px WebP is larger than 2 MB`);
  }

  const id = crypto.randomUUID().toLowerCase();
  const [mainHash, smallHash] = await Promise.all([sha256Hex(main.blob), sha256Hex(small.blob)]);
  const mainPath = `${id}.webp`;
  const smallPath = `${id}-800.webp`;

  await step(file, 'uploading the main image', () => uploadObject(mainPath, main.blob, 'image/webp'));
  await step(file, 'registering the main image', () => mediaRegister({
    id, kind: 'image', storagePath: mainPath, mime: 'image/webp', bytes: main.blob.size,
    width: main.width, height: main.height, sha256: mainHash, variantOf: null,
  }));
  await step(file, 'uploading the 800 px copy', () => uploadObject(smallPath, small.blob, 'image/webp'));
  await step(file, 'registering the 800 px copy', () => mediaRegister({
    id: null, kind: 'image', storagePath: smallPath, mime: 'image/webp', bytes: small.blob.size,
    width: small.width, height: small.height, sha256: smallHash, variantOf: id,
  }));
  invalidateLibrary();
  return draftRef(id);
}

/** A single-file upload (video, captions): upload, then register. */
async function uploadFile(file: File, body: Blob, kind: MediaKind, ext: string, mime: string): Promise<string> {
  const id = crypto.randomUUID().toLowerCase();
  const path = `${id}.${ext}`;
  const sha256 = await sha256Hex(body);
  await step(file, 'uploading', () => uploadObject(path, body, mime));
  await step(file, 'registering', () => mediaRegister({
    id, kind, storagePath: path, mime, bytes: body.size, width: null, height: null, sha256, variantOf: null,
  }));
  invalidateLibrary();
  return draftRef(id);
}

export async function uploadVideo(file: File): Promise<string> {
  if (file.type !== 'video/mp4') throw fail(file, 'only MP4 (H.264) video is accepted');
  if (file.size > VIDEO_MAX_BYTES) throw fail(file, 'larger than 20 MB');
  return uploadFile(file, file, 'video', 'mp4', 'video/mp4');
}

export async function uploadCaptions(file: File): Promise<string> {
  // Browsers often report no type for .vtt: the name and the header decide.
  const vttName = /\.vtt$/i.test(file.name);
  if (!vttName && file.type !== 'text/vtt') throw fail(file, 'captions must be a WebVTT (.vtt) file');
  if (file.size > CAPTIONS_MAX_BYTES) throw fail(file, 'larger than 200 KB');
  const text = await file.text(); // UTF-8 decoding drops a byte order mark
  if (!/^WEBVTT(?:[ \t]|\r?\n|$)/.test(text)) throw fail(file, 'not a WebVTT file (it must start with WEBVTT)');
  return uploadFile(file, new Blob([text], { type: 'text/vtt' }), 'captions', 'vtt', 'text/vtt');
}

export function uploadMedia(kind: MediaKind, file: File): Promise<string> {
  switch (kind) {
    case 'image':
      return uploadImage(file);
    case 'video':
      return uploadVideo(file);
    case 'captions':
      return uploadCaptions(file);
  }
}
