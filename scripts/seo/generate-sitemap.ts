import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { PAGE_REGISTRY, allPublicUrls, type PageId, type PublicUrl } from '../../src/lib/seo/registry';
import { localizePath, stripLocaleFromPath } from '../../src/lib/seo/locale';
import type { DynamicPage, DynamicPageKind } from '../../src/lib/seo/dynamicPages';
import { loadContent } from './loadContent';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE = 'https://eurovision.games';
const OUT = resolve(__dirname, '../../public/sitemap.xml');
const REPO_ROOT = resolve(__dirname, '../..');

// Build date — fallback when no per-file git history is available
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// Map each pageId to the file paths that determine its `lastmod`. The newest
// commit across these paths becomes the URL's lastmod. We track:
//   - the page TSX (layout changes)
//   - the locale-specific copy bundle if it exists (content changes)
// Using the registry as the single source of truth means adding a new page
// only requires updating PAGE_REGISTRY + this map.
const PAGE_FILES: Record<PageId, string[]> = {
  'home': ['src/pages/HomePage.tsx', 'src/components/seo/HomeSeoBlock.tsx'],
  'how-to-play': ['src/pages/seo/HowToPlayPage.tsx', 'src/pages/seo/content/howToPlayCopy.ts'],
  'eurovision-night': ['src/pages/seo/EurovisionNightPage.tsx', 'src/pages/seo/content/eurovisionNightCopy.ts'],
  'eurovision-games': ['src/pages/seo/EurovisionGamesPage.tsx', 'src/pages/seo/content/eurovisionGamesCopy.ts'],
  'eurovision-party': ['src/pages/seo/EurovisionPartyPage.tsx', 'src/pages/seo/content/eurovisionPartyCopy.ts'],
  'eurovision-trivia': ['src/pages/seo/EurovisionTriviaPage.tsx', 'src/pages/seo/content/triviaCopy.ts'],
  'eurovision-2026-predictions': ['src/pages/seo/Predictions2026Page.tsx', 'src/pages/seo/content/predictionsCopy.ts'],
  'faq': ['src/pages/seo/FAQPage.tsx', 'src/pages/seo/content/faqCopy.ts'],
  'rules': ['src/pages/seo/RulesPage.tsx', 'src/pages/seo/content/rulesCopy.ts'],
  'scoring': ['src/pages/seo/ScoringPage.tsx', 'src/pages/seo/content/scoringCopy.ts'],
  'about': ['src/pages/seo/AboutPage.tsx', 'src/pages/seo/content/aboutCopy.ts'],
  'privacy': ['src/pages/seo/PrivacyPage.tsx', 'src/pages/seo/content/privacyCopy.ts'],
  'terms': ['src/pages/seo/TermsPage.tsx', 'src/pages/seo/content/termsCopy.ts'],
  'eurovision-duels': ['src/pages/seo/EurovisionDuelsPage.tsx', 'src/pages/seo/content/duelsCopy.ts'],
  'dashboard': ['src/pages/seo/DashboardPage.tsx', 'src/pages/seo/content/dashboardCopy.ts'],
  'cookies': ['src/pages/seo/CookiesPage.tsx', 'src/pages/seo/content/cookiesCopy.ts'],
  // Pages from the registry that don't ship as standalone TSX yet — fall back
  // to BUILD_DATE. These will get real `lastmod` once their TSX/copy ships.
  'winners': [],
};

function lastModFromGit(paths: string[]): string {
  if (paths.length === 0) return BUILD_DATE;
  try {
    // Pick the most recent commit date across all listed paths. --format=%cs
    // emits YYYY-MM-DD which is sitemap-spec compliant.
    const existing = paths.filter((p) => existsSync(resolve(REPO_ROOT, p)));
    if (existing.length === 0) return BUILD_DATE;
    const dates = existing.map((p) => {
      const out = execSync(`git log -1 --format=%cs -- "${p}"`, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }).trim();
      return out || BUILD_DATE;
    });
    // Sort lexicographically; YYYY-MM-DD sorts == chronologically
    dates.sort();
    return dates[dates.length - 1] || BUILD_DATE;
  } catch {
    return BUILD_DATE;
  }
}

