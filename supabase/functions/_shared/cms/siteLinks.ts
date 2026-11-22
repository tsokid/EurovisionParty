// Link targets of the site-wide docs (site-header, site-footer, site-settings;
// Track 3 spec §2 "Link target type"). A nav link names a page by its id, never
// a typed URL, so it can never point at a page that does not exist:
//
//   { kind: 'page', pageId, anchor? }  a registry page (anchor: an FAQ question)
//   { kind: 'dynamic', key }           a data page: the live hub, past contests, countries
//   { kind: 'external', href }         an https:// address (footer and settings only)
//
// Zod-free and Deno-free: the public bundle imports it (SiteHeader, SiteFooter).

import type { FaqAnchorId } from './faqTopics.ts';

/**
 * The static pages a link can target: the ids of PAGE_REGISTRY
 * (src/lib/seo/registry.ts, which Deno cannot import). A test keeps the two
 * lists equal.
 */
export const SITE_PAGE_IDS = [
  'home',
  'how-to-play',
  'eurovision-night',
  'eurovision-games',
  'eurovision-party',
  'eurovision-trivia',
  'eurovision-predictions',
  'faq',
  'rules',
  'scoring',
  'about',
  'privacy',
  'terms',
  'eurovision-duels',
  'dashboard',
  'cookies',
  'winners',
] as const;
export type SitePageId = (typeof SITE_PAGE_IDS)[number];

/** Data pages, resolved at render time: `hub` is /eurovision-{live year}. */
export const DYNAMIC_LINK_KEYS = ['hub', 'pastContests', 'countries'] as const;
export type DynamicLinkKey = (typeof DYNAMIC_LINK_KEYS)[number];

export const LINK_KINDS = ['page', 'dynamic', 'external'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export type LinkTarget =
  | { kind: 'page'; pageId: SitePageId; anchor?: FaqAnchorId }
  | { kind: 'dynamic'; key: DynamicLinkKey }
  | { kind: 'external'; href: string };

/** One link of a menu: its label (may hold {year}), where it goes, and whether it is hidden. */
export type NavLink = { label: string; target: LinkTarget; hidden?: boolean };

/** A header entry: a link, or a menu (no target) of links. */
export type HeaderItem = { label: string; target?: LinkTarget; hidden?: boolean; children?: NavLink[] };

export const FOOTER_COLUMN_IDS = ['about', 'howToPlay', 'eurovision', 'help'] as const;
export type FooterColumnId = (typeof FOOTER_COLUMN_IDS)[number];

/** The site-wide doc ids (one doc each, content/pages/{id}.json). */
export const SITE_WIDE_DOC_IDS = ['site-header', 'site-footer', 'site-settings'] as const;
export type SiteWideDocId = (typeof SITE_WIDE_DOC_IDS)[number];

/**
 * A stable key for "the same destination", for the duplicate check: two
 * links to one page and anchor, one data page or one address.
 */
export function targetKey(t: LinkTarget): string {
  switch (t.kind) {
    case 'page':
      return `page:${t.pageId}${t.anchor ? `#${t.anchor}` : ''}`;
    case 'dynamic':
      return `dynamic:${t.key}`;
    case 'external':
      return `external:${t.href.trim().replace(/\/+$/, '')}`;
  }
}

/** Labels may use {year}, the live contest year. */
export const LABEL_PLACEHOLDERS = ['year'] as const;
