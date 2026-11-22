# Track 3: Our Own CMS inside `/admin`, Design Spec

**Date:** 2026-11-21 · **Status:** draft for owner review · **Decision basis:** roadmap 2026-11-18, Track 3, option A (owner, 21 Nov 2026)
**Builds on:** `2026-10-30-contests-archive-cms-design.md` §7 and §11, migrations 074/076/077, `supabase/functions/publish-content`, `scripts/seo/snapshot*.ts` (branch `feat/redesign-stage`).

---

## 1. Intent

Give the two admins a Storyblok/Sanity-grade editor for **every word on the public site**, organized the way the site is organized. Publishing must never cost SEO.

**Goals**
- All public copy, including header, footer and settings, is CMS content. Code keeps structure and components only.
- The admin mirrors the site: Header, Footer columns, pages by where they appear (including pages in no menu), contests/countries/entries, media, settings.
- Every screen and every document has a URL that can be deep-linked.
- Click-to-edit on the real page, autosave, per-page publish with a diff, history and restore, EN/EL side by side, ⌘K, and SEO checks.
- Publishing is gated by a **blocking SEO guard** and goes through the existing prerender → Vercel pipeline.

**Non-goals**
- Roles and workflow. There are exactly two editors and no review step.
- In-game strings, quiz questions and room flows (unchanged from 2026-10-30 §13).
- Creating new routes from the admin. Pages map 1:1 to `PAGE_REGISTRY`; a new page type means a code change.
- A Vercel or GitHub UI inside the admin. We link out.

**Anti-goals (we will refuse these)**
- Runtime CMS reads on public pages. The build never calls Supabase (2026-10-30 §4).
- Any editor-only markup in prerendered HTML. `data-cms-path` exists only in preview.
- Raw URLs typed into nav items. Links point at `pageId`s so slugs stay single-sourced.
- Free-form HTML or WYSIWYG page building that bypasses the schemas.

---

## 2. Content model

Every document has the shape `{ en: T, el: T }`, validated by zod schemas in `supabase/functions/_shared/cms/`. The published source of truth is `content/**` in the repo, and drafts live in `cms_documents`. A missing draft row means "same as published".

| Type | docId / storage | Key fields | Status |
|---|---|---|---|
| **Page (static)** | `about`, `faq`, `rules`, `home`… (18 ids = `PAGE_REGISTRY`) → `content/pages/{id}.json` | `seoTitle`, `metaDescription`, `h1`, `lede`, `ogImage`, blocks (text, image, video, faq, steps, table, cta, related, dynamic) | **Exists** (076, `registry.ts`) |
| **Editorial layer** | `archive-{year}`, `country-{iso}`, `hub-{year}` | intro/outro text, optional `metaDescription` override, blocks | **Exists** (3c) |
| **FAQ item** | Embedded block inside the `faq` doc, with a stable `id` (`create`, `join`, `leave`) | `id` (anchor, immutable once published), `q`, `a` (rich text) | **Exists.** New: `id` becomes required and immutable, and nav targets can reference it |
| **Header** | `site-header` → `content/pages/site-header.json` | `items[]`: `{ label, target, children[]? }`; `cta`: `{ label, target }` (Φτιάξε Δωμάτιο); `ui`: `openMenu`, `closeMenu`, `yourRooms`, `noRooms`, `joinRoom` | **New** |
| **Footer** | `site-footer` | `tagline`; `columns[4]`: `{ key: about \| howToPlay \| eurovision \| help, heading, links[] }`; `disclaimer`; `contactEmail` | **New** (4 columns per the Stage footer on `feat/redesign-stage`) |
| **Settings** | `site-settings` | `siteName`, default `ogImage`, Organization JSON-LD name/logo, social profiles, `contactEmail` (single source) | **New** |
| **Contest** | `contests` table → `content/contests/{year}.json` | year, city, host, dates, stage, `indexable` | **Exists** (070) |
| **Entry** | `contest_entries` | country, artist, song, semi, places, points, `qualified` | **Exists** (070/071) |
| **Country** | `countries` table → `content/countries/{iso}.json` | names en/el, slug, `indexable` | **Exists** |
| **Media** | `cms_media` + private bucket `cms-media` → `public/media/{sha12}.{ext}` | kind, mime, size, dimensions, `variant_of`; **new:** `alt {en, el}`, `title` | **Exists** (077). Alt moves from per-block to a media default that a block can override |

