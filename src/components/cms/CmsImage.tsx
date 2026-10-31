// Published image: <img> with reserved space (width/height), responsive
// srcset (800 w variant + the stored size) and lazy loading; `hero` is eager.
// Anything that is not a published /media/ reference renders nothing, except
// a draft `cms-media/` reference under a MediaResolverContext (admin preview).
import { useContext } from 'react';
import { isDim, isPublishedMedia, type CmsImageValue } from './mediaTypes';
import { isDraftMedia, MediaResolverContext, type ResolvedImage } from './MediaResolver';

export default function CmsImage({ value, hero = false, className }: { value: CmsImageValue; hero?: boolean; className?: string }) {
  const resolver = useContext(MediaResolverContext);
  let img: ResolvedImage | null = null;
  if (value && isPublishedMedia(value.media, 'webp') && isDim(value.width) && isDim(value.height)) {
    img = { src: value.media, src800: value.media.replace(/\.webp$/, '-800.webp'), width: value.width, height: value.height };
  } else if (value && resolver && isDraftMedia(value.media)) {
    const r = resolver.image(value.media);
    if (r && isDim(r.width) && isDim(r.height)) img = r;
  }
  if (!img) return null;
  // The 800 w variant is stored at the source width when the source is narrower.
  const smallW = Math.min(800, img.width);
  const srcSet = img.width <= 800 || !img.src800 ? undefined : `${img.src800} ${smallW}w, ${img.src} ${img.width}w`;
  return (
    <img
      src={img.src}
      srcSet={srcSet}
      sizes={srcSet ? '(min-width: 800px) 800px, 100vw' : undefined}
      alt={value.alt ?? ''}
      width={img.width}
      height={img.height}
      loading={hero ? 'eager' : 'lazy'}
      decoding="async"
      {...(hero ? { fetchPriority: 'high' as const } : {})}
      className={className ?? 'h-auto w-full rounded-2xl'}
    />
  );
}
