import clsx from 'clsx';
import { AvatarVisual } from './avatars/AvatarVisual';
import { useAvatarEntry } from './avatars/library';

/**
 * Initials from a stage name, for Greek and Latin alike:
 * - two or more words → first letter of the first two words ("Ελένη Παπά" → "ΕΠ");
 * - one word → its first two letters ("Μαρία" → "ΜΑ", "Tom" → "TO");
 * - accents are dropped and letters upper-cased ("άννα" → "ΑΝ");
 * - digits, emoji and punctuation are skipped; nothing usable → "?".
 */
export function avatarInitials(name: string | null | undefined): string {
  const words = (name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/\s+/)
    .map((w) => Array.from(w).filter((ch) => /\p{L}/u.test(ch)))
    .filter((letters) => letters.length > 0);
  if (words.length === 0) return '?';
  const picked = words.length >= 2 ? [words[0][0], words[1][0]] : words[0].slice(0, 2);
  return picked.join('').toLocaleUpperCase('el');
}

/**
 * Tints from the Stage board (purple, pink, teal) plus three darker steps,
 * all with white initials. Used when there is no avatar art: no `avatarId`,
 * or one the registry does not know (an unknown id still picks a stable tint).
 */
export const AVATAR_TONES = ['#A35BFF', '#F0469C', '#2B9C8F', '#7B3FE4', '#C2367F', '#1F7A8C'] as const;

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return h;
}

export function avatarTone(key: string): string {
  return AVATAR_TONES[hash(key) % AVATAR_TONES.length];
}

export interface AvatarProps {
  /** Stage name: source of the initials and the accessible name. */
  name: string;
  /** Chosen avatar id (players.avatar_id). A registry id renders its art; otherwise initials. */
  avatarId?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * The stage name is shown next to the avatar: hide it from assistive tech
   * so the name is not read twice. Default true (the usual layout).
   */
  decorative?: boolean;
  className?: string;
}

export function Avatar({ name, avatarId, size = 'md', decorative = true, className }: AvatarProps) {
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': name };
  const art = useAvatarEntry(avatarId);
  if (art) {
    return (
      <span
        className={clsx('avatar', 'avatar-art', size !== 'md' && `avatar-${size}`, className)}
        data-avatar-id={art.id}
        {...a11y}
      >
        <AvatarVisual entry={art} />
      </span>
    );
  }
  return (
    <span
      className={clsx('avatar', size !== 'md' && `avatar-${size}`, className)}
      style={{ background: avatarTone(avatarId || name) }}
      data-avatar-id={avatarId || undefined}
      {...a11y}
    >
      {avatarInitials(name)}
    </span>
  );
}
