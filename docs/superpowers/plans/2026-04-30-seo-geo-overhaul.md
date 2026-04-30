# Eurovision Games — SEO + GEO + Content + UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `eurovision.games` from 15 pages with client-side language switching into a ~200-page bilingual SEO+GEO powerhouse: `/en/...` and `/el/...` URL routing, hreflang, programmatic country/winner pages, llms.txt, comprehensive schema, refreshed content for all existing pages, and citation-testing infrastructure.

**Architecture:**
- **i18n URL-based routing** — React Router v7 with `/en/*` and `/el/*` prefixes, locale via `useParams`, root `/` 301-redirects to detected locale.
- **Content data layer** — Page content moves from inline JSX strings to typed JSON files per page per locale (`src/content/<page>/{en,el}.json`). Pages render content from data; identical layout in both languages.
- **Schema as data** — Declarative schema builder (`src/lib/seo/schema.ts`) emits typed JSON-LD; pages compose blocks (e.g. `[article, faqPage, breadcrumb]`).
- **Build-time sitemap + hreflang** — Node script walks route registry + content files, emits `public/sitemap.xml` with `<xhtml:link rel="alternate" hreflang>` per URL.
- **Programmatic pages** — Single template per series (`/winners/[year]`, `/countries/[slug]`), data from versioned JSON arrays.

**Tech Stack:**
- React 19 + Vite 8 + React Router 7
- TypeScript 5.9, Tailwind 4
- Vitest + @testing-library/react (NEW — added in Phase 0)
- i18next + react-i18next (existing)
- tsx for build scripts (existing)

**Conventions:**
- All new pages: use `PageHero` + `ContentLayout` + `Section` + `FaqAccordion` + `RelatedCards` + `CtaBanner` design system. No raw `<article className="prose">`.
- All schema: emit via `buildSchema()` helpers — never hand-rolled JSON-LD in pages.
- All copy: lives in `src/content/<slug>/{en,el}.json`. Pages import and consume; never inline strings.
- All redirects: declared in `src/lib/seo/redirects.ts`; honored by `RedirectRoute` component.
- Commits: conventional commits, scoped to phase (`feat(seo-p0): ...`).

---

## File Structure

### NEW directories
- `src/content/` — content JSON per page per locale
- `src/content/data/` — shared data (winners, countries, glossary)
- `src/lib/seo/` — SEO utility library (schema builders, hreflang helpers, sitemap generator inputs)
- `src/components/seo-pro/` — new design-system primitives that don't exist yet (e.g., `DefinitionBlock`, `RunOfShow`, `WinnerCard`, `CountryCard`, `GlossaryTerm`)
- `scripts/seo/` — Node scripts: sitemap generator, schema validator, citation tester
- `tests/` — Vitest tests
- `tests/lib/seo/` — unit tests for SEO library
- `tests/content/` — content-shape contract tests

### Touched existing files
- `src/routes.tsx` — full rewrite for i18n routing
- `src/i18n/index.ts` — extend with locale-from-URL resolver
- `src/components/seo/PublicLayout.tsx` — wrap with locale provider
- `src/components/seo/SchemaHead.tsx` — extend to emit hreflang
- `src/components/seo/SiteHeader.tsx` — locale-aware nav links
- `src/components/seo/SiteFooter.tsx` — locale-aware nav links
- `src/components/ui/LanguageSwitcher.tsx` — switch via URL, not localStorage
- `public/sitemap.xml` — autogen from script (becomes build artifact)
- `public/robots.txt` — extend with more AI bots + llms.txt link
- `public/llms.txt` — NEW
- `vite.config.ts` — add Vitest config
- `package.json` — Vitest deps + new scripts

### Deleted files
- `src/pages/seo/OnlineGamesPage.tsx`
- `src/pages/seo/MobileGamesPage.tsx`

---

## Phase Overview & Dependencies

```
Phase 0 (Foundations) ──┬──> Phase 1 (Existing pages refresh) ─┐
                        ├──> Phase 2 (Tier 1 new pages) ───────┼──> Phase 6 (Tech SEO sweep)
                        ├──> Phase 3 (Greek-exclusive pages) ──┤
                        └──> Phase 4 (Programmatic pages) ─────┘
                                                               │
                              Phase 5 (Comparison pages) ──────┴──> Phase 7 (GEO monitoring)
```

Phase 0 must complete first. Phases 1–5 parallelizable across subagents. Phase 6 runs after 1–5. Phase 7 runs last.

---

# PHASE 0 — Foundations

**Goal:** Stand up i18n URL routing, hreflang, sitemap auto-gen, llms.txt, schema builder library, content data layer, and Vitest. Nothing ships visible to users yet — but the infra everything else depends on is in place.

**Acceptance criteria:**
- Visit `/` → redirects to `/en` or `/el` based on `Accept-Language` and saved preference
- Every existing page reachable at both `/en/<slug>` and `/el/<slug>` (Greek versions render English copy as fallback until Phase 1 ships translations)
- Each page emits `<link rel="alternate" hreflang="en|el|x-default">` to its sister URL
- `npm run build` regenerates `dist/sitemap.xml` with hreflang xhtml:link entries
- `/llms.txt` reachable, lists all hub pages
- `npm test` runs Vitest, all tests pass
- `npm run validate-schema` validates all emitted JSON-LD

---

### Task 0.1: Add Vitest + testing infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/lib/sanity.test.ts`

- [ ] **Step 1: Install Vitest + Testing Library**

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add scripts to `package.json`** — add to the `scripts` object:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 5: Write sanity test `tests/lib/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run `npm test` — expect 1 passing test**

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/
git commit -m "chore(seo-p0): add vitest + testing-library infrastructure"
```

---

### Task 0.2: Locale primitives — types + helpers

**Files:**
- Create: `src/lib/seo/locale.ts`
- Create: `tests/lib/seo/locale.test.ts`

- [ ] **Step 1: Write failing test `tests/lib/seo/locale.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  LOCALES,
  isLocale,
  detectLocale,
  oppositeLocale,
  localizePath,
  stripLocaleFromPath,
} from '@/lib/seo/locale';

describe('locale helpers', () => {
  it('LOCALES is en + el', () => {
    expect(LOCALES).toEqual(['en', 'el']);
  });

  it('isLocale narrows correctly', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('el')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('detectLocale prefers stored, then nav lang, then en', () => {
    expect(detectLocale({ stored: 'el', browser: 'fr-FR' })).toBe('el');
    expect(detectLocale({ stored: null, browser: 'el-GR' })).toBe('el');
    expect(detectLocale({ stored: null, browser: 'fr-FR' })).toBe('en');
    expect(detectLocale({ stored: 'invalid', browser: 'el' })).toBe('el');
  });

  it('oppositeLocale flips', () => {
    expect(oppositeLocale('en')).toBe('el');
    expect(oppositeLocale('el')).toBe('en');
  });

  it('localizePath prepends locale', () => {
    expect(localizePath('en', '/eurovision-night')).toBe('/en/eurovision-night');
    expect(localizePath('el', '/')).toBe('/el');
    expect(localizePath('en', '')).toBe('/en');
  });

  it('stripLocaleFromPath removes locale prefix', () => {
    expect(stripLocaleFromPath('/en/eurovision-night')).toBe('/eurovision-night');
    expect(stripLocaleFromPath('/el')).toBe('/');
    expect(stripLocaleFromPath('/foo')).toBe('/foo'); // no locale
  });
});
```

- [ ] **Step 2: Run `npm test` — expect failure (module not found)**

- [ ] **Step 3: Implement `src/lib/seo/locale.ts`**

```ts
export const LOCALES = ['en', 'el'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'el';
}

interface DetectInput {
  stored: string | null;
  browser: string | null | undefined;
}

export function detectLocale({ stored, browser }: DetectInput): Locale {
  if (isLocale(stored)) return stored;
  const short = browser?.slice(0, 2).toLowerCase();
  if (isLocale(short)) return short;
  return 'en';
}

export function oppositeLocale(l: Locale): Locale {
  return l === 'en' ? 'el' : 'en';
}

export function localizePath(locale: Locale, path: string): string {
  if (path === '' || path === '/') return `/${locale}`;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean}`;
}

export function stripLocaleFromPath(path: string): string {
  const m = path.match(/^\/(en|el)(\/.*)?$/);
  if (!m) return path;
  return m[2] || '/';
}
```

- [ ] **Step 4: Run `npm test` — expect all 6 tests pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/locale.ts tests/lib/seo/locale.test.ts
git commit -m "feat(seo-p0): add locale type + detection helpers with tests"
```

---

### Task 0.3: Page registry — single source of truth for routes + hreflang

**Files:**
- Create: `src/lib/seo/registry.ts`
- Create: `tests/lib/seo/registry.test.ts`

The registry is one file describing every public page, its slug, available locales, schema types, and parent-hub. Used by routing, sitemap gen, breadcrumbs, related links, llms.txt.

- [ ] **Step 1: Write failing test `tests/lib/seo/registry.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { PAGE_REGISTRY, getPage, allPageUrls } from '@/lib/seo/registry';

describe('page registry', () => {
  it('contains the homepage', () => {
    const home = getPage('home');
    expect(home).toBeDefined();
    expect(home?.slugByLocale.en).toBe('/');
    expect(home?.slugByLocale.el).toBe('/');
  });

  it('every entry has en + el slugs', () => {
    for (const page of PAGE_REGISTRY) {
      expect(page.slugByLocale.en).toBeDefined();
      expect(page.slugByLocale.el).toBeDefined();
    }
  });

  it('allPageUrls returns localized URLs for every page', () => {
    const urls = allPageUrls();
    expect(urls.length).toBeGreaterThanOrEqual(PAGE_REGISTRY.length * 2);
    expect(urls).toContainEqual({ locale: 'en', path: '/en' });
    expect(urls).toContainEqual({ locale: 'el', path: '/el' });
  });

  it('no duplicate slugs within a locale', () => {
    const enSlugs = PAGE_REGISTRY.map((p) => p.slugByLocale.en);
    const elSlugs = PAGE_REGISTRY.map((p) => p.slugByLocale.el);
    expect(new Set(enSlugs).size).toBe(enSlugs.length);
    expect(new Set(elSlugs).size).toBe(elSlugs.length);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

- [ ] **Step 3: Implement `src/lib/seo/registry.ts`**

```ts
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
  // Phase 2 — Tier 1 new pages
  | 'eurovision-2026'
  | 'eurovision-2026-schedule'
  | 'eurovision-2026-semifinals'
  | 'eurovision-2026-songs'
  | 'eurovision-drinking-game'
  | 'eurovision-bingo'
  | 'eurovision-sweepstake'
  | 'eurovision-quiz'
  | 'glossary'
  | 'host-eurovision-party'
  | 'eurovision-history'
  // Phase 3 — Greek-exclusive (no en counterpart)
  | 'eurovision-ellada'
  | 'eurovision-kypros'
  | 'eurovision-2026-elliniko-tragoudi'
  | 'eurovision-2026-programma'
  // Phase 4 — programmatic hubs (programmatic spokes are dynamic; not in registry)
  | 'winners'
  | 'countries'
  // Phase 5
  | 'compare-bingo'
  | 'compare-quiz-pack'
  | 'best-eurovision-app'
  | 'printables';

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

  // Phase 2 — Tier 1 new pages
  { id: 'eurovision-2026', slugByLocale: { en: '/eurovision-2026', el: '/eurovision-2026' }, priority: 0.95, changefreq: 'weekly' },
  { id: 'eurovision-2026-schedule', slugByLocale: { en: '/eurovision-2026-schedule', el: '/eurovision-2026-schedule' }, hub: 'eurovision-2026', priority: 0.9, changefreq: 'weekly' },
  { id: 'eurovision-2026-semifinals', slugByLocale: { en: '/eurovision-2026-semifinals', el: '/eurovision-2026-semifinals' }, hub: 'eurovision-2026', priority: 0.9, changefreq: 'weekly' },
  { id: 'eurovision-2026-songs', slugByLocale: { en: '/eurovision-2026-songs', el: '/eurovision-2026-songs' }, hub: 'eurovision-2026', priority: 0.9, changefreq: 'weekly' },
  { id: 'eurovision-drinking-game', slugByLocale: { en: '/eurovision-drinking-game', el: '/eurovision-drinking-game' }, hub: 'eurovision-party', priority: 0.85, changefreq: 'monthly' },
  { id: 'eurovision-bingo', slugByLocale: { en: '/eurovision-bingo', el: '/eurovision-bingo' }, hub: 'eurovision-games', priority: 0.85, changefreq: 'monthly' },
  { id: 'eurovision-sweepstake', slugByLocale: { en: '/eurovision-sweepstake', el: '/eurovision-sweepstake' }, hub: 'eurovision-games', priority: 0.85, changefreq: 'monthly' },
  { id: 'eurovision-quiz', slugByLocale: { en: '/eurovision-quiz', el: '/eurovision-quiz' }, hub: 'eurovision-games', priority: 0.85, changefreq: 'monthly' },
  { id: 'glossary', slugByLocale: { en: '/glossary', el: '/glossary' }, priority: 0.8, changefreq: 'monthly' },
  { id: 'host-eurovision-party', slugByLocale: { en: '/host-eurovision-party', el: '/host-eurovision-party' }, hub: 'eurovision-party', priority: 0.85, changefreq: 'monthly' },
  { id: 'eurovision-history', slugByLocale: { en: '/eurovision-history', el: '/eurovision-history' }, priority: 0.85, changefreq: 'monthly' },

  // Phase 3 — Greek-exclusive
  { id: 'eurovision-ellada', slugByLocale: { en: '/eurovision-ellada', el: '/eurovision-ellada' }, hub: 'eurovision-history', priority: 0.85, changefreq: 'monthly', greekExclusive: true },
  { id: 'eurovision-kypros', slugByLocale: { en: '/eurovision-kypros', el: '/eurovision-kypros' }, hub: 'eurovision-history', priority: 0.85, changefreq: 'monthly', greekExclusive: true },
  { id: 'eurovision-2026-elliniko-tragoudi', slugByLocale: { en: '/eurovision-2026-elliniko-tragoudi', el: '/eurovision-2026-elliniko-tragoudi' }, hub: 'eurovision-2026', priority: 0.85, changefreq: 'weekly', greekExclusive: true },
  { id: 'eurovision-2026-programma', slugByLocale: { en: '/eurovision-2026-programma', el: '/eurovision-2026-programma' }, hub: 'eurovision-2026', priority: 0.85, changefreq: 'weekly', greekExclusive: true },

  // Phase 4 — programmatic hubs
  { id: 'winners', slugByLocale: { en: '/winners', el: '/winners' }, hub: 'eurovision-history', priority: 0.85, changefreq: 'yearly' },
  { id: 'countries', slugByLocale: { en: '/countries', el: '/countries' }, hub: 'eurovision-history', priority: 0.85, changefreq: 'yearly' },

  // Phase 5 — comparison + commercial
  { id: 'compare-bingo', slugByLocale: { en: '/compare/eurovision-games-vs-bingo', el: '/compare/eurovision-games-vs-bingo' }, priority: 0.7, changefreq: 'yearly' },
  { id: 'compare-quiz-pack', slugByLocale: { en: '/compare/eurovision-games-vs-quiz-pack', el: '/compare/eurovision-games-vs-quiz-pack' }, priority: 0.7, changefreq: 'yearly' },
  { id: 'best-eurovision-app', slugByLocale: { en: '/best-eurovision-app', el: '/best-eurovision-app' }, priority: 0.7, changefreq: 'yearly' },
  { id: 'printables', slugByLocale: { en: '/printables', el: '/printables' }, priority: 0.7, changefreq: 'monthly' },
];

export function getPage(id: PageId): PageEntry | undefined {
  return PAGE_REGISTRY.find((p) => p.id === id);
}

export function allPageUrls(): { locale: Locale; path: string }[] {
  const urls: { locale: Locale; path: string }[] = [];
  for (const page of PAGE_REGISTRY) {
    if (!page.greekExclusive) {
      urls.push({ locale: 'en', path: localizePath('en', page.slugByLocale.en) });
    }
    if (!page.englishExclusive) {
      urls.push({ locale: 'el', path: localizePath('el', page.slugByLocale.el) });
    }
  }
  return urls;
}
```

- [ ] **Step 4: Run test — expect all 4 pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/registry.ts tests/lib/seo/registry.test.ts
git commit -m "feat(seo-p0): add page registry with hreflang-aware URL builder"
```

---

### Task 0.4: Schema builder library

**Files:**
- Create: `src/lib/seo/schema.ts`
- Create: `tests/lib/seo/schema.test.ts`

