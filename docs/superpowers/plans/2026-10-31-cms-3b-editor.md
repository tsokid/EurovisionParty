# CMS 3b: Admin Pages Editor, Preview & Publish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner can edit any static page's copy in `/admin → Pages`. Each field shows EN and EL side by side, and the form is generated from the 3a schemas. The owner can preview the real page with the draft, save the draft to the DB, and publish it to the site through the existing Publish pipeline.

**Architecture:**
- Drafts live in a new `cms_documents` table (migration 076). Each row holds one document in the 3a `{en, el}` shape.
- The editor loads the DB draft when one exists. Otherwise it loads the published `/content/pages/{docId}.json`.
- `publish-content` validates every draft server-side with the shared `_shared/cms` validator and writes `content/pages/{docId}.json` in the same single commit as contests.
- The admin is code-split into its own lazy chunk. That lets the form use zod at runtime while the public bundle stays zod-free.

**Tech Stack:** React 19, zod 4.3.6 (admin chunk and Deno only), Supabase RPCs (PGlite-tested), Deno edge function `publish-content` (pure modules tested with vitest), Vite code splitting.

**Specs:** `docs/superpowers/specs/2026-10-31-cms-design.md` §6, §7. The parent spec is `2026-10-30-contests-archive-cms-design.md`. Ledgers to read:
- `.superpowers/sdd/2026-10-31-cms-3a-content-model/progress.md`: the final-review items deferred to 3b.
- `.superpowers/sdd/2026-10-31-archive-pages-publish/progress.md`: publish pipeline rulings.

## Global Constraints

- Production Supabase is locked. Test SQL with PGlite, and Storage and GitHub with mocks.
- **Public bundle stays zod-free.** `ZodError` may appear only in the lazy admin chunk. The main-chunk budget is ≤ 1,760,000 B.
- **No rendered change to public pages in 3b**, except the documented locale-switcher prefetch.
- Admin UI is in English, following the existing admin module patterns: `supabase.rpc` → throw → `formatError`, and `window.confirm` before destructive actions.
- **Every new RPC:**
  - `security definer`
  - `set search_path = public`
  - `is_super_admin()` gate
  - `revoke execute … from public, anon`, then `grant … to authenticated`
- **`rawHtml` fields:** the content must pass an allowlist. Allowed tags: `strong`, `em`, `b`, `i`, `br`, and `a` with `href` starting `/` or `https://`, and no attributes other than `href`, `target="_blank"`, and `rel`. Anything else is a validation error. Ruling I4 option (b) keeps rendering identical.
- **Length presets are soft.** SEO title ≤ 60 and meta description ≤ 160 produce warnings only (`softMaxLength`): an editor counter plus a `validate-content` warning. They never block saving or publishing.
- `tests/scripts/sitemap.test.ts` is flaky under load. Re-run it alone if it is the only failure.

## Review Focus

1. **Stale overwrite.** Two admins, or two tabs, can save the same document. Saving uses optimistic concurrency on `updated_at`. → Task 3 tests.
2. **Invalid draft reaching the site.** Publish must validate server-side and refuse the whole publish, listing the per-document errors. → Task 4 tests.
3. **Shared-field and list edits diverging between locales.** In lists that hold shared fields, add, remove, and reorder must apply to both locales at once. Shared fields are edited once. → Task 6 tests.
4. **XSS through `rawHtml`.** The allowlist validator rejects `<img onerror>`, `javascript:` links, and `<script>`. → Task 1 tests.
5. **Preview crash.** A placeholder the page doesn't supply, or a malformed draft, shows an error inside the preview pane instead of crashing the admin. → Task 5 test.

---

### Task 1: Engine follow-ups

**Files:** `supabase/functions/_shared/cms/{fields,validate,walk,interpolateDocument,html}.ts`, the schemas, `scripts/cms/validate-content.ts`, and tests under `tests/cms/`.