/** Newest commit date across `paths` in one git call (dynamic pages can list ~70 files). */
function lastModFromGitBatch(paths: string[]): string {
  const existing = paths.filter((p) => existsSync(resolve(REPO_ROOT, p)));
  if (existing.length === 0) return BUILD_DATE;
  try {
    const out = execSync(`git log -1 --format=%cs -- ${existing.map((p) => `"${p}"`).join(' ')}`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    return out || BUILD_DATE;
  } catch {
    return BUILD_DATE;
  }
}

const DYNAMIC_META: Record<DynamicPageKind, { priority: number; changefreq: string }> = {
  hub: { priority: 0.9, changefreq: 'weekly' },
  'archive-index': { priority: 0.7, changefreq: 'monthly' },
  archive: { priority: 0.6, changefreq: 'yearly' },
  'country-index': { priority: 0.7, changefreq: 'monthly' },
  country: { priority: 0.6, changefreq: 'yearly' },
};

interface UrlEntry {
  loc: string;
  alternates: { hreflang: string; href: string }[];
  priority: number;
  changefreq: string;
  lastmod: string;
}

function buildEntries(): UrlEntry[] {
  const entries: UrlEntry[] = [];
  for (const page of PAGE_REGISTRY) {
    const enUrl = page.greekExclusive ? null : SITE + localizePath('en', page.slugByLocale.en);
    const elUrl = page.englishExclusive ? null : SITE + localizePath('el', page.slugByLocale.el);
    const alternates: UrlEntry['alternates'] = [];
    if (enUrl) alternates.push({ hreflang: 'en', href: enUrl });
    if (elUrl) alternates.push({ hreflang: 'el', href: elUrl });
    alternates.push({ hreflang: 'x-default', href: enUrl ?? elUrl! });

    const lastmod = lastModFromGit(PAGE_FILES[page.id] ?? []);

    if (enUrl) {
      entries.push({ loc: enUrl, alternates, priority: page.priority, changefreq: page.changefreq, lastmod });
    }
    if (elUrl) {
      entries.push({ loc: elUrl, alternates, priority: page.priority, changefreq: page.changefreq, lastmod });
    }
  }
  return entries;
}

const isDynamic = (u: PublicUrl): u is DynamicPage => 'kind' in u;

/**
 * Data-driven pages from allPublicUrls (empty while INCLUDE_DYNAMIC is off).
 * Indexable pages only: noindex years/countries stay out of the sitemap.
 */
function buildDynamicEntries(): UrlEntry[] {
  const groups = new Map<string, DynamicPage[]>();
  for (const page of allPublicUrls(loadContent()).filter(isDynamic)) {
    if (!page.indexable) continue;
    const key = stripLocaleFromPath(page.path);
    groups.set(key, [...(groups.get(key) ?? []), page]);
  }
  const entries: UrlEntry[] = [];
  for (const pages of groups.values()) {
    const alternates: UrlEntry['alternates'] = pages.map((p) => ({ hreflang: p.locale, href: SITE + p.path }));
    alternates.push({ hreflang: 'x-default', href: (alternates.find((a) => a.hreflang === 'en') ?? alternates[0]).href });
    const { priority, changefreq } = DYNAMIC_META[pages[0].kind];
    const lastmod = lastModFromGitBatch(pages[0].files);
    for (const p of pages) entries.push({ loc: SITE + p.path, alternates, priority, changefreq, lastmod });
  }
  return entries;
}

function entryXml(e: UrlEntry): string {
  const alts = e.alternates
    .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
    .join('\n');
  return [
    '  <url>',
    `    <loc>${e.loc}</loc>`,
    `    <lastmod>${e.lastmod}</lastmod>`,
    `    <changefreq>${e.changefreq}</changefreq>`,
    `    <priority>${e.priority.toFixed(1)}</priority>`,
    alts,
    '  </url>',
  ].join('\n');
}

function buildXml(entries: UrlEntry[]): string {
  const body = entries.map(entryXml).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset',
    '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '  xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

const entries = [...buildEntries(), ...buildDynamicEntries()];
const xml = buildXml(entries);
writeFileSync(OUT, xml, 'utf8');
console.log(`Sitemap written: ${OUT} (${entries.length} URLs, lastmod from git)`);