**Link target type (new, shared):** `{ kind: 'page', pageId, anchor? } | { kind: 'dynamic', key: 'hub' | 'pastContests' | 'countries' | 'winners' } | { kind: 'external', href }`. The renderer resolves it through `localizePath` and `hubPath(year)`. Labels may use `{year}`, as `siteNav.hub` does today.

**Seed:** `scripts/cms/extract-copy.ts` gets a mapping for `siteNav.*` and `siteFooter.*` from `src/i18n/locales/{en,el}.json`. The script writes the three new JSON files, and the i18n keys are then deleted. The existing `pagesUnchanged` capture test proves the prerendered HTML is byte-identical.

**Derived, not stored:** "Not in any menu" = `PAGE_REGISTRY` minus the `pageId`s referenced by header and footer. Today that is `/eurovision-party`. `/rules` shows as header-only.

---

## 3. Information architecture and URL map

The admin moves from state-switched modules (`AdminShell` `activeId`, `adminNav.openDoc`) to nested routes under `/admin/*`. The structure follows Sanity's Structure Builder idea: a desk tree that mirrors the product, not the database.

```
/admin                                   Dashboard: unpublished changes, last runs, missing translations
/admin/header                            Header editor (+ preview of the header)
/admin/footer                            Footer: 4 columns + disclaimer
/admin/footer/:column                    One column (about | how-to-play | eurovision | help)
/admin/pages                             Pages grouped: Header · Footer › column · Not in any menu · Data-page editorials
/admin/pages/:docId                      Editor (split: fields | live preview)
   ?locale=en|el|both  &field=blocks.3.items.1.a   deep link to a field
/admin/pages/:docId/history              Revision timeline
/admin/pages/:docId/history/:revId       Read-only revision + "Restore"
/admin/pages/:docId/publish              Diff vs live + SEO report + Publish
/admin/contests                          Contest list
/admin/contests/:year                    Contest details + editorial link
/admin/contests/:year/entries/:iso       Entry editor
/admin/countries                         Countries list
/admin/countries/:iso                    Country + editorial
/admin/media                             Library (grid, filters, "unused")
/admin/media/:id                         Asset: alt EN/EL, usage list, replace
/admin/settings                          Site settings
/admin/publish                           Queue (all unpublished) + run log
/admin/publish/runs/:runId               Run detail: commit, deploy state, SEO diff, revert
/admin/game/{parser|monitor|winners}     Existing night-of tools, unchanged inside
/admin/system/admins                     Super admins
/admin/preview/:docId/:locale            Preview iframe target (not navigable from the menu)
```

Each editor shows **"View live ↗"** (the public URL) and **"Copy admin link"**. `vercel.json` already sends `X-Robots-Tag: noindex, nofollow, noarchive` for `/admin(.*)`, and `robots.txt` disallows `/admin/`. The SPA rewrite must cover `/admin/*`, and a test asserts it.

The UI is built on the Stage tokens (`--color-stage-*` in `src/index.css`) and primitives (`src/components/stage/`). The admin gets a dense variant (`Card`, `Chip`, `Button`) and no separate palette. This replaces the current `bg-[rgb(10,5,25)]` one-off styling.

---

## 4. Editing UX, benchmarked