**Changes:**
- `walk.ts`: `walkSchema(schema, visit)` is a single walker. Replace the five duplicated walkers (`fieldPaths`/`fieldAt`, `holdsShared`/`sharedMismatches`, the extract-copy walkers) with it.
- `interpolateDocument(doc, vars)` moves here from `scripts/cms/extract-copy.ts`.
- **`href` field kind:** a `FieldKind 'href'` that is shared by default and refined to start with `/` or `https://`. Use it everywhere, including `about.ts` `linkHref`.
- **Linked pairs:** `group(…, { pairs: [['linkLabel','linkHref']] })`. Within a pair, either both fields are set or neither is. Apply it to the `about` and `eurovision-night` pairs.
- **Placeholder help:** add `placeholderHelp: Record<string,string>` to the metadata, and fill it for every templated field.
- **Labels and presets:**
  - `seoTitle()` and `metaDescription()` helpers in `common.ts`. They are `text` with a `softMaxLength` of 60 or 160.
  - Use them for every `meta.title` / `meta.description`, plus `schemaTitle`/`schemaDescription` where they exist.
  - Add a `label` on the meta, hero, and cta groups. The form falls back to humanised keys elsewhere.
- **`validateDocument` returns `warnings`:** soft length, a possible hardcoded year or city (moved here from `validate-content`), and an optional field filled in one locale but empty in the other.
- **`rawHtml` allowlist validator:** `html.ts` holds a pure tokenizer and checker, with no DOM dependency.
- **Placeholder-supply test (I6):** render each templated page with a document where every templated field contains all its allowed placeholders. The page must not throw.
- **N1 hardening:** the `validateContent` test is no longer tied to a Greek city entry.

**Tests:** unit tests for each item above. `pagesUnchanged` under `CMS_MIGRATION_PROOF=1` still passes, because rendering is unchanged.

---

### Task 2: Code-split the admin

**Files:** `src/routeConfig.tsx` (the `/admin` route becomes `React.lazy`), `src/admin/AdminRoute.tsx`, `tests/scripts/bundleSize.test.ts`.

- The admin and everything it imports load from a separate chunk.
- **Bundle test:**
  - The entry chunk, and any chunk loaded by public routes, must contain no `ZodError` and no admin-only marker strings.
  - The admin chunk exists.
  - Record the main chunk size.
- `/admin` still works. Write a render test using lazy plus `Suspense`.

---

### Task 3: DB — `cms_documents` (migration 076)

**Files:** `supabase/migrations/076_cms_documents.sql`, `tests/db/cmsDocuments.test.ts`.

- Table `cms_documents`:

  | Column | Definition |
  |---|---|
  | `doc_id` | `text primary key check (doc_id ~ '^[a-z0-9-]+$')` |
  | `doc_type` | `text not null` |
  | `data` | `jsonb not null` |
  | `updated_at` | `timestamptz not null default now()` |
  | `updated_by` | `uuid` |

- RLS is enabled, with no policies. Access goes through RPCs only.
- RPCs, all super-admin:
  - `cms_list()` → `table(doc_id, doc_type, updated_at, published boolean)`. `published` is true when the doc's `updated_at <=` the last ok/noop publish run's `started_at`.
  - `cms_get(p_doc_id)` → `jsonb` (`{doc_id, doc_type, data, updated_at}`), or null.
  - `cms_save(p_doc_id, p_doc_type, p_data jsonb, p_expected_updated_at timestamptz)`:
    - Inserts when the row is missing, and in that case requires `p_expected_updated_at` to be null.
    - Otherwise updates only if `updated_at = p_expected_updated_at`. If not, it raises `'document changed by someone else; reload'`.
    - Returns the new `updated_at`.
  - `cms_discard(p_doc_id)` deletes the draft, which reverts the doc to the published file.
- `publish_input()` (074) adds `cms_documents: [{doc_id, doc_type, data}]`. `unpublished_summary()` adds `changed_docs text[]`, using the same `since` logic. Edit 074 in place, since it is unapplied.
- **Tests:**
  - Concurrency: a second save with a stale `updated_at` raises.
  - Non-admin calls are forbidden.
  - `published` flag logic.
  - `publish_input` includes the docs.
  - `unpublished_summary` lists changed docs.

---

### Task 4: `publish-content` writes documents

**Files:**
- `supabase/functions/publish-content/{run.ts,cmsFiles.ts,deno.json}`
- `supabase/functions/deno.json`, or a per-function import map: `"zod": "npm:zod@4.3.6"`
- tests: `tests/functions/publishCms.test.ts`, `tests/functions/zodPin.test.ts`

**Behaviour:**
- `cmsFiles(docs)` → `Record<path, string>`.
  - Each doc is validated with `validateDocument(doc_type, data)`.
  - If any doc has errors, it throws `CmsValidationError`, listing `doc_id`, locale, path, and message for each error. `runPublish` ends the run as `error` with that message, and nothing is committed.
  - Valid docs are serialized deterministically, in the same format as the 3a files, to `content/pages/{doc_id}.json`.
