# CMS 3c: Media, Rich Text, Blocks & Editorial Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- The owner can add images, self-hosted video and rich text blocks to any page.
- The owner can give each archive year, country and live hub its own editorial intro, image and blocks.
- Publishing copies the media into the repo (`public/media/`), so the public site never depends on Supabase.
- The `indexable` switch shows whether a year or country has editorial yet.

**Architecture:**
- Uploads go to a private Supabase Storage bucket `cms-media`. Images are resized in the browser first.
- A `cms_media` table records each file's metadata.
- Drafts reference media as `cms-media/<uuid>`.
- On Publish, `publish-content` downloads each referenced file and writes it as a binary Git blob to `public/media/<sha12>.<ext>`. It then rewrites the references in the published JSON to `/media/<sha12>.<ext>`.
- Public components only render `/media/` references.
- The admin preview resolves `cms-media/` references through signed URLs.

**Tech Stack:** Canvas or `createImageBitmap` for client-side resize to WebP. Supabase Storage. GitHub Git Data API (blob `encoding: base64`). React 19. Our own Markdown-subset renderer.

**Specs:**
- `docs/superpowers/specs/2026-10-31-cms-design.md` §3 (richText, blocks), §5, §7, §8.
- 3a and 3b ledgers in `.superpowers/sdd/2026-10-31-cms-3{a,b}-*/progress.md`.

## Global Constraints

- **Testing:** production is locked. Use PGlite, mocked Storage and mocked GitHub.
- **Public bundle:** no zod and no Supabase Storage client. Bundle budget ≤ 1,760,000 B.
- **No rendered change:** existing pages must not change. `pagesUnchanged` with `CMS_MIGRATION_PROOF=1` must pass. New blocks and editorial render only when the content exists.
- **Rich text has no raw HTML.**
  - Markdown subset: paragraphs, `**bold**`, `*italic*`, `[text](url)` with url `/…` or `https://…`, `- ` and `1. ` lists, `### ` headings.
  - Rendered to React elements by our own renderer. `dangerouslySetInnerHTML` is forbidden in it (guard test).
- **Media limits:**
  - Images: input up to 15 MB. Output WebP, 1600 w plus an 800 w variant, at most 2 MB each after resize. `width` and `height` are stored.
  - Video: MP4 (H.264) only, at most 20 MB, poster image required. Captions (VTT) optional.
  - Publish refuses if it would add more than 50 MB of new media.
- **Images render without CLS:** set `width`/`height`, `loading="lazy"` and `decoding="async"`. Hero images use `loading="eager"` and `fetchpriority="high"`.
- **Video player:** our own component around native `<video>`.
  - `preload="none"`, poster shown first.
  - Own controls: play/pause, mute, progress. Keyboard accessible.
  - Autoplay only if the block sets it. It is then `muted loop playsInline` and starts only when visible (IntersectionObserver). It pauses when hidden.
  - No third-party player.
- **Media references:**
  - Drafts may hold `cms-media/<uuid>` or `/media/<sha12>.<ext>`.
  - Published files hold `/media/…` only. `validate-content` fails on a `cms-media/` reference in `content/`.
- **Editorial uniqueness:** editorial `metaDescription` overrides are covered by the I2 cross-page uniqueness check.
- **RPC grant pattern** as in 3b. `tests/scripts/sitemap.test.ts` is flaky under load; re-run it alone.

## Review Focus

1. **A reference that never resolves.** A draft referencing a deleted or missing media row must fail Publish with a clear error. It must not ship a broken image. → Task 5.
2. **Binary integrity.** The bytes committed to Git must equal the Storage bytes, and the blob SHA must match. → Task 5 test with a known binary.
3. **Layout shift and performance.** No image renders without dimensions. Video never downloads before a play intent. → Task 3 tests.
4. **Rich text links.** `javascript:`, `data:`, `//host` and entity tricks are rejected, the same as `isSafeHref`. → Task 2 tests.
5. **Editorial on noindex pages.** Editorial must render the same on indexable and noindex pages. Toggling `indexable` must not depend on publish order. → Task 6.

---

### Task 1: DB and Storage (migration 077)

**Files:** `supabase/migrations/077_cms_media.sql`, `tests/db/cmsMedia.test.ts`.

- Table `cms_media`:
  - `id uuid pk default gen_random_uuid()`
  - `kind text check (kind in ('image','video','captions'))`
  - `storage_path text not null unique`
  - `variant_of uuid references cms_media(id) on delete cascade`, used for the 800 w image variant
  - `mime text not null`, `bytes int not null`, `width int`, `height int`
  - `sha256 text not null`
  - `published_path text` (set by publish)
  - `created_at`, `created_by uuid`
  - RLS on, no policies.