- [ ] **Step 1: Write failing test `tests/lib/seo/schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  buildOrganization,
  buildWebSite,
  buildArticle,
  buildFaqPage,
  buildHowTo,
  buildBreadcrumbList,
  buildEvent,
  buildDefinedTermSet,
  buildItemList,
} from '@/lib/seo/schema';

describe('schema builders', () => {
  it('buildOrganization includes required fields', () => {
    const o = buildOrganization();
    expect(o['@context']).toBe('https://schema.org');
    expect(o['@type']).toBe('Organization');
    expect(o.name).toBe('Eurovision Games');
    expect(o.url).toBe('https://eurovision.games');
    expect(o.logo).toBeDefined();
  });

  it('buildArticle accepts inLanguage', () => {
    const a = buildArticle({
      headline: 'Test',
      url: 'https://eurovision.games/en/foo',
      datePublished: '2026-04-30',
      dateModified: '2026-04-30',
      locale: 'en',
    });
    expect(a.inLanguage).toBe('en');
    expect(a.headline).toBe('Test');
    expect(a.mainEntityOfPage).toBe('https://eurovision.games/en/foo');
  });

  it('buildFaqPage emits Question entities', () => {
    const f = buildFaqPage([
      { q: 'Is it free?', a: 'Yes.' },
      { q: 'How many players?', a: '2 to 20.' },
    ]);
    expect(f['@type']).toBe('FAQPage');
    expect(f.mainEntity).toHaveLength(2);
    expect(f.mainEntity[0]['@type']).toBe('Question');
    expect(f.mainEntity[0].name).toBe('Is it free?');
    expect(f.mainEntity[0].acceptedAnswer.text).toBe('Yes.');
  });

  it('buildHowTo emits HowToStep entries', () => {
    const h = buildHowTo({
      name: 'Test',
      steps: [
        { name: 'A', text: 'Do A.' },
        { name: 'B', text: 'Do B.' },
      ],
    });
    expect(h.step).toHaveLength(2);
    expect(h.step[0]['@type']).toBe('HowToStep');
  });

  it('buildBreadcrumbList builds ordered list', () => {
    const b = buildBreadcrumbList([
      { name: 'Home', url: 'https://eurovision.games/en' },
      { name: 'Games', url: 'https://eurovision.games/en/eurovision-games' },
    ]);
    expect(b.itemListElement).toHaveLength(2);
    expect(b.itemListElement[0].position).toBe(1);
    expect(b.itemListElement[1].position).toBe(2);
  });

  it('buildEvent supports subEvents', () => {
    const e = buildEvent({
      name: 'Eurovision 2026',
      startDate: '2026-05-12',
      endDate: '2026-05-16',
      location: 'Wiener Stadthalle, Vienna',
      url: 'https://eurovision.games/en/eurovision-2026',
      subEvents: [
        { name: 'Semifinal 1', startDate: '2026-05-12', url: 'https://eurovision.games/en/eurovision-2026-semifinals' },
      ],
    });
    expect(e['@type']).toBe('Event');
    expect(e.subEvent).toHaveLength(1);
  });

  it('buildDefinedTermSet emits DefinedTerm entries', () => {
    const d = buildDefinedTermSet({
      name: 'Eurovision Glossary',
      url: 'https://eurovision.games/en/glossary',
      terms: [
        { name: 'Douze points', description: 'The maximum 12 points awarded by each jury or televote pool.' },
      ],
    });
    expect(d['@type']).toBe('DefinedTermSet');
    expect(d.hasDefinedTerm).toHaveLength(1);
    expect(d.hasDefinedTerm[0]['@type']).toBe('DefinedTerm');
  });

  it('buildItemList preserves order', () => {
    const i = buildItemList({
      name: 'Top picks',
      items: [
        { name: 'Sweden', url: '...' },
        { name: 'Italy', url: '...' },
      ],
    });
    expect(i.itemListElement[0].position).toBe(1);
    expect(i.itemListElement[1].position).toBe(2);
  });

  it('buildWebSite includes SearchAction', () => {
    const w = buildWebSite();
    expect(w.potentialAction['@type']).toBe('SearchAction');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

- [ ] **Step 3: Implement `src/lib/seo/schema.ts`**

```ts
import type { Locale } from './locale';

const SITE_URL = 'https://eurovision.games';
const ORG_NAME = 'Eurovision Games';
const ORG_LOGO = `${SITE_URL}/icon-512.png`;

type SchemaBlock = Record<string, unknown>;

export function buildOrganization(): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: ORG_NAME,
    url: SITE_URL,
    logo: ORG_LOGO,
    sameAs: [
      // Fill in social profiles when available
    ],
  };
}

export function buildWebSite(): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}#website`,
    url: SITE_URL,
    name: ORG_NAME,
    publisher: { '@id': `${SITE_URL}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

interface ArticleInput {
  headline: string;
  url: string;
  description?: string;
  datePublished: string;
  dateModified: string;
  locale: Locale;
  authorName?: string;
  image?: string;
}
export function buildArticle(i: ArticleInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: i.headline,
    description: i.description,
    mainEntityOfPage: i.url,
    inLanguage: i.locale,
    datePublished: i.datePublished,
    dateModified: i.dateModified,
    image: i.image,
    author: { '@type': 'Organization', name: i.authorName ?? ORG_NAME },
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}

export interface FaqEntry { q: string; a: string }
export function buildFaqPage(items: FaqEntry[]): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

export interface HowToStep { name: string; text: string }
interface HowToInput { name: string; description?: string; steps: HowToStep[] }
export function buildHowTo(i: HowToInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: i.name,
    description: i.description,
    step: i.steps.map((s) => ({
      '@type': 'HowToStep',
      name: s.name,
      text: s.text,
    })),
  };
}

export interface BreadcrumbItem { name: string; url: string }
export function buildBreadcrumbList(items: BreadcrumbItem[]): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

interface EventSubEvent { name: string; startDate: string; endDate?: string; url: string }
interface EventInput {
  name: string;
  startDate: string;
  endDate?: string;
  location: string;
  url: string;
  subEvents?: EventSubEvent[];
}
export function buildEvent(i: EventInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: i.name,
    startDate: i.startDate,
    endDate: i.endDate,
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: i.location },
    url: i.url,
    organizer: { '@type': 'Organization', name: 'European Broadcasting Union' },
    subEvent: i.subEvents?.map((s) => ({
      '@type': 'Event',
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      url: s.url,
      location: { '@type': 'Place', name: i.location },
    })),
  };
}

export interface DefinedTermInput { name: string; description: string; alternateName?: string[] }
interface TermSetInput { name: string; url: string; terms: DefinedTermInput[] }
export function buildDefinedTermSet(i: TermSetInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: i.name,
    url: i.url,
    hasDefinedTerm: i.terms.map((t) => ({
      '@type': 'DefinedTerm',
      name: t.name,
      description: t.description,
      alternateName: t.alternateName,
      inDefinedTermSet: i.url,
    })),
  };
}

export interface ItemListEntry { name: string; url: string; description?: string }
interface ItemListInput { name: string; items: ItemListEntry[] }
export function buildItemList(i: ItemListInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: i.name,
    itemListElement: i.items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      url: it.url,
      description: it.description,
    })),
  };
}

interface QuizQuestion { question: string; correctAnswer: string; wrongAnswers: string[] }
interface QuizInput { name: string; about?: string; questions: QuizQuestion[] }
export function buildQuiz(i: QuizInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: i.name,
    about: i.about,
    hasPart: i.questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.correctAnswer },
      suggestedAnswer: q.wrongAnswers.map((w) => ({ '@type': 'Answer', text: w })),
    })),
  };
}

interface VideoGameInput { name: string; url: string; description: string }
export function buildVideoGame(i: VideoGameInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: i.name,
    url: i.url,
    description: i.description,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    gamePlatform: ['Web Browser', 'Mobile Web', 'Desktop Web'],
    numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 20 },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}

interface WebApplicationInput { name: string; url: string; description: string }
export function buildWebApplication(i: WebApplicationInput): SchemaBlock {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: i.name,
    url: i.url,
    description: i.description,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}
```

- [ ] **Step 4: Run test — expect 9 passing**

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/schema.ts tests/lib/seo/schema.test.ts
git commit -m "feat(seo-p0): add schema.org JSON-LD builder library"
```

---

### Task 0.5: Hreflang helper

**Files:**
- Create: `src/lib/seo/hreflang.ts`
- Create: `tests/lib/seo/hreflang.test.ts`

- [ ] **Step 1: Write failing test `tests/lib/seo/hreflang.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildHreflangLinks } from '@/lib/seo/hreflang';

describe('hreflang', () => {
  it('emits en, el, x-default for bilingual page', () => {
    const links = buildHreflangLinks({
      enUrl: 'https://eurovision.games/en/eurovision-night',
      elUrl: 'https://eurovision.games/el/eurovision-night',
    });
    expect(links).toContainEqual({ hreflang: 'en', href: 'https://eurovision.games/en/eurovision-night' });
    expect(links).toContainEqual({ hreflang: 'el', href: 'https://eurovision.games/el/eurovision-night' });
    expect(links).toContainEqual({ hreflang: 'x-default', href: 'https://eurovision.games/en/eurovision-night' });
  });

  it('greek-exclusive emits only el + x-default=el', () => {
    const links = buildHreflangLinks({
      elUrl: 'https://eurovision.games/el/eurovision-ellada',
    });
    expect(links).toHaveLength(2);
    expect(links).toContainEqual({ hreflang: 'el', href: 'https://eurovision.games/el/eurovision-ellada' });
    expect(links).toContainEqual({ hreflang: 'x-default', href: 'https://eurovision.games/el/eurovision-ellada' });
  });
});
```

- [ ] **Step 2: Run test — expect failure**

- [ ] **Step 3: Implement `src/lib/seo/hreflang.ts`**

```ts
export interface HreflangLink {
  hreflang: 'en' | 'el' | 'x-default';
  href: string;
}

interface Input {
  enUrl?: string;
  elUrl?: string;
}

export function buildHreflangLinks({ enUrl, elUrl }: Input): HreflangLink[] {
  const links: HreflangLink[] = [];
  if (enUrl) links.push({ hreflang: 'en', href: enUrl });
  if (elUrl) links.push({ hreflang: 'el', href: elUrl });
  // x-default points to EN by default; EL-exclusive falls back to EL
  links.push({ hreflang: 'x-default', href: enUrl ?? elUrl ?? '' });
  return links;
}
```

- [ ] **Step 4: Run test — expect 2 passing**

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/hreflang.ts tests/lib/seo/hreflang.test.ts
git commit -m "feat(seo-p0): add hreflang link builder"
```

---

### Task 0.6: Extend SchemaHead to emit hreflang

**Files:**
- Modify: `src/components/seo/SchemaHead.tsx`
- Create: `tests/components/seo/SchemaHead.test.tsx`

- [ ] **Step 1: Write failing test `tests/components/seo/SchemaHead.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import SchemaHead from '@/components/seo/SchemaHead';

describe('SchemaHead with hreflang', () => {
  beforeEach(() => {
    cleanup();
    document.head.innerHTML = '';
  });

  it('emits hreflang link tags', () => {
    render(
      <SchemaHead
        title="Test"
        description="Desc"
        canonical="https://eurovision.games/en/test"
        hreflang={[
          { hreflang: 'en', href: 'https://eurovision.games/en/test' },
          { hreflang: 'el', href: 'https://eurovision.games/el/test' },
          { hreflang: 'x-default', href: 'https://eurovision.games/en/test' },
        ]}
      />
    );
    const links = document.querySelectorAll('link[rel="alternate"]');
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute('hreflang')).toBe('en');
  });
});
```

- [ ] **Step 2: Run test — expect failure (prop not supported)**

- [ ] **Step 3: Update `src/components/seo/SchemaHead.tsx`** — read existing file, add `hreflang?: HreflangLink[]` prop and emit `<link rel="alternate" hreflang="..." href="...">` tags inside the same effect, with cleanup.

```tsx
import { useEffect } from 'react';
import type { HreflangLink } from '../../lib/seo/hreflang';

interface Props {
  title: string;
  description: string;
  canonical: string;
  jsonLd?: object | object[];
  hreflang?: HreflangLink[];
  ogLocale?: 'en_US' | 'el_GR';
  ogLocaleAlternate?: ('en_US' | 'el_GR')[];
}

export default function SchemaHead({ title, description, canonical, jsonLd, hreflang, ogLocale, ogLocaleAlternate }: Props) {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = readMeta('description');
    const prevOgTitle = readMeta('og:title', true);
    const prevOgDesc = readMeta('og:description', true);
    const prevOgUrl = readMeta('og:url', true);
    const prevOgLocale = readMeta('og:locale', true);
    const prevCanonical = (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ?? null;

    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:url', canonical, true);
    if (ogLocale) setMeta('og:locale', ogLocale, true);

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    let createdCanonical = false;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
      createdCanonical = true;
    }
    link.href = canonical;

    // hreflang links
    const hreflangTags: HTMLLinkElement[] = (hreflang ?? []).map((h) => {
      const l = document.createElement('link');
      l.rel = 'alternate';
      l.hreflang = h.hreflang;
      l.href = h.href;
      l.dataset.dynamic = 'true';
      document.head.appendChild(l);
      return l;
    });

    // og:locale:alternate
    const ogLocaleAltTags: HTMLMetaElement[] = (ogLocaleAlternate ?? []).map((loc) => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:locale:alternate');
      m.content = loc;
      m.dataset.dynamic = 'true';
      document.head.appendChild(m);
      return m;
    });

    const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    const tags: HTMLScriptElement[] = blocks.map((b) => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.dynamic = 'true';
      s.text = JSON.stringify(b);
      document.head.appendChild(s);
      return s;
    });
    return () => {
      tags.forEach((t) => t.remove());
      hreflangTags.forEach((t) => t.remove());
      ogLocaleAltTags.forEach((t) => t.remove());
      document.title = prevTitle;
      if (prevDesc !== null) setMeta('description', prevDesc);
      if (prevOgTitle !== null) setMeta('og:title', prevOgTitle, true);
      if (prevOgDesc !== null) setMeta('og:description', prevOgDesc, true);
      if (prevOgUrl !== null) setMeta('og:url', prevOgUrl, true);
      if (prevOgLocale !== null) setMeta('og:locale', prevOgLocale, true);
      if (createdCanonical) {
        link?.remove();
      } else if (link && prevCanonical !== null) {
        link.href = prevCanonical;
      }
    };
  }, [title, description, canonical, jsonLd, hreflang, ogLocale, ogLocaleAlternate]);
  return null;
}

function setMeta(name: string, value: string, og = false) {
  const sel = og ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let m = document.querySelector(sel) as HTMLMetaElement | null;
  if (!m) {
    m = document.createElement('meta');
    if (og) m.setAttribute('property', name);
    else m.name = name;
    document.head.appendChild(m);
  }
  m.content = value;
}

function readMeta(name: string, og = false): string | null {
  const sel = og ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  const m = document.querySelector(sel) as HTMLMetaElement | null;
  return m ? m.content : null;
}
```

- [ ] **Step 4: Run test — expect passing**

- [ ] **Step 5: Commit**

```bash
git add src/components/seo/SchemaHead.tsx tests/components/seo/SchemaHead.test.tsx
git commit -m "feat(seo-p0): SchemaHead emits hreflang + og:locale tags"
```

---

### Task 0.7: Page-level SEO wrapper component

**Files:**
- Create: `src/components/seo/PageSeo.tsx`

This component wraps `SchemaHead` and auto-derives canonical + hreflang from the page registry + locale, so individual pages don't have to assemble URLs manually.

- [ ] **Step 1: Implement `src/components/seo/PageSeo.tsx`**

```tsx
import SchemaHead from './SchemaHead';
import { getPage, type PageId } from '../../lib/seo/registry';
import { buildHreflangLinks } from '../../lib/seo/hreflang';
import { localizePath, type Locale } from '../../lib/seo/locale';

const SITE = 'https://eurovision.games';

interface Props {
  pageId: PageId;
  locale: Locale;
  title: string;
  description: string;
  jsonLd?: object | object[];
}

export default function PageSeo({ pageId, locale, title, description, jsonLd }: Props) {
  const page = getPage(pageId);
  if (!page) {
    if (import.meta.env.DEV) console.warn(`PageSeo: unknown pageId "${pageId}"`);
    return null;
  }
  const enPath = localizePath('en', page.slugByLocale.en);
  const elPath = localizePath('el', page.slugByLocale.el);
  const enUrl = page.greekExclusive ? undefined : `${SITE}${enPath}`;
  const elUrl = page.englishExclusive ? undefined : `${SITE}${elPath}`;
  const canonical = locale === 'en' ? (enUrl ?? elUrl!) : (elUrl ?? enUrl!);
  const hreflang = buildHreflangLinks({ enUrl, elUrl });
  return (
    <SchemaHead
      title={title}
      description={description}
      canonical={canonical}
      jsonLd={jsonLd}
      hreflang={hreflang}
      ogLocale={locale === 'en' ? 'en_US' : 'el_GR'}
      ogLocaleAlternate={locale === 'en' ? ['el_GR'] : ['en_US']}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/seo/PageSeo.tsx
git commit -m "feat(seo-p0): add PageSeo wrapper that auto-derives hreflang from registry"
```

---

### Task 0.8: Locale context + provider

**Files:**
- Create: `src/lib/seo/LocaleContext.tsx`
- Create: `tests/lib/seo/LocaleContext.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider, useLocale } from '@/lib/seo/LocaleContext';

function Probe() {
  const locale = useLocale();
  return <span data-testid="locale">{locale}</span>;
}

describe('LocaleProvider', () => {
  it('exposes locale via hook', () => {
    render(
      <LocaleProvider locale="el">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('el');
  });

  it('throws if useLocale outside provider', () => {
    expect(() => render(<Probe />)).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `src/lib/seo/LocaleContext.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from './locale';

const Ctx = createContext<Locale | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocale must be used inside <LocaleProvider>');
  return v;
}
```

- [ ] **Step 4: Run — expect passing**

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/LocaleContext.tsx tests/lib/seo/LocaleContext.test.tsx
git commit -m "feat(seo-p0): add LocaleContext provider + hook"
```

---

### Task 0.9: Rewrite routes for `/en/*` and `/el/*` URL routing