| Feature | Benchmark pattern adopted | Our implementation |
|---|---|---|
| Site-shaped navigation | **Sanity Structure Builder** (custom desk tree) | Tree from §3, computed from header/footer docs, so moving a link moves the page in the tree |
| Click-to-edit | **Storyblok Visual Editor + bridge** (iframe, `_editable` markers, postMessage). Sanity Presentation's stega encoding is rejected: invisible characters must never reach prerendered HTML | `data-cms-path` markers only in preview mode, iframe bridge (§5) |
| Autosave | **Sanity draft documents** (separate draft, continuous save) | Debounced 1.2 s `cms_save` with the existing optimistic concurrency. Status pill: *Saving… / Saved 12:04 / Conflict*. Blur and route change flush immediately |
| Two editors at once | **Sanity presence avatars** | Supabase Realtime presence on `cms:doc:{id}`: avatar plus field focus ("Elena · FAQ › join"). On a conflict, a disjoint-path change auto-rebases and an overlapping one opens a per-field "keep mine / keep theirs" dialog |
| Per-page publish + diff | **Contentful per-entry Publish** + **Sanity Review Changes** (field-level diff with author) | `/publish` screen: text diff per field per locale, visual diff (§5), SEO delta. Publish ships only this doc. Header, footer and settings are labelled "site-wide: affects all 285 pages" |
| History and restore | **Sanity History timeline** | Revisions grouped by editing session plus every publish (with commit SHA). Restore writes a new draft and never rewrites history |
| EN/EL | **Contentful multi-locale field editor** ("show all locales" columns) + **Storyblok translation status** | `locale=both` shows two columns per field. Flags appear at three levels: field (red dot), doc (`EL 3 missing`), list and tree badge. A required field empty in either locale blocks publish (2026-10-30 §11) |
| ⌘K | **Sanity global search** (Ctrl/⌘K over docs + Linear-style actions) | Client index of screens, doc titles, field text (drafts + published, under 1 MB), contests, countries and media alt. Actions include "Publish current", "Open live" and "Go to history" |
| SEO checks | **Storyblok/Contentful SEO apps** (per-entry panel) | Right-rail panel, live while typing (§4.1) |

### 4.1 SEO checks per page

| Check | Rule | Severity |
|---|---|---|
| Title length | 30–60 chars per locale (rendered, `{year}` interpolated) | Warn over 60, **block if empty** |
| Meta description | 70–160 chars; unique across the site (existing `seo.ts`) | Warn on length, **block on duplicate** |
| H1 | Exactly one `<h1>` in the rendered preview DOM | **Block** on 0 or more than 1 |
| Slug | Read-only, fixed English (2026-10-30 §3). Shown with the canonical | Info |
| Missing alt | Every `<img>` in preview has non-empty alt in both locales | **Block** |
| hreflang pair | Both locales valid → `en` and `el` alternates plus `x-default` will render | **Block** if one locale is incomplete |
| Internal links | Every rendered `<a href>` resolves to a `PAGE_REGISTRY` route, a dynamic route with data, or a FAQ anchor that exists | **Block** on a broken link, warn on a nofollow or external link |

The checks run on the **preview's rendered DOM** plus the shared `validate.ts`/`seo.ts`, so the editor and Publish use one implementation.

---

## 5. Preview architecture

The existing `PreviewPane` renders the page inline with `PageContentOverrideProvider`, `PreviewModeContext`, a cloned i18n instance and a detached router. It moves into a **same-origin iframe** at `/admin/preview/:docId/:locale`, still inside the admin chunk. The iframe gives:
- real viewport widths (360 / 768 / 1280 toggles);
- no CSS bleed between the admin and the page;
- the real `SiteHeader`/`SiteFooter` chrome, needed to edit nav in context.

**Data flow**
1. The iframe authenticates with the shared Supabase session (same origin) and reads **drafts directly through RLS** (new select policy, §7), overlaid on the published `content/**` JSON. It subscribes to Realtime `postgres_changes` on `cms_documents`, so the other editor's autosaves appear live.
2. Keystrokes that are not yet autosaved go parent → iframe over `postMessage({type:'draft', docId, locale, data})`. The origin is checked, and so is the schema version.
3. Components mark editable nodes with `cmsAttrs(path)`, which returns `{ 'data-cms-path': 'faq:el:blocks.3.items.1.a' }` **only when `PreviewModeContext` is true** and `{}` otherwise. The prerender never sets preview mode, so the output stays byte-identical and the `pagesUnchanged` test plus the SEO snapshot enforce it.
4. **Click mapping:** a capture-phase listener in the iframe finds `closest('[data-cms-path]')`, outlines it on hover, and on click sends `{type:'focus', path}`. The parent routes to `?field=` and focuses the input. In reverse, focusing a field sends `{type:'highlight', path}`. Links and forms in the iframe stay swallowed (as today).
5. **Visual diff:** two iframes, live (published JSON only) and draft, with "side by side" and "overlay with highlight" modes. Nodes whose `data-cms-path` value differs between the two are tinted. This is a DOM-level comparison and needs no screenshot infrastructure.
6. Head tags are captured by a **preview head collector** (replacing the current "skip head writes"), so the SEO panel reads the exact title, meta, canonical, hreflang and JSON-LD the prerender will emit.

