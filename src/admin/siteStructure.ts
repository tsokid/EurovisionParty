// Where each CMS page appears on the public site, for the admin's Site tree
// (spec §2 "Derived, not stored", §3). Until P2 makes the header and footer
// CMS documents, this mirrors the links coded in SiteHeader.tsx and
// SiteFooter.tsx; tests/admin/siteStructure.test.ts fails when they drift.
// Only CMS page docs are listed: the live hub, past contests and countries
// are data pages (their editorials sit in the Pages list).
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { PAGE_REGISTRY } from '../lib/seo/registry';
import type { FooterColumnKey } from './paths';

export interface PageGroup {
  /** Stable key: 'header', 'footer:<column>', 'none', 'system'. */
  key: string;
  title: string;
  docIds: string[];
}

/** Header: the logo (home), Eurovision night, and the "How to play" menu. */
export const HEADER_DOC_IDS = [
  'home',
  'eurovision-night',
  'eurovision-trivia',
  'eurovision-predictions',
  'rules',
  'scoring',
  'faq',
] as const;

export const FOOTER_COLUMNS: ReadonlyArray<{ key: FooterColumnKey; title: string; docIds: readonly string[] }> = [
  { key: 'about', title: 'About', docIds: ['about', 'eurovision-games', 'cookies'] },
  {
    key: 'how-to-play',
    title: 'How to play',
    docIds: ['how-to-play', 'eurovision-trivia', 'eurovision-duels', 'eurovision-predictions', 'dashboard', 'rules'],
  },
  { key: 'eurovision', title: 'Eurovision', docIds: ['winners'] },
  { key: 'help', title: 'Help', docIds: ['faq', 'scoring', 'privacy', 'terms'] },
];

export function footerColumn(key: string | undefined) {
  return FOOTER_COLUMNS.find((c) => c.key === key) ?? null;
}

/** Registry pages linked from neither the header nor the footer (today: /eurovision-party). */
export function pagesInNoMenu(): string[] {
  const linked = new Set<string>([...HEADER_DOC_IDS, ...FOOTER_COLUMNS.flatMap((c) => c.docIds)]);
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
    { key: 'header', title: 'Header', docIds: [...HEADER_DOC_IDS] },
    ...FOOTER_COLUMNS.map((c) => ({ key: `footer:${c.key}`, title: `Footer · ${c.title}`, docIds: [...c.docIds] })),
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