- Run it within the same single commit as the contest snapshot.
- **zod pin test:** the `package.json` zod version must equal the `deno.json` `npm:zod@x` version.
- **Import boundary:** `publish-content` may import `../_shared/cms/**`. The existing boundary test still forbids `src/`.

---

### Task 5: Preview

**Files:** `src/lib/cms/PageContentOverride.tsx` (context plus provider), `usePageContent.ts` (check the override first), `src/admin/modules/pages/PreviewPane.tsx` (an error boundary plus locale toggle), and tests.

- `PageContentOverrideProvider({ docId, doc })`: `usePageContent(docId)` returns the override's locale slice synchronously. It never reads the cache, the collector, or the network.
- `PreviewPane` renders the real page component for `docId` (map docId to component; reuse `routeConfig` elements) inside:
  - `LocaleProvider` (with an EN/EL toggle)
  - a `MemoryRouter` at the page's path
  - the override provider
  - an error boundary that shows "Preview error: …"
- Preview must not change `document.title` or head tags. Render `PageSeo` in a mode that does nothing (`HeadCollector` absent → SchemaHead's effect). Add a `PreviewMode` context that SchemaHead respects, so it skips head writes.
- **Tests:**
  - The override is used.
  - A malformed draft or missing placeholder shows the error box.
  - `document.title` is unchanged after rendering the preview.

---

### Task 6: Form generator

**Files:** `src/admin/modules/pages/form/{SchemaForm,fields/*}.tsx` and tests.

- `SchemaForm({ schema, value: {en, el}, onChange, errors, warnings })` walks the schema with `walkSchema`.
- **Per kind:**
  - `text`, `multiline`, `richText`, `href`: inputs, with EN and EL side by side. Shared kinds, including `href`, `choice`, and `flag`, get one control that writes both locales.
  - `choice`: select. `flag`: checkbox.
  - `tuple`: fixed rows.
  - `optional`: an "Add"/"Remove" toggle.
  - `group`: a fieldset with its label or a humanised key.
  - `list`: items with add, remove, and up/down. If the list holds shared fields, every operation applies to both locales at the same index.
  - `rawHtml`: a monospace textarea with the hint "Allowed: <strong>, <em>, <a href="/…">".
- Show the counter with its soft limit. Show placeholder chips with their help text; clicking a chip inserts the placeholder.
- Show errors and warnings inline at their path, matched by locale.
- **Tests:**
  - Each kind renders and edits.
  - Shared-list add/remove/reorder stays aligned across locales.
  - Errors are shown at the right field.
  - Counters warn without blocking.

---

### Task 7: Pages module

**Files:** `src/admin/modules/Pages.tsx`, `src/admin/modules/pages/*`, `src/admin/modules/index.ts` (add Pages after Contests), and tests.

- **List:**
  - Shows all site doc types from `CMS_DOC_TYPES` (group `site`).
  - Each row shows a state badge: "Published" (no draft, or the draft is published), "Draft (unpublished)", or "Never edited" (no draft).
  - Clicking a row opens the editor.
- **Editor:**
  - Loads `cms_get`, or fetches `/content/pages/{docId}.json` as the base.
  - Shows SchemaForm alongside the PreviewPane (side by side, or tabs on narrow screens).
  - Validates live on change, debounced.
  - **Save draft** is disabled while there are errors. Warnings are allowed. It calls `cms_save` with `expected_updated_at`. On a conflict it shows "Someone else changed this page — Reload" with a Reload button.
  - **Discard draft** asks for confirmation, then calls `cms_discard`.
  - The PublishBar at the top is shared with Contests. Reuse `usePublisher`, and include the docs in "N unpublished changes".
- Leaving with unsaved edits asks for confirmation (`beforeunload`, plus a guard on module switch).
- **Tests (mocked supabase):**
  - load-from-published fallback
  - save
  - conflict
  - discard
  - validation blocks save
  - publish includes docs

---

### Task 8: Locale-switcher prefetch, and the runbook

- When the language switcher opens, or on hover or focus, prefetch the other locale's document for the current page, using the existing `prefetchContent`. Test it.
- Runbook (`docs/superpowers/runbooks/2026-cutover.md`):
  - Add migration 076 to the apply order: after 074, before the edge-function deploy.
  - Note that `publish-content` now needs its `deno.json` import map. The deploy rehearsal covers it.
  - Add a CMS smoke step after the first Publish: edit an FAQ answer, Save, Publish, check the live page.
  - Update the coverage test.
