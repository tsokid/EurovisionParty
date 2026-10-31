// Preview-only media resolution. A draft holds `cms-media/<uuid>` references
// (rows of cms_media, files in the private Storage bucket); only the admin
// preview can show them, through signed URLs. PreviewPane provides a
// resolver; the public site provides none, so there a draft reference
// renders nothing, exactly like any other non-/media/ value.
//
// Ships in the public bundle: tiny, zod-free, no Supabase.
import { createContext } from 'react';

export type ResolvedImage = { src: string; src800?: string; width: number; height: number };

/** width and height are the poster's (the player reserves that space). */
export type ResolvedVideo = { src: string; poster: string; width: number; height: number; captions?: string };

export interface MediaResolver {
  /** A draft image reference, or null when it cannot be shown. */
  image(ref: string): ResolvedImage | null;
  /** A video group with at least one draft reference, or null when it cannot be shown. */
  video(value: { media?: unknown; poster?: unknown; captions?: unknown }): ResolvedVideo | null;
}

export const MediaResolverContext = createContext<MediaResolver | null>(null);

/** A draft reference: `cms-media/<uuid>` (lowercase). */
export const isDraftMedia = (ref: unknown): ref is string =>
  typeof ref === 'string' && /^cms-media\/[0-9a-f-]{36}$/.test(ref);
