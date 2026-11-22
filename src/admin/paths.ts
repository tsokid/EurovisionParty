// Admin URLs (spec 2026-11-21-cms-track3-design.md §3). Every admin screen
// and every item the existing modules select has its own path under /admin,
// so back/forward and reload restore the exact screen. Build links with these
// helpers rather than by hand.

export const ADMIN_ROOT = '/admin';

/** Footer columns, in the order of the Stage footer (SiteFooter.tsx). */
export const FOOTER_COLUMN_KEYS = ['about', 'how-to-play', 'eurovision', 'help'] as const;
export type FooterColumnKey = (typeof FOOTER_COLUMN_KEYS)[number];

export type ContestSection = 'details' | 'entries';

const seg = (s: string | number) => encodeURIComponent(String(s));

export const adminPaths = {
  overview: () => ADMIN_ROOT,
  header: () => `${ADMIN_ROOT}/header`,
  footer: (column?: FooterColumnKey) => (column ? `${ADMIN_ROOT}/footer/${column}` : `${ADMIN_ROOT}/footer`),
  pages: (docId?: string | null) => (docId ? `${ADMIN_ROOT}/pages/${seg(docId)}` : `${ADMIN_ROOT}/pages`),
  contests: (year?: number | null, section: ContestSection = 'details', iso?: string | null) => {
    if (year == null) return `${ADMIN_ROOT}/contests`;
    const base = `${ADMIN_ROOT}/contests/${year}`;
    if (iso) return `${base}/entries/${seg(iso)}`;
    return section === 'entries' ? `${base}/entries` : base;
  },
  monitor: () => `${ADMIN_ROOT}/game/monitor`,
  parser: (year?: number | null) => (year == null ? `${ADMIN_ROOT}/game/parser` : `${ADMIN_ROOT}/game/parser/${year}`),
  winners: (roomId?: string | null) => (roomId ? `${ADMIN_ROOT}/game/winners/${seg(roomId)}` : `${ADMIN_ROOT}/game/winners`),
  avatars: () => `${ADMIN_ROOT}/game/avatars`,
  media: () => `${ADMIN_ROOT}/media`,
  settings: () => `${ADMIN_ROOT}/settings`,
  admins: () => `${ADMIN_ROOT}/system/admins`,
};

/** Splits the part of a path after a module's base into decoded segments ("2027/entries" → ["2027", "entries"]). */
export function splatSegments(splat: string | undefined): string[] {
  return (splat ?? '')
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

/** A whole-number year from a path segment, else null. */
export function parseYear(s: string | undefined): number | null {
  if (!s || !/^\d{4}$/.test(s)) return null;
  return Number(s);
}

/** What /admin/contests/* selects: a year, its section and (in entries) one country. */
export type ContestRoute = { year: number | null; section: ContestSection; iso: string | null; valid: boolean };

export function parseContestRoute(splat: string | undefined): ContestRoute {
  const [y, section, iso, ...rest] = splatSegments(splat);
  if (y === undefined) return { year: null, section: 'details', iso: null, valid: true };
  const year = parseYear(y);
  if (year === null) return { year: null, section: 'details', iso: null, valid: false };
  if (section === undefined) return { year, section: 'details', iso: null, valid: true };
  if (section !== 'entries' || rest.length > 0) return { year, section: 'details', iso: null, valid: false };
  return { year, section: 'entries', iso: iso ? iso.toUpperCase() : null, valid: true };
}

/**
 * The part of an admin path that decides which editor is mounted. Moving
 * within one screen key (a contest year's details ↔ entries ↔ one entry)
 * keeps the same editor and its unsaved edits, so the leave guard only asks
 * when the key changes.
 */
export function screenKey(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const m = /^\/admin\/contests\/([^/]+)(?:\/entries(?:\/[^/]*)?)?$/.exec(clean);
  if (m) return `/admin/contests/${m[1]}`;
  return clean;
}
