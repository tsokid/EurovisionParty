import type { Locale } from './locale';
import { localizePath } from './locale';

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
  // Phase 2 — Tier 1 new pages (slimmed: no drinking-game/bingo/sweepstake/glossary)
  | 'eurovision-2026'
  | 'eurovision-2026-schedule'
  | 'eurovision-2026-semifinals'
  | 'eurovision-2026-songs'
  | 'eurovision-quiz'
  | 'host-eurovision-party'
  | 'eurovision-history'
  // Footer-driven supporting pages
  | 'eurovision-duels'
  | 'dashboard'
  | 'cookies'
  // Phase 3 — Greek-exclusive (no en counterpart)
  | 'eurovision-ellada'
  | 'eurovision-kypros'
  | 'eurovision-2026-elliniko-tragoudi'
  | 'eurovision-2026-programma'
  // Phase 4 — programmatic hubs (programmatic spokes are dynamic; not in registry)
  | 'winners'
  | 'countries';

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
  { id: 'eurovision-2026', slugByLocale: { en: '/eurovision-2026', el: '/eurovision-2026' }, priority: 0.95, changefreq: 'weekly' },
  { id: 'eurovision-2026-schedule', slugByLocale: { en: '/eurovision-2026-schedule', el: '/eurovision-2026-schedule' }, hub: 'eurovision-2026', priority: 0.9, changefreq: 'weekly' },
  { id: 'eurovision-2026-semifinals', slugByLocale: { en: '/eurovision-2026-semifinals', el: '/eurovision-2026-semifinals' }, hub: 'eurovision-2026', priority: 0.9, changefreq: 'weekly' },
  { id: 'eurovision-2026-songs', slugByLocale: { en: '/eurovision-2026-songs', el: '/eurovision-2026-songs' }, hub: 'eurovision-2026', priority: 0.9, changefreq: 'weekly' },
  { id: 'eurovision-quiz', slugByLocale: { en: '/eurovision-quiz', el: '/eurovision-quiz' }, hub: 'eurovision-games', priority: 0.85, changefreq: 'monthly' },
  { id: 'host-eurovision-party', slugByLocale: { en: '/host-eurovision-party', el: '/host-eurovision-party' }, hub: 'eurovision-party', priority: 0.85, changefreq: 'monthly' },
  { id: 'eurovision-history', slugByLocale: { en: '/eurovision-history', el: '/eurovision-history' }, priority: 0.85, changefreq: 'monthly' },

  // Footer-driven supporting pages (target user's footer structure)
  { id: 'eurovision-duels', slugByLocale: { en: '/duels', el: '/duels' }, hub: 'eurovision-games', priority: 0.85, changefreq: 'monthly' },
  { id: 'dashboard', slugByLocale: { en: '/dashboard', el: '/dashboard' }, hub: 'eurovision-games', priority: 0.8, changefreq: 'monthly' },
  { id: 'cookies', slugByLocale: { en: '/cookies', el: '/cookies' }, priority: 0.4, changefreq: 'yearly' },

  // Phase 3 — Greek-exclusive
  { id: 'eurovision-ellada', slugByLocale: { en: '/eurovision-ellada', el: '/eurovision-ellada' }, hub: 'eurovision-history', priority: 0.85, changefreq: 'monthly', greekExclusive: true },
  { id: 'eurovision-kypros', slugByLocale: { en: '/eurovision-kypros', el: '/eurovision-kypros' }, hub: 'eurovision-history', priority: 0.85, changefreq: 'monthly', greekExclusive: true },
  { id: 'eurovision-2026-elliniko-tragoudi', slugByLocale: { en: '/eurovision-2026-elliniko-tragoudi', el: '/eurovision-2026-elliniko-tragoudi' }, hub: 'eurovision-2026', priority: 0.85, changefreq: 'weekly', greekExclusive: true },
  { id: 'eurovision-2026-programma', slugByLocale: { en: '/eurovision-2026-programma', el: '/eurovision-2026-programma' }, hub: 'eurovision-2026', priority: 0.85, changefreq: 'weekly', greekExclusive: true },

  // Phase 4 — programmatic hubs
  { id: 'winners', slugByLocale: { en: '/winners', el: '/winners' }, hub: 'eurovision-history', priority: 0.85, changefreq: 'yearly' },
  { id: 'countries', slugByLocale: { en: '/countries', el: '/countries' }, hub: 'eurovision-history', priority: 0.85, changefreq: 'yearly' },
];

export function getPage(id: PageId): PageEntry | undefined {
  return PAGE_REGISTRY.find((p) => p.id === id);
}

export function allPageUrls(): { locale: Locale; path: string }[] {
  const urls: { locale: Locale; path: string }[] = [];
  for (const page of PAGE_REGISTRY) {
    urls.push({ locale: 'en', path: localizePath('en', page.slugByLocale.en) });
    urls.push({ locale: 'el', path: localizePath('el', page.slugByLocale.el) });
  }
  return urls;
}
