# Foundation (Sub-project 1): Per-URL Static HTML — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every public URL ships its own prerendered HTML (own title, meta, canonical, hreflang, JSON-LD, body), unknown locale URLs return a real 404, and the sitemap lists only URLs that are actually built.

**Architecture:** Routes move to a shared config used by both the browser router and a Vite SSR entry. After `vite build`, a prerender script renders every registry URL with React Router's static handler, collects head tags through a context (SchemaHead's `useEffect` does not run on the server), and writes `dist/{locale}/{path}.html`. Vercel serves those files via `cleanUrls`; everything else outside `/en` `/el` falls back to the SPA shell. The client hydrates prerendered pages.

**Tech Stack:** React 19, react-router-dom 7 (`createStaticHandler`, `createStaticRouter`, `StaticRouterProvider`), Vite 8 SSR build, i18next, vitest 4, tsx, Vercel static config.

**Spec:** `docs/superpowers/specs/2026-10-30-contests-archive-cms-design.md` (§3 soft-404 resolution, §8 Prerender). This plan covers sub-project 1 only. Hub, archive, countries, predictions rename and their redirects are sub-project 2.

## Global Constraints

- Site origin: `https://eurovision.games`. Locales: `en`, `el` only (`src/lib/seo/locale.ts`).
- Prerendered pages must not call Supabase or any network during render.
- `/room/*` and `/admin` stay client-only (not prerendered).
- Sitemap and registry contain **only** URLs that are built; the build fails otherwise.
- Branch: `feat/foundation-prerender`. **Do not merge to `main`.** Owner ships sub-projects 1 + 2 in one cutover; sub-project 2 branches from this one. Verification uses a Vercel preview deploy.
- Tests live in `tests/**` (vitest include pattern), default env jsdom; SSR tests opt into `// @vitest-environment node`.
- Baseline: `tests/scripts/sitemap.test.ts` currently times out (5 s default; `git log` per page is slow on Windows). Fixed in Task 1.

## Review Focus

1. **Locale leakage between renders.** i18next is a singleton; rendering `/el/faq` right after `/en/faq` must produce Greek text, and vice versa. → Task 4 test `renders el after en without leaking language`.
2. **Special characters in head tags.** Titles/descriptions contain `&`, quotes, `<`, Greek; JSON-LD may contain `</script>`. Must be escaped, never break the head. → Task 3 tests.
3. **Deep links to the game.** `/room/ABCD` and `/admin` must still load the SPA after the Vercel config change; legacy unprefixed URLs (`/how-to-play`, `/online-games`) must still reach `LocaleRedirect`. → Task 7 test.
4. **Trailing slashes.** `/en/faq/` must redirect to `/en/faq`, not 404. → Task 7 asserts `trailingSlash: false`.
5. **Greek pages hydrate in Greek.** Client must set the i18n language from the URL before hydrating, or `/el/*` flashes English and logs hydration errors. → Task 5 test `localeFromPath` + Task 9 console check.

---

### Task 1: Registry contains only built pages

**Files:**
- Modify: `src/lib/seo/registry.ts`
- Modify: `scripts/seo/generate-sitemap.ts` (`PAGE_FILES`)
- Modify: `scripts/seo/generate-llms-txt.ts` (`DESCRIPTIONS`, tier arrays)
- Test: `tests/lib/seo/registry.test.ts`, `tests/scripts/sitemap.test.ts`

**Interfaces:**
- Produces: `PageId` union without the 12 removed ids; `allPageUrls(): { locale: Locale; path: string }[]` that skips the locale excluded by `greekExclusive` / `englishExclusive`.

- [ ] **Step 1: Write failing tests** in `registry.test.ts`:

