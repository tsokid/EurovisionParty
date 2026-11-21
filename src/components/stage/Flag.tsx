import clsx from 'clsx';

/**
 * ISO codes the app uses: every code in content/ (countries + contests
 * 1956–today) and src/lib/countries2026.ts, plus GR.
 * CS = Serbia and Montenegro, YU = Yugoslavia (historic archive entries).
 */
export const FLAG_CODES: ReadonlySet<string> = new Set([
  'AD', 'AL', 'AM', 'AT', 'AU', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CS', 'CY', 'CZ',
  'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GE', 'GR', 'HR', 'HU', 'IE', 'IL', 'IS',
  'IT', 'LT', 'LU', 'LV', 'MA', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT',
  'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'TR', 'UA', 'YU',
]);

/** Historic codes flagcdn.com has no image for: drawn in CSS (`.f-cs`, `.f-yu`). */
export const CSS_ONLY_FLAGS: ReadonlySet<string> = new Set(['CS', 'YU']);

const norm = (iso: string | null | undefined) => (iso ?? '').trim().toUpperCase();

/**
 * flagcdn.com PNG for a known ISO code (any case) at a given width
 * (40 or 80), `null` for unknown and CSS-only codes.
 */
export function flagSrc(iso: string | null | undefined, width: 40 | 80 = 40): string | null {
  const code = norm(iso);
  if (!FLAG_CODES.has(code) || CSS_ONLY_FLAGS.has(code)) return null;
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

/** `f-xx` for a CSS-only historic code, `null` otherwise. */
export function flagClass(iso: string | null | undefined): string | null {
  const code = norm(iso);
  return CSS_ONLY_FLAGS.has(code) ? `f-${code.toLowerCase()}` : null;
}

const SIZES = { sm: [18, 12], md: [28, 20], lg: [40, 28] } as const;

export interface FlagProps {
  iso: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  /** Accessible name (e.g. the country). Omit when the country name is shown next to it. */
  label?: string;
  className?: string;
}

/**
 * Real flag image (flagcdn.com w40, w80 for 2x) with explicit width/height,
 * lazy-loaded, on the grey `.flag` box that doubles as the placeholder.
 * Decorative (`alt=""` + `aria-hidden`) unless `label` is given.
 * Unknown code → grey box; CS/YU → CSS approximation.
 */
export function Flag({ iso, size = 'md', label, className }: FlagProps) {
  const cls = clsx('flag', size !== 'md' && `flag-${size}`, flagClass(iso), className);
  const src = flagSrc(iso, 40);
  if (!src) {
    const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
    return <span className={cls} {...a11y} />;
  }
  const [w, h] = SIZES[size];
  return (
    <img
      className={cls}
      src={src}
      srcSet={`${src} 1x, ${flagSrc(iso, 80)} 2x`}
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
      alt={label ?? ''}
      {...(label ? {} : { 'aria-hidden': true as const })}
    />
  );
}