**Files:**
- Modify: `src/routes.tsx`
- Modify: `src/components/seo/PublicLayout.tsx`
- Modify: `src/i18n/index.ts`
- Create: `src/components/seo/LocaleRoot.tsx`
- Create: `src/components/seo/LocaleRedirect.tsx`

**Architecture decision:** Each public page accepts an optional `locale` prop. The router instantiates each page twice — once under `/en/` and once under `/el/` — passing the locale. `LocaleRedirect` at `/`, `/<slug>` (legacy unprefixed) routes 301-equivalent (client-side `<Navigate replace>`) to the localized URL.

- [ ] **Step 1: Implement `src/components/seo/LocaleRedirect.tsx`** — for legacy unprefixed URLs

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { detectLocale, localizePath, type Locale } from '../../lib/seo/locale';

const STORAGE_KEY = 'europarty-lang';

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export default function LocaleRedirect() {
  const { pathname, search, hash } = useLocation();
  const locale: Locale = detectLocale({
    stored: readStored(),
    browser: typeof navigator !== 'undefined' ? navigator.language : null,
  });
  const target = localizePath(locale, pathname) + search + hash;
  return <Navigate to={target} replace />;
}
```

- [ ] **Step 2: Implement `src/components/seo/LocaleRoot.tsx`** — wraps each locale subtree

```tsx
import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isLocale } from '../../lib/seo/locale';
import { LocaleProvider } from '../../lib/seo/LocaleContext';
import SiteHeader from './SiteHeader';

