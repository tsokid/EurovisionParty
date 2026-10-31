# Structured Bilingual CMS (Sub-project 3) — Design

**Status:** Approved 2026-10-31. The owner chose: "select the best and most sustainable and worthy solution". Every decision below is Claude's call unless marked *owner*.
**Builds on:** `docs/superpowers/specs/2026-10-30-contests-archive-cms-design.md` (§11) and the shipped sub-projects 1, 2a and 2b on `feat/foundation-prerender`. That work covers prerender, the content snapshot, `publish-content`, and the admin Contests module.

## 1. Intent

The owner wants to change any page's text, images and video from `/admin`, in English and Greek, without a developer, a second platform or other hosting (*owner*, 2026-10-30). Today all copy lives in about 6,000 lines of TypeScript under `src/pages/**/content/*Copy.ts`. Every edit is a code change.

What success means:
- The owner edits a page, sees a preview, presses Publish, and the change is live about 2 minutes later.
- Rankings are unaffected: the migration changes no rendered byte.
- The site stays fast.

## 2. Goals, non-goals, anti-goals

**Goals**
- **One source of truth per page.** Copy lives in `content/pages/{pageId}.json`, with both locales in the file. Layout stays in the React components.
- **Structured, not free-form.** Each page type has a schema. That schema generates the TypeScript type, the build-time validation and the admin form, so nothing can drift between them.
- **Editorial content for data pages.** Archive years, countries and the live hub get an optional editorial layer: intro text, an image and blocks. This is what makes `indexable` worth switching on (spec D5).
- **Flexible zones.** Every page has optional block zones where the owner can add text, image, video, callout, FAQ items or CTA without code.
- **Self-hosted media.** Images and video (*owner*: no YouTube or embeds) are played by our own `<video>` player.

**Non-goals**
- WYSIWYG page building and drag-and-drop layout.
- Multiple editors with roles or workflow. There are two super admins, and git is the history.
- Translation automation.
- In-game UI strings. `src/i18n/*.json` stay in code (spec §2).

**Anti-goals** (a failure even if it works)
- Any change to rendered HTML at migration time. Titles, descriptions, body text and JSON-LD must stay byte-identical.
- A public page that calls Supabase at view time.
- Raw HTML entered by the editor reaching a page, which would be an XSS or markup break.
- Media that slows pages: unbounded image sizes, or autoplaying video that downloads on load.

## 3. Content model

**Files**
- `content/pages/{docId}.json`, one per document, shaped `{ "en": {...}, "el": {...} }`.
- Document IDs:
  - static pages: the registry `pageId`, e.g. `faq`, `how-to-play`, `home`, `not-found`;
  - editorial layers: `archive-{year}`, `country-{ISO}`, `hub-{year}`.
- The `content/` snapshot convention applies: deterministic serialisation, sorted keys, a trailing newline.

**Schemas**
- Each document type is defined with **zod**, added as a direct dependency, in `supabase/functions/_shared/cms/schemas/*.ts`.
- The location is Deno-free and shared by the site build, the admin and `publish-content`, following the 2b rule that edge functions import nothing from `src/`.
- Every field is wrapped in metadata the form generator reads: label, help text, multiline, max length, and whether it is required in both locales.

**Field kinds**
- `text`: single line. Optional `maxLength`, with presets: title ≤ 60, meta description ≤ 160.
- `richText`: limited Markdown. Allowed: paragraphs, `**bold**`, `*italic*`, `[link](url)`, bullet and numbered lists, and `###` headings.
  - Links must be internal paths, which render as `LocaleLink`, or `https://` URLs.
  - It is rendered by our own small renderer to React elements. No `dangerouslySetInnerHTML`, no raw HTML.
- `list<T>`, `object`, `image` (media reference with alt text per locale), `video` (media reference, poster image, optional captions file).
- `blocks`: an ordered list of generic blocks: `text`, `image`, `video`, `callout`, `faq`, `cta`, `steps`, `table`.

**Templates**
- The few strings that depend on live data (about 20 functions across the copy files, e.g. `intro(n)`, years and cities) become strings with whitelisted placeholders: `{year}`, `{city}`, `{cityIn}`, `{count}`, `{finalDate}`.
- Each field declares which placeholders it allows. Interpolation happens at render time.
- Build validation fails on an unknown or missing placeholder.

**Locales**
- On a page that is part of the public build, every required field must be non-empty in **both** `en` and `el`. Publish refuses otherwise.

## 4. Migration (zero rendered change)

1. A one-off script, `scripts/cms/extract-copy.ts`, imports each `*Copy.ts`, converts template functions to placeholder strings using a hand-written per-file mapping, and writes `content/pages/*.json`.
2. Each page component switches from `import { copy }` to `usePageContent(docId)`. That hook follows the hub pattern: it reads the snapshot during SSR, uses the inline `#__content__` seed on the client, and fetches during client navigation.
3. **Proof of zero change.** Before any switch, capture the full prerendered `<head>` and `<main>` text of every static page in both locales into `tests/fixtures/pages-before/`. After the migration, the output must be byte-identical. This extends the frozen-titles approach from 2b Task 7.
4. Delete the `*Copy.ts` files.
5. Contest templates (`archiveCopy.ts`, `countryCopy.ts`, `hubCopy.ts`) **stay in code**. They are grammar engines over data, not editorial text. The CMS adds an editorial layer on top of them (§5).

