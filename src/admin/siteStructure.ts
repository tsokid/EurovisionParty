// Where each CMS page appears on the public site, for the admin's Site tree
// (spec §2 "Derived, not stored", §3). Read from the published header and
// footer docs (content/pages/site-header.json, site-footer.json), so moving
// a link in the CMS moves the page in the tree. Hidden links do not count:
// a page only reachable through a hidden link is "Not in any menu".
// Only CMS page docs are listed: the live hub, past contests and countries
// are data pages (their editorials sit in the Pages list).
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import type { FooterColumnId, LinkTarget, NavLink } from '../../supabase/functions/_shared/cms/siteLinks';
import { PAGE_REGISTRY } from '../lib/seo/registry';
import { publishedSiteDoc } from '../lib/cms/siteChrome';
import type { FooterColumnKey } from './paths';

export interface PageGroup {
  /** Stable key: 'header', 'footer:<column>', 'none', 'system'. */
  key: string;
  title: string;
  docIds: string[];
}

/** Admin URL segment ↔ footer doc column id. */
export const FOOTER_COLUMN_ID: Record<FooterColumnKey, FooterColumnId> = {
  about: 'about',
  'how-to-play': 'howToPlay',
  eurovision: 'eurovision',
  help: 'help',
};

const columnKey = (id: FooterColumnId) =>
  (Object.keys(FOOTER_COLUMN_ID) as FooterColumnKey[]).find((k) => FOOTER_COLUMN_ID[k] === id)!;

/** The page ids of visible page links, in order, each once. */
export function linkedPageIds(links: ReadonlyArray<{ target?: LinkTarget; hidden?: boolean; children?: NavLink[] }>): string[] {
  const out: string[] = [];
  const add = (t: LinkTarget | undefined) => {
    if (t?.kind === 'page' && !out.includes(t.pageId)) out.push(t.pageId);
  };
  for (const l of links) {
    if (l.hidden) continue;
    add(l.target);
    for (const c of l.children ?? []) if (!c.hidden) add(c.target);
  }
  return out;
}

/** Header: the logo (home), then the pages of its links and menus. */
export function headerDocIds(): string[] {
  const ids = linkedPageIds(publishedSiteDoc('site-header').en.items as Parameters<typeof linkedPageIds>[0]);
  return ['home', ...ids.filter((id) => id !== 'home')];
}

export interface FooterColumnInfo {
  key: FooterColumnKey;
  title: string;
  docIds: string[];
}

/** The footer's four columns: admin key, heading (English) and the pages they link to. */
export function footerColumns(): FooterColumnInfo[] {
  return publishedSiteDoc('site-footer').en.columns.map((c) => ({
    key: columnKey(c.id as FooterColumnId),
    title: c.heading,
    docIds: linkedPageIds(c.links as NavLink[]),
  }));
}

export function footerColumn(key: string | undefined): FooterColumnInfo | null {
  return footerColumns().find((c) => c.key === key) ?? null;
}

/** Registry pages linked from neither the header nor the footer (today: /eurovision-party). */
export function pagesInNoMenu(): string[] {
  const linked = new Set<string>([...headerDocIds(), ...footerColumns().flatMap((c) => c.docIds)]);
  return PAGE_REGISTRY.map((p) => p.id).filter((id) => !linked.has(id));
}

/** CMS site docs that are not a registry page (the 404 page). */
function systemDocs(): string[] {
  const registry = new Set<string>(PAGE_REGISTRY.map((p) => p.id));
  return Object.entries(CMS_DOC_TYPES)
    .filter(([id, def]) => def.group === 'site' && !registry.has(id))
    .map(([id]) => id);
}

export function pageGroups(): PageGroup[] {
  return [
    { key: 'header', title: 'Header', docIds: headerDocIds() },
    ...footerColumns().map((c) => ({ key: `footer:${c.key}`, title: `Footer · ${c.title}`, docIds: c.docIds })),
    { key: 'none', title: 'Not in any menu', docIds: pagesInNoMenu() },
    { key: 'system', title: 'System', docIds: systemDocs() },
  ].filter((g) => g.docIds.length > 0);
}

export function docLabel(docId: string): string {
  return CMS_DOC_TYPES[docId as keyof typeof CMS_DOC_TYPES]?.label ?? docId;
}

/** Public path (unlocalized) of a site page doc, or null (e.g. the 404 page). */
export function sitePagePath(docId: string): string | null {
  return PAGE_REGISTRY.find((p) => p.id === docId)?.slugByLocale.en ?? null;
}