---

## 6. Publish pipeline

```
draft ─► /publish: diff + SEO checks (client, blocking) ─► begin_publish(cms, doc_ids)
      ─► publish-content: validate + uniqueness + seo-intent ─► 1 commit to main (GitHub Data API)
      ─► Vercel build: validate-content → vite build → SSR → prerender → check-prerender
                       → seo:snapshot → seo:diff (live baseline, intent)  ◄── BLOCKING
      ─► deploy ─► end_publish + deploy state ─► revisions marked "published"
```

- **Per-page scope.** `begin_publish` takes `p_doc_ids text[]` (null = all). `publish_input` returns only those drafts, and contests stay on their own path. Global "Publish all" remains on `/admin/publish`.
- **SEO intent.** `publish-content` writes `content/.seo-intent.json` in the same commit. It lists the URLs whose source changed and the HARD fields expected to change (title, description, h1, canonical, hreflang, jsonLd, robots), derived from the shipped docs and contest years. A removed route is allowed only when `vercel.json` gets a 301 for it in the same commit.
- **Guard.** `scripts/seo/snapshot.ts` and `snapshot-diff.ts` are merged from `feat/redesign-stage` into the build after `check-prerender`. The baseline is the **live** `/_seo/snapshot.json`, emitted by every deploy (disallowed in robots, noindex header). `snapshot-diff` gains `--intent`. A HARD change outside the intent, or a removed route without a 301, fails the build. Fetch failure fails closed; `SEO_GUARD_BOOTSTRAP=1` exists for the first deploy only. Code pushes run the same guard, so a redesign commit with no intent file must be SEO-neutral.
- **Triggering Vercel.** Unchanged: a push to `main` auto-deploys. New edge function `publish-status` uses a read-only Vercel token (function secret) to poll the deployment by commit SHA. It writes `publish_runs.deploy_state` (`building | ready | error`) and `deploy_url`. The admin shows the state live.
- **Failure handling.**
  - Pre-commit failure (validation, SEO check, media): nothing is committed and the draft stays. The error is shown per field.
  - Build failure: Vercel keeps the previous production deployment (a failed build is never promoted). `publish-status` sees `error` and **auto-creates a revert commit** (parent tree via `github.ts`), so `main` stays green. The run shows the guard's diff output, and drafts remain unpublished.
  - A hung run uses the existing 10-minute timeout in `begin_publish`.
- **Rollback after a good deploy.** Two paths:
  1. **Undo publish:** a revert commit of that run's SHA, offered only if no later commit touched the same files.
  2. **Restore revision → Publish:** a forward fix, always available.

  Vercel Instant Rollback stays a manual break-glass, documented in the runbook.

---

## 7. Data and migrations

Numbers are provisional (main ends at 084 after the Stage redesign; avatars library is 089). Everything is idempotent and PGlite-tested.

| Migration | Change | RLS / access |
|---|---|---|
| **085_cms_revisions** | `cms_revisions(id bigserial, doc_id, data jsonb, kind in ('checkpoint','published','restored','seed'), author uuid, run_id, commit_sha, created_at)`. `cms_save` writes a checkpoint when the author's last checkpoint for that doc is over 10 min old, and prunes checkpoints older than 90 days inline (no cron; crons are off per 068). RPCs `cms_history(doc_id)` and `cms_restore(doc_id, rev_id, expected_updated_at)` | RLS on; select for `is_super_admin()`; writes only via RPC (security definer, locked per 069) |
| **086_cms_publish_per_doc** | `cms_documents.published_updated_at`; `publish_runs.doc_ids text[]`, `deploy_state`, `deploy_url`, `reverted_sha`. `begin_publish(p_cms, p_doc_ids)`. `end_publish` stamps `published_updated_at = updated_at` for shipped docs and inserts `published` revisions. `cms_list.published` and `unpublished_summary.changed_docs` switch from the global CMS-since to per doc. Backfill from the old logic. `set_deploy_state(run_id, …)` (service_role) | `deploy_state` writes are service_role only |
| **087_cms_read_rls** | Select policies on `cms_documents`, `cms_media`, `cms_revisions` for authenticated `is_super_admin()`. Add `cms_documents` to the `supabase_realtime` publication | Read-only policies; insert/update/delete stay RPC-only |
| **088_cms_media_alt** | `cms_media.alt jsonb` (`{en, el}`), `title`. `media_set_meta(id, alt, title)` | RPC-only writes |