- RPCs (super admin):
  - `media_register(p_kind, p_storage_path, p_mime, p_bytes, p_width, p_height, p_sha256, p_variant_of)` → uuid. Validates mime and bytes against the limits above.
  - `media_list(p_kind text default null)`
  - `media_delete(p_id)`. Refuses with `'media in use by <doc_ids>'` if any `cms_documents.data::text` contains `cms-media/<id>`.
- Service role: `media_mark_published(p_id, p_path)`.
- `publish_input()` (074) adds `media: [{id, kind, storage_path, mime, bytes, sha256, published_path, variant_of, width, height}]` for every media row referenced by an unpublished draft. Edit 074 in place.
- Storage bucket and policies are **documented in the runbook**: the bucket `cms-media` is private, and only super admins may insert or delete, through a `storage.objects` policy using `is_super_admin()`. PGlite can't test Storage. Write the policy SQL into 077, guarded by `if exists (select 1 from pg_namespace where nspname = 'storage')`.

---

### Task 2: Field kinds and rich text

**Files:** `_shared/cms/fields.ts` (`image()`, `video()`, `blocks()`), `_shared/cms/richText.ts` (parser to AST, validator), `src/components/cms/RichText.tsx` (AST to React), tests.

- `image()` = `group({ media: shared mediaRef('image'), alt: text({ required: true }) })`.
- `video()` = `group({ media: shared mediaRef('video'), poster: shared mediaRef('image'), captions: optional(shared mediaRef('captions')), autoplay: flag })`.
- `mediaRef(kind)` is a string kind that matches `^(cms-media/[0-9a-f-]{36}|/media/[0-9a-f]{12}\.(webp|mp4|vtt))$`.
- `richText()`:
  - `parseRichText(s)` returns an AST (paragraph, list, heading, strong, em, link, text).
  - Validation rejects unsafe links (reuse `isSafeHref` plus `https://`) and unsupported syntax, for example raw `<` tags. Those are reported as errors with line numbers.
- `blocks()`: a list of discriminated groups by `type`:

  | Block | Fields |
  |---|---|
  | `text` | `richText` |
  | `image` | `image`, `caption?` |
  | `video` | `video`, `caption?` |
  | `callout` | `tone: choice(info, warn)`, `richText` |
  | `faq` | `items: list({ q, a: richText })` |
  | `cta` | `title`, `body`, `label`, `href` |

  The `type` is shared. Blocks lists are aligned, because they hold shared fields.
- Extend `walkSchema`, `emptyValue`, `SchemaForm` support (Task 4) and `validateDocument`. Use the discriminated union through zod `discriminatedUnion`, walked by `walkSchema`.
- Add a guard: no `dangerouslySetInnerHTML` in `src/components/cms/**`.

---

### Task 3: Public components

**Files:** `src/components/cms/{CmsImage,VideoPlayer,Blocks}.tsx`, tests.

- `CmsImage({ value, hero? })`:
  - Renders only `/media/` refs; anything else renders nothing.
  - Variant lookup: the 800 w variant is `<sha12>-800.webp`, a naming convention set by publish (Task 5).
  - Uses `srcset` and `sizes`.
  - `width` and `height` come from the reference metadata. The published doc stores `{ media, alt, width, height }`: publish writes the dimensions in.
  - Tests:
    - attributes per the Global Constraints;
    - hero vs lazy;
    - no render for `cms-media/`.
- `VideoPlayer({ value })` per the Global Constraints. Tests:
  - `preload="none"`;
  - no `src` request before play;
  - autoplay only when visible (mock IntersectionObserver);
  - keyboard play and pause.
- `Blocks({ value })` renders each block type. FAQ blocks also produce FAQPage JSON-LD entries through a callback the page merges.

---

### Task 4: Admin — upload, media picker, form widgets

**Files:** `src/admin/modules/pages/media/*`, `SchemaForm` widgets for `mediaRef`, `image`, `video`, `richText` and `blocks`, tests.

- **Upload:**
  - The image path decodes the file, resizes it to WebP 1600 w and 800 w (canvas `toBlob('image/webp', 0.82)`) and computes SHA-256 (`crypto.subtle`).
  - It uploads both to `cms-media/<uuid>.webp` and `<uuid>-800.webp`, then calls `media_register` for each, linking the variant.
  - The video path checks mime and size, then requires a poster.
