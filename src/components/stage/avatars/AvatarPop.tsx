import clsx from 'clsx';
import type { AvatarEntry } from './types';
import { isImageAvatar } from './types';
import { AvatarArt } from './AvatarArt';

export interface AvatarPopProps {
  entry: AvatarEntry;
  /**
   * `sizes` hint for the image: its rendered CSS width, about 1.75 × the
   * circle (see .avpop-img in index.css).
   */
  sizes?: string;
  loading?: 'lazy' | 'eager';
  /** Accessible name; omit when the name is shown next to it. */
  title?: string;
  className?: string;
}

/**
 * A large "sticker" avatar: the Stage avatar circle with the cutout drawn
 * bigger than it and bottom-anchored, so the head and hair break out above
 * the circle while the shoulders follow its lower curve. The box is the
 * circle's width and about 1.3 × as tall; size it with `width` from CSS.
 * SVG recipes (fallback set) draw their own round art inside the circle.
 */
export function AvatarPop({ entry, sizes = '180px', loading = 'lazy', title, className }: AvatarPopProps) {
  return (
    <span className={clsx('avpop', className)} data-avatar-pop={entry.id}>
      <span className="avpop-disc" aria-hidden="true">
        {!isImageAvatar(entry) && <AvatarArt spec={entry} />}
      </span>
      {isImageAvatar(entry) && (
        <img
          className="avpop-img"
          src={entry.full}
          srcSet={`${entry.thumb} 96w, ${entry.full} 512w`}
          sizes={sizes}
          width={512}
          height={512}
          loading={loading}
          decoding="async"
          alt={title ?? ''}
          aria-hidden={title ? undefined : true}
          draggable={false}
          data-avatar-art={entry.id}
        />
      )}
    </span>
  );
}