## 5. Editorial layer for data pages

Documents `archive-{year}`, `country-{ISO}` and `hub-{year}` are all optional:
- `intro`: richText
- `image`: hero image with alt text per locale
- `blocks`: ordered list
- optional `metaDescription` override

When a document exists, its intro renders under the hero and its blocks render before the related links. The data tables stay data-driven.

The ContestDetailsForm hint for `indexable` ("Turn on after you've added your own text or image") gets a live indicator, "Editorial: none / text / text + image", that links to the editor.

## 6. Admin

There is a new **Pages** module next to Contests.

**List**
- All documents, grouped: Site pages, Contest years, Countries.
- Each row shows its state: published / unpublished changes / never published.
- Editorial documents are created on demand ("Add editorial for 2005").

**Editor**
- The form is generated from the schema.
- Each field shows EN and EL side by side, with character counters for limited fields.
- Placeholder chips are shown next to template fields.
- Validation is inline.
- Saving writes a draft to the DB. Nothing goes live until Publish.

**Preview**
- A pane renders the real page component with the draft through a `ContentProvider` override, entirely in the browser. No deployment is needed.
- Locale toggle.

**Publish**
- The existing PublishBar now counts CMS documents as well.
- `publish-content` writes `content/pages/*.json` and media in the same single commit as contests.

## 7. Storage and publish

**DB**
- `cms_documents (doc_id text pk, doc_type text, data jsonb, updated_at, updated_by)`.
- `cms_media (id uuid pk, storage_path, kind image|video|captions, mime, bytes, width, height, sha256, created_at)`.
- RLS: super admin only. Writes go through RPCs, following the 071/074 grant pattern.
- `publish_input()` includes the documents.
- `unpublished_summary()` also reports changed documents.

**Media upload** (admin, client side)
- **Images:** resized in the browser to WebP. Maximum 1600 px wide plus an 800 px variant. Maximum 2 MB after resize.
- **Video:** MP4 (H.264), maximum 20 MB. A poster image is required.
- Files go to the Supabase Storage bucket `cms-media`. It is private, and reads use signed URLs for admin preview only.

**On Publish**
- `publish-content` downloads the referenced media with the service role.
- Each file is written to `public/media/{sha256-12}.{ext}` as base64 Git blobs. Binary files need the blob API, not inline tree content.
- References are rewritten to `/media/...`.
- Files are content-addressed, so they get an immutable cache header in `vercel.json`. Unchanged media is skipped by blob SHA.
- Storage objects older than the last successful publish, and not referenced by any draft, are deleted. This respects the 1 GB free tier.

**Size guard:** if a single publish would add more than 50 MB of media, Publish refuses. The repo-growth risk is noted in spec §12.

## 8. Rendering and performance

- **Images:**
  - `<img>` with `srcset` (800w/1600w), `width`/`height` from metadata (no CLS), `loading="lazy"` and `decoding="async"`.
  - The hero image is eager and gets `fetchpriority="high"`.
- **Video player:**
  - Our own component around the native `<video>`, with `preload="none"`, the poster shown until play, our own controls (play/pause, mute, progress) and keyboard access.
  - Optional per block: `muted autoplay loop playsinline`, only when the block sets it, and only with `IntersectionObserver` once the video is visible.
  - No third-party player.
- **Payload:**
  - A page inlines only its own document. Guide pages already inline `site.json`.
  - The main chunk budget test (1,760,000 B) is kept. The Markdown renderer is ours (about 2 KB), and zod stays out of the client bundle: validation runs at build and in the admin route only.

## 9. Constraints

- Production Supabase is locked. Everything is tested with PGlite, mocked Storage and mocked GitHub. Real uploads are first exercised during the cutover. The runbook gains CMS steps: create the bucket and set its policies.
- SEO safety rules from sub-projects 1 and 2 apply unchanged: frozen titles, check-prerender, the noindex rule, and historical URLs.
- Media enters git. That is acceptable at the current scale (one 15-second video, dozens of images). The 50 MB per-publish guard and the 200 MB total threshold get revisited later (spec §12).

## 10. Left to the builder

- Exact zod-to-form widget mapping and styling. Follow the existing admin modules.
- Markdown parser implementation details, within the allowed subset.
- How the extraction script maps each copy file's functions, provided byte-identical output is proven.

## 11. Order of work

- **3a:** schema engine, `content/pages`, migration of every static page with zero rendered change.
- **3b:** DB, admin Pages editor, preview, and publish of documents.
- **3c:** media upload and publish, the image and video components, the editorial layer for archive, country and hub pages, the indexable indicator, and runbook additions.