```ts
const REMOVED = ['eurovision-2026','eurovision-2026-schedule','eurovision-2026-semifinals','eurovision-2026-songs',
  'eurovision-quiz','host-eurovision-party','eurovision-history','eurovision-ellada','eurovision-kypros',
  'eurovision-2026-elliniko-tragoudi','eurovision-2026-programma','countries'];
it('contains no unbuilt pages', () => {
  for (const id of REMOVED) expect(PAGE_REGISTRY.find((p) => p.id === id)).toBeUndefined();
});
it('no entry points at a removed hub', () => {
  for (const p of PAGE_REGISTRY) if (p.hub) expect(getPage(p.hub)).toBeDefined();
});
it('allPageUrls skips excluded locales', () => {
  // exclusivity is enforced in the function, independent of current data
  const urls = allPageUrls();
  for (const p of PAGE_REGISTRY.filter((x) => x.greekExclusive))
    expect(urls).not.toContainEqual({ locale: 'en', path: localizePath('en', p.slugByLocale.en) });
});
```

In `sitemap.test.ts` add timeout `30_000` to the existing `it(...)` and assert `expect(xml).not.toContain('/eurovision-2026<')` and `not.toContain('/countries<')`.

- [ ] **Step 2: Run** `npx vitest run tests/lib/seo/registry.test.ts tests/scripts/sitemap.test.ts` — Expected: FAIL on `contains no unbuilt pages` and the sitemap assertions.
- [ ] **Step 3: Implement.** Remove the 12 ids from `PageId`, `PAGE_REGISTRY`, `PAGE_FILES`, and from `DESCRIPTIONS`/tier arrays in `generate-llms-txt.ts`. Drop `hub: 'eurovision-history'` from `winners`. Make `allPageUrls` honour `greekExclusive`/`englishExclusive` (same rule `generate-sitemap.ts` already uses). Run `npm run sitemap && npm run llms-txt` to regenerate `public/sitemap.xml` and `public/llms.txt`.
- [ ] **Step 4: Run** the same tests plus `npx tsc -b` — Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `fix(seo): drop 12 unbuilt URLs from registry, sitemap and llms.txt`

---

### Task 2: Shared route config

**Files:**
- Create: `src/routeConfig.tsx`
- Modify: `src/routes.tsx`
- Test: `tests/lib/seo/routeParity.test.ts`

**Interfaces:**
- Produces: `export const routes: RouteObject[]` in `src/routeConfig.tsx` (the exact array currently passed to `createBrowserRouter`); `src/routes.tsx` becomes `export const router = createBrowserRouter(routes)`.

- [ ] **Step 1: Write failing test** `routeParity.test.ts`: collect the `path` of every child of the `/:locale` route except `'*'` (index child ↔ `'/'`), and assert the set equals the set of `slugByLocale.en` in `PAGE_REGISTRY`. This guards registry/route drift in both directions.
- [ ] **Step 2: Run** — Expected: FAIL, `routeConfig` does not exist.
- [ ] **Step 3: Implement.** Move imports and the array to `routeConfig.tsx`; `routes.tsx` keeps only the `createBrowserRouter` call. No behaviour change.
- [ ] **Step 4: Run** the test and `npx tsc -b` — Expected: PASS.
- [ ] **Step 5: Commit** `refactor(routes): extract route config for SSR reuse`

---

### Task 3: Head tags collected during render

**Files:**
- Create: `src/lib/seo/headTags.ts`, `src/lib/seo/HeadContext.tsx`
- Modify: `src/components/seo/SchemaHead.tsx`
- Test: `tests/lib/seo/headTags.test.ts`, `tests/components/seo/SchemaHead.test.tsx`

**Interfaces:**
- Produces:
  - `type HeadInput` = SchemaHead's `Props` (move the interface into `headTags.ts`, SchemaHead imports it).
  - `headTagsHtml(input: HeadInput): string` — every tag SchemaHead's effect writes, as HTML: `<title>`, `description`, `og:title`, `og:description`, `og:url`, `og:type` (default `'website'`), `og:image` + `twitter:image` (default `https://eurovision.games/logo.png`), `og:locale`, `og:locale:alternate`, `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`, `keywords`, article times, `<link rel="canonical">`, hreflang `<link rel="alternate">`, JSON-LD `<script type="application/ld+json">`.
  - `interface HeadCollector { head: HeadInput | null; status: number; setHead(h: HeadInput): void; setStatus(code: number): void }`, `createHeadCollector(): HeadCollector` (status defaults to 200), `HeadProvider({ collector, children })`, `useHeadCollector(): HeadCollector | null`.
  - SchemaHead: during render, `useHeadCollector()?.setHead(props)`; client `useEffect` unchanged.

