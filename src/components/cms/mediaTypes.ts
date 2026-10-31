// Published shapes of the media and block values, as Task 5 (publish) writes
// them. Plain types, zod-free: the public components import this file.

/** Published `{ media, alt }` image group, dimensions written in by publish. */
export interface CmsImageValue {
  /** `/media/<sha12>.webp`; the 800 w variant is `/media/<sha12>-800.webp`. */
  media: string;
  alt: string;
  width: number;
  height: number;
}

/** Published video group; width and height are the poster's, so the player reserves space. */
export interface CmsVideoValue {
  /** `/media/<sha12>.mp4` */
  media: string;
  /** `/media/<sha12>.webp` */
  poster: string;
  /** `/media/<sha12>.vtt` */
  captions?: string;
  autoplay: boolean;
  width: number;
  height: number;
}

export type CmsBlock =
  | { type: 'text'; body: string }
  | { type: 'callout'; tone: 'info' | 'warn'; body: string }
  | { type: 'image'; image: CmsImageValue; caption?: string }
  | { type: 'video'; video: CmsVideoValue; caption?: string }
  | { type: 'faq'; items: { q: string; a: string }[] }
  | { type: 'cta'; title: string; body: string; label: string; href: string };

export type MediaExt = 'webp' | 'mp4' | 'vtt';

/** True for a published `/media/<sha12>.<ext>` reference (a draft's `cms-media/<uuid>` and anything else: false). */
export function isPublishedMedia(ref: unknown, ext: MediaExt): ref is string {
  return typeof ref === 'string' && new RegExp(`^/media/[0-9a-f]{12}\\.${ext}$`).test(ref);
}

export const isDim = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