No migration seeds header, footer or settings: they are committed JSON (repo = published), as with 3a.

---

## 8. Phased delivery

| # | Phase | Definition of done |
|---|---|---|
| **P0** | Routed shell on Stage tokens | Every existing module is reachable at its §3 URL. Back/forward and reload restore the screen. The unsaved-edits guard works on route change. `/admin/*` is noindex (header + robots test). No change to public HTML |
| **P1** | SEO guard in the pipeline | Snapshot scripts merged. The live `/_seo/snapshot.json` is emitted. `seo:diff --intent` runs in `npm run build`. `publish-content` writes the intent. A test commit that changes a title without intent fails the Vercel build and production is untouched |
| **P2** | Header, footer, settings as content | Three doc types plus schemas. Seeded from i18n, `siteNav`/`siteFooter` keys removed. `SiteHeader`/`SiteFooter` read the docs. `pagesUnchanged` and the SEO snapshot are identical. The "Not in any menu" group lists `/eurovision-party` |
| **P3** | Autosave, history, presence | 085 + 087 applied. Autosave with a status pill. Timeline + restore. Presence avatars. A two-browser conflict test (disjoint fields auto-rebase, overlapping fields show the dialog) |
| **P4** | Iframe preview + click-to-edit | `cmsAttrs` on all CMS-fed components, including header and footer. Click ↔ field round-trip on every static page. Viewport toggles. Zero `data-cms-path` in `dist/` (build check) |
| **P5** | Per-page publish + diff + deploy state | 086 applied. `/publish` diff (text + visual + SEO delta). Single-doc publish ships one file. `publish-status` shows building/ready/error. Auto-revert on a failed build is proven once on production with a deliberately broken draft |
| **P6** | EN/EL columns, SEO panel, ⌘K, media alt | 088 applied. Missing-translation flags at field, doc and tree level. All §4.1 checks are live, with blocking checks enforced in Publish. ⌘K opens any doc or field in 2 keystrokes or fewer after typing |

The Stage redesign (with the 4-column footer) shipped on 22 Nov 2026; P2 seeds header and footer from that shipped version.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Header/footer edit is site-wide: one bad link reaches 285 pages | High | Internal-link check blocks the publish. The "site-wide" label sits on Publish. The SEO guard covers the JSON-LD and nav-driven H1-adjacent changes |
| Live-baseline fetch dependency in the build | Build blocked if the site is down | Fail closed by design; documented bootstrap flag; the baseline is cached in the Vercel build cache as a second source |
| Supabase DB size (402 history) | Writes refused | Revisions capped: checkpoints pruned at 90 days, docs under 1 MiB; dashboard shows DB size |
| Auto-revert races a second publish | Reverts the wrong content | `begin_publish` serializes runs; revert only if `main` HEAD = the failed SHA, otherwise alert and stop |
| Preview/prerender divergence (iframe reads drafts at runtime, prerender reads files) | Editor sees something the site will not render | The iframe uses the same components and the same overlay function as `publish-content`'s `cmsFiles`. The P4 parity test renders both from one fixture |
| Season pressure: Track 3 lands Feb–Mar 2027, before May | Editor churn during content push | Phases are independent and shippable. P0–P2 alone remove the hardcoding; P5 is the last risky change, frozen after 15 Apr |

---

## 10. Open questions for the owner

**Q1. Two people on one page: how strict?**