- [ ] **Step 1: Write failing tests** in `headTags.test.ts`:
  - `escapes attribute values`: title `Tom & "Jerry" <b>` yields `<title>Tom &amp; &quot;Jerry&quot; &lt;b&gt;</title>` and `content="Tom &amp; &quot;Jerry&quot; &lt;b&gt;"`.
  - `keeps Greek text intact`: title `Οδηγός Eurovision` appears verbatim.
  - `neutralises script close in JSON-LD`: jsonLd `{ name: '</script><x>' }` → output contains `</script` and no literal `</script><x>`.
  - `defaults og:type and og:image`.
  - `emits one alternate link per hreflang entry`.
  In `SchemaHead.test.tsx` add `collects head during server render`: `renderToString(<HeadProvider collector={c}><SchemaHead title="T" description="D" canonical="https://eurovision.games/en/faq" /></HeadProvider>)` → `c.head?.title === 'T'`.
- [ ] **Step 2: Run** `npx vitest run tests/lib/seo/headTags.test.ts tests/components/seo/SchemaHead.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** in the files above. One escape helper for text/attributes (`& < > " '`); JSON-LD via `JSON.stringify(...).replace(/</g, '\\u003c')`.
- [ ] **Step 4: Run** — Expected: PASS (existing SchemaHead tests still pass).
- [ ] **Step 5: Commit** `feat(seo): collect head tags during render for prerender`

---

### Task 4: Server render entry

**Files:**
- Create: `src/entry-server.tsx`
- Modify: `src/pages/NotFoundPage.tsx` (call `useHeadCollector()?.setStatus(404)` during render)
- Modify: `tests/setup.ts` (stub Supabase env)
- Modify: any component that touches `window`/`document`/`localStorage`/`navigator` **during render** (not in effects) — found by the test below
- Test: `tests/ssr/render.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Consumes: `routes` (Task 2), `createHeadCollector`, `HeadProvider` (Task 3), `allPageUrls` (Task 1).
- Produces: `export async function render(url: string): Promise<RenderResult>` with `interface RenderResult { html: string; head: HeadInput | null; status: number; lang: Locale }`. `url` is a path like `/el/faq`.

- [ ] **Step 1: Write failing tests** in `tests/ssr/render.test.ts`:
  - `renders every registry URL`: for each `allPageUrls()` entry, `render(path)` resolves with `status === 200`, `html.length > 500`, `head?.canonical === 'https://eurovision.games' + path` (home: `/en`, `/el`), `lang === locale`.
  - `renders el after en without leaking language`: `await render('/en/faq')`, then `render('/el/faq')` html contains the Greek FAQ H1 from `src/pages/seo/content/faqCopy.ts`; then `render('/en/faq')` again contains the English H1.
  - `unknown locale path is 404`: `render('/en/no-such-page')` → `status === 404`.
  - `does not touch the network`: `vi.spyOn(globalThis, 'fetch')` → not called across all renders.
  In `tests/setup.ts`: `vi.stubEnv('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321')` and the same for `VITE_SUPABASE_ANON_KEY` with `'test-anon-key'`.
- [ ] **Step 2: Run** `npx vitest run tests/ssr/render.test.ts` — Expected: FAIL (`entry-server` missing).
- [ ] **Step 3: Implement `render`:** derive locale with `stripLocaleFromPath`/`isLocale`; `await i18n.changeLanguage(locale)` before rendering; `createStaticHandler(routes).query(new Request('https://eurovision.games' + url))`; `createStaticRouter(handler.dataRoutes, context)`; `renderToString(<StrictMode><HeadProvider collector={c}><StaticRouterProvider router={r} context={context} /></HeadProvider></StrictMode>)`. If `query` returns a `Response` (redirect), return `status` from it and empty html. Then fix each render-time browser access the node-env test surfaces (move into `useEffect` or guard with `typeof window !== 'undefined'`); do not change behaviour in the browser.
- [ ] **Step 4: Run** the SSR test and the full suite `npx vitest run` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ssr): server render entry for public pages`