- **Media picker:** `media_list` thumbnails through signed URLs, then pick or upload.
- **Widgets:**
  - `image`: thumbnail plus alt text EN/EL.
  - `video`: poster thumbnail, file name, autoplay toggle.
  - `richText`: textarea with a small toolbar (bold, italic, link, list, heading) and a live rendered preview using `RichText`.
  - `blocks`: add a block by type from a menu, then reorder and remove (aligned across locales).
- **Preview:** `PreviewPane` resolves `cms-media/` refs to signed URLs. The sanitizer from 3b also covers `richText` (already safe through the AST) and `mediaRef`: a disallowed value becomes empty.
- **Tests:**
  - resize mock;
  - upload flow with mocked Storage;
  - picker;
  - each widget;
  - blocks add, reorder and remove alignment.

---

### Task 5: Publish media

**Files:** `supabase/functions/publish-content/{media.ts,run.ts,github.ts}`, `vercel.json` (`/media/(.*)` gets `Cache-Control: public, max-age=31536000, immutable`), tests.

- `collectMediaRefs(drafts)` gathers the `cms-media/<uuid>` references.
  - A missing row, or a row whose kind doesn't match the field, refuses the publish with `doc_id path: media <id> not found`.
- For each reference:
  1. Download it from Storage. Inject `downloadMedia(storage_path) → Uint8Array`.
  2. Verify SHA-256 against the row.
  3. Name it `public/media/<sha12>.<ext>`. Image variants are named `<sha12>-800.webp`.
- Rewrite the references in the doc to `/media/…` and add `width`/`height` for images.
- After a successful commit, call `media_mark_published`.
- **Binary blobs:** `commitFiles` gains binary support. A file value of type `Uint8Array` is sent as a blob with `encoding: base64`. No-op detection uses the git blob SHA computed over bytes.
- **Size guard:** refuse if the new media total is over 50 MB.
- **Tests:**
  - binary round-trip, using a known PNG and WebP fixture, bytes to blob SHA;
  - reference rewrite;
  - missing media;
  - SHA mismatch;
  - size guard;
  - a no-op when the media is already published, meaning `published_path` is set and the file exists in the tree.
- `validate-content` fails on a `cms-media/` reference in `content/`.

---

### Task 6: Editorial layer

**Files:**
- Schemas `editorial.ts`, registered as families with `docTypeFor('archive-2005') === 'archive-editorial'`, `country-GR` → `country-editorial`, `hub-2026` → `hub-editorial`. The `seoFields` call must use `docTypeFor`, per the 3b parked item.
- `src/pages/contest/{ArchiveYearPage,CountryPage,HubPage}.tsx`.
- `usePageContent` gains `{ optional: true }`. With it, a missing doc returns `missing` and does not throw in SSR.
- Snapshot index: `content/pages/index.json` lists the editorial doc ids, so the ContestDetailsForm indicator and the client know what exists. Publish writes it.
- Admin:
  - The Pages list gains "Contest years", "Countries" and "Live hub" groups.
  - "Add editorial for …" offers a select of years and countries without a doc, then creates a draft from `emptyValue`.
  - The ContestDetailsForm indicator shows "Editorial: none / text / text + image" and links to the editor.

**Schema:** `{ intro: richText, image: optional(image()), blocks: blocks(), metaDescription: optional(metaDescription()) }`.

**Rendering:**
- `intro` goes under the hero. `image` is the hero image. `blocks` go before the related links.
- `metaDescription` overrides the templated description when set.

**Tests:**
- An archive page with and without editorial. Without it, the page is byte-identical to now.
- Country and hub pages.
- A missing optional doc doesn't throw.
- The index file is consistent.
- The I2 uniqueness check covers editorial descriptions.

---

### Task 7: Blocks on static pages, runbook, guardrails

- Add an optional `extraBlocks: blocks()` zone to each static page schema, rendered before the page's related or CTA section. It is empty by default, so existing pages are unchanged. Proven by `pagesUnchanged`.
- Runbook additions:
  - create the bucket `cms-media`, private;
  - apply the Storage policies;
  - apply 077 after 076;
  - a smoke test: upload an image, add it to the 2005 editorial, Publish, and check `/el/past-contests/eurovision-2005-kyiv` shows it with dimensions.
- Guard tests:
  - no `cms-media/` in `content/**`;
  - every `/media/` reference in `content/**` exists in `public/media/`;
  - an orphaned `public/media` file only warns.