| Option | Trade-off |
|---|---|
| A. Presence + auto-rebase + conflict dialog *(recommended, specced)* | Smooth for two people; rare dialog on the same field |
| B. Hard lock per page, "take over" button | Zero conflicts; blocks Elena while the owner has a tab open |
| C. Real-time co-editing (CRDT/Yjs) | Google-Docs feel; roughly 3× build cost and a new dependency, overkill for 2 editors |

**Q2. Visual diff fidelity**

| Option | Trade-off |
|---|---|
| A. DOM side-by-side with changed-node tint *(recommended)* | No infra, instant; does not catch pure CSS regressions (those come from code, not content) |
| B. Pixel screenshot diff (Vercel preview + Playwright in a GitHub Action) | Exact; adds 3–5 min per publish and CI secrets |
| C. Text diff only | Cheapest; misses layout effects (long EL strings wrapping) |

**Q3. Should risky publishes go through a Vercel preview first?**

| Option | Trade-off |
|---|---|
| A. Always straight to `main`, guard in build *(today's model)* | Fastest (about 2 min); a failed build costs one auto-revert |
| B. Every publish goes to a `content-preview` branch, then you promote | Real prerendered preview before live; doubles publish time and adds a click |
| C. Only site-wide docs (header, footer, settings) go via preview *(recommended)* | Safety where blast radius is 285 pages, speed everywhere else |

**Q4. How much layout freedom on pages?**

| Option | Trade-off |
|---|---|
| A. Fixed fields per page (today) | Safest SEO; every structural change needs code |
| B. Reorder, add or remove blocks from the fixed block set *(recommended)* | Storyblok-like freedom within the design system; the schemas change from tuples to lists |
| C. Full page builder, including new pages from the admin | Max freedom; needs dynamic routes and registry-from-DB, the biggest SEO risk |

**Q5. Revision retention**

| Option | Trade-off |
|---|---|
| A. Keep everything | Full audit trail; DB growth on a size-restricted project |
| B. Published versions forever, checkpoints 90 days *(recommended)* | Bounded size; old mid-edit states are lost after 3 months |
| C. Published versions only in the DB, checkpoints in browser storage | Smallest DB; history is per device and not shared between the two editors |

## Addendum (owner, 22 Nov 2026): Avatars library in the CMS

The owner wants avatars managed in the CMS. It must be top-level quality and simple, never complex.

**Admin location:** `/admin/game/avatars`, its own URL, next to the other game settings. It is a grid of cards, each showing the thumbnail, the title (EN, plus an optional EL), a status chip and a usage count.

**Actions:**
- **Add.** Drag-and-drop one or many images onto the grid. Each image is cropped square in the browser, previewed on the Stage circle, and uploaded. The server makes 96px and 512px WebP files. The title is taken from the filename and can be edited inline.
- **Publish / Unpublish.** Unpublished avatars disappear from the picker for new players. Players who already chose one keep it. The control is a toggle on the card and takes effect at once (no site rebuild, since the picker reads it live).
- **Reorder.** Drag to reorder; the order is the picker order.
- **Delete.** Soft delete with an undo toast. After 30 days the avatar is purged, along with its storage files. If players in active rooms use it, the confirmation dialog says how many, and those players fall back to the code-built SVG avatar. Hard delete is only allowed when nobody uses the avatar.
- **Bulk.** Select several avatars, then Publish, Unpublish or Delete them.

**Data model:**
- Migration `avatars`:
  - `id text pk` (img-NN or a uuid)
  - `title_en`, `title_el`
  - `thumb_path`, `full_path` (Supabase storage bucket `avatars`, public read)
  - `status` ('published' | 'unpublished')
  - `sort int`
  - `created_at`, `deleted_at`
- RLS:
  - public select where `status='published'` and `deleted_at` is null
  - admins (allowlist) get full access
- **Seed:** the 53 owner avatars that ship in `public/avatars/` with the redesign get imported into the table and the bucket. After that the app reads only from the table; the static registry remains as an offline fallback and for SSR.
- The picker queries published avatars ordered by `sort`. `players.avatar_id` references the id loosely (no FK), so deleting an avatar never breaks rows.

**Phase:** this ships in P2, alongside the header and footer, because it is self-contained and high-value.