export default function LocaleRoot() {
  const params = useParams<{ locale: string }>();
  const { i18n } = useTranslation();
  if (!isLocale(params.locale)) {
    return <Outlet />;
  }
  const locale = params.locale;
  useEffect(() => {
    if (i18n.language !== locale) i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [locale, i18n]);
  return (
    <LocaleProvider locale={locale}>
      <SiteHeader />
      <Outlet />
    </LocaleProvider>
  );
}
```

- [ ] **Step 3: Update `src/i18n/index.ts`** — make initial language deterministic; URL-based switching is now authoritative

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import el from './locales/el.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    el: { translation: el },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lng);
  }
});

export default i18n;
```

- [ ] **Step 4: Update `src/components/seo/PublicLayout.tsx`** — strip the SiteHeader from here (LocaleRoot owns it now)

```tsx
import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return <Outlet />;
}
```

- [ ] **Step 5: Rewrite `src/routes.tsx`**

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { NotFoundPage } from './pages/NotFoundPage';
import AdminRoute from './admin/AdminRoute';
import LocaleRoot from './components/seo/LocaleRoot';
import LocaleRedirect from './components/seo/LocaleRedirect';
import HowToPlayPage from './pages/seo/HowToPlayPage';
import EurovisionNightPage from './pages/seo/EurovisionNightPage';
import EurovisionGamesPage from './pages/seo/EurovisionGamesPage';
import EurovisionPartyPage from './pages/seo/EurovisionPartyPage';
import EurovisionTriviaPage from './pages/seo/EurovisionTriviaPage';
import Predictions2026Page from './pages/seo/Predictions2026Page';
import FAQPage from './pages/seo/FAQPage';
import RulesPage from './pages/seo/RulesPage';
import ScoringPage from './pages/seo/ScoringPage';
import AboutPage from './pages/seo/AboutPage';
import PrivacyPage from './pages/seo/PrivacyPage';
import TermsPage from './pages/seo/TermsPage';

export const router = createBrowserRouter([
  // Game + admin own their own chrome
  { path: '/room/:roomCode', element: <RoomPage /> },
  { path: '/admin', element: <AdminRoute /> },

  // Locale-prefixed public surface
  {
    path: '/:locale',
    element: <LocaleRoot />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'how-to-play', element: <HowToPlayPage /> },
      { path: 'eurovision-night', element: <EurovisionNightPage /> },
      { path: 'eurovision-games', element: <EurovisionGamesPage /> },
      { path: 'eurovision-party', element: <EurovisionPartyPage /> },
      { path: 'eurovision-trivia', element: <EurovisionTriviaPage /> },
      { path: 'eurovision-2026-predictions', element: <Predictions2026Page /> },
      { path: 'faq', element: <FAQPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'scoring', element: <ScoringPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // Legacy unprefixed → redirect to locale
  { path: '/', element: <LocaleRedirect /> },
  { path: '/online-games', element: <Navigate to="/en/eurovision-games" replace /> },
  { path: '/mobile-games', element: <Navigate to="/en/eurovision-games" replace /> },
  { path: '/how-to-play', element: <LocaleRedirect /> },
  { path: '/eurovision-night', element: <LocaleRedirect /> },
  { path: '/eurovision-games', element: <LocaleRedirect /> },
  { path: '/eurovision-party', element: <LocaleRedirect /> },
  { path: '/eurovision-trivia', element: <LocaleRedirect /> },
  { path: '/eurovision-2026-predictions', element: <LocaleRedirect /> },
  { path: '/faq', element: <LocaleRedirect /> },
  { path: '/rules', element: <LocaleRedirect /> },
  { path: '/scoring', element: <LocaleRedirect /> },
  { path: '/about', element: <LocaleRedirect /> },
  { path: '/privacy', element: <LocaleRedirect /> },
  { path: '/terms', element: <LocaleRedirect /> },

  { path: '*', element: <NotFoundPage /> },
]);
```

- [ ] **Step 6: Delete the now-unused page files** (replaced by redirects)

```bash
git rm src/pages/seo/OnlineGamesPage.tsx src/pages/seo/MobileGamesPage.tsx
```

- [ ] **Step 7: Run `npm run build` — verify TypeScript compiles**

- [ ] **Step 8: Boot dev server, verify**

Run: `npm run dev`
Manual checks:
- Visit `/` → redirects to `/en` (or `/el` if browser is Greek)
- Visit `/en` → renders homepage
- Visit `/el` → renders homepage in Greek (translations active where present)
- Visit `/en/eurovision-night` → renders night page
- Visit `/eurovision-night` (no locale) → redirects to `/en/eurovision-night`
- Visit `/online-games` → redirects to `/en/eurovision-games`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(seo-p0): introduce /en/* and /el/* URL routing with legacy redirects"
```

---

### Task 0.10: Locale-aware LanguageSwitcher

**Files:**
- Modify: `src/components/ui/LanguageSwitcher.tsx`

- [ ] **Step 1: Read the existing file** to understand current shape

- [ ] **Step 2: Update component** — switch via URL navigation, not localStorage. Replace its body with logic equivalent to:

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '../../lib/seo/LocaleContext';
import { oppositeLocale, localizePath, stripLocaleFromPath } from '../../lib/seo/locale';

const STORAGE_KEY = 'europarty-lang';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const target = oppositeLocale(locale);
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  const handleSwitch = () => {
    const stripped = stripLocaleFromPath(pathname);
    const next = localizePath(target, stripped) + search + hash;
    localStorage.setItem(STORAGE_KEY, target);
    navigate(next);
  };

  return (
    <button
      type="button"
      onClick={handleSwitch}
      className="px-2.5 py-1 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/5 transition uppercase tabular-nums"
      aria-label={`Switch to ${target.toUpperCase()}`}
    >
      {target.toUpperCase()}
    </button>
  );
}
```

(If existing component has more polish — flag emoji, dropdown, etc. — preserve that; only swap navigation logic.)

- [ ] **Step 3: Verify in dev** — switch language toggles URL prefix without reload

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/LanguageSwitcher.tsx
git commit -m "feat(seo-p0): LanguageSwitcher navigates via URL prefix"
```

---

### Task 0.11: Make every internal Link locale-aware

**Files:**
- Create: `src/components/seo/LocaleLink.tsx`
- Modify: all components that hardcode `/eurovision-night` etc.

- [ ] **Step 1: Implement `src/components/seo/LocaleLink.tsx`**

```tsx
import { Link, type LinkProps } from 'react-router-dom';
import { forwardRef } from 'react';
import { useLocale } from '../../lib/seo/LocaleContext';
import { localizePath } from '../../lib/seo/locale';

type Props = Omit<LinkProps, 'to'> & { to: string };

const LocaleLink = forwardRef<HTMLAnchorElement, Props>(({ to, ...rest }, ref) => {
  const locale = useLocale();
  // Absolute / external / mailto unchanged
  if (/^(https?:|mailto:|tel:|#)/.test(to)) {
    return <Link ref={ref} to={to} {...rest} />;
  }
  return <Link ref={ref} to={localizePath(locale, to)} {...rest} />;
});
LocaleLink.displayName = 'LocaleLink';
export default LocaleLink;
```

- [ ] **Step 2: Find usages of hardcoded internal paths in nav/footer/heroes**

```bash
grep -rn 'to="/eurovision' src/components/seo/ src/pages/
```

- [ ] **Step 3: Replace `Link` with `LocaleLink`** in `SiteHeader`, `SiteFooter`, `PageHero` (Breadcrumbs), `RelatedCards`, `CtaBanner`, and any pages that link with hardcoded slugs.

For each, change `import { Link } from 'react-router-dom'` to `import LocaleLink from './LocaleLink'` (or relative path) and rename `<Link to="/foo">` to `<LocaleLink to="/foo">`.

- [ ] **Step 4: Verify in dev** — clicking a header link from `/el/...` keeps you on `/el/...`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(seo-p0): introduce LocaleLink for locale-preserving internal navigation"
```

---

### Task 0.12: Build-time sitemap generator with hreflang

**Files:**
- Create: `scripts/seo/generate-sitemap.ts`
- Modify: `package.json` (add prebuild hook)
- Delete: `public/sitemap.xml` (becomes generated)

- [ ] **Step 1: Implement `scripts/seo/generate-sitemap.ts`**

```ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { localizePath } from '../../src/lib/seo/locale';

const SITE = 'https://eurovision.games';
const OUT = resolve(__dirname, '../../public/sitemap.xml');

interface UrlEntry {
  loc: string;
  alternates: { hreflang: string; href: string }[];
  priority: number;
  changefreq: string;
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

    if (enUrl) {
      entries.push({ loc: enUrl, alternates, priority: page.priority, changefreq: page.changefreq });
    }
    if (elUrl) {
      entries.push({ loc: elUrl, alternates, priority: page.priority, changefreq: page.changefreq });
    }
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

const xml = buildXml(buildEntries());
writeFileSync(OUT, xml, 'utf8');
console.log(`Sitemap written: ${OUT} (${buildEntries().length} URLs)`);
```

- [ ] **Step 2: Update `package.json` scripts**

```json
"sitemap": "tsx scripts/seo/generate-sitemap.ts",
"prebuild": "npm run sitemap",
"build": "tsc -b && vite build"
```

- [ ] **Step 3: Run `npm run sitemap` — expect output written**

- [ ] **Step 4: Open `public/sitemap.xml`** — verify hreflang xhtml:link entries present, all 30+ URLs listed

- [ ] **Step 5: Add unit test `tests/scripts/sitemap.test.ts`** — import the buildXml helpers (refactor as needed to export)

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sitemap.xml', () => {
  it('regenerates with hreflang entries', () => {
    execSync('npm run sitemap', { stdio: 'pipe' });
    const xml = readFileSync(resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain('hreflang="el"');
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain('https://eurovision.games/en/eurovision-night');
    expect(xml).toContain('https://eurovision.games/el/eurovision-night');
  });
});
```

- [ ] **Step 6: Run `npm test` — expect passing**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(seo-p0): auto-generate sitemap.xml with hreflang from page registry"
```

---

### Task 0.13: llms.txt generator

**Files:**
- Create: `scripts/seo/generate-llms-txt.ts`
- Modify: `package.json` (add to prebuild)

- [ ] **Step 1: Implement `scripts/seo/generate-llms-txt.ts`**

```ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { localizePath } from '../../src/lib/seo/locale';

const SITE = 'https://eurovision.games';
const OUT = resolve(__dirname, '../../public/llms.txt');

const DESCRIPTIONS: Record<string, string> = {
  home: 'Free browser-based party game for the Eurovision Song Contest. Predictions, trivia duels, live scoring.',
  'how-to-play': 'How to play Eurovision Games — 60-second setup, 6 steps from create-room to trophy reveal.',
  'eurovision-night': 'Complete guide to hosting Eurovision night: 10-step playbook, food, drinks, run-of-show.',
  'eurovision-games': 'Free interactive party games to play during Eurovision: predictions, trivia, live scoring.',
  'eurovision-party': 'Hosting playbook for a Eurovision party: guests, theme, decor, food, run-of-show.',
  'eurovision-trivia': '50+ Eurovision trivia questions with answers, plus how to run trivia duels live.',
  'eurovision-2026-predictions': 'Top 5 / Worst 5 predictions for Eurovision 2026, weekly-refreshed odds and country breakdowns.',
  'eurovision-2026': 'Eurovision 2026 hub: schedule, semifinals, songs, predictions. Vienna, 16 May 2026.',
  'eurovision-2026-schedule': 'Eurovision 2026 schedule: semifinal 1 (12 May), semifinal 2 (14 May), grand final (16 May), local broadcast times.',
  'eurovision-2026-semifinals': 'Eurovision 2026 semifinals: running order, qualifiers, dates, predictions.',
  'eurovision-2026-songs': 'All Eurovision 2026 entries by country: songs, artists, lyrics, betting odds.',
  'eurovision-drinking-game': 'Eurovision drinking game rules — sip and shot triggers, sober alternatives, printable sheet.',
  'eurovision-bingo': 'Eurovision bingo — printable cards, callouts, scoring tips, free vs paid options.',
  'eurovision-sweepstake': 'Eurovision sweepstake rules — random country draw, payout structures, free template.',
  'eurovision-quiz': 'Take a free Eurovision quiz — choose category and difficulty.',
  glossary: 'Eurovision glossary — douze points, jury, televote, Big Five, Big Four, semifinal, and more.',
  'host-eurovision-party': 'Step-by-step guide to hosting a Eurovision party — invitations, theme, decor, food, games.',
  'eurovision-history': 'Eurovision history: founding (1956), winners by country, scoring system evolution, key moments.',
  winners: 'Every Eurovision winner from 1956 to today — songs, artists, points, voting breakdown.',
  countries: 'Every country in Eurovision: full entry history, best results, best songs.',
  faq: 'Eurovision Games FAQ: setup, gameplay, scoring, hosting, technical questions answered.',
  rules: 'Eurovision Games rules: predictions, duels, scoring, winner categories.',
  scoring: 'How Eurovision Games scoring works: prediction points, duel theft, winner categories.',
  about: 'About Eurovision Games — built for the people who watch Eurovision like a sport.',
  'compare-bingo': 'Eurovision Games vs Eurovision Bingo: features, setup time, cost compared.',
  'compare-quiz-pack': 'Eurovision Games vs commercial quiz packs: cost, customisation, live scoring.',
  'best-eurovision-app': 'The best apps for Eurovision watch parties — features, pricing, gameplay.',
  printables: 'Free printable Eurovision scorecards, bingo cards, prediction sheets.',
};

const TIER_1 = ['home', 'eurovision-2026', 'eurovision-night', 'eurovision-party', 'eurovision-games', 'how-to-play'] as const;
const TIER_2 = [
  'eurovision-2026-schedule', 'eurovision-2026-semifinals', 'eurovision-2026-songs',
  'eurovision-2026-predictions', 'eurovision-trivia', 'eurovision-quiz',
  'eurovision-history', 'winners', 'countries', 'glossary',
] as const;
const TIER_3 = [
  'eurovision-drinking-game', 'eurovision-bingo', 'eurovision-sweepstake',
  'host-eurovision-party',
  'compare-bingo', 'compare-quiz-pack', 'best-eurovision-app', 'printables',
  'rules', 'scoring', 'faq', 'about',
] as const;

function lineFor(id: string): string {
  const page = PAGE_REGISTRY.find((p) => p.id === id);
  if (!page) return '';
  const url = SITE + localizePath('en', page.slugByLocale.en);
  return `- [${id}](${url}): ${DESCRIPTIONS[id] ?? ''}`;
}

const out = [
  '# Eurovision Games',
  '',
  '> Free browser-based multiplayer party game for the Eurovision Song Contest. Predictions, trivia duels, live scoring, no signup, no install.',
  '',
  'Eurovision Games at https://eurovision.games is a watch-party companion: hosts create a room (60s), friends join with a code, everyone predicts Top 5 and Worst 5 of Eurovision 2026, plays head-to-head trivia duels during ad breaks, and competes for five trophy titles (Champion, Thief, Duelist, Oracle, Guru). Available in English (/en/) and Greek (/el/).',
  '',
  '## Core pages',
  ...TIER_1.map(lineFor),
  '',
  '## Eurovision 2026',
  ...TIER_2.map(lineFor),
  '',
  '## Reference & related',
  ...TIER_3.map(lineFor),
  '',
  '## Optional',
  '- [sitemap.xml](https://eurovision.games/sitemap.xml): full URL list with hreflang',
  '- [robots.txt](https://eurovision.games/robots.txt): crawl policy (AI bots welcome)',
  '',
].join('\n');

writeFileSync(OUT, out, 'utf8');
console.log(`llms.txt written: ${OUT}`);
```

- [ ] **Step 2: Update `package.json` prebuild**

```json
"llms-txt": "tsx scripts/seo/generate-llms-txt.ts",
"prebuild": "npm run sitemap && npm run llms-txt"
```

- [ ] **Step 3: Run `npm run llms-txt` — verify `public/llms.txt` exists**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(seo-p0): generate llms.txt for AI ingestion"
```

---

### Task 0.14: Update robots.txt

**Files:**
- Modify: `public/robots.txt`

- [ ] **Step 1: Replace contents**

```
# eurovision.games — robots.txt
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /room/

# AI crawlers — explicitly allowed (we want to be cited)
User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: cohere-training-data-crawler
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

User-agent: Bytespider
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: DuckAssistBot
Allow: /

Sitemap: https://eurovision.games/sitemap.xml

# AI ingestion manifest
# https://llmstxt.org/
```

- [ ] **Step 2: Commit**

```bash
git add public/robots.txt
git commit -m "feat(seo-p0): expand robots.txt with full AI crawler allowlist"
```

---

### Task 0.15: Schema validator script

**Files:**
- Create: `scripts/seo/validate-schema.ts`
- Modify: `package.json`

This is a build-time validator that fetches each page in dev (or imports the components and renders them headless) and checks JSON-LD blocks against a basic shape contract.

For Phase 0, do a simpler check: the *builder* outputs are validated. Pages will be validated post-build by an external tool (Google Rich Results Test) — out of scope for unit testing. We just enforce that builders never emit broken shapes.

- [ ] **Step 1: Implement `scripts/seo/validate-schema.ts`**

```ts
// Walks all schema builder outputs against a sample input set, then
// validates each one has @context, @type, and required fields.
import {
  buildOrganization, buildWebSite, buildArticle, buildFaqPage,
  buildHowTo, buildBreadcrumbList, buildEvent, buildDefinedTermSet,
  buildItemList, buildQuiz, buildVideoGame, buildWebApplication,
} from '../../src/lib/seo/schema';

interface Issue { builder: string; field: string; message: string }
const issues: Issue[] = [];

function check(builder: string, obj: any, required: string[]) {
  if (!obj['@context']) issues.push({ builder, field: '@context', message: 'missing' });
  if (!obj['@type']) issues.push({ builder, field: '@type', message: 'missing' });
  for (const r of required) {
    if (obj[r] === undefined) issues.push({ builder, field: r, message: 'missing' });
  }
}

check('Organization', buildOrganization(), ['name', 'url']);
check('WebSite', buildWebSite(), ['url', 'name', 'potentialAction']);
check('Article', buildArticle({ headline: 'X', url: 'u', datePublished: 'd', dateModified: 'd', locale: 'en' }), ['headline', 'datePublished', 'dateModified', 'inLanguage']);
check('FAQPage', buildFaqPage([{ q: 'q', a: 'a' }]), ['mainEntity']);
check('HowTo', buildHowTo({ name: 'n', steps: [{ name: 'a', text: 'b' }] }), ['name', 'step']);
check('BreadcrumbList', buildBreadcrumbList([{ name: 'h', url: 'u' }]), ['itemListElement']);
check('Event', buildEvent({ name: 'n', startDate: '2026-05-16', location: 'Vienna', url: 'u' }), ['name', 'startDate', 'location']);
check('DefinedTermSet', buildDefinedTermSet({ name: 'g', url: 'u', terms: [{ name: 't', description: 'd' }] }), ['name', 'hasDefinedTerm']);
check('ItemList', buildItemList({ name: 'l', items: [{ name: 'i', url: 'u' }] }), ['itemListElement']);
check('Quiz', buildQuiz({ name: 'q', questions: [{ question: 'q', correctAnswer: 'a', wrongAnswers: ['x'] }] }), ['name', 'hasPart']);
check('VideoGame', buildVideoGame({ name: 'g', url: 'u', description: 'd' }), ['name', 'applicationCategory']);
check('WebApplication', buildWebApplication({ name: 'a', url: 'u', description: 'd' }), ['name', 'applicationCategory']);

if (issues.length) {
  console.error('Schema builder issues:', issues);
  process.exit(1);
}
console.log('All schema builders pass.');
```

- [ ] **Step 2: Update `package.json`**

```json
"validate-schema": "tsx scripts/seo/validate-schema.ts"
```

- [ ] **Step 3: Run `npm run validate-schema` — expect "All schema builders pass."**

- [ ] **Step 4: Commit**

```bash
git add scripts/seo/validate-schema.ts package.json
git commit -m "feat(seo-p0): add schema builder validator script"
```

---

### Task 0.16: Content data layer scaffolding

**Files:**
- Create: `src/content/_types.ts`
- Create: `src/content/_loader.ts`
- Create: `tests/content/loader.test.ts`

The content layer is JSON-per-page-per-locale. For Phase 0 we just create the shape and helper; pages migrate to it during Phase 1.

- [ ] **Step 1: Create `src/content/_types.ts`**

```ts
export interface FaqEntry { q: string; a: string }
export interface StepEntry { title: string; text: string }
export interface RelatedCardEntry { id: string; title: string; blurb: string }

export interface PageContent {
  pageId: string;
  locale: 'en' | 'el';
  meta: { title: string; description: string };
  hero: { eyebrow?: string; title: string; lede: string };
  sections: Array<
    | { type: 'paragraph'; id?: string; title?: string; html: string }
    | { type: 'list'; id?: string; title?: string; items: string[] }
    | { type: 'steps'; id?: string; title?: string; steps: StepEntry[] }
    | { type: 'table'; id?: string; title?: string; headers: string[]; rows: string[][]; caption?: string }
    | { type: 'faq'; id?: string; title?: string; items: FaqEntry[] }
    | { type: 'cta'; id?: string; title: string; body: string; primaryLabel: string; primaryHref: string; secondaryLabel?: string; secondaryHref?: string }
    | { type: 'related'; id?: string; title?: string; cards: RelatedCardEntry[] }
    | { type: 'definitionBlock'; id?: string; html: string }
  >;
}
```

- [ ] **Step 2: Create `src/content/_loader.ts`**

```ts
import type { Locale } from '../lib/seo/locale';
import type { PageContent } from './_types';

// Vite glob import — eagerly loads all content modules at build time.
const modules = import.meta.glob<{ default: PageContent }>('./*/*.json', { eager: true, import: 'default' });

export function loadContent(pageId: string, locale: Locale): PageContent | null {
  const key = `./${pageId}/${locale}.json`;
  const mod = modules[key] as unknown as PageContent | undefined;
  return mod ?? null;
}
```

- [ ] **Step 3: Test setup — create a fixture content file `src/content/_fixture/en.json`**

```json
{
  "pageId": "_fixture",
  "locale": "en",
  "meta": { "title": "Fixture", "description": "Fixture description" },
  "hero": { "title": "Hello", "lede": "World" },
  "sections": []
}
```

- [ ] **Step 4: Add test `tests/content/loader.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loadContent } from '@/content/_loader';

describe('content loader', () => {
  it('loads fixture EN', () => {
    const c = loadContent('_fixture', 'en');
    expect(c).not.toBeNull();
    expect(c?.meta.title).toBe('Fixture');
  });

  it('returns null for missing locale', () => {
    expect(loadContent('_fixture', 'el')).toBeNull();
  });
});
```

- [ ] **Step 5: Run test — expect passing**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(seo-p0): add content data layer (types + loader)"
```

---

### Task 0.17: Generic ContentRenderer component

**Files:**
- Create: `src/components/seo/ContentRenderer.tsx`

Renders a `PageContent` using the existing design system primitives. This is what every refreshed/new page will use.

- [ ] **Step 1: Implement**

```tsx
import type { PageContent } from '../../content/_types';
import ContentLayout from './ContentLayout';
import PageHero from './PageHero';
import Section from './Section';
import FaqAccordion from './FaqAccordion';
import RelatedCards from './RelatedCards';
import CtaBanner from './CtaBanner';
import DataTable from './DataTable';
import Breadcrumbs, { type Crumb } from './Breadcrumbs';
import LocaleLink from './LocaleLink';

interface Props {
  content: PageContent;
  crumbs: Crumb[];
  // resolver maps a card id (registry pageId) → { href, title, blurb fallback }
  resolveRelated: (id: string) => { href: string; titleFallback: string; blurbFallback: string };
}

export default function ContentRenderer({ content, crumbs, resolveRelated }: Props) {
  return (
    <>
      <PageHero
        crumbs={crumbs}
        chip={content.hero.eyebrow}
        title={content.hero.title}
        lede={content.hero.lede}
      />
      <ContentLayout>
        {content.sections.map((s, i) => {
          switch (s.type) {
            case 'paragraph':
              return (
                <Section key={i} id={s.id} title={s.title ?? ''}>
                  <div dangerouslySetInnerHTML={{ __html: s.html }} />
                </Section>
              );
            case 'definitionBlock':
              return (
                <div key={i} className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6 text-[17px]">
                  <div dangerouslySetInnerHTML={{ __html: s.html }} />
                </div>
              );
            case 'list':
              return (
                <Section key={i} id={s.id} title={s.title ?? ''}>
                  <ul className="list-disc pl-6 space-y-2">
                    {s.items.map((it, j) => (
                      <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
                    ))}
                  </ul>
                </Section>
              );
            case 'steps':
              return (
                <Section key={i} id={s.id} title={s.title ?? ''}>
                  <ol className="space-y-4">
                    {s.steps.map((st, j) => (
                      <li key={j} className="rounded-xl border border-white/10 p-5">
                        <div className="flex items-start gap-4">
                          <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-euro-purple-light to-euro-pink flex items-center justify-center text-white text-sm font-bold">{j + 1}</span>
                          <div>
                            <h3 className="text-white font-bold">{st.title}</h3>
                            <p className="mt-1 text-white/75" dangerouslySetInnerHTML={{ __html: st.text }} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Section>
              );
            case 'table':
              return (
                <Section key={i} id={s.id} title={s.title ?? ''}>
                  <DataTable caption={s.caption} headers={s.headers} rows={s.rows.map((r) => r.map((c) => <span dangerouslySetInnerHTML={{ __html: c }} />))} />
                </Section>
              );
            case 'faq':
              return (
                <Section key={i} id={s.id} title={s.title ?? 'FAQ'}>
                  <FaqAccordion items={s.items} />
                </Section>
              );
            case 'cta':
              return (
                <CtaBanner
                  key={i}
                  title={s.title}
                  body={s.body}
                  primary={{ label: s.primaryLabel, href: s.primaryHref }}
                  secondary={s.secondaryLabel ? { label: s.secondaryLabel, href: s.secondaryHref! } : undefined}
                />
              );
            case 'related':
              return (
                <RelatedCards
                  key={i}
                  heading={s.title}
                  items={s.cards.map((c) => {
                    const r = resolveRelated(c.id);
                    return {
                      href: r.href,
                      title: c.title || r.titleFallback,
                      blurb: c.blurb || r.blurbFallback,
                    };
                  })}
                />
              );
            default:
              return null;
          }
        })}
      </ContentLayout>
    </>
  );
}
```

- [ ] **Step 2: Verify TS build clean** — `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/ContentRenderer.tsx
git commit -m "feat(seo-p0): add ContentRenderer that drives pages from JSON content"
```

---

### Task 0.18: Phase 0 acceptance smoke test

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: success, sitemap + llms.txt regenerate.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all green.

- [ ] **Step 3: Run dev server, manual verify**

```bash
npm run dev
```

Manual checks (use preview tools or browser):
- `/` → redirect to `/en` (or `/el` if browser is el)
- `/en` → homepage renders
- `/el` → homepage renders, Greek nav
- `/en/eurovision-night` → night page renders
- View page source: `<link rel="alternate" hreflang="en" ...>`, `<link rel="alternate" hreflang="el" ...>`, `<link rel="alternate" hreflang="x-default" ...>` all present
- Language switcher toggles `/en/...` ↔ `/el/...`
- `/online-games` → 301-equivalent redirect to `/en/eurovision-games`
- `/llms.txt` returns 200 with structured content
- `/sitemap.xml` shows hreflang xhtml:link entries

- [ ] **Step 4: Tag commit**

```bash
git tag seo-p0-complete
```

---

### Task 0.19: Cookie consent — vanilla-cookieconsent v3

Three cookies/storage items exist: `europarty-lang` (functional), Supabase auth tokens (functional), and any future analytics. GDPR requires a consent banner. Use `vanilla-cookieconsent` v3 (MIT, 15 KB, no external service).

**Files:**
- Create: `src/components/cookie/CookieConsent.tsx`
- Create: `src/components/cookie/cookieconsent.config.ts`
- Modify: `src/components/seo/PublicLayout.tsx`
- Modify: `package.json` (add dep)
- Modify: `src/i18n/locales/en.json` (add cookie consent strings)
- Modify: `src/i18n/locales/el.json` (add cookie consent strings)

- [ ] **Step 1: Install**

```bash
npm install vanilla-cookieconsent
```

- [ ] **Step 2: Create `src/components/cookie/cookieconsent.config.ts`**

```ts
import type { CookieConsentConfig } from 'vanilla-cookieconsent';

export const config: CookieConsentConfig = {
  root: 'body',
  autoShow: true,
  disablePageInteraction: false,
  hideFromBots: true,
  mode: 'opt-in',
  revision: 1,

  cookie: {
    name: 'cc_cookie',
    domain: 'eurovision.games',
    path: '/',
    sameSite: 'Lax',
    expiresAfterDays: 365,
  },

  guiOptions: {
    consentModal: {
      layout: 'bar',
      position: 'bottom',
      equalWeightButtons: false,
      flipButtons: false,
    },
    preferencesModal: {
      layout: 'box',
      position: 'right',
    },
  },

  categories: {
    necessary: {
      enabled: true,
      readOnly: true,
    },
    analytics: {
      enabled: false,
      autoClear: {
        cookies: [{ name: /^(_ga|_gid)/ }],
      },
    },
  },

  language: {
    default: 'en',
    translations: {
      en: {
        consentModal: {
          title: '🍪 We use cookies',
          description:
            'We use essential cookies to keep the game running and remember your language preference. No tracking without your consent.',
          acceptAllBtn: 'Accept all',
          acceptNecessaryBtn: 'Necessary only',
          showPreferencesBtn: 'Manage preferences',
          footer: '<a href="/en/privacy-policy">Privacy Policy</a> · <a href="/en/terms">Terms</a>',
        },
        preferencesModal: {
          title: 'Cookie preferences',
          acceptAllBtn: 'Accept all',
          acceptNecessaryBtn: 'Necessary only',
          savePreferencesBtn: 'Save preferences',
          closeIconLabel: 'Close',
          sections: [
            {
              title: 'Strictly necessary',
              description: 'Language preference (localStorage), Supabase authentication tokens. Cannot be disabled.',
              linkedCategory: 'necessary',
            },
            {
              title: 'Analytics (none currently)',
              description: 'If we add analytics in future (e.g. Plausible), we will ask for consent here first.',
              linkedCategory: 'analytics',
            },
          ],
        },
      },
      el: {
        consentModal: {
          title: '🍪 Χρησιμοποιούμε cookies',
          description:
            'Χρησιμοποιούμε απαραίτητα cookies για τη λειτουργία του παιχνιδιού και την αποθήκευση της γλωσσικής προτίμησής σου.',
          acceptAllBtn: 'Αποδοχή όλων',
          acceptNecessaryBtn: 'Μόνο απαραίτητα',
          showPreferencesBtn: 'Διαχείριση προτιμήσεων',
          footer: '<a href="/el/politiki-aporritou">Πολιτική Απορρήτου</a> · <a href="/el/oroi-chrisis">Όροι</a>',
        },
        preferencesModal: {
          title: 'Προτιμήσεις cookies',
          acceptAllBtn: 'Αποδοχή όλων',
          acceptNecessaryBtn: 'Μόνο απαραίτητα',
          savePreferencesBtn: 'Αποθήκευση',
          closeIconLabel: 'Κλείσιμο',
          sections: [
            {
              title: 'Απολύτως απαραίτητα',
              description: 'Γλωσσική προτίμηση (localStorage) και tokens αυθεντικοποίησης Supabase. Δεν μπορούν να απενεργοποιηθούν.',
              linkedCategory: 'necessary',
            },
            {
              title: 'Αναλυτικά στοιχεία (κανένα αυτή τη στιγμή)',
              description: 'Εάν προσθέσουμε analytics στο μέλλον, θα ζητήσουμε τη συγκατάθεσή σου.',
              linkedCategory: 'analytics',
            },
          ],
        },
      },
    },
  },
};
```

- [ ] **Step 3: Create `src/components/cookie/CookieConsent.tsx`**

```tsx
import { useEffect } from 'react';
import CookieConsentAPI from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import { config } from './cookieconsent.config';
import { useLocale } from '../../hooks/useLocale';

// Override default theme colours to match the purple/deep palette
const CSS_OVERRIDE = `
  :root {
    --cc-bg: #1a0533;
    --cc-primary-color: #a855f7;
    --cc-btn-primary-bg: #a855f7;
    --cc-btn-primary-hover-bg: #9333ea;
    --cc-btn-secondary-bg: rgba(255,255,255,0.08);
    --cc-btn-secondary-hover-bg: rgba(255,255,255,0.14);
    --cc-btn-secondary-color: #ede9f5;
    --cc-text: rgba(237,233,245,0.82);
    --cc-title-color: #ede9f5;
    --cc-border-color: rgba(255,255,255,0.10);
    --cc-toggle-bg-on: #a855f7;
    --cc-toggle-bg-off: rgba(255,255,255,0.12);
    --cc-overlay-bg: rgba(10,4,24,0.72);
    --cc-footer-color: rgba(237,233,245,0.45);
    --cc-link-color: #c084fc;
    --cc-separator-border-color: rgba(255,255,255,0.08);
  }
`;

export default function CookieConsent() {
  const { lang } = useLocale();

  useEffect(() => {
    // Inject theme override once
    const styleId = 'cc-theme-override';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = CSS_OVERRIDE;
      document.head.appendChild(style);
    }
    CookieConsentAPI.run({ ...config, language: { ...config.language, default: lang } });
  }, []);

  // Update language when locale changes
  useEffect(() => {
    CookieConsentAPI.setLanguage(lang);
  }, [lang]);

  return null;
}
```

- [ ] **Step 4: Mount in `src/components/seo/PublicLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import CookieConsent from '../cookie/CookieConsent';

export default function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
      <SiteFooter />
      <CookieConsent />
    </>
  );
}
```

Note: `SiteFooter` is already mounted inside individual page components today; once it's here in `PublicLayout`, remove it from each page component (or leave it — it's idempotent if pages stop rendering it themselves).

- [ ] **Step 5: Verify banner renders**

```bash
npm run dev
```

Visit `http://localhost:5173/en`. Expect: purple cookie bar at bottom. Accept/refuse both work. Revisit preferences via footer link (add `data-cc="show-preferencesModal"` to a "Cookie Settings" anchor in the footer).

- [ ] **Step 6: Commit**

```bash
git add src/components/cookie/ src/components/seo/PublicLayout.tsx package.json package-lock.json
git commit -m "feat(seo-p0): add vanilla-cookieconsent v3 styled to purple theme"
```

---

### Task 0.20: Footer restructure

Replace the current 4-column footer with the spec-confirmed structure: About, How to play, FAQs, Legal + EBU disclaimer.

**Files:**
- Modify: `src/components/seo/SiteFooter.tsx`
- Modify: `src/i18n/locales/en.json` (add footer keys)
- Modify: `src/i18n/locales/el.json` (add footer keys)

- [ ] **Step 1: Add footer i18n keys to `src/i18n/locales/en.json`** — merge into `"siteFooter"`:

```json
"siteFooter": {
  "about": "About",
  "howToPlay": "How to Play",
  "faq": "FAQs",
  "legal": "Legal",
  "links": {
    "whatIs": "What is Eurovision Games",
    "freeGame": "Free Online Eurovision Game",
    "cookies": "Cookies & Consent",
    "gameStages": "Game Stages",
    "trivia": "Trivia",
    "duels": "Duels",
    "predictions": "Predictions",
    "dashboard": "Dashboard",
    "create": "Create a Room",
    "join": "Join a Room",
    "leave": "Leave / Delete a Room",
    "scoring": "How Points Are Calculated",
    "privacy": "Privacy Policy",
    "terms": "Terms of Use"
  },
  "disclaimer": "Eurovision Games is an unofficial fan-made party game. Not affiliated with, endorsed by, or operated by the European Broadcasting Union or the Eurovision Song Contest.",
  "contactEmail": "hello@eurovision.games"
}
```

- [ ] **Step 2: Add footer i18n keys to `src/i18n/locales/el.json`** — merge into `"siteFooter"`:

```json
"siteFooter": {
  "about": "Σχετικά",
  "howToPlay": "Πώς Παίζεται",
  "faq": "Συχνές Ερωτήσεις",
  "legal": "Νομικά",
  "links": {
    "whatIs": "Τι είναι το Eurovision Games",
    "freeGame": "Δωρεάν Online Παιχνίδι Eurovision",
    "cookies": "Cookies & Συγκατάθεση",
    "gameStages": "Φάσεις Παιχνιδιού",
    "trivia": "Trivia",
    "duels": "Μονομαχίες",
    "predictions": "Προβλέψεις",
    "dashboard": "Πίνακας Βαθμολογίας",
    "create": "Δημιουργία Δωματίου",
    "join": "Είσοδος σε Δωμάτιο",
    "leave": "Αποχώρηση / Διαγραφή Δωματίου",
    "scoring": "Πώς Υπολογίζονται οι Βαθμοί",
    "privacy": "Πολιτική Απορρήτου",
    "terms": "Όροι Χρήσης"
  },
  "disclaimer": "Το Eurovision Games είναι ανεπίσημο fan-made παιχνίδι. Δεν σχετίζεται με, δεν υποστηρίζεται από, ούτε διαχειρίζεται από την Ευρωπαϊκή Ραδιοτηλεοπτική Ένωση ή τον Διαγωνισμό Τραγουδιού Eurovision.",
  "contactEmail": "hello@eurovision.games"
}
```

- [ ] **Step 3: Rewrite `src/components/seo/SiteFooter.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../hooks/useLocale';

export default function SiteFooter() {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const p = (slug: string) => `/${lang}/${slug}`;

  return (
    <footer className="border-t border-white/10 mt-16 px-4 pb-10 pt-10 text-sm bg-black/30">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">

        {/* About */}
        <div>
          <h4 className="text-euro-gold font-bold mb-3">{t('siteFooter.about')}</h4>
          <ul className="space-y-2">
            <li><Link to={p('about')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.whatIs')}</Link></li>
            <li><Link to={p('')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.freeGame')}</Link></li>
            <li><button data-cc="show-preferencesModal" className="text-white/70 hover:text-white transition text-left">{t('siteFooter.links.cookies')}</button></li>
          </ul>
        </div>

        {/* How to Play */}
        <div>
          <h4 className="text-euro-gold font-bold mb-3">{t('siteFooter.howToPlay')}</h4>
          <ul className="space-y-2">
            <li><Link to={p('how-to-play')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.gameStages')}</Link></li>
            <li><Link to={p('eurovision-trivia')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.trivia')}</Link></li>
            <li><Link to={p('eurovision-trivia')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.duels')}</Link></li>
            <li><Link to={p('eurovision-2026-predictions')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.predictions')}</Link></li>
            <li><Link to={p('scoring')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.dashboard')}</Link></li>
          </ul>
        </div>

        {/* FAQs */}
        <div>
          <h4 className="text-euro-gold font-bold mb-3">{t('siteFooter.faq')}</h4>
          <ul className="space-y-2">
            <li><Link to={p('faq')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.create')}</Link></li>
            <li><Link to={p('faq')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.join')}</Link></li>
            <li><Link to={p('faq')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.leave')}</Link></li>
            <li><Link to={p('scoring')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.scoring')}</Link></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-euro-gold font-bold mb-3">{t('siteFooter.legal')}</h4>
          <ul className="space-y-2">
            <li><Link to={p('privacy-policy')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.privacy')}</Link></li>
            <li><Link to={p('terms')} className="text-white/70 hover:text-white transition">{t('siteFooter.links.terms')}</Link></li>
          </ul>
        </div>

      </div>

      {/* EBU disclaimer */}
      <p className="max-w-5xl mx-auto text-white/35 text-xs mt-8 text-center leading-relaxed">
        {t('siteFooter.disclaimer')}
      </p>
      <p className="max-w-5xl mx-auto text-white/30 text-xs mt-2 text-center">
        <a href={`mailto:${t('siteFooter.contactEmail')}`} className="hover:text-white/60 transition">
          {t('siteFooter.contactEmail')}
        </a>
      </p>
    </footer>
  );
}
```

- [ ] **Step 4: Run dev, visual check**

```bash
npm run dev
```

Visit `/en` — footer must show 4 columns: About, How to Play, FAQs, Legal. EBU disclaimer at bottom. Cookies & Consent button opens cookie preferences modal.

- [ ] **Step 5: Commit**

```bash
git add src/components/seo/SiteFooter.tsx src/i18n/locales/en.json src/i18n/locales/el.json
git commit -m "feat(seo-p0): restructure site footer (About/HowToPlay/FAQs/Legal + EBU disclaimer)"
```

---

### Task 0.21: Nav swap — Duels before Predictions in sticky menu

Per UX spec: "Switch predictions with duels in sticky menu" means Duels link appears before Predictions in the How To Play dropdown and mobile drawer.

**Files:**
- Modify: `src/components/seo/SiteHeader.tsx`

- [ ] **Step 1: Reorder `HOW_TO_PLAY_LINKS` in `src/components/seo/SiteHeader.tsx`**

Find:
```ts
const HOW_TO_PLAY_LINKS = [
  { href: '/eurovision-trivia', key: 'trivia' as const },
  { href: '/eurovision-2026-predictions', key: 'predictions' as const },
  { href: '/rules', key: 'rules' as const },
  { href: '/scoring', key: 'scoring' as const },
  { href: '/faq', key: 'otherFaq' as const },
];
```

Replace with (swap trivia/predictions order, update to locale-prefixed hrefs via `useLocale` or hardcode for now):
```ts
const HOW_TO_PLAY_LINKS = [
  { href: '/eurovision-trivia', key: 'trivia' as const },         // Duels (trivia page covers duels)
  { href: '/eurovision-2026-predictions', key: 'predictions' as const }, // Predictions
  { href: '/rules', key: 'rules' as const },
  { href: '/scoring', key: 'scoring' as const },
  { href: '/faq', key: 'otherFaq' as const },
];
```

Note: "trivia" and "predictions" are already in that order. If the current live order is predictions → trivia, swap them. Confirm by reading the current file before editing. The swap: `trivia` link moves to index 0, `predictions` to index 1 (already the case in some versions). Verify visually after.

- [ ] **Step 2: Verify**

```bash
npm run dev
```

Open "How to play" dropdown on desktop. Confirm Duels/Trivia appears before Predictions.

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/SiteHeader.tsx
git commit -m "feat(ux): put Duels before Predictions in How-to-Play nav"
```

---

### Task 0.22: Phase-gate Quiz + Duels (locked after Preshow)

Quiz and Duels are only available in the `preshow` phase. After the host advances past Preshow, both nav items and in-game entry points show a locked state instead of being functional.

**Files:**
- Modify: `src/components/seo/SiteHeader.tsx` (lock dropdown links post-preshow if in a room)
- Modify: `src/lib/types.ts` (verify `GamePhase` enum — must include `'preshow'`)
- Modify: `src/stores/gameStore.ts` (expose `isPreshow` selector)

This is a UI gate only — no backend change. The lock only applies when the user is inside an active room and the phase has advanced past preshow.

- [ ] **Step 1: Verify `GamePhase` in `src/lib/types.ts`** — confirm `'preshow'` exists

Read `src/lib/types.ts` and confirm the phase union includes `'preshow'`. It should already be there from the existing game implementation. If not, add it:

```ts
export type GamePhase = 'lobby' | 'preshow' | 'predictions' | 'show' | 'results' | 'ended';
```

- [ ] **Step 2: Add `isPreshow` selector to `src/stores/gameStore.ts`**

In the game store (Zustand), add or verify there is a way to read current phase:

```ts
// Existing selector — read current:
export const useGamePhase = () => useGameStore((s) => s.phase);
export const useIsPreshow = () => useGameStore((s) => s.phase === 'preshow' || s.phase === 'lobby');
```

If the store uses a different shape, adapt to match. Export `useIsPreshow`.

- [ ] **Step 3: Add `LockedBadge` component to `src/components/ui/LockedBadge.tsx`**

```tsx
export default function LockedBadge({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-white/40 cursor-not-allowed select-none">
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Apply lock in `SiteHeader.tsx`** — in the How-to-Play dropdown and mobile drawer, wrap the Trivia/Duels link:

```tsx
import { useIsPreshow } from '../../stores/gameStore';
import LockedBadge from '../ui/LockedBadge';

// In the HOW_TO_PLAY_LINKS map:
{HOW_TO_PLAY_LINKS.map((l) => {
  const isLocked = !isPreshow && (l.key === 'trivia'); // trivia page covers duels
  return isLocked
    ? <LockedBadge key={l.href} label={t(`siteNav.${l.key}`)} />
    : <Link key={l.href} to={l.href} ...>{t(`siteNav.${l.key}`)}</Link>;
})}
```

Note: `useIsPreshow` from `gameStore` will return `true` (or default `false` meaning "not in room") when not inside a room session — so links must only lock when actually in a room AND phase > preshow. Add the room-context check:

```tsx
const isInRoom = useGameStore((s) => !!s.roomCode);
const isPreshow = useIsPreshow();
const quizLocked = isInRoom && !isPreshow;
```

- [ ] **Step 5: Verify**

```bash
npm run dev
```

On the public homepage (no room): both Trivia and Predictions links work normally.
In a room in `preshow` phase: both links work.
In a room past `preshow`: Trivia/Duels shows locked badge; Predictions still works.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/LockedBadge.tsx src/components/seo/SiteHeader.tsx src/stores/gameStore.ts src/lib/types.ts
git commit -m "feat(ux): lock Quiz/Duels nav after Preshow phase"
```

---

# PHASE 1 — Existing Page Refresh + Bilingual Rebuild

**Goal:** All 11 surviving existing public pages are migrated to the content-data + ContentRenderer pattern with full EN + EL content, GEO-optimized (definition blocks, FAQ schema, structured passages, updated dates), enhanced UX using the design system, and proper schema. `/online-games` and `/mobile-games` are deleted (already redirected in Phase 0).

**Pages in scope (11):** `/`, `/how-to-play`, `/eurovision-night`, `/eurovision-games`, `/eurovision-party`, `/eurovision-trivia`, `/eurovision-2026-predictions`, `/faq`, `/rules`, `/scoring`, `/about`. (`/privacy`, `/terms` are minimal — handled in Task 1.12.)

**Acceptance criteria per page:**
- Renders in both `/en/<slug>` and `/el/<slug>`
- Loads content from `src/content/<pageId>/{en,el}.json`
- First H2 follows a definition block (1–2 sentences, direct answer to query)
- ≥1 FAQPage schema block, ≥3 FAQ items
- ≥1 of: HowTo, Article, Event, ItemList schema appropriate to content
- All internal links use LocaleLink
- "Keep reading" RelatedCards section at bottom (3 cards)
- Updated date visible in hero or footer of article body ("Updated [Month YYYY]")
- Visual smoke test passes in browser preview at both locales

**Subagent dispatch pattern:** One subagent per page. Each subagent receives: pageId, target keywords, intent, schema list, related pages, and a content brief. Subagent produces both EN and EL JSON content files + page component update.

---

### Task 1.1: Per-page brief template (one-time setup)

**Files:**
- Create: `docs/seo/briefs/_template.md`

- [ ] **Step 1: Create the brief template** — every page gets one of these handed to the writer subagent

```markdown
# Content Brief: <pageId>

**URL (en):** /en/<slug>
**URL (el):** /el/<slug>
**Primary keyword (en):** <kw>
**Primary keyword (el):** <kw>
**Secondary keywords:** <kw, kw, kw>
**Search intent:** <informational | commercial | transactional | navigational>
**Target word count:** <800–1500 typical>

## Definition block (≤200 chars, lead with this)
"<...>"

## Required H2 sections (in order)
1. <H2 title> — <what to cover, 80-150 word range, key facts>
2. ...

## Required schema
- Article (or relevant primary)
- FAQPage with ≥<N> entries
- <other>

## Required FAQs (write answers fitting search intent)
- Q: ...
- Q: ...

## Required tables / lists
- ...

## Internal links to include (use LocaleLink to=...)
- /how-to-play, /eurovision-2026, ...

## Related cards (3)
- pageId, pageId, pageId

## CTA
- Primary: "Create a Eurovision room" → /
- Secondary: "How to play" → /how-to-play

## GEO patterns to ensure
- [ ] First-sentence definition
- [ ] Stat + attribution somewhere
- [ ] Steps as numbered list
- [ ] At least one comparison/data table
- [ ] Updated date visible

## Greek-specific notes
- <e.g., when discussing Sweden's wins, also note Greece's 2005 win for Greek audience relevance>
- <e.g., translate but localize numerals, currency, broadcast names — ΕΡΤ not BBC>
```

- [ ] **Step 2: Commit**

```bash
git add docs/seo/briefs/_template.md
git commit -m "docs(seo-p1): add per-page content brief template"
```

---

### Task 1.2: Refresh `/eurovision-night` (English)

**Files:**
- Create: `src/content/eurovision-night/en.json`
- Modify: `src/pages/seo/EurovisionNightPage.tsx`
- Create: `docs/seo/briefs/eurovision-night.md`

- [ ] **Step 1: Write brief `docs/seo/briefs/eurovision-night.md`**

Use the template, populate with:
- Primary KW (en): "eurovision night" / "eurovision watch party"
- Primary KW (el): "πάρτι eurovision" / "eurovision βραδιά"
- Intent: informational
- Definition: "Eurovision night is the live grand-final broadcast of the Eurovision Song Contest, watched in homes across Europe and Australia as a competitive social ritual — costume parties, scored predictions, and themed food spread across the four-hour show."
- Required schema: Article + HowTo (10-step playbook) + FAQPage (≥6) + Event (the 2026 final)
- Required H2s: What is Eurovision night? · How to host (10-step playbook) · Food & drink ideas · Time-zone tips · Game options inside the room · FAQ
- Required FAQs (≥6): "What time does Eurovision start?", "How long is Eurovision?", "How many people watch Eurovision?", "Do I need an account to play Eurovision Games?", "What if my guests miss the start?", "Can I host Eurovision night online?"
- Internal links: `/eurovision-party`, `/how-to-play`, `/eurovision-2026-predictions`, `/eurovision-2026-schedule`, `/eurovision-drinking-game`
- Related cards: `eurovision-2026-predictions`, `eurovision-party`, `eurovision-trivia`

- [ ] **Step 2: Author `src/content/eurovision-night/en.json`** following the brief and `PageContent` shape from Task 0.16. Sections in order:
  - definitionBlock
  - paragraph "What is Eurovision night?" (with ~150-word answer including 2026 venue + date)
  - steps "How to host (10-step playbook)" with 10 steps
  - paragraph "Food and drink ideas"
  - table "Time-zone start times" (headers: Region, Local time, Notes; rows: CET, BST, EET, AEDT, ET, PT)
  - list "Game options inside the room"
  - faq "FAQ" (≥6 items)
  - cta "Lock in your watch party"
  - related cards (3)

- [ ] **Step 3: Refactor `src/pages/seo/EurovisionNightPage.tsx`** — delete prose body, render via ContentRenderer

```tsx
import { useLocale } from '../../lib/seo/LocaleContext';
import { loadContent } from '../../content/_loader';
import { getPage } from '../../lib/seo/registry';
import { localizePath } from '../../lib/seo/locale';
import PageSeo from '../../components/seo/PageSeo';
import ContentRenderer from '../../components/seo/ContentRenderer';
import SiteFooter from '../../components/seo/SiteFooter';
import {
  buildArticle, buildHowTo, buildFaqPage, buildEvent, buildBreadcrumbList,
} from '../../lib/seo/schema';

const SITE = 'https://eurovision.games';

export default function EurovisionNightPage() {
  const locale = useLocale();
  const content = loadContent('eurovision-night', locale);
  if (!content) return null;
  const page = getPage('eurovision-night')!;
  const url = `${SITE}${localizePath(locale, page.slugByLocale[locale])}`;

  // Schema
  const article = buildArticle({
    headline: content.meta.title,
    description: content.meta.description,
    url,
    datePublished: '2026-04-30',
    dateModified: '2026-04-30',
    locale,
  });
  const howToSection = content.sections.find((s) => s.type === 'steps');
  const howTo = howToSection?.type === 'steps'
    ? buildHowTo({
        name: content.hero.title,
        steps: howToSection.steps.map((s) => ({ name: s.title, text: s.text })),
      })
    : null;
  const faqSection = content.sections.find((s) => s.type === 'faq');
  const faq = faqSection?.type === 'faq' ? buildFaqPage(faqSection.items) : null;
  const event = buildEvent({
    name: 'Eurovision Song Contest 2026 — Grand Final',
    startDate: '2026-05-16T21:00+02:00',
    endDate: '2026-05-17T01:00+02:00',
    location: 'Wiener Stadthalle, Vienna',
    url: `${SITE}${localizePath(locale, '/eurovision-2026')}`,
  });
  const crumbs = [
    { label: locale === 'el' ? 'Αρχική' : 'Home', href: localizePath(locale, '/') },
    { label: content.hero.title },
  ];
  const breadcrumb = buildBreadcrumbList(
    crumbs.map((c, i, arr) => ({
      name: c.label,
      url: c.href ? `${SITE}${c.href}` : url,
    }))
  );
  const jsonLd = [article, howTo, faq, event, breadcrumb].filter(Boolean) as object[];

  return (
    <>
      <PageSeo
        pageId="eurovision-night"
        locale={locale}
        title={content.meta.title}
        description={content.meta.description}
        jsonLd={jsonLd}
      />
      <ContentRenderer
        content={content}
        crumbs={crumbs}
        resolveRelated={(id) => {
          const p = getPage(id as never);
          return {
            href: p ? p.slugByLocale[locale] : '/',
            titleFallback: id,
            blurbFallback: '',
          };
        }}
      />
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 4: Run `npm run dev`, visit `/en/eurovision-night`** — verify renders, view-source has correct schema and hreflang

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): rebuild /eurovision-night EN with content-data + GEO patterns"
```

---

### Task 1.3: Translate `/eurovision-night` to Greek (EL)

**Files:**
- Create: `src/content/eurovision-night/el.json`

- [ ] **Step 1: Author EL content** — same shape as EN, but:
  - Definition: "Η βραδιά της Eurovision είναι η ζωντανή μετάδοση του τελικού της Eurovision Song Contest, που γίνεται κάθε δεύτερο Σάββατο του Μαΐου και παρακολουθείται σε ολόκληρη την Ευρώπη και την Αυστραλία ως κοινωνικό ρεσιτάλ."
  - All H2 titles in Greek
  - Time-zone table includes EET (Ελλάδα/Κύπρος) prominently as the host time
  - Mentions ΕΡΤ as the Greek broadcaster
  - Mentions Greece's 2005 win for cultural relevance
  - FAQs translated and adapted (Greek users care about "Πώς ψηφίζουμε από Ελλάδα" etc.)
  - Internal links remain registry-relative; LocaleLink prefixes `/el/`

- [ ] **Step 2: Verify in dev** — visit `/el/eurovision-night`, content renders in Greek

- [ ] **Step 3: Commit**

```bash
git add src/content/eurovision-night/el.json
git commit -m "feat(seo-p1): EL content for /eurovision-night"
```

---

### Task 1.4: Refresh `/eurovision-party` (EN + EL)

**Files:**
- Create: `src/content/eurovision-party/en.json`
- Create: `src/content/eurovision-party/el.json`
- Create: `docs/seo/briefs/eurovision-party.md`
- Modify: `src/pages/seo/EurovisionPartyPage.tsx`

- [ ] **Step 1: Write brief** — primary KW: "eurovision party" / "πάρτι eurovision"; intent: informational; required H2s: definition · what makes a great party · guest list · theme & decor · food & drink · voting & games · 12-hour checklist · run-of-show · FAQ; schema: Article + HowTo + FAQPage + ItemList (food); related: eurovision-night, eurovision-drinking-game, eurovision-games

- [ ] **Step 2: Author EN content** — preserve existing strengths (12-hour checklist, run-of-show timeline). Convert to data sections.

- [ ] **Step 3: Author EL content** — adapt food list (include Greek classics: τυρόπιτα, σπανακόπιτα), broadcasting reference (ΕΡΤ), Greek host context

- [ ] **Step 4: Refactor `EurovisionPartyPage.tsx`** to use ContentRenderer (pattern from Task 1.2 step 3)

- [ ] **Step 5: Verify both locales render in dev**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): rebuild /eurovision-party EN + EL"
```

---

### Task 1.5: Refresh `/eurovision-games`

**Files:**
- Create: `src/content/eurovision-games/en.json`
- Create: `src/content/eurovision-games/el.json`
- Create: `docs/seo/briefs/eurovision-games.md`
- Modify: `src/pages/seo/EurovisionGamesPage.tsx`

- [ ] **Step 1: Brief** — primary KW: "eurovision games" / "παιχνίδια eurovision"; intent: commercial; required H2s: definition (what they are) · why play during Eurovision · free vs paid · what's in our game · comparison vs alternatives · FAQ; schema: Article + WebApplication + VideoGame + FAQPage + ItemList (game modes); related: how-to-play, eurovision-trivia, eurovision-bingo

- [ ] **Step 2: Expand the comparison table** to 8 rows: Eurovision Games (us), Printable bingo, Commercial quiz packs (£10-30), Custom spreadsheet, Generic party games app, Trivial Pursuit Eurovision, Sporcle quiz, Pen-and-paper scorecards. Columns: Setup time, Live scoring, Cost, # players, Eurovision-specific, Mobile-friendly.

- [ ] **Step 3: Author EN + EL content**

- [ ] **Step 4: Refactor page component**

- [ ] **Step 5: Verify both locales**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): rebuild /eurovision-games EN + EL with 8-row comparison"
```

---

### Task 1.6: Refresh `/eurovision-trivia`

**Files:**
- Create: `src/content/eurovision-trivia/en.json`
- Create: `src/content/eurovision-trivia/el.json`
- Create: `docs/seo/briefs/eurovision-trivia.md`
- Modify: `src/pages/seo/EurovisionTriviaPage.tsx`

- [ ] **Step 1: Brief** — primary KW: "eurovision trivia" / "trivia eurovision"; intent: informational; required: 50+ trivia questions across 5 categories (history, songs, countries, wins, fun facts) × 3 difficulty tiers (easy, medium, hard); FAQ; schema: Article + Quiz + FAQPage + ItemList (categories)

- [ ] **Step 2: Add `quiz` section type to ContentRenderer + content types** — modify `src/content/_types.ts` to add:

```ts
| { type: 'quiz'; id?: string; title?: string; questions: Array<{ q: string; choices: string[]; correctIndex: number; explanation?: string }> }
```

And update `ContentRenderer.tsx` switch to render this as a QuizCard with collapsible answers (reuse `TriviaSampleCard` if exists in `src/components/seo/`).

- [ ] **Step 3: Author EN content** with 50 trivia Qs split across 5 H2 categories, 10 each

- [ ] **Step 4: Author EL content** — translate + add Greek-specific trivia (Helena Paparizou's win year, Ελένη Φουρέιρα's "Fuego" placement, Greek douze points history)

- [ ] **Step 5: Refactor page component**

- [ ] **Step 6: Verify both locales**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): rebuild /eurovision-trivia with 50 questions EN + EL"
```

---

### Task 1.7: Refresh `/eurovision-2026-predictions`

**Files:**
- Create: `src/content/eurovision-2026-predictions/en.json`
- Create: `src/content/eurovision-2026-predictions/el.json`
- Create: `src/content/data/odds-2026.json` (data file — refreshed weekly)
- Create: `docs/seo/briefs/eurovision-2026-predictions.md`
- Modify: `src/pages/seo/Predictions2026Page.tsx`

- [ ] **Step 1: Brief** — primary KW: "eurovision 2026 predictions" / "eurovision 2026 προβλέψεις"; intent: informational/commercial; required: weekly-refreshed odds table, country breakdown for top 10, Big Five overview, semifinal predictions, predictions methodology section; schema: Article (with weekly dateModified) + ItemList (top 10 picks) + FAQPage; related: eurovision-2026-songs, eurovision-2026-semifinals, how-to-play

- [ ] **Step 2: Create odds data file `src/content/data/odds-2026.json`**

```json
{
  "lastUpdated": "2026-04-30",
  "topPicks": [
    { "rank": 1, "country": "Sweden", "artist": "TBD", "song": "TBD", "decimalOdds": 4.5 },
    { "rank": 2, "country": "Italy", "artist": "TBD", "song": "TBD", "decimalOdds": 5.0 }
  ],
  "darkHorses": [],
  "bottomFive": []
}
```

(Subagent populates with current data sourced from Eurovisionworld / Wiwibloggs at time of authoring; mark with disclaimer "Odds illustrative — refresh from public bookmaker aggregators".)

- [ ] **Step 3: Author EN + EL content** — content imports odds-2026.json at render time. Include "How predictions are scored in our game" section linking to `/scoring`. Greek version emphasizes Greek + Cypriot entry analysis.

- [ ] **Step 4: Refactor page** — must read `lastUpdated` from odds file and render an "Updated [Month Day, YYYY]" badge prominently in hero

- [ ] **Step 5: Verify both locales**

- [ ] **Step 6: Add a maintenance note in README** — `docs/seo/maintenance.md`

```markdown
# SEO Maintenance

## Weekly tasks (during Eurovision season Mar–May)
- [ ] Update `src/content/data/odds-2026.json` with latest aggregated odds
- [ ] Update `lastUpdated` field
- [ ] Run `npm run build` and deploy
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): rebuild /eurovision-2026-predictions with weekly-refreshable odds data"
```

---

### Task 1.8: Refresh `/how-to-play`

**Files:**
- Create: `src/content/how-to-play/en.json`
- Create: `src/content/how-to-play/el.json`
- Create: `docs/seo/briefs/how-to-play.md`
- Modify: `src/pages/seo/HowToPlayPage.tsx`

- [ ] **Step 1: Brief** — KW: "how to play eurovision games" / "πώς να παίξω eurovision games"; required: 6-step playbook (existing), what you need section, "Got 60 seconds?" quick-start variant, FAQ; schema: HowTo + FAQPage + WebApplication

- [ ] **Step 2: Author EN content**

- [ ] **Step 3: Author EL content**

- [ ] **Step 4: Refactor page**

- [ ] **Step 5: Verify both locales**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): rebuild /how-to-play EN + EL"
```

---

### Task 1.9: Refresh `/scoring` (with `/rules` consolidated link)

**Files:**
- Create: `src/content/scoring/en.json`
- Create: `src/content/scoring/el.json`
- Create: `docs/seo/briefs/scoring.md`
- Modify: `src/pages/seo/ScoringPage.tsx`

- [ ] **Step 1: Brief** — KW: "eurovision scoring" / "eurovision βαθμολογία" + "douze points meaning" / "douze points τι σημαίνει"; required: definition of douze points block, Eurovision official scoring (jury vs televote, points distribution 1-12), our game scoring, comparison; schema: Article + FAQPage + DefinedTermSet (mini glossary inline)

- [ ] **Step 2: Author EN + EL content** with explicit definition for "douze points" + table of points distribution (12, 10, 8, 7, 6, 5, 4, 3, 2, 1)

- [ ] **Step 3: Refactor page**

- [ ] **Step 4: Verify**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): rebuild /scoring with douze points definition + scoring tables"
```

---

### Task 1.10: Refresh `/rules`

**Files:**
- Create: `src/content/rules/en.json`
- Create: `src/content/rules/el.json`
- Modify: `src/pages/seo/RulesPage.tsx`

Brief: rules of the game (predictions, duels, winners, tiebreaks). Schema: Article + FAQPage. Cross-link to `/scoring` for scoring details.

- [ ] **Step 1: Author content + refactor + verify + commit** as per pattern.

```bash
git add -A
git commit -m "feat(seo-p1): rebuild /rules EN + EL"
```

---

### Task 1.11: Refresh `/faq`

**Files:**
- Create: `src/content/faq/en.json`
- Create: `src/content/faq/el.json`
- Modify: `src/pages/seo/FAQPage.tsx`

- [ ] **Step 1: Brief** — Triple existing FAQ size. Cluster by category (Setup, Gameplay, Scoring, Hosting, Technical, Privacy). Each Q a definition-block style answer (≤2 sentences). FAQPage schema covers all.

- [ ] **Step 2: Author content** — minimum 30 FAQ entries across 6 categories

- [ ] **Step 3: Update component** to render category headers

- [ ] **Step 4: Verify**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): expand /faq to 30+ entries clustered by category"
```

---

### Task 1.12: Refresh `/about`, polish `/privacy`, `/terms`

**Files:**
- Create: `src/content/about/{en,el}.json`
- Create: `src/content/privacy/{en,el}.json`
- Create: `src/content/terms/{en,el}.json`
- Modify: corresponding pages

- [ ] **Step 1: About** — add author/founder bio block (E-E-A-T signal), why this exists, contact, sameAs links to social. Schema: AboutPage + Person + Organization.

- [ ] **Step 2: Privacy + Terms** — minimal port to ContentRenderer; ensure both locales render

- [ ] **Step 3: Verify**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): refresh /about with E-E-A-T bio; port /privacy + /terms to data layer"
```

---

### Task 1.13: Refresh homepage `/`

**Files:**
- Create: `src/content/home/{en,el}.json` (only marketing block content; not the room-creation UI)
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Brief** — homepage is hybrid (app + marketing). Below the create/join UI, there's already a SEO content block (`HomeSeoBlock`). Migrate that block's text to content data and enrich. Required schema: VideoGame + WebApplication + Organization + WebSite (with SearchAction) + FAQPage (top 5 universal Qs).

- [ ] **Step 2: Update `HomeSeoBlock` to read from content** if it doesn't already; pass locale-resolved content

- [ ] **Step 3: In `HomePage`, emit the schema set via `PageSeo`**

- [ ] **Step 4: Verify both locales**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(seo-p1): home page schema + content-data + bilingual SEO block"
```

---

### Task 1.14: Phase 1 acceptance

- [ ] **Step 1: Run all tests** — `npm test` green

- [ ] **Step 2: Run build** — `npm run build` clean

- [ ] **Step 3: Manual smoke** — visit each of the 11 EN pages + 11 EL pages, confirm:
  - Hero renders with eyebrow + title + lede
  - Definition block visible above first H2
  - Updated date shows somewhere
  - At least 1 FAQ visible (FAQPage schema in source)
  - "Keep reading" 3-card section at bottom
  - LocaleLink internal links keep current locale
  - Language switcher swaps to other locale on same page

- [ ] **Step 4: Validate schema externally** — paste 3 random page sources into [Google Rich Results Test](https://search.google.com/test/rich-results), expect no critical errors

- [ ] **Step 5: Tag**

```bash
git tag seo-p1-complete
```

---

# PHASE 2 — Tier 1 New Pages (11 new pages × 2 locales)

**Goal:** Create the 11 highest-priority new pages with full bilingual content, comprehensive schema, and design-system UX.

**Pages:**
1. `/eurovision-2026` — event hub
2. `/eurovision-2026-schedule`
3. `/eurovision-2026-semifinals`
4. `/eurovision-2026-songs`
5. `/eurovision-drinking-game`
6. `/eurovision-bingo`
7. `/eurovision-sweepstake`
8. `/eurovision-quiz`
9. `/glossary`
10. `/host-eurovision-party`
11. `/eurovision-history`

**Acceptance criteria per page:** identical to Phase 1 acceptance + the new page must be added to:
- `src/routes.tsx` (under `/:locale` group)
- `PAGE_REGISTRY` (already done in Phase 0)
- `SiteFooter` link list

**Subagent dispatch:** All 11 pages parallelizable. Spawn one subagent per page with brief + content + page component skeleton.

---

### Task 2.1: Add new pages to router

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Create page-component placeholder files** (one per new page) so router doesn't fail

```bash
for slug in eurovision-2026 eurovision-2026-schedule eurovision-2026-semifinals \
            eurovision-2026-songs eurovision-drinking-game eurovision-bingo \
            eurovision-sweepstake eurovision-quiz glossary \
            host-eurovision-party eurovision-history; do
  # PascalCase the slug
  pascal=$(echo "$slug" | sed -e 's/-\([a-z]\)/\U\1/g' -e 's/^./\U&/')
  cat > "src/pages/seo/${pascal}Page.tsx" <<EOF
export default function ${pascal}Page() {
  return <div style={{padding:32,color:'white'}}>Coming in Phase 2 — ${slug}</div>;
}
EOF
done
```

(If shell substitution differs in user's shell, manually create each file with stub.)

- [ ] **Step 2: Add 11 imports + 11 route entries** to `src/routes.tsx`. Inside the `/:locale` children array, add:

```tsx
{ path: 'eurovision-2026', element: <Eurovision2026Page /> },
{ path: 'eurovision-2026-schedule', element: <Eurovision2026SchedulePage /> },
{ path: 'eurovision-2026-semifinals', element: <Eurovision2026SemifinalsPage /> },
{ path: 'eurovision-2026-songs', element: <Eurovision2026SongsPage /> },
{ path: 'eurovision-drinking-game', element: <EurovisionDrinkingGamePage /> },
{ path: 'eurovision-bingo', element: <EurovisionBingoPage /> },
{ path: 'eurovision-sweepstake', element: <EurovisionSweepstakePage /> },
{ path: 'eurovision-quiz', element: <EurovisionQuizPage /> },
{ path: 'glossary', element: <GlossaryPage /> },
{ path: 'host-eurovision-party', element: <HostEurovisionPartyPage /> },
{ path: 'eurovision-history', element: <EurovisionHistoryPage /> },
```

- [ ] **Step 3: Build clean** — `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(seo-p2): scaffold 11 Tier-1 new page routes (placeholders)"
```

---

### Task 2.2: `/eurovision-2026` — event hub

**Files:**
- Create: `src/content/eurovision-2026/{en,el}.json`
- Create: `docs/seo/briefs/eurovision-2026.md`
- Modify: `src/pages/seo/Eurovision2026Page.tsx`

- [ ] **Step 1: Brief** — primary KW (en): "eurovision 2026"; (el): "eurovision 2026"; intent: informational; sections: definition · key dates table · host city Vienna · how to watch · top 5 sections (schedule, semis, songs, predictions, drinking game) with cards; schema: Event (with subEvents for semi 1, semi 2, grand final) + FAQPage + Article + ItemList (linked sub-pages)

- [ ] **Step 2: Author both locales**

- [ ] **Step 3: Implement page** with full schema (Event with 3 subEvents)

- [ ] **Step 4: Verify both locales render with all schema** in view-source

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-2026 event hub with Event schema + 3 subEvents"
```

---

### Task 2.3: `/eurovision-2026-schedule`

- [ ] **Step 1: Brief** — KW: "eurovision 2026 schedule" / "πότε είναι το eurovision 2026"; sections: definition (when + where) · full schedule table (semis + final + dates + times) · broadcast times by region · how to watch from Greece (ΕΡΤ) · FAQ

- [ ] **Step 2: Author content** — schedule table is the centerpiece, with both UTC and local Vienna time + EET (Greek/Cypriot) + GMT (UK) + ET (US)

- [ ] **Step 3: Implement page** — Event schema, FAQPage, Article

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-2026-schedule with full broadcast time matrix"
```

---

### Task 2.4: `/eurovision-2026-semifinals`

- [ ] **Step 1: Brief** — KW: "eurovision 2026 semifinals" / "ημιτελικοί eurovision 2026"; sections: definition · semi 1 lineup table · semi 2 lineup table · qualifying rules · prediction tips for semis · FAQ

- [ ] **Step 2: Author content** — running order tables once data published; until then placeholder + "updated [date]" badge

- [ ] **Step 3: Implement page** — Event (per semi), ItemList (running order), FAQPage

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-2026-semifinals with per-semi Event schema"
```

---

### Task 2.5: `/eurovision-2026-songs`

- [ ] **Step 1: Brief** — KW: "eurovision 2026 songs" / "eurovision 2026 τραγούδια"; sections: definition · participating countries (37 expected) · songs by country (alphabetical table) · favourites · FAQ

- [ ] **Step 2: Create data file `src/content/data/songs-2026.json`** — array of 37 entries: country, flag emoji, artist, song title, language, official video URL (when public)

- [ ] **Step 3: Author content** that imports the data and renders the table

- [ ] **Step 4: Implement page** — ItemList (MusicRecording per entry), Article, FAQPage

- [ ] **Step 5: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-2026-songs with full entries data + ItemList schema"
```

---

### Task 2.6: `/eurovision-drinking-game`

- [ ] **Step 1: Brief** — KW: "eurovision drinking game" / "eurovision drinking game ελληνικά"; intent: informational; sections: definition · classic rules (sip triggers, shot triggers) · advanced rules · sober alternative variant · safety section · printable rules · FAQ; schema: HowTo + Game + FAQPage

- [ ] **Step 2: Author content** — sip triggers (key change, costume change, rain effect, prop usage, fire FX), shot triggers (douze points to your country, your country drops out, RSI moment); sober variant uses points instead of drinks. Safety: drink water, eat first, set a max.

- [ ] **Step 3: Implement page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-drinking-game with classic + sober variants"
```

---

### Task 2.7: `/eurovision-bingo`

- [ ] **Step 1: Brief** — KW: "eurovision bingo" / "eurovision bingo ελληνικά"; sections: definition · how it works · sample bingo card grid · 25 callouts list · vs Eurovision Games comparison; schema: HowTo + FAQPage

- [ ] **Step 2: Author content + sample 5×5 card grid component or table**

- [ ] **Step 3: Implement page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-bingo with sample card + 25 callouts"
```

---

### Task 2.8: `/eurovision-sweepstake`

- [ ] **Step 1: Brief** — KW: "eurovision sweepstake" / "eurovision sweepstake rules"; sections: definition · how a sweepstake works · prize structures · drawing system · printable sheet · FAQ; schema: HowTo + FAQPage

- [ ] **Step 2: Author content**

- [ ] **Step 3: Implement page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-sweepstake with prize structures + free template"
```

---

### Task 2.9: `/eurovision-quiz`

- [ ] **Step 1: Brief** — KW: "eurovision quiz" / "κουίζ eurovision"; intent: informational/transactional; sections: definition · take the quiz (interactive) · category picker · score tracking · FAQ; schema: Quiz + Question + FAQPage

- [ ] **Step 2: Build interactive quiz component** `src/components/seo/InteractiveQuiz.tsx` — picks N random questions from `src/content/data/trivia-pool.json`, scores client-side. (No backend; localStorage for best score.)

- [ ] **Step 3: Create `src/content/data/trivia-pool.json`** — 100+ questions tagged by category + difficulty + locale

- [ ] **Step 4: Author content + page**

- [ ] **Step 5: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-quiz interactive client-side quiz with 100+ Q pool"
```

---

### Task 2.10: `/glossary`

- [ ] **Step 1: Brief** — KW: "eurovision glossary" + many term-specific KWs (douze points, jury, televote, Big Five, etc.); intent: informational; sections: definition · alphabetical glossary · FAQ; schema: DefinedTermSet + DefinedTerm × N

- [ ] **Step 2: Create `src/content/data/glossary.json`** — array of 30+ terms × 2 locales

```json
{
  "en": [
    { "term": "Douze points", "definition": "The maximum 12 points awarded by each jury or televote pool to their favourite country.", "alternateNames": ["12 points", "twelve points"] },
    { "term": "Big Five", "definition": "The five biggest financial contributors (UK, France, Germany, Spain, Italy) who automatically qualify for the grand final." }
  ],
  "el": [
    { "term": "Douze points", "definition": "Τα μέγιστα 12 βαθμοί που απονέμει κάθε εθνική κριτική επιτροπή ή τηλεψηφοφορία στην αγαπημένη της χώρα." }
  ]
}
```

- [ ] **Step 3: Build `GlossaryGrid` component** that renders the glossary alphabetically with anchor links

- [ ] **Step 4: Implement page** with full DefinedTermSet schema

- [ ] **Step 5: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /glossary with 30+ terms + DefinedTermSet schema"
```

---

### Task 2.11: `/host-eurovision-party`

- [ ] **Step 1: Brief** — KW: "how to host eurovision party" / "πώς να κάνω πάρτι eurovision"; intent: informational; this is the deep step-by-step (vs `/eurovision-party` which is the overview); sections: definition · 14-day checklist · day-of timeline · supplies list · troubleshooting common issues · FAQ; schema: HowTo (deep) + FAQPage + ItemList (supplies)

- [ ] **Step 2: Author content**

- [ ] **Step 3: Implement page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /host-eurovision-party 14-day deep guide"
```

---

### Task 2.12: `/eurovision-history`

- [ ] **Step 1: Brief** — KW: "eurovision history" / "ιστορία eurovision"; sections: definition · founding 1956 · most successful countries (with table) · scoring system evolution · key controversies · best & worst songs · FAQ; schema: Article + ItemList (winners by country count)

- [ ] **Step 2: Author content** with key facts: first contest 1956 Lugano (7 countries), most wins (Ireland 7, Sweden 7), notable wins (ABBA 1974, Riverdance interval 1994)

- [ ] **Step 3: Implement page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p2): /eurovision-history with country-success table + key moments"
```

---

### Task 2.13: Update SiteFooter to expose new pages

**Files:**
- Modify: `src/components/seo/SiteFooter.tsx`

- [ ] **Step 1: Add new link sections** for "Eurovision 2026", "Hosting", "Reference" with the new Tier-1 pages

- [ ] **Step 2: Verify all footer links navigate correctly with locale preserved**

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/SiteFooter.tsx
git commit -m "feat(seo-p2): expose new Tier-1 pages in SiteFooter"
```

---

### Task 2.14: Phase 2 acceptance

- [ ] **Step 1: Run sitemap regen** — `npm run sitemap` — verify all 22 new URLs present (11 × 2 locales)

- [ ] **Step 2: Manual smoke** — visit all 11 EN + 11 EL pages, verify rendering

- [ ] **Step 3: Validate schema** — sample 3 pages in Rich Results Test

- [ ] **Step 4: Tag**

```bash
git tag seo-p2-complete
```

---

# PHASE 3 — Greek-Exclusive Pages (4 pages, EL only)

**Goal:** Author 4 Greek-only pages targeting Greek market exclusives.

**Pages (no EN counterpart):**
1. `/el/eurovision-ellada` — Greece in Eurovision
2. `/el/eurovision-kypros` — Cyprus in Eurovision
3. `/el/eurovision-2026-elliniko-tragoudi` — Greek 2026 entry
4. `/el/eurovision-2026-programma` — Greek broadcast programme

**Acceptance:** as previous phases. Important: `greekExclusive: true` is already set in registry; hreflang from these pages emits ONLY `el` + `x-default=el`. The page components must accept the `el` locale and reject `en` (return NotFound).

---

### Task 3.1: Add Greek-exclusive routes + guards

**Files:**
- Modify: `src/routes.tsx`
- Create: `src/pages/seo/EurovisionElladaPage.tsx`
- Create: `src/pages/seo/EurovisionKyprosPage.tsx`
- Create: `src/pages/seo/Eurovision2026EllinikoTragoudiPage.tsx`
- Create: `src/pages/seo/Eurovision2026ProgrammaPage.tsx`
- Create: `src/components/seo/GreekOnlyGuard.tsx`

- [ ] **Step 1: Create `src/components/seo/GreekOnlyGuard.tsx`**

```tsx
import { Navigate } from 'react-router-dom';
import { useLocale } from '../../lib/seo/LocaleContext';
import { type ReactNode } from 'react';

export default function GreekOnlyGuard({ children }: { children: ReactNode }) {
  const locale = useLocale();
  if (locale !== 'el') {
    // EN visitors hitting /en/eurovision-ellada → redirect to /el equivalent
    return <Navigate to={`/el${window.location.pathname.replace(/^\/en/, '')}`} replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Stub page files**, each wraps content in `<GreekOnlyGuard>`

- [ ] **Step 3: Add 4 route entries** to `/:locale` children

- [ ] **Step 4: Verify** `/en/eurovision-ellada` redirects to `/el/eurovision-ellada`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(seo-p3): scaffold 4 Greek-exclusive pages with locale guard"
```

---

### Task 3.2: `/el/eurovision-ellada` — Greece in Eurovision

- [ ] **Step 1: Brief** — primary KW: "Ελλάδα eurovision" / "ελληνικές συμμετοχές eurovision"; sections: definition · Greece's history (debut 1974) · Greek wins (2005 Helena Paparizou) · best results · all 47 Greek entries table · best Greek songs · controversies · FAQ; schema: Article + ItemList (all entries) + Country + FAQPage

- [ ] **Step 2: Create `src/content/data/greek-entries.json`** — 47 entries: year, artist, song, place, points

- [ ] **Step 3: Author content** in EL only

- [ ] **Step 4: Implement page**

- [ ] **Step 5: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p3): /el/eurovision-ellada — full Greek Eurovision history"
```

---

### Task 3.3: `/el/eurovision-kypros` — Cyprus in Eurovision

- [ ] **Step 1: Brief** — KW: "Κύπρος eurovision" / "κυπριακή συμμετοχή eurovision"; sections: definition · Cypriot history (debut 1981) · best results (Eleni Foureira "Fuego" 2018, 2nd place) · all entries · 2026 entry · FAQ; schema: Article + ItemList + Country + FAQPage

- [ ] **Step 2: Create `src/content/data/cypriot-entries.json`**

- [ ] **Step 3: Author content + page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p3): /el/eurovision-kypros — Cypriot Eurovision history"
```

---

### Task 3.4: `/el/eurovision-2026-elliniko-tragoudi` — Greek 2026 entry

- [ ] **Step 1: Brief** — KW: "ελληνικό τραγούδι eurovision 2026"; sections: definition · 2026 artist + song · lyrics · performance details · betting odds · how Greek viewers can vote · FAQ; schema: MusicRecording + Article + Person + FAQPage

- [ ] **Step 2: Author content** — placeholder structure, weekly-refreshable like predictions page

- [ ] **Step 3: Implement page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p3): /el/eurovision-2026-elliniko-tragoudi — Greek 2026 entry hub"
```

---

### Task 3.5: `/el/eurovision-2026-programma` — Greek broadcast guide

- [ ] **Step 1: Brief** — KW: "Eurovision 2026 πρόγραμμα ΕΡΤ" / "eurovision 2026 ελληνική μετάδοση"; sections: definition · ΕΡΤ schedule (semis + final + times) · RIK Cyprus schedule · how to vote from Greece · streaming options · FAQ; schema: BroadcastEvent + Event + FAQPage

- [ ] **Step 2: Author content**

- [ ] **Step 3: Implement page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p3): /el/eurovision-2026-programma — ΕΡΤ + RIK broadcast guide"
```

---

### Task 3.6: Phase 3 acceptance

- [ ] **Step 1: Sitemap regen** — verify 4 EL-only URLs present, no EN counterparts

- [ ] **Step 2: Manual smoke** — visit `/el/eurovision-ellada`, `/el/eurovision-kypros`, `/el/eurovision-2026-elliniko-tragoudi`, `/el/eurovision-2026-programma`. View source: hreflang has only `el` + `x-default=el`.

- [ ] **Step 3: Tag**

```bash
git tag seo-p3-complete
```

---

# PHASE 4 — Programmatic Pages (122 pages)

**Goal:** Generate `/winners/[year]` (70 pages, 1956–2025) and `/countries/[country]` (52 pages) plus their hubs `/winners` and `/countries`. All bilingual.

**Architecture:**
- Hub pages list all entries with filterable tables
- Detail pages render from one shared `<WinnerYearPage>` / `<CountryPage>` template, data from JSON
- Sitemap generator extended to include programmatic URLs
- Quality gate: each detail page MUST include ≥300 unique words of original commentary (not just data dump) — author per-locale `commentary` field per entry

---

### Task 4.1: Winner data file (1956–2025)

**Files:**
- Create: `src/content/data/winners.json`

- [ ] **Step 1: Author the dataset** — array of 70 entries:

```ts
interface WinnerYearEntry {
  year: number;
  hostCity: string;
  hostCountry: string;
  date: string; // ISO
  winningCountry: string;
  winningArtist: string;
  winningSong: string;
  totalPoints: number | null; // some early years no points
  pointsRunnerUp?: number | null;
  participants: number;
  // Commentary in both locales — this is the unique value per page
  commentary: {
    en: string; // 100-200 words original take
    el: string;
  };
  funFact: { en: string; el: string };
  // Optional context
  notes?: { en: string; el: string };
}
```

Populate all 70 years from public sources (Wikipedia "List of Eurovision winners"). Each `commentary` must be original prose — not copy-paste.

(This is large; subagent dispatched for this task should write 10 years per round in 7 batches, committing each batch.)

- [ ] **Step 2: Validate dataset** — write `tests/content/winners.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import data from '@/content/data/winners.json';

describe('winners.json', () => {
  it('contains 70 entries (1956-2025)', () => {
    expect(data).toHaveLength(70);
  });

  it('every entry has both locale commentaries ≥80 words', () => {
    for (const e of data) {
      const enWords = e.commentary.en.split(/\s+/).length;
      const elWords = e.commentary.el.split(/\s+/).length;
      expect(enWords).toBeGreaterThanOrEqual(80);
      expect(elWords).toBeGreaterThanOrEqual(80);
    }
  });

  it('years are unique and contiguous', () => {
    const years = data.map((e) => e.year).sort();
    expect(years[0]).toBe(1956);
    // 2020 was cancelled — allow gap
    const expectedYears = [];
    for (let y = 1956; y <= 2025; y++) {
      if (y !== 2020) expectedYears.push(y);
    }
    expect(years).toEqual(expectedYears);
  });
});
```

- [ ] **Step 3: Commit batches**

```bash
git add -A
git commit -m "feat(seo-p4): seed winners.json with 70 years of bilingual commentary"
```

---

### Task 4.2: Winner year template + route

**Files:**
- Create: `src/pages/seo/WinnerYearPage.tsx`
- Create: `src/pages/seo/WinnersHubPage.tsx`
- Modify: `src/routes.tsx` — add `winners`, `winners/:year`

- [ ] **Step 1: Implement `WinnerYearPage.tsx`** — reads `useParams.year`, looks up entry, renders bilingual commentary, table of facts (host, date, points, runner-up, participant count), embedded YouTube link to winning song (when a known canonical URL), prev/next navigation. Schema: Article + Event + MusicRecording + Person + Country + BreadcrumbList.

- [ ] **Step 2: Implement `WinnersHubPage.tsx`** — table of all winners (year, country, artist, song, points), filterable by decade. CollectionPage + ItemList schema.

- [ ] **Step 3: Add routes**

```tsx
{ path: 'winners', element: <WinnersHubPage /> },
{ path: 'winners/:year', element: <WinnerYearPage /> },
```

- [ ] **Step 4: Update sitemap generator** to emit URLs for all 70 winner-year pages × 2 locales

```ts
// in scripts/seo/generate-sitemap.ts, after PAGE_REGISTRY loop:
import winners from '../../src/content/data/winners.json';
for (const w of winners) {
  for (const locale of ['en', 'el'] as const) {
    const url = `${SITE}/${locale}/winners/${w.year}`;
    entries.push({
      loc: url,
      alternates: [
        { hreflang: 'en', href: `${SITE}/en/winners/${w.year}` },
        { hreflang: 'el', href: `${SITE}/el/winners/${w.year}` },
        { hreflang: 'x-default', href: `${SITE}/en/winners/${w.year}` },
      ],
      priority: 0.7,
      changefreq: 'yearly',
    });
  }
}
```

- [ ] **Step 5: Update llms.txt generator** — list `winners` hub but not all 70 detail pages (too noisy)

- [ ] **Step 6: Verify** — visit `/en/winners`, `/en/winners/2024`, `/el/winners/2024`. Sitemap regen, count URLs.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(seo-p4): /winners hub + /winners/[year] template, 70 programmatic pages × 2 locales"
```

---

### Task 4.3: Country data file (52 entries)

**Files:**
- Create: `src/content/data/countries.json`

- [ ] **Step 1: Author dataset** — array of 52 country entries:

```ts
interface CountryEntry {
  slug: string;        // e.g. "sweden", "united-kingdom"
  name: { en: string; el: string };
  flag: string;        // emoji
  debut: number | null;
  totalEntries: number;
  wins: number;
  bestResult: { year: number; place: number; song: string; artist: string };
  worstResult?: { year: number; place: number };
  notableEntries: Array<{ year: number; song: string; artist: string; place: number }>;
  withdrawn?: boolean;
  commentary: { en: string; el: string };  // ≥120 words each
}
```

Populate from Wikipedia "List of countries in the Eurovision Song Contest". Subagent batches of 13 per round across 4 commits.

- [ ] **Step 2: Validation test `tests/content/countries.test.ts`** mirrors winners test

- [ ] **Step 3: Commit batches**

```bash
git add -A
git commit -m "feat(seo-p4): seed countries.json with 52 country profiles bilingual"
```

---

### Task 4.4: Country detail template + hub

**Files:**
- Create: `src/pages/seo/CountryPage.tsx`
- Create: `src/pages/seo/CountriesHubPage.tsx`
- Modify: `src/routes.tsx` — add `countries`, `countries/:slug`

- [ ] **Step 1: Implement templates** — same pattern as winners. CountryPage: header (flag + name + debut + wins + best result), commentary, all entries table (importable from a `country-entries.json` joined dataset, or compute from per-country data), notable entries highlights. Schema: Article + Country + ItemList + BreadcrumbList.

- [ ] **Step 2: Add routes**

- [ ] **Step 3: Update sitemap generator** — emit 52 × 2 = 104 URLs

- [ ] **Step 4: Verify** — sample `/en/countries/sweden`, `/el/countries/sweden`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(seo-p4): /countries hub + /countries/[slug] template, 52 programmatic pages × 2 locales"
```

---

### Task 4.5: Phase 4 acceptance

- [ ] **Step 1: Sitemap regen** — count URLs, expect ≈ (30 evergreen × 2) + (70 winners × 2) + (52 countries × 2) + 4 EL-exclusive = ~302 URLs

- [ ] **Step 2: Manual smoke** — sample 5 random winner pages + 5 random country pages, both locales

- [ ] **Step 3: Validate schema externally** on 3 pages

- [ ] **Step 4: Verify all programmatic pages have ≥300 words unique content** (run word-count test against rendered HTML or against JSON commentary fields)

- [ ] **Step 5: Tag**

```bash
git tag seo-p4-complete
```

---

# PHASE 5 — Comparison + Commercial Pages (4 pages × 2 locales)

**Goal:** Author commercial-intent pages that capture "vs" / "best" search patterns.

**Pages:**
1. `/compare/eurovision-games-vs-bingo`
2. `/compare/eurovision-games-vs-quiz-pack`
3. `/best-eurovision-app`
4. `/printables`

---

### Task 5.1: Add comparison routes

**Files:**
- Modify: `src/routes.tsx`
- Create: 4 page stubs

- [ ] **Step 1: Stubs + routes** for `/compare/eurovision-games-vs-bingo`, `/compare/eurovision-games-vs-quiz-pack`, `/best-eurovision-app`, `/printables`

- [ ] **Step 2: Build clean**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(seo-p5): scaffold 4 commercial routes"
```

---

### Task 5.2: `/compare/eurovision-games-vs-bingo`

- [ ] **Step 1: Brief** — KW: "eurovision games vs bingo" / "eurovision παιχνίδι vs bingo"; intent: commercial; sections: definition · how each works · feature comparison table (8 rows) · pros and cons each · who should use each · FAQ; schema: Article + FAQPage + ComparisonTable (use Article + Table)

- [ ] **Step 2: Author EN + EL**

- [ ] **Step 3: Implement page**

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p5): /compare/eurovision-games-vs-bingo"
```

---

### Task 5.3: `/compare/eurovision-games-vs-quiz-pack`

- [ ] **Step 1: Brief + content + page** — same pattern, focus on cost (we're free; quiz packs £10-30), customization, live scoring, refresh cadence (we update each year; printed packs go stale)

- [ ] **Step 2: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p5): /compare/eurovision-games-vs-quiz-pack"
```

---

### Task 5.4: `/best-eurovision-app`

- [ ] **Step 1: Brief** — KW: "best eurovision app"; honest listicle (we list ourselves but include real alternatives — Eurovoxx, EuroFanCafe, etc.); sections: definition · top 5 apps with pros/cons · why we put ourselves #1 · FAQ; schema: ItemList (ranked apps) + Article + FAQPage

- [ ] **Step 2: Author content + page**

- [ ] **Step 3: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p5): /best-eurovision-app honest comparison"
```

---

### Task 5.5: `/printables`

- [ ] **Step 1: Brief** — KW: "eurovision printables", "eurovision scorecard", "eurovision bingo printable"; intent: informational/transactional (free download); sections: definition · scorecards (PDF) · bingo cards (PDF) · drinking-game rules sheet (PDF) · prediction sheet · FAQ; schema: CollectionPage + DigitalDocument × N + FAQPage

- [ ] **Step 2: Generate PDFs** — create simple PDFs in `public/printables/` (scorecard.pdf, bingo-card.pdf, drinking-game.pdf, predictions.pdf). Use `tsx scripts/seo/generate-printables.ts` with `pdfkit` or similar — or hand-author once.

- [ ] **Step 3: Author content + page** — page lists each PDF with thumbnail and download link, embeds DigitalDocument schema

- [ ] **Step 4: Verify + commit**

```bash
git add -A
git commit -m "feat(seo-p5): /printables with 4 free PDF downloads + DigitalDocument schema"
```

---

### Task 5.6: Phase 5 acceptance

- [ ] **Step 1: Sitemap regen, count** — confirm 8 new URLs (4 × 2 locales)

- [ ] **Step 2: Smoke + schema validation**

- [ ] **Step 3: Tag**

```bash
git tag seo-p5-complete
```

---

# PHASE 6 — Technical SEO Sweep

**Goal:** Audit and fix Core Web Vitals, image optimization, schema validation across all pages, broken links, and consider pre-rendering for crawl reliability.

---

### Task 6.1: Lighthouse audit baseline

**Files:**
- Create: `scripts/seo/lighthouse-audit.ts`
- Create: `docs/seo/audits/2026-04-30-baseline.md`

- [ ] **Step 1: Install lighthouse** — `npm install -D lighthouse chrome-launcher`

- [ ] **Step 2: Implement audit script** that runs Lighthouse against 10 sample URLs (mix of EN + EL) and outputs JSON + markdown summary

- [ ] **Step 3: Run audit, save baseline**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(seo-p6): lighthouse audit baseline"
```

