// What a publish changes, computed from the live doc and the draft (CMS P5,
// spec §4 "Per-page publish + diff", owner Q2 = A):
// - fieldChanges: the changed leaf fields per locale (the text diff);
// - changedTargets: those fields as data-cms-path values of one locale, the
//   nodes the visual diff tints in the live and the draft page;
// - seoDelta: the hard SEO fields the change can touch per locale and route,
//   and whether the build's SEO guard will accept them. It uses the same
//   docIntents() publish-content writes into seo-intent.json and the same
//   route mapping as scripts/seo/intent.ts (a static doc → its registry route
//   in that locale; editorial docs → their data page; site-wide docs → no
//   route at all), so what the screen says is what the build will do.
// - wordDiff: a word-level diff of two strings, for the highlights.
import { changedPaths, getAt, type Path } from '../cms/fieldDiff';
import { cmsPathValue } from '../../lib/cms/cmsAttrs';
import { docIntents, type HardField } from '../../../supabase/functions/_shared/cms/seoIntent';
import { seoFields } from '../../../supabase/functions/_shared/cms/seo';
import { docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import { SITE_WIDE_DOC_IDS } from '../../../supabase/functions/_shared/cms/siteLinks';
import { PAGE_REGISTRY } from '../../lib/seo/registry';
import { localizePath, type Locale } from '../../lib/seo/locale';

export const isSiteWide = (docId: string): boolean => (SITE_WIDE_DOC_IDS as readonly string[]).includes(docId);

/** The changed leaf fields (locale first), in document order. */
export function fieldChanges(live: unknown, draft: unknown): Path[] {
  return changedPaths(live ?? {}, draft ?? {});
}

/** The changed fields of one locale as data-cms-path values of `docId`. */
export function changedTargets(docId: string, locale: Locale, changes: readonly Path[]): string[] {
  return changes
    .filter((p) => p[0] === locale && p.length > 1)
    .map((p) => cmsPathValue(docId, locale, p.slice(1).join('.')));
}

/** The diffable fields: what changed is compared through these SEO kinds. */
export type SeoField = Extract<HardField, 'title' | 'description' | 'h1' | 'jsonLd'>;

export type SeoRow = {
  locale: Locale;
  field: SeoField;
  /** The public route the guard compares (null: no page in this locale). */
  route: string | null;
  /** Title and description: the value now and after. */
  before?: string | null;
  after?: string | null;
  /** True when the value is known to change; false when it only may (h1, JSON-LD). */
  definite: boolean;
  /** Whether the build's SEO guard accepts this change. */
  allowed: boolean;
};

const asText = (v: unknown): string | null => (typeof v === 'string' ? v : v == null ? null : JSON.stringify(v));

/**
 * The SEO delta of publishing `draft` over `live` for `docId`. `paths`: the
 * unprefixed public path per locale for an editorial doc (its data page).
 */
export function seoDelta(docId: string, live: unknown, draft: unknown, paths?: Partial<Record<Locale, string | null>>): SeoRow[] {
  if (isSiteWide(docId)) return [];
  const page = PAGE_REGISTRY.find((p) => p.id === docId);
  const fieldPaths = seoFields(docTypeFor(docId)) ?? {};
  const rows: SeoRow[] = [];
  for (const intent of docIntents(docId, draft, live)) {
    const locale = intent.locale as Locale;
    let route: string | null = null;
    if (page) {
      const exclusive = locale === 'en' ? page.greekExclusive : page.englishExclusive;
      route = exclusive ? null : localizePath(locale, page.slugByLocale[locale]);
    } else if (paths?.[locale]) {
      route = localizePath(locale, paths[locale]!);
    }
    for (const field of intent.fields) {
      if (field !== 'title' && field !== 'description' && field !== 'h1' && field !== 'jsonLd') continue;
      const row: SeoRow = { locale, field, route, definite: false, allowed: route !== null };
      const p = field === 'title' || field === 'description' ? fieldPaths[field] : undefined;
      if (p) {
        const segs = p.split('.');
        row.before = asText(getAt((live as Record<string, unknown> | null)?.[locale], segs));
        row.after = asText(getAt((draft as Record<string, unknown> | null)?.[locale], segs));
        row.definite = row.before !== row.after;
      }
      rows.push(row);
    }
  }
  return rows;
}

export type WordPart = { text: string; kind: 'same' | 'add' | 'del' };

/**
 * A word-level diff of `a` → `b` (longest common subsequence over words and
 * the spaces between them). Long texts fall back to one removed and one added
 * part, so the screen never stalls.
 */
export function wordDiff(a: string, b: string): WordPart[] {
  const A = a.split(/(\s+)/).filter((x) => x !== '');
  const B = b.split(/(\s+)/).filter((x) => x !== '');
  if (A.length * B.length > 250_000) {
    return [...(a ? [{ text: a, kind: 'del' as const }] : []), ...(b ? [{ text: b, kind: 'add' as const }] : [])];
  }
  const n = A.length;
  const m = B.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: WordPart[] = [];
  const push = (text: string, kind: WordPart['kind']) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { push(A[i], 'same'); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push(A[i], 'del'); i++; }
    else { push(B[j], 'add'); j++; }
  }
  while (i < n) push(A[i++], 'del');
  while (j < m) push(B[j++], 'add');
  return out;
}
