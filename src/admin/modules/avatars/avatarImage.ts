// The browser side of adding an avatar: a square crop of the dropped image,
// drawn to 96px (every in-game avatar) and 512px (the avatar viewer) WebP
// with canvas toBlob('image/webp'), and a title from the file name.
// Pure helpers (cropRect, cropBackground, titleFromFilename, newAvatarId)
// are unit-tested; renderSquareWebp needs a real canvas.

/** The two files every avatar has: 96px thumb, 512px full. */
export const AVATAR_SIZES = { thumb: 96, full: 512 } as const;
export const AVATAR_WEBP_QUALITY = 0.86;
/** Under this side (px) the 512px file is an upscale: the admin says so. */
export const MIN_SOURCE_SIDE = 512;
/** Files the drop zone takes. */
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'] as const;
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/** Where the square is, in the source: zoom ≥ 1 (1 = the largest square), centre in 0..1. */
export interface Crop {
  zoom: number;
  cx: number;
  cy: number;
}

export const DEFAULT_CROP: Crop = { zoom: 1, cx: 0.5, cy: 0.5 };

export interface Rect { x: number; y: number; side: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The source square for `crop` in a `width`×`height` image: side =
 * min(w, h) / zoom, centred on (cx, cy), moved back inside the image.
 */
export function cropRect(width: number, height: number, crop: Crop = DEFAULT_CROP): Rect {
  if (!(width > 0 && height > 0)) throw new Error('cropRect: the image has no size');
  const zoom = clamp(crop.zoom, 1, 8);
  const side = Math.min(width, height) / zoom;
  const x = clamp(crop.cx * width - side / 2, 0, width - side);
  const y = clamp(crop.cy * height - side / 2, 0, height - side);
  return { x, y, side };
}

/** The crop's centre after dragging the preview by (dx, dy) of its `frame` px. */
export function panCrop(crop: Crop, width: number, height: number, dx: number, dy: number, frame: number): Crop {
  const { side } = cropRect(width, height, crop);
  const scale = side / frame; // source px per preview px
  const r = cropRect(width, height, { ...crop, cx: crop.cx - (dx * scale) / width, cy: crop.cy - (dy * scale) / height });
  return { zoom: crop.zoom, cx: (r.x + r.side / 2) / width, cy: (r.y + r.side / 2) / height };
}

/** CSS background-size / position that show `rect` of the image filling a square box. */
export function cropBackground(width: number, height: number, rect: Rect): { size: string; position: string } {
  const pct = (n: number) => `${Math.round(n * 1000) / 1000}%`;
  const px = width - rect.side;
  const py = height - rect.side;
  return {
    size: `${pct((width / rect.side) * 100)} ${pct((height / rect.side) * 100)}`,
    position: `${px > 0 ? pct((rect.x / px) * 100) : '0%'} ${py > 0 ? pct((rect.y / py) * 100) : '0%'}`,
  };
}

/** Whether the 512px file would be blown up from a smaller square. */
export const isUpscale = (width: number, height: number, crop: Crop = DEFAULT_CROP): boolean =>
  cropRect(width, height, crop).side < MIN_SOURCE_SIDE;

/** «disco-queen_02.final.PNG» → «Disco Queen 02 Final». */
export function titleFromFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return 'Νέο avatar';
  return base
    .split(' ')
    .map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .slice(0, 60);
}

/** A fresh avatar id (the table's id rule: lowercase, digits and dashes). */
export function newAvatarId(uuid: () => string = () => crypto.randomUUID()): string {
  return `up-${uuid().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`;
}

/** Bucket object names of an avatar's two files. */
export const avatarObjectNames = (id: string) => ({ thumb: `${id}-${AVATAR_SIZES.thumb}.webp`, full: `${id}-${AVATAR_SIZES.full}.webp` });

/** Draws `rect` of `source` to a `size`×`size` WebP. Throws when the browser cannot encode WebP. */
export async function renderSquareWebp(source: CanvasImageSource, rect: Rect, size: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Αυτός ο browser δεν μπορεί να επεξεργαστεί εικόνες');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, rect.x, rect.y, rect.side, rect.side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', AVATAR_WEBP_QUALITY));
  // A browser without a WebP encoder silently returns PNG.
  if (!blob || blob.type !== 'image/webp') throw new Error('Αυτός ο browser δεν φτιάχνει WebP: δοκίμασε Chrome, Edge ή Firefox');
  return blob;
}

/** Both files of an avatar from one decoded image and its crop. */
export async function renderAvatarFiles(source: CanvasImageSource, width: number, height: number, crop: Crop): Promise<{ thumb: Blob; full: Blob }> {
  const rect = cropRect(width, height, crop);
  const [thumb, full] = await Promise.all([
    renderSquareWebp(source, rect, AVATAR_SIZES.thumb),
    renderSquareWebp(source, rect, AVATAR_SIZES.full),
  ]);
  return { thumb, full };
}
