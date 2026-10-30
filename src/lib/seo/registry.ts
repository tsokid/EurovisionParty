import type { Locale } from './locale';
import { localizePath } from './locale';
import { dynamicPageUrls, type ContentData } from './dynamicPages';

export type PageId =
  | 'home'
  | 'how-to-play'
  | 'eurovision-night'
  | 'eurovision-games'
  | 'eurovision-party'
  | 'eurovision-trivia'
  | 'eurovision-2026-predictions'
  | 'faq'
  | 'rules'
  | 'scoring'
  | 'about'
  | 'privacy'
  | 'terms'
  // Footer-driven supporting pages
  | 'eurovision-duels'
  | 'dashboard'
  | 'cookies'
  // Phase 4 — programmatic hubs (programmatic spokes are dynamic; not in registry)
  | 'winners';

export interface PageEntry {
  id: PageId;
  slugByLocale: Record<Locale, string>;
  hub?: PageId;
  priority: number; // sitemap priority 0.0–1.0
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  greekExclusive?: boolean;
  englishExclusive?: boolean;
}

export const PAGE_REGISTRY: PageEntry[] = [
  { id: 'home', slugByLocale: { en: '/', el: '/' }, priority: 1.0, changefreq: 'weekly' },

  // Existing — refreshed in Phase 1
  { id: 'how-to-play', slugByLocale: { en: '/how-to-play', el: '/how-to-play' }, priority: 0.8, changefreq: 'monthly' },
  { id: 'eurovision-night', slugByLocale: { en: '/eurovision-night', el: '/eurovision-night' }, priority: 0.9, changefreq: 'monthly' },
  { id: 'eurovision-games', slugByLocale: { en: '/eurovision-games', el: '/eurovision-games' }, priority: 0.9, changefreq: 'monthly' },
  { id: 'eurovision-party', slugByLocale: { en: '/eurovision-party', el: '/eurovision-party' }, priority: 0.9, changefreq: 'monthly' },
  { id: 'eurovision-trivia', slugByLocale: { en: '/eurovision-trivia', el: '/eurovision-trivia' }, priority: 0.9, changefreq: 'monthly' },
  { id: 'eurovision-2026-predictions', slugByLocale: { en: '/eurovision-2026-predictions', el: '/eurovision-2026-predictions' }, priority: 0.9, changefreq: 'weekly' },
  { id: 'faq', slugByLocale: { en: '/faq', el: '/faq' }, priority: 0.7, changefreq: 'monthly' },
  { id: 'rules', slugByLocale: { en: '/rules', el: '/rules' }, priority: 0.7, changefreq: 'yearly' },
  { id: 'scoring', slugByLocale: { en: '/scoring', el: '/scoring' }, priority: 0.7, changefreq: 'yearly' },
  { id: 'about', slugByLocale: { en: '/about', el: '/about' }, priority: 0.6, changefreq: 'yearly' },
  { id: 'privacy', slugByLocale: { en: '/privacy', el: '/privacy' }, priority: 0.3, changefreq: 'yearly' },
  { id: 'terms', slugByLocale: { en: '/terms', el: '/terms' }, priority: 0.3, changefreq: 'yearly' },

  // Phase 2 — Tier 1 new pages (slimmed)

  // Footer-driven supporting pages (target user's footer structure)
  { id: 'eurovision-duels', slugByLocale: { en: '/duels', el: '/duels' }, hub: 'eurovision-games', priority: 0.85, changefreq: 'monthly' },
  { id: 'dashboard', slugByLocale: { en: '/dashboard', el: '/dashboard' }, hub: 'eurovision-games', priority: 0.8, changefreq: 'monthly' },
  { id: 'cookies', slugByLocale: { en: '/cookies', el: '/cookies' }, priority: 0.4, changefreq: 'yearly' },

  // Phase 3 — Greek-exclusive

  // Phase 4 — programmatic hubs
  { id: 'winners', slugByLocale: { en: '/winners', el: '/winners' }, priority: 0.85, changefreq: 'yearly' },
];

export function getPage(id: PageId): PageEntry | undefined {
  return PAGE_REGISTRY.find((p) => p.id === id);
}

export function allPageUrls(registry: PageEntry[] = PAGE_REGISTRY): { locale: Locale; path: string }[] {
  const urls: { locale: Locale; path: string }[] = [];
  for (const page of registry) {
    if (!page.greekExclusive) urls.push({ locale: 'en', path: localizePath('en', page.slugByLocale.en) });
    if (!page.englishExclusive) urls.push({ locale: 'el', path: localizePath('el', page.slugByLocale.el) });
  }
  return urls;
}

/**
 * Gate for the data-driven pages (hub, archive, countries). Off until their
 * page components exist (Task 6 flips it); while off, every consumer of
 * allPublicUrls sees exactly the static registry.
 */
export const INCLUDE_DYNAMIC = false;

export interface PublicUrl {
  locale: Locale;
  /** Locale-prefixed path, e.g. `/el/faq`. */
  path: string;
  /** false → prerendered with robots noindex and left out of the sitemap. */
  indexable: boolean;
}

/**
 * Every public URL: the static registry (always indexable) ∪ dynamicPageUrls(content)
 * when the gate is on. The content snapshot is a parameter so the registry stays
 * loader-agnostic: app code passes contentData() (import.meta.glob), Node build
 * scripts pass loadContent() (fs). Dynamic entries keep their extra DynamicPage
 * fields (kind, files).
 */
export function allPublicUrls(content: ContentData, includeDynamic: boolean = INCLUDE_DYNAMIC): PublicUrl[] {
  const statics: PublicUrl[] = allPageUrls().map((u) => ({ ...u, indexable: true }));
  return includeDynamic ? [...statics, ...dynamicPageUrls(content)] : statics;
}

export const SITE_ORIGIN = 'https://eurovision.games';

/** Absolute, locale-prefixed URL for an unprefixed site path (`/faq` → `https://eurovision.games/el/faq`). */
export function absoluteUrl(locale: Locale, path: string): string {
  return SITE_ORIGIN + localizePath(locale, path);
}

/**
 * Absolute URL of a registry page in `locale` — the page's canonical. Falls back
 * to the other locale for locale-exclusive pages. Throws on an unknown id.
 */
export function pageUrl(id: PageId, locale: Locale): string {
  const page = getPage(id);
  if (!page) throw new Error(`pageUrl: unknown pageId "${id}"`);
  const en = page.greekExclusive ? undefined : absoluteUrl('en', page.slugByLocale.en);
  const el = page.englishExclusive ? undefined : absoluteUrl('el', page.slugByLocale.el);
  return locale === 'en' ? (en ?? el!) : (el ?? en!);
}
