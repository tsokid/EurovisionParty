export const LOCALES = ['en', 'el'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'el';
}

interface DetectInput {
  stored: string | null;
  browser: string | null | undefined;
}

export function detectLocale({ stored, browser }: DetectInput): Locale {
  if (isLocale(stored)) return stored;
  const short = browser?.slice(0, 2).toLowerCase();
  if (isLocale(short)) return short;
  return 'en';
}

export function oppositeLocale(l: Locale): Locale {
  return l === 'en' ? 'el' : 'en';
}

export function localizePath(locale: Locale, path: string): string {
  if (path === '' || path === '/') return `/${locale}`;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean}`;
}

export function stripLocaleFromPath(path: string): string {
  const m = path.match(/^\/(en|el)(\/.*)?$/);
  if (!m) return path;
  return m[2] || '/';
}