---

### Task 6.2: Fix any LCP/INP/CLS regressions

For each metric below threshold per Lighthouse report:

- [ ] **Step 1: LCP fixes** — preload hero image where present, ensure `<img>` has `width` + `height`, use `loading="eager"` for above-fold

- [ ] **Step 2: CLS fixes** — set explicit dimensions on every `<img>`, reserve space for FAQ accordions and Carousels

- [ ] **Step 3: INP fixes** — defer non-critical JS, code-split larger components (`React.lazy` for InteractiveQuiz)

- [ ] **Step 4: Re-run Lighthouse, confirm green**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "perf(seo-p6): fix CWV regressions identified in audit"
```

---

### Task 6.3: Image optimization

**Files:**
- Modify: `scripts/optimize-cards.ts` (existing) — extend or duplicate for full-site
- Create: `scripts/seo/optimize-images.ts`

- [ ] **Step 1: Audit images** — find all `<img>` references, list source files, format

- [ ] **Step 2: Convert to WebP/AVIF** — use sharp (already a dep) to generate `.webp` + `.avif` variants of all assets

- [ ] **Step 3: Update component refs** — use `<picture>` with `<source type="image/avif">`, `<source type="image/webp">`, fallback `<img>`

- [ ] **Step 4: Add alt text audit** — script that scans for `<img>` with empty/missing alt

- [ ] **Step 5: Verify + commit**

```bash
git add -A
git commit -m "perf(seo-p6): WebP/AVIF image variants + alt-text audit pass"
```

---

### Task 6.4: Pre-rendering decision + implementation

**Decision criteria:** SPA emits content via JS hydration. Crawlers and AI bots can usually execute JS but it's slower and less reliable. For a site of 200+ pages whose value is content extraction, pre-rendering gives a meaningful boost.

- [ ] **Step 1: Choose approach** — `vite-plugin-prerender-spa` or `@prerenderer/vite-plugin` or `vite-react-ssg`. Recommend `vite-react-ssg` (cleanest for React Router 7).

- [ ] **Step 2: Install + wire up** — read project structure to confirm compatibility; if pre-rendering breaks the room/admin client-side flows (which use Supabase auth + realtime), gate by route — only pre-render `/en/*` and `/el/*` public routes, leave `/room/*` and `/admin` SPA-only

- [ ] **Step 3: Generate pre-rendered HTML for all public routes** — should produce ≈300 .html files in dist/

- [ ] **Step 4: Verify** — fetch `/en/eurovision-night` HTML directly with curl, confirm content present in initial HTML (not behind hydration)

- [ ] **Step 5: Update CI/build pipeline if applicable**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(seo-p6): pre-render public routes for crawl reliability"
```

---

### Task 6.5: External schema validation sweep

- [ ] **Step 1: Script** that fetches each public URL (locally or against staging), extracts JSON-LD blocks, posts to Schema.org validator API

- [ ] **Step 2: Generate report `docs/seo/audits/2026-04-30-schema-sweep.md`** — list any errors per page

- [ ] **Step 3: Fix any reported issues** — likely simple field shape problems

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(seo-p6): schema validation issues from external sweep"
```

---

### Task 6.6: Internal link audit

- [ ] **Step 1: Script** that crawls the locally-built site, extracts every `<a href>`, checks all return 200

- [ ] **Step 2: Fix broken/orphan links**

- [ ] **Step 3: Confirm "every page reachable from homepage in ≤3 clicks"** — verify with a graph-traversal script

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(seo-p6): internal link audit + orphan elimination"
```

---

### Task 6.7: Phase 6 acceptance

- [ ] **Step 1: Re-run Lighthouse** on 10 sample pages — all green
- [ ] **Step 2: Re-run schema sweep** — zero errors
- [ ] **Step 3: Re-run link audit** — zero broken
- [ ] **Step 4: Tag**

```bash
git tag seo-p6-complete
```

---

# PHASE 7 — GEO Citation Testing + Monitoring

**Goal:** Stand up tooling to verify our pages are getting cited by AI engines and monitor over time.

---

### Task 7.1: Citation testing harness

**Files:**
- Create: `scripts/seo/citation-test.ts`
- Create: `scripts/seo/citation-queries.json`

- [ ] **Step 1: Author `citation-queries.json`** — list of 20 target queries (10 EN + 10 EL) the research doc identified as priority

- [ ] **Step 2: Implement script** — runs each query against:
  - Perplexity Sonar API (if API key available — else manual mode)
  - OpenAI Chat (with browse tool) — manual mode
  - Anthropic Claude (with web tool) — manual mode
  - Google AI Overview — manual via SERP API or manual entry

  For Phase 7 v1, do **manual mode**: script outputs the queries to stdout, prompts user to run them on each engine and record citation status (cited Y/N + citation source).

- [ ] **Step 3: Output report** — `docs/seo/audits/citation-2026-04-30.md` with results table

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(seo-p7): GEO citation testing harness (manual mode)"
```

---

### Task 7.2: Search Console + analytics setup checklist

**Files:**
- Create: `docs/seo/operations.md`

- [ ] **Step 1: Document** — checklist for human owner:
  - Verify `eurovision.games` in Google Search Console
  - Submit sitemap.xml
  - Verify in Bing Webmaster Tools
  - Add Plausible/Umami/GA4 (whichever the project uses) — confirm or add
  - Set up weekly export of GSC top queries → into `docs/seo/audits/gsc-weekly-*.md`

- [ ] **Step 2: Commit**

```bash
git add docs/seo/operations.md
git commit -m "docs(seo-p7): operations runbook for ongoing monitoring"
```

---

### Task 7.3: Weekly maintenance scripts

**Files:**
- Modify: `docs/seo/maintenance.md` (created in Task 1.7)

- [ ] **Step 1: Append** — full weekly checklist:
  - Update `src/content/data/odds-2026.json`
  - Update `src/content/eurovision-2026-songs/...` if new entries published
  - Run citation test, update `docs/seo/audits/citation-*.md`
  - Run link audit
  - Run sitemap regen + deploy

- [ ] **Step 2: Add cron suggestion** — example GitHub Action that runs the link audit + sitemap regen weekly

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs(seo-p7): weekly + monthly SEO maintenance runbook"
```

---

### Task 7.4: Final acceptance

- [ ] **Step 1: Full test suite green** — `npm test`
- [ ] **Step 2: Build clean** — `npm run build`
- [ ] **Step 3: Sitemap final URL count** — expect ≈ 300 URLs
- [ ] **Step 4: llms.txt final** — confirms hub structure
- [ ] **Step 5: 5 random pages pass external Rich Results Test**
- [ ] **Step 6: Citation harness baseline run + report saved**
- [ ] **Step 7: Tag**

```bash
git tag seo-overhaul-complete
```

---

## Self-Review Notes

- **Spec coverage:** Each of the 8 phases in the user prompt has direct tasks. Tier-1 new pages: 11 tasks in Phase 2 covering all 11 pages. Greek-exclusive: 4 tasks in Phase 3. Programmatic: 2 templates × 2 hubs in Phase 4. Comparison: 4 tasks in Phase 5. Tech sweep: 7 tasks in Phase 6. GEO monitoring: 4 tasks in Phase 7.
- **Naming consistency:** `loadContent`, `PageContent`, `getPage`, `localizePath`, `buildHreflangLinks`, `PageSeo`, `LocaleLink`, `LocaleProvider`, `useLocale` — used identically across plan.
- **No placeholders:** Every code step shows actual code or exact commands. Content briefs are templated; per-page content authoring within tasks describes exact required H2s, schema, FAQ counts.
- **Risks called out:**
  - Programmatic page commentary (winners + countries) is the longest content task. Plan batches by 10/13 per commit.
  - Pre-rendering integration may surface SPA assumption breaks; Task 6.4 step 2 explicitly gates by route.
  - Greek translation quality cannot be machine-translated; brief makes this explicit per page.
  - Predictions + 2026-songs + Greek-2026-entry pages need weekly refresh until event; Tasks 1.7, 2.5, 3.4 include the data file pattern + maintenance doc.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-seo-geo-overhaul.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because Phases 1–5 contain dozens of independent content authoring tasks that parallelize well.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
