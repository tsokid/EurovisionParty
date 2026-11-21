import clsx from 'clsx';

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
 * all with white initials. The avatar art registry arrives with the identity
 * task; until then an `avatarId` picks a stable tint.
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
  /** Chosen avatar id (registry pending); falls back to the name for the tint. */
  avatarId?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /**
   * The stage name is shown next to the avatar: hide it from assistive tech
   * so the name is not read twice. Default true (the usual layout).
   */
  decorative?: boolean;
  className?: string;
}

export function Avatar({ name, avatarId, size = 'md', decorative = true, className }: AvatarProps) {
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': name };
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
