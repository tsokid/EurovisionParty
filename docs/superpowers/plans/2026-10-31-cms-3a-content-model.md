# CMS 3a: Content Model and Zero-Change Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all editorial copy of the static pages out of `src/pages/**/content/*Copy.ts` into schema-validated, bilingual `content/pages/{docId}.json`. The page components then read their copy through `usePageContent(docId)`. The prerendered output must stay byte-identical.

**Architecture:**
- Each document type has a zod schema in `supabase/functions/_shared/cms/`. That location is Deno-free and shared by the build, the admin, and `publish-content`.
- The schema mirrors the existing TypeScript copy interface exactly. Each field carries metadata the 3b form generator will read.
- Template functions become strings with whitelisted placeholders, interpolated at render time.
- Content loading reuses the 2b split loader: eager in SSR, `#__content__` seed plus fetch on the client.

**Tech Stack:** zod (direct dependency, pinned to the version already in `package-lock.json`), React 19, Vite SSR prerender, vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-cms-design.md` (§3, §4, §8). The parent spec is `docs/superpowers/specs/2026-10-30-contests-archive-cms-design.md`.

## Global Constraints

- **Zero rendered change.** For every static page in both locales, the prerendered `<head>` and `<main>` must be byte-identical to the capture taken in Task 1. That covers every registry page plus `404.html`. No exceptions are allowed in 3a.
- **zod stays out of the client bundle.** Validation runs at build time (prerender / check script) and in tests. The client trusts the published JSON. The main-chunk budget test (≤ 1,760,000 B) must still pass.
- **`supabase/functions/**` imports nothing from `src/`.** The import-boundary test exists.
- **Snapshot serialization** is deterministic: sorted keys, 2-space indentation, trailing newline. Files have the shape `{ "en": …, "el": … }`.
- **Contest template copy stays in code:** `archiveCopy.ts`, `countryCopy.ts`, `hubCopy.ts`, `contestText.ts`. They are not migrated.
- **Placeholders** use the syntax `{name}` and are whitelisted per field. They are `{year}`, `{city}`, `{cityIn}`, `{count}`, `{finalDate}`, `{semi1Date}`, `{semi2Date}`, `{hostName}`, plus any field-specific name the per-file mapping needs, declared in that schema. An unknown placeholder fails validation.
- **Tests** live in `tests/**`. `tests/scripts/sitemap.test.ts` is flaky under load; re-run it alone.

## Review Focus

1. **Hidden differences.** Pages whose copy builds strings with functions (`winnersCopy`, the predictions intro and similar) must render identically after conversion to placeholders. → Task 1 fixtures plus the Task 4–6 equality test.
2. **Hydration.** On the client, a page reading `content/pages/x.json` must have it seeded before hydrate. Client navigation to it must not flash or lose `PageSeo`. → Task 3 test, plus a dist check that each static page inlines its own doc.
3. **Bundle.** Importing a schema from a component would pull zod into the client chunk. → Task 2 bundle test asserting `zod` is absent from `dist/assets`.
4. **Missing locale.** An `el` field left empty must fail the build, not render blank. → Task 2 validation test.
5. **JSON-LD.** FAQPage, HowTo, Article and similar built from copy must stay identical. This is covered by the head capture, which includes the JSON-LD scripts.

---

### Task 1: Capture the before state

**Files:**
- Create: `scripts/cms/capturePages.ts`, `tests/fixtures/pages-before/{locale}/{path}.json`
- Test: `tests/cms/pagesUnchanged.test.ts`

**Interfaces:**
- `capturePage(url): Promise<{ head: string; main: string; title: string; jsonLd: string[] }>` renders through `src/entry-server.tsx` `render(url)` and `headTagsHtml`.
  - `main` is the rendered HTML of the page body with whitespace normalised (collapse runs of whitespace, trim). Keep the tags; this is a structural capture, not text only.
- The fixture covers every static registry URL in both locales, plus `/en/__404`. Dynamic contest pages are excluded.

- [ ] **Step 1:** Write the capture script and run it once to write the fixtures. Commit them **before any other change**.
- [ ] **Step 2:** Write `pagesUnchanged.test.ts`, which re-captures each URL and asserts equality with its fixture. Run it. Expected: PASS, because nothing has changed yet.
- [ ] **Step 3: Commit** `test(cms): capture prerendered head+main of every static page`.

---

### Task 2: Schema engine and validation

**Files:**
- Create:
  - `supabase/functions/_shared/cms/fields.ts`
  - `supabase/functions/_shared/cms/placeholders.ts`
  - `supabase/functions/_shared/cms/validate.ts`
  - `supabase/functions/_shared/cms/registry.ts`
  - `scripts/cms/validate-content.ts`
- Modify: `package.json`. Add `zod` as a direct dependency at the exact version in the lockfile. Append `&& tsx scripts/cms/validate-content.ts` to `build`, before `check-prerender`.
- Test: `tests/cms/fields.test.ts`, `tests/cms/validate.test.ts`, `tests/scripts/bundleSize.test.ts` (extended)

**Interfaces:**
- `fields.ts` defines field constructors that return zod schemas with attached metadata (`.describe` JSON, or a WeakMap registry):
  - `text(meta?: { label?; help?; maxLength?; placeholders?: string[]; required?: boolean })`
  - `multiline(meta?)`
  - `list(item, meta?)`
  - `group(shape, meta?)`
  - `richText(meta?)`: stored as string, rendered in 3b. In 3a it is defined and tested, but no static page uses it.
  - `fieldMeta(schema): FieldMeta` reads the metadata back.
- `placeholders.ts`:
  - `interpolate(template: string, vars: Record<string,string|number>): string` throws on a missing var.
  - `placeholdersIn(template): string[]`.
- `validate.ts`: `validateDocument(docType: string, data: unknown): { ok: true; value } | { ok: false; errors: { path: string; locale: 'en'|'el'; message: string }[] }`. It checks:
  - the shape against the schema for both locales;
  - that required fields are non-empty in both locales;
  - that every placeholder used is allowed for that field.
- `registry.ts`: `CMS_DOC_TYPES: Record<string, { schema; label: string; group: 'site'|'contest'|'country' }>` plus `docTypeFor(docId): string`. Static pages map their registry pageId to a doc type with the same name.
- `validate-content.ts` validates every `content/pages/*.json` against its doc type. It prints errors and exits 1 on failure.

- [ ] **Step 1: Write failing tests.**
  - Field metadata round-trips.
  - `interpolate`: replaces placeholders, throws on a missing var, leaves `{` alone when it isn't a placeholder pattern (`{{`?). Decide on and test an escape: `{{` renders a literal `{`.
  - `validateDocument`:
    - accepts a valid doc;
    - reports `el` empty for a required field with path and locale;
    - reports an unknown placeholder;
    - reports extra or unknown keys (strict schemas).
  - Bundle: after `npm run build`, no `dist/assets/*.js` contains the string `ZodError`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests and `npx tsc -b`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cms): schema fields, placeholders, document validation`.

---

### Task 3: `usePageContent` and the loader

**Files:**
- Modify: `src/lib/seo/contentData.ts`, `src/lib/seo/contentData.client.ts` (or the modules the 2b split uses), the collector and seed plumbing as needed, `scripts/seo/loadContent.ts`.
- Create: `src/lib/cms/usePageContent.ts`
- Test: `tests/cms/usePageContent.test.tsx`, `tests/ssr/render.test.ts` (extended)

**Interfaces:**
- `usePageContent<T>(docId: string): { status: 'ready'; data: { en: T; el: T }[locale] } | { status: 'loading' | 'missing' | 'error' }`.
  - In SSR it reads `content/pages/{docId}.json` eagerly and records it in the per-render collector so it gets inlined.
  - On the client it reads synchronously from the seed, and otherwise fetches `/content/pages/{docId}.json`. That is the same mechanism as `useContent`; reuse it rather than duplicating it.
- Static page components must never hide `PageSeo` behind a pending state. On client navigation while the doc is loading, render the existing `ContentPending` for the body. Head tags then update once the doc is ready. This is the same pattern as the hub. Because every static page is prerendered, direct loads are always seeded.
- A missing doc at prerender time is a build failure. check-prerender already rejects `data-content-state`.

- [ ] **Step 1: Write failing tests.**
  - The SSR render of a fixture doc inlines `pages/{docId}.json`.
  - The client hook returns ready synchronously when seeded.
  - It fetches and becomes ready on a cache miss.
  - It returns missing on a 404.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(cms): usePageContent with SSR inline + client seed/fetch`.

---

### Tasks 4–6: Migrate the static pages

Each task migrates one group with the same procedure:

1. Write a zod schema per page in `supabase/functions/_shared/cms/schemas/{docType}.ts` that mirrors the page's existing copy interface exactly. Use `text`, `list` and `group`, and mark the template fields with their placeholders. Register it in `registry.ts`.
2. Generate `content/pages/{docId}.json` with `scripts/cms/extract-copy.ts`. The script imports the copy module and calls each template function with sentinel values to recover the template. For example, call `intro(n)` with the sentinel `__count__`, then replace the sentinel with `{count}`. Put the per-file mapping in the script. Each template's output must be byte-identical after interpolation, and a unit test checks this for every templated field.
3. Switch the page component to `usePageContent`, adding `interpolate` at the call sites of former functions. Delete the `*Copy.ts` file once nothing imports it.
4. Run `npm run build`, then `tests/cms/pagesUnchanged.test.ts`. It must pass for every page in the group, in both locales.

**Groups:**
- **Task 4 (simple text pages):** `about`, `privacy`, `terms`, `cookies`, `dashboard`, `scoring`, `rules`, `faq`.
- **Task 5 (guides):** `how-to-play`, `eurovision-night`, `eurovision-games`, `eurovision-party`, `eurovision-trivia`, `eurovision-duels` (slug `/duels`).
- **Task 6 (data-mixed pages):** `home` (`homeCopy.ts`), `not-found` (`notFoundCopy.ts`), `eurovision-predictions` (`predictionsCopy.ts`), `winners` (`winnersCopy.ts`).
  - The data-driven parts stay in code: tables and live-contest facts from `site.json` / `contests/index.json`.
  - Only the editorial strings move.
  - `contestText.ts` stays in code.

**Each task's Files:**
- Create: the schemas, the `content/pages/*.json` documents, and the `extract-copy` mapping entries.
- Modify: the page components and `registry.ts`.
- Delete: the migrated `*Copy.ts` files.

**Tests:** the unit test for template round-trips (`tests/cms/extractCopy.test.ts`); `pagesUnchanged`; and `validate-content`, which must pass during the build.

- [ ] **Step 1:** Write the schemas and the round-trip unit tests. Run them. Expected: FAIL.
- [ ] **Step 2:** Implement the extraction and generate the JSON.
- [ ] **Step 3:** Switch the components and delete the copy files.
- [ ] **Step 4:** Run `npm run build`, then `pagesUnchanged`, the bundle test, `tsc -b` and the full suite. Expected: PASS, with zero diffs.
- [ ] **Step 5: Commit** `refactor(cms): <group> copy into content/pages`.

---

### Task 7: Guardrails

**Files:**
- Test: `tests/cms/noCopyModules.test.ts`, `tests/cms/contentPagesComplete.test.ts`

- [ ] **Step 1:** Write the tests.
  - No `src/pages/seo/content/*Copy.ts` or `src/pages/content/*Copy.ts` files remain, except the contest templates and `contestText.ts`.
  - Every static registry pageId, plus `not-found`, has a `content/pages/{docId}.json` that validates.
  - Every `content/pages` file maps to a registered doc type, so there are no orphans.
- [ ] **Step 2:** Run. Expected: PASS.
- [ ] **Step 3: Commit** `test(cms): guard content/pages completeness`.
