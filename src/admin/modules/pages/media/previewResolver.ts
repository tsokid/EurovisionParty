// The admin preview's MediaResolver: draft `cms-media/<uuid>` references
// shown through signed URLs, with the dimensions media_list stores.
import { useMemo } from 'react';
import { isDraftMedia, type MediaResolver, type ResolvedImage } from '../../../../components/cms/MediaResolver';
import { draftId, draftIdsIn, type MediaRow } from './mediaApi';
import { useMediaInfo, type MediaInfo } from './useMediaInfo';

const PUBLISHED = /^\/media\/[0-9a-f]{12}\.(webp|mp4|vtt)$/;

export function createMediaResolver(info: MediaInfo): MediaResolver {
  const byPublished = new Map<string, MediaRow>();
  for (const r of info.rows.values()) if (r.published_path) byPublished.set(r.published_path, r);

  /** A draft reference: its row (of `kind`, not a variant) and signed URL; a published one: its row, served by the site. */
  const file = (ref: unknown, kind: MediaRow['kind']): { row: MediaRow | undefined; src: string } | null => {
    if (isDraftMedia(ref)) {
      const row = info.rows.get(draftId(ref)!);
      const src = row && row.kind === kind && !row.variant_of ? info.urls[row.storage_path] : undefined;
      return src ? { row, src } : null;
    }
    if (typeof ref === 'string' && PUBLISHED.test(ref)) return { row: byPublished.get(ref), src: ref };
    return null;
  };

  const image = (ref: unknown): ResolvedImage | null => {
    const f = file(ref, 'image');
    if (!f?.row?.width || !f.row.height) return null;
    const variant = info.variants.get(f.row.id);
    const src800 = isDraftMedia(ref) ? (variant && info.urls[variant.storage_path]) : (ref as string).replace(/\.webp$/, '-800.webp');
    return { src: f.src, ...(src800 ? { src800 } : {}), width: f.row.width, height: f.row.height };
  };

  return {
    image,
    video(value) {
      const media = file(value.media, 'video');
      const poster = image(value.poster);
      if (!media || !poster) return null;
      const captions = value.captions === undefined ? null : file(value.captions, 'captions');
      return { src: media.src, poster: poster.src, width: poster.width, height: poster.height, ...(captions ? { captions: captions.src } : {}) };
    },
  };
}

/** A resolver for the draft references in `doc` (resolves nothing until the library has loaded). */
export function usePreviewMediaResolver(doc: unknown): MediaResolver {
  const ids = useMemo(() => draftIdsIn(doc), [doc]);
  const info = useMediaInfo(ids);
  return useMemo(() => createMediaResolver(info), [info]);
}
