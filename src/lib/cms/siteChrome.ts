/**
 * The site-wide CMS docs (Track 3 P2): content/pages/site-header.json,
 * site-footer.json and site-settings.json, and how their link targets become
 * paths.
 *
 * Every page renders the header and footer, so these docs are bundled
 * (contentData.client.ts) and read synchronously, never through
 * usePageContent: nothing is inlined in a page's #__content__ and nothing is
 * fetched, so moving the header and footer into the CMS leaves every
 * prerendered page exactly as it was. Publishing one rebuilds the site.
 *
 * Inside the admin preview (PageContentOverrideProvider with one of these doc
 * ids) the draft is used instead.
 */
import { bundledContent } from '../seo/contentData';
import { useLocale } from '../seo/LocaleContext';
import type { Locale } from '../seo/locale';
import { PAGE_REGISTRY } from '../seo/registry';
import { ARCHIVE_INDEX_PATH, COUNTRY_INDEX_PATH, hubPath } from '../seo/dynamicPages';
import { usePageContentOverride } from './pageContentOverrideContext';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';
import type { LinkTarget, SiteWideDocId } from '../../../supabase/functions/_shared/cms/siteLinks';
import type { SiteHeaderContent } from '../../../supabase/functions/_shared/cms/schemas/site-header';
import type { SiteFooterContent } from '../../../supabase/functions/_shared/cms/schemas/site-footer';
import type { SiteSettingsContent } from '../../../supabase/functions/_shared/cms/schemas/site-settings';

type Doc<T> = Record<Locale, T>;

interface SiteWideContent {
  'site-header': SiteHeaderContent;
  'site-footer': SiteFooterContent;
  'site-settings': SiteSettingsContent;
}

/** The published doc (both locales). Throws when the build lacks it: every page needs it. */
export function publishedSiteDoc<K extends SiteWideDocId>(docId: K): Doc<SiteWideContent[K]> {
  const doc = bundledContent(`pages/${docId}.json`) as Doc<SiteWideContent[K]> | undefined;
  if (!doc) throw new Error(`siteChrome: content/pages/${docId}.json is missing`);
  return doc;
}

/** The active locale's slice of a site-wide doc: the admin preview's draft, else the published doc. */
export function useSiteDoc<K extends SiteWideDocId>(docId: K): SiteWideContent[K] {
  const locale = useLocale();
  const override = usePageContentOverride();
  if (override && override.docId === docId) {
    const draft = (override.doc as Partial<Doc<SiteWideContent[K]>> | null)?.[locale];
    if (draft !== undefined) return draft;
  }
  return publishedSiteDoc(docId)[locale];
}

const PAGE_PATH = new Map(PAGE_REGISTRY.map((p) => [p.id as string, p.slugByLocale] as const));

/**
 * The unlocalized path of a target (LocaleLink adds the locale), its https://
 * address, or null when it has nowhere to go: the live hub while no year is
 * known, or a page id the registry no longer has.
 */
export function targetPath(target: LinkTarget, locale: Locale, hubYear: number | null): string | null {
  switch (target.kind) {
    case 'page': {
      const slug = PAGE_PATH.get(target.pageId)?.[locale];
      if (!slug) return null;
      return target.anchor ? `${slug}#${target.anchor}` : slug;
    }
    case 'dynamic':
      if (target.key === 'hub') return hubYear === null ? null : hubPath(hubYear);
      return target.key === 'pastContests' ? ARCHIVE_INDEX_PATH : COUNTRY_INDEX_PATH;
    case 'external':
      return target.href;
  }
}

/** A label with {year} filled in (empty while the year is unknown). */
export function linkText(label: string, year: number | null): string {
  try {
    return interpolate(label, { year: year ?? '' });
  } catch {
    return label;
  }
}

export interface ResolvedLink {
  label: string;
  to: string;
  target: LinkTarget;
}

/** The visible links of a list, resolved; hidden ones and ones with nowhere to go are left out. */
export function resolveLinks(
  links: ReadonlyArray<{ label: string; target: LinkTarget; hidden?: boolean }>,
  locale: Locale,
  year: number | null,
): ResolvedLink[] {
  const out: ResolvedLink[] = [];
  for (const l of links) {
    if (l.hidden) continue;
    const to = targetPath(l.target, locale, year);
    if (to !== null) out.push({ label: linkText(l.label, year), to, target: l.target });
  }
  return out;
}
