// In-browser image processing for uploads: decode, resize to WebP, SHA-256.
// Never upscales: a source narrower than the target keeps its own size.

export const WEBP_QUALITY = 0.82;

export type Encoded = { blob: Blob; width: number; height: number };

/** Decodes an image file (EXIF orientation applied). Throws if the browser cannot read it. */
export function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** `bitmap` as WebP, `min(maxWidth, its width)` wide, aspect ratio kept. */
export async function encodeWebp(bitmap: ImageBitmap, maxWidth: number): Promise<Encoded> {
  const width = Math.min(maxWidth, bitmap.width);
  const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize images (no 2D canvas)');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
  // A browser without a WebP encoder silently returns PNG.
  if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP images: use a current Chrome, Edge or Firefox');
  return { blob, width, height };
}

const bytesOf = (blob: Blob): Promise<ArrayBuffer> =>
  typeof blob.arrayBuffer === 'function'
    ? blob.arrayBuffer()
    : new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(blob);
    });

/** Lowercase hex SHA-256 of the blob's bytes (what media_register and publish check). */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await bytesOf(blob));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
