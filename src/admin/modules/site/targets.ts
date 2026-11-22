// What a header/footer link can point at, in words the owner uses: the site's
// pages (by name), the FAQ questions, the contest pages, or (footer only) a
// web address. Built from the page registry, so a link can only name a page
// that exists.
import { CMS_DOC_TYPES } from '../../../../supabase/functions/_shared/cms/registry';
import { FAQ_ANCHOR_IDS } from '../../../../supabase/functions/_shared/cms/faqTopics';
import {
  DYNAMIC_LINK_KEYS, SITE_PAGE_IDS, targetKey,
  type DynamicLinkKey, type LinkKind, type LinkTarget,
} from '../../../../supabase/functions/_shared/cms/siteLinks';
import { publishedSiteDoc, targetPath } from '../../../lib/cms/siteChrome';

export interface TargetOption {
  key: string;
  target: LinkTarget;
  /** Name in the list (the page's admin name). */
  name: string;
  /** Its address, shown small. */
  path: string;
  group: 'Σελίδες' | 'Ερωτήσεις FAQ' | 'Σελίδες διαγωνισμού';
  /** Suggested labels for a new link: the label the site already uses for it, else the name. */
  label: { en: string; el: string };
}

const DYNAMIC_NAME: Record<DynamicLinkKey, string> = {
  hub: 'Ο τρέχων διαγωνισμός (Eurovision {έτος})',
  pastContests: 'Προηγούμενοι διαγωνισμοί',
  countries: 'Χώρες',
};

const ANCHOR_NAME: Record<(typeof FAQ_ANCHOR_IDS)[number], string> = {
  create: 'FAQ · Δημιουργία δωματίου',
  join: 'FAQ · Είσοδος σε δωμάτιο',
  leave: 'FAQ · Αποχώρηση / διαγραφή δωματίου',
};

/** Labels the published header and footer already give each destination. */
function knownLabels(): Map<string, { en: string; el: string }> {
  const out = new Map<string, { en: string; el: string }>();
  const take = (en: { label: string; target?: LinkTarget }[], el: { label: string }[]) =>
    en.forEach((l, i) => { if (l.target && !out.has(targetKey(l.target))) out.set(targetKey(l.target), { en: l.label, el: el[i]?.label ?? l.label }); });
  const header = publishedSiteDoc('site-header');
  take(header.en.items as never, header.el.items);
  header.en.items.forEach((it, i) => take((it.children ?? []) as never, header.el.items[i]?.children ?? []));
  const footer = publishedSiteDoc('site-footer');
  footer.en.columns.forEach((c, i) => take(c.links as never, footer.el.columns[i].links));
  return out;
}

export function targetOptions(): TargetOption[] {
  const known = knownLabels();
  const opt = (target: LinkTarget, name: string, group: TargetOption['group']): TargetOption => {
    const key = targetKey(target);
    return { key, target, name, group, path: targetPath(target, 'en', 2026)?.replace('2026', '{έτος}') ?? '', label: known.get(key) ?? { en: name, el: name } };
  };
  return [
    ...SITE_PAGE_IDS.map((pageId) => opt({ kind: 'page', pageId }, pageId === 'home' ? 'Home page' : CMS_DOC_TYPES[pageId]?.label ?? pageId, 'Σελίδες')),
    ...FAQ_ANCHOR_IDS.map((anchor) => opt({ kind: 'page', pageId: 'faq', anchor }, ANCHOR_NAME[anchor], 'Ερωτήσεις FAQ')),
    ...DYNAMIC_LINK_KEYS.map((key) => opt({ kind: 'dynamic', key }, DYNAMIC_NAME[key], 'Σελίδες διαγωνισμού')),
  ];
}

/** A target in words: «Σχετικά · /about». */
export function describeTarget(t: LinkTarget | undefined, options: TargetOption[]): { name: string; path: string } {
  if (!t) return { name: 'Μενού', path: '' };
  if (t.kind === 'external') return { name: 'Άλλο site', path: t.href };
  const o = options.find((x) => x.key === targetKey(t));
  return o ? { name: o.name, path: o.path } : { name: 'Η σελίδα δεν υπάρχει πια', path: '' };
}

export const allowsExternal = (kinds: readonly LinkKind[]) => kinds.includes('external');
