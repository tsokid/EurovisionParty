import clsx from 'clsx';

/**
 * ISO codes with a `.f-xx` class in src/index.css: every code in content/
 * (countries + contests 1956–today) and src/lib/countries2026.ts, plus GR.
 * CS = Serbia and Montenegro, YU = Yugoslavia (historic archive entries).
 */
export const FLAG_CODES: ReadonlySet<string> = new Set([
  'AD', 'AL', 'AM', 'AT', 'AU', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CS', 'CY', 'CZ',
  'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GE', 'GR', 'HR', 'HU', 'IE', 'IL', 'IS',
  'IT', 'LT', 'LU', 'LV', 'MA', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT',
  'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'TR', 'UA', 'YU',
]);

/** `f-xx` for a known ISO code (any case), `null` otherwise (grey fallback). */
export function flagClass(iso: string | null | undefined): string | null {
  const code = (iso ?? '').trim().toUpperCase();
  return FLAG_CODES.has(code) ? `f-${code.toLowerCase()}` : null;
}

export interface FlagProps {
  iso: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  /** Accessible name (e.g. the country). Omit when the country name is shown next to it. */
  label?: string;
  className?: string;
}

/** CSS-drawn flag (ds.css approximations). Unknown code → grey `.flag` base. */
export function Flag({ iso, size = 'md', label, className }: FlagProps) {
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  return <span className={clsx('flag', size !== 'md' && `flag-${size}`, flagClass(iso), className)} {...a11y} />;
}
