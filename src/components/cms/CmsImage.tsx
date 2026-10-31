// Published image: <img> with reserved space (width/height), responsive
// srcset (800 w variant + the stored size) and lazy loading; `hero` is eager.
// Anything that is not a published /media/ reference renders nothing.
import { isDim, isPublishedMedia, type CmsImageValue } from './mediaTypes';

export default function CmsImage({ value, hero = false, className }: { value: CmsImageValue; hero?: boolean; className?: string }) {
  if (!value || !isPublishedMedia(value.media, 'webp') || !isDim(value.width) || !isDim(value.height)) return null;
  const small = value.media.replace(/\.webp$/, '-800.webp');
  // The 800 w variant is stored at the source width when the source is narrower.
  const smallW = Math.min(800, value.width);
  const srcSet = value.width <= 800 ? undefined : `${small} ${smallW}w, ${value.media} ${value.width}w`;
  return (
    <img
      src={value.media}
      srcSet={srcSet}
      sizes={srcSet ? '(min-width: 800px) 800px, 100vw' : undefined}
      alt={value.alt ?? ''}
      width={value.width}
      height={value.height}
      loading={hero ? 'eager' : 'lazy'}
      decoding="async"
      {...(hero ? { fetchPriority: 'high' as const } : {})}
      className={className ?? 'h-auto w-full rounded-2xl'}
    />
  );
}
