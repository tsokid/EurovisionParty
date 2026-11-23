import type { AvatarEntry } from './types';
import { isImageAvatar } from './types';
import { AvatarArt } from './AvatarArt';

export interface AvatarVisualProps {
  entry: AvatarEntry;
  /** Rendered px (width = height). Omit to fill the parent. */
  size?: number;
  /** Image avatars: the 96px thumb (default) or the 512px file for large views. */
  variant?: 'thumb' | 'full';
  /** Accessible name; omit when the name is shown next to it. */
  title?: string;
  className?: string;
}

/** Draws one registry avatar, SVG recipe or owner image, at any size. */
export function AvatarVisual({ entry, size, variant = 'thumb', title, className }: AvatarVisualProps) {
  if (isImageAvatar(entry)) {
    const intrinsic = variant === 'full' ? 512 : 96;
    return (
      <img
        src={variant === 'full' ? entry.full : entry.thumb}
        width={size ?? intrinsic}
        height={size ?? intrinsic}
        // Thumbs load at once and are precached (158 KB for all): lazy ones
        // showed up late in the room (23 Nov 2026). The 512px file opens on demand.
        loading={variant === 'full' ? 'lazy' : undefined}
        decoding="async"
        alt={title ?? ''}
        aria-hidden={title ? undefined : true}
        draggable={false}
        data-avatar-art={entry.id}
        className={className ? `avatar-img ${className}` : 'avatar-img'}
      />
    );
  }
  return <AvatarArt spec={entry} size={size} title={title} className={className} />;
}
