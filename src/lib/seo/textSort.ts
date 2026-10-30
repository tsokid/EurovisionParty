/**
 * Deterministic text ordering for prerendered lists. No locale-aware collation (Intl):
 * its collation differs between Node and browsers (and ICU builds), which
 * would make server and client renders disagree. Compare code points of the
 * NFD form with diacritics stripped, lowercased; the original string breaks
 * ties so the order is total.
 */

/** "Ελλάδα" → "ελλαδα", "Åland" → "aland". */
export function sortKey(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function compareText(a: string, b: string): number {
  return cmp(sortKey(a), sortKey(b)) || cmp(a, b);
}