---

### Task 5: Client hydrates prerendered pages

**Files:**
- Modify: `src/main.tsx`, `src/lib/seo/locale.ts`
- Test: `tests/lib/seo/locale.test.ts`, `tests/lib/bootMode.test.ts`

**Interfaces:**
- Produces: `localeFromPath(path: string): Locale | null` in `locale.ts`; `bootMode(root: HTMLElement): 'hydrate' | 'render'` exported from `src/lib/bootMode.ts` — `'hydrate'` iff `root.dataset.prerendered === 'true'`.

- [ ] **Step 1: Write failing tests:** `localeFromPath('/el/faq') === 'el'`, `('/en') === 'en'`, `('/room/ABCD') === null`, `('/elephant') === null`; `bootMode` for a div with/without `data-prerendered="true"`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** In `main.tsx`: `const lang = localeFromPath(location.pathname); if (lang) await i18n.changeLanguage(lang);` then `hydrateRoot(root, app)` when `bootMode(root) === 'hydrate'`, else the existing `createRoot(root).render(app)`. Same `app` tree as today.
- [ ] **Step 4: Run** tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ssr): hydrate prerendered pages with URL locale`

---

### Task 6: Prerender script and build wiring

**Files:**
- Modify: `index.html` (markers), `package.json` (`build`), `vite.config.ts` (PWA `globIgnores`), `.gitignore` (`dist-server/`)
- Create: `scripts/prerender.ts`, `scripts/prerender/injectPage.ts`
- Test: `tests/scripts/injectPage.test.ts`

**Interfaces:**
- Consumes: `render` (Task 4), `headTagsHtml` (Task 3), `allPageUrls` (Task 1).
- Produces: `injectPage(template: string, page: { html: string; headHtml: string; lang: Locale }): string`; `outputPath(urlPath: string): string` (`'/en'` → `'en.html'`, `'/en/how-to-play'` → `'en/how-to-play.html'`); files in `dist/`, plus `dist/404.html` from `render('/en/__404')`.

- [ ] **Step 1: Edit `index.html`:** wrap every per-page head tag that `headTagsHtml` emits (title, description, og:title/description/type/url/image, twitter:*, canonical) between `<!--seo:start-->` and `<!--seo:end-->`; leave the Organization/WebApplication JSON-LD and favicon/fonts outside. Wrap the `<noscript>` fallback inside `#root` between `<!--app:start-->` and `<!--app:end-->`.
- [ ] **Step 2: Write failing tests** `injectPage.test.ts`: output replaces the seo block with `headHtml` (template's default title absent), replaces the app block with `html`, sets `<html lang="el">` for el, adds `data-prerendered="true"` to `#root`, and throws `missing marker` if a marker is absent. `outputPath` cases above.
- [ ] **Step 3: Run** — Expected: FAIL.
- [ ] **Step 4: Implement** `injectPage`, `outputPath`, and `scripts/prerender.ts` (imports `../dist-server/entry-server.js`, reads `dist/index.html`, writes each page; exits non-zero if any render status ≠ 200 except the 404 page). `package.json` build: `tsc -b && vite build && vite build --ssr src/entry-server.tsx --outDir dist-server && tsx scripts/prerender.ts && tsx scripts/seo/check-prerender.ts` (check script arrives in Task 8; until then omit the last step). PWA workbox: `globIgnores: ['en.html', 'el.html', 'en/**', 'el/**', '404.html']`.
- [ ] **Step 5: Run** tests, then `npm run build` — Expected: PASS; `dist/en/how-to-play.html` contains `<title>` from `howToPlayCopy.ts` and `data-prerendered="true"`; `dist/el.html` has `lang="el"`.
- [ ] **Step 6: Commit** `feat(ssr): prerender every public URL at build`

---

### Task 7: Vercel config — clean URLs, real 404, SPA fallback

**Files:**
- Modify: `vercel.json`
- Test: `tests/scripts/vercelConfig.test.ts`

**Interfaces:**
- Produces: `vercel.json` without `routes`; with `cleanUrls: true`, `trailingSlash: false`, `rewrites: [{ "source": "/((?!en(?:/|$)|el(?:/|$)).*)", "destination": "/index.html" }]`, existing `headers` unchanged, `redirects` (permanent) for `/:locale(en|el)/eurovision-quiz` → `/:locale/eurovision-trivia`, `/:locale(en|el)/host-eurovision-party` → `/:locale/eurovision-party`, and unprefixed `/eurovision-quiz` → `/en/eurovision-trivia`, `/host-eurovision-party` → `/en/eurovision-party`.

- [ ] **Step 1: Write failing test:** parse `vercel.json`; assert no `routes` key, `cleanUrls === true`, `trailingSlash === false`, CSP header unchanged (string equality with current value), the four redirects present with `permanent: true`. Rewrite regex (`new RegExp('^/(?!en(?:/|$)|el(?:/|$)).*$')`) matches `/room/ABCD`, `/admin`, `/how-to-play`, `/online-games`, `/`; does not match `/en`, `/el`, `/en/no-such-page`, `/el/faq`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** the config.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(vercel): serve prerendered pages, real 404s, SPA fallback outside locales`

---

### Task 8: Build-time prerender check

**Files:**
- Create: `scripts/seo/check-prerender.ts`, `scripts/seo/checkPrerender.ts`
- Modify: `package.json` (append check to `build`)
- Test: `tests/scripts/checkPrerender.test.ts`

**Interfaces:**
- Produces: `checkPrerender(pages: { url: string; html: string }[], sitemapLocs: string[], has404: boolean): string[]` (empty = pass). `check-prerender.ts` reads `dist/**/*.html` (excluding `index.html`), `public/sitemap.xml`, prints errors, exits 1 if any.

- [ ] **Step 1: Write failing tests**, one per rule, each with a minimal fixture:
  - `sitemap URL without file` → error naming the URL.
  - `duplicate title within a locale` → error naming both URLs.
  - `duplicate description within a locale` → error.
  - `canonical not equal to own URL` → error.
  - `missing 404.html` → error.
  - all good → `[]`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** both files; append `&& tsx scripts/seo/check-prerender.ts` to `build`.
- [ ] **Step 4: Run** tests, then `npm run build` — Expected: PASS and the check prints `prerender check: N pages OK`. If real duplicates surface in current copy, fix the copy in `src/pages/seo/content/*Copy.ts` (not the rule).
- [ ] **Step 5: Commit** `feat(seo): fail build on unbuilt sitemap URLs and duplicate meta`

---

### Task 9: Preview verification

**Files:** none (verification only).

- [ ] **Step 1:** `git push -u origin feat/foundation-prerender`; wait for the Vercel preview URL (`gh pr` is not needed; read it from the Vercel GitHub check on the branch).
- [ ] **Step 2:** For `/en/how-to-play`, `/el/faq`, `/en/winners`, `/en`: `curl -s <preview><path>` contains the page's own `<title>` and `data-prerendered="true"`.
- [ ] **Step 3:** `curl -s -o /dev/null -w "%{http_code}"` → `/en/no-such-page` = 404; `/en/faq/` = 308 to `/en/faq`; `/en/eurovision-quiz` = 308 to `/en/eurovision-trivia`; `/room/ABCD` = 200; `/how-to-play` = 200 (shell, client redirects).
- [ ] **Step 4:** In the built-in browser, open `/el/faq`, `/en/how-to-play`, `/en/winners`; `read_console_messages` shows no hydration errors; navigate between pages and confirm `document.title` updates.
- [ ] **Step 5:** Report results to the owner. Do not merge.
