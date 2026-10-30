# Contests, Archive & Structured CMS — Design Spec

**Status:** Draft for review, 2026-10-30 (brainstorm with tsokid@gmail.com)
**Author:** Claude
**Scope:** Move the site from a hardcoded 2026 build to a year-agnostic contest system with a public archive, country history pages, static per-URL HTML, and a bilingual (EN/EL) structured CMS inside the existing `/admin`.
**Does NOT touch:** live game mechanics (rooms, phases, duels, quiz, scoring), `super_admins` / `super_admin_emails`, admin OTP auth, in-game UI strings (`src/i18n/*.json` stay in code).

---

## 1. Problem

1. **Everything is 2026-shaped.** Tables are named `eurovision_2026_participants` / `eurovision_2026_results`, the lineup is hardcoded in `src/lib/countries2026.ts`, page copy (`src/pages/seo/content/*Copy.ts`) names 2026, `index.html` titles say 2026. Moving to 2027 means editing code in dozens of places, and 2026 data has nowhere to go afterwards.
2. **No history.** Past contests exist only as a winners list in `winnersCopy.ts` and a 2025 ranking in `scripts/seed-2025-results.js` (ISO codes, no points). Nothing searchable like "Eurovision 2025 results" or "Greece in Eurovision".
3. **Crawlers see one page.** `vercel.json` rewrites every URL to `/index.html`; the SPA sets title/meta client-side. Every URL ships the same 2026 `<title>` to Google and social previews.
4. **12 soft-404s.** `src/lib/seo/registry.ts` and `public/sitemap.xml` advertise URLs with no route: `eurovision-2026`, `-2026-schedule`, `-2026-semifinals`, `-2026-songs`, `eurovision-quiz`, `host-eurovision-party`, `eurovision-history`, `countries`, and Greek-only `eurovision-ellada`, `eurovision-kypros`, `eurovision-2026-elliniko-tragoudi`, `eurovision-2026-programma`.
5. **Content edits need a developer.** No way for the admin to change text, images or video.

## 2. Decisions taken in brainstorm

| # | Decision |
|---|---|
| D1 | **Static pages, Supabase only for the live game.** Public content pages never query Supabase at view time. Supabase holds editable drafts; the published site is a snapshot in the repo, built by Vercel. |
| D2 | **Lifecycle per contest year:** `upcoming → current → finalized → archived`. **Finalize** locks results and computes winners. **Archive** is a separate button that snapshots the year into the repo and creates its archive page. |
| D3 | **Un-archive** = full undo of an Archive pressed by mistake. **Corrections** to an archived year use **Edit + Republish**; the archive page never goes offline. |
| D4 | **The current year stays current until the next lineup exists.** 2026 stays `finalized` (hub shows results) until 2027 entries are announced (≈ Jan–Feb 2027); then Archive 2026 and 2027 becomes `current`. No "TBA" partial-row states are needed. |
| D5 | **Import all history (1956–2025) once; publish gradually.** Every year gets an archive page; each year has an `indexable` switch, off until the admin adds own text or an image. Non-indexable years are listed in `/past-contests` but carry `noindex`. |
| D6 | **Country pages with full history**, generated from the archive. |
| D7 | **Participants are data, not code.** One entries table with a `year` column feeds every page and the game. "Current participants" is a view over the current year, so archiving changes which year it points to — no table renames. |
| D8 | **CMS lives inside the existing `/admin`**, next to the parser modules. No other platform or hosting. All pages structured (typed fields + typed blocks), EN and EL. |
| D9 | **No embedded video (YouTube etc.).** Video is a self-hosted file (current asset: 15 s) played by our own player. |
| D10 | **Build order:** (1) Foundation → (2) Contests & archive → (3) General CMS. Each gets its own implementation plan. |

## 3. Site map (approved)

All pages exist as `/en/…` and `/el/…`. Slugs are English in both locales; titles, headings and body are localized.

| Type | URLs | Source |
|---|---|---|
| Home | `/` | CMS page + game entry |
| Current contest hub | `/eurovision-{year}`, `/eurovision-{year}/schedule`, `/eurovision-{year}/semifinals`, `/eurovision-{year}/songs` | AUTO from current contest + CMS text |
| Guides (no year in URL) | `/how-to-play`, `/eurovision-predictions` (renamed), `/eurovision-night`, `/eurovision-games`, `/eurovision-party`, `/eurovision-trivia`, `/duels`, `/dashboard`, `/rules`, `/scoring`, `/faq` | CMS page; year-dependent parts are dynamic blocks |
| Archive | `/past-contests`, `/past-contests/eurovision-{year}-{city-slug}` | AUTO from archived contests + CMS text |
| Winners | `/winners` | AUTO from archive (replaces `winnersCopy.ts` hardcoded list) |
| Countries | `/countries`, `/countries/{country-slug}` | AUTO from archive + optional CMS text |
| Legal / info | `/about`, `/privacy`, `/terms`, `/cookies` | CMS page |

**Soft-404 resolution:**
- `eurovision-2026`, `-2026-schedule`, `-2026-semifinals`, `-2026-songs` → become the hub (flat slugs 301 to the nested hub URLs).
- `countries` → becomes `/countries`. `eurovision-ellada` → 301 `/el/countries/greece`. `eurovision-kypros` → 301 `/el/countries/cyprus`.
- `eurovision-history` → 301 `/past-contests`.
- `eurovision-2026-programma` → 301 `/el/eurovision-2026/schedule`. `eurovision-2026-elliniko-tragoudi` → 301 `/el/countries/greece`.
- `eurovision-quiz` → 301 `/eurovision-trivia`. `host-eurovision-party` → 301 `/eurovision-party`.
- `eurovision-2026-predictions` → 301 `/eurovision-predictions`.
- Sitemap and registry contain **only** URLs that are built. A build-time check fails the build if a registry/sitemap URL has no prerendered file.

**After Archive of year Y:** `/eurovision-{Y}` and its subpages 301 to `/past-contests/eurovision-{Y}-{city}`. Un-archive removes those redirects.

## 4. Architecture

```
            ┌─────────── /admin (React, Supabase auth) ───────────┐
            │ edit contests / entries / pages / media (drafts)    │
            │ buttons: Finalize · Archive · Un-archive · Publish  │
            └──────────────┬──────────────────────────────────────┘
                           │ RPC / insert (super admin only, RLS)
                    ┌──────▼──────┐
                    │  Supabase   │  drafts: contests, contest_entries,
                    │  Postgres   │  countries, pages, media (+ Storage)
                    └──────┬──────┘
                           │ edge function `publish-content`
                           │ (super admin JWT check)
                           ▼
            GitHub commit to main: content/** + public/media/** + vercel.json redirects
                           │ (Vercel auto-deploy on push)
                           ▼
            Vercel build: prebuild (sitemap, llms.txt) → vite build → prerender
                           │
                           ▼
            dist/{locale}/{path}/index.html per URL  (served before the SPA rewrite)
```

- **Source of truth for editing:** Supabase (all years, including archived — ~70 years × ~40 rows is tiny).
- **Source of truth for the public site:** the repo snapshot under `content/`. The build never calls Supabase.
- **Live game** keeps reading Supabase (rooms, players, live results). Its lineup comes from the `current_participants` view; if that is empty or unreachable it falls back to the snapshot of the current year bundled at build time (replaces the `COUNTRIES_2026` fallback).

### 4.1 Snapshot layout (repo)

```
content/
  contests/{year}.json        # contest meta + all entries (final + semis) + per-locale CMS text for that year
  countries/{iso}.json        # names, slugs, optional CMS text per locale
  pages/{pageId}.json         # CMS pages: per-locale fields + blocks
  site.json                   # which year is current, stage, navigation
public/media/{hash}.{ext}     # images, video, posters (content-addressed, immutable cache)
```

`src/content/_loader.ts` + `_types.ts` already define a JSON `PageContent` shape with typed sections (paragraph, list, steps, table, faq, cta, related, definitionBlock). Extend it; do not invent a second format. Existing `*Copy.ts` files migrate into `content/pages/*.json` (sub-project 3; sub-project 1 may read them as-is).

## 5. Data model (Supabase)

```sql
create type contest_stage as enum ('upcoming','current','finalized','archived');

create table contests (
  year          int primary key,
  host_iso      text,                 -- host country
  city          text not null,        -- display, e.g. 'Vienna'
  city_slug     text not null,        -- 'vienna' → /past-contests/eurovision-2026-vienna
  semi1_date    date, semi2_date date, final_date date,
  stage         contest_stage not null default 'upcoming',
  indexable     boolean not null default false,   -- D5
  finalized_at  timestamptz, archived_at timestamptz,
  published_at  timestamptz,                      -- last successful publish of this year
  updated_at    timestamptz not null default now()
);
-- at most one contest in ('current','finalized')
create unique index one_live_contest on contests ((true)) where stage in ('current','finalized');

create table countries (
  iso      text primary key,          -- ISO 3166-1 alpha-2 (+ historical: 'YU','CS' etc. as needed)
  name_en  text not null, name_el text not null,
  slug     text not null unique       -- 'greece'
);

create table contest_entries (
  year              int  references contests(year) on delete cascade,
  iso               text references countries(iso),
  artist            text, song text, language text,
  semi              smallint,          -- 1 | 2 | null (auto-qualifier or pre-2004)
  semi_running_order smallint, semi_place smallint, semi_points int,
  qualified         boolean,           -- null when no semis that year
  final_running_order smallint, final_place smallint,
  total_points int, jury_points int, televote_points int,
  source            text,              -- 'parser' | 'import:<dataset>' | 'manual'
  updated_at        timestamptz not null default now(),
  primary key (year, iso)
);

-- every entry of the live year (hub, songs, semifinals pages)
create view current_entries as
  select e.* from contest_entries e
  join contests c on c.year = e.year and c.stage in ('current','finalized');

-- the game's lineup: grand-final entries only (same ~26 rows the game reads today)
create view current_participants as
  select * from current_entries where final_running_order is not null;
```

- **Game lineup = finalists only.** `current_participants` replaces `eurovision_2026_participants` one-for-one: one row per finalist, `final_running_order` is the game's `running_order`. Before the final lineup is known the view is empty, exactly as the table is today before the participants parse; the predictions phase gating is unchanged. `commit_manual_results` keeps its "one ISO per finalist" validation against this view.
- **Successor states are separate countries**, as the EBU lists them (Yugoslavia `YU`, Serbia and Montenegro `CS`, Serbia `RS`; Soviet-era none participated). Each has its own row and page; country pages show a "see also" link via `countries.related_iso text[]`. Stats are per entity, never merged.

- RLS: `select` on all three for `anon`/`authenticated` (data is public anyway); writes only via super-admin RPCs.
- **Migration from today:** copy `eurovision_2026_participants` + `eurovision_2026_results` into `contest_entries` (year 2026), insert `contests(2026,'AT','Vienna','vienna', stage='finalized')`. The parser (`eurovision-parse`, `parseResults.ts`) and admin cards (`ManualRankingCard.tsx`, `PredictionsResultsScreen.tsx`, `useParticipants.ts`) switch to `contest_entries` for the live year. Old tables are dropped once nothing reads them.
- `rooms` gets `contest_year int` (default = live year at insert) so game history stays attached to its year. Backfill: every existing room → 2026. Room winners of past rooms are not recomputed.
- **Semifinals for 2026 and onward:** extend `eurovision-parse` with semifinal pages (same eurovision.com URL pattern, `…-first-semi-final/`, `…-second-semi-final/`) to fill `semi`, `semi_running_order`, `semi_place`, `semi_points`, `qualified`. Run once for 2026 before Archive 2026; for 2027 it runs after each semi. Until filled, the archive page hides the semifinal section (§9 rule).

## 6. Admin lifecycle actions

All in the existing admin, as a new **Contests** module next to `EurovisionParser` (`src/admin/modules/`). Each action is a super-admin RPC, transactional, with a confirm step that shows exactly what will change.

| Action | Precondition | Effect |
|---|---|---|
| **Create year** | none | New `contests` row, `stage='upcoming'`. Entries can be added (manually or by parser) while upcoming. |
| **Finalize** | year is `current`; results parse is done or manual ranking entered | **Wraps the existing `finalize_results(p_year)`** (027/038 — flips `parse_jobs`, scores every room) and additionally sets `stage='finalized'` and runs `compute_winners` for every room of that year that has no winners yet. Contest winner = `final_place = 1`. After Finalize, `reset_contest` (039–042) and parser writes for that year are refused; to change results use Edit + Republish. 2026 is migrated directly as `finalized` (its `finalize_results` already ran). Triggers Publish. |
| **Archive** | year Y is `finalized`; year Y+1 exists with ≥ 1 entry | Y → `archived`, Y+1 → `current` (one transaction). Publish: snapshot of Y written, archive page built, hub redirects for Y added. |
| **Un-archive** | Y is the most recently archived year; **no room exists with `contest_year = Y+1`** | Y → `finalized`, Y+1 → `upcoming` (its entries are **kept**). Publish: archive page of Y removed, hub of Y restored, redirects removed. |
| **Edit + Republish** | any year, any stage | Edit entries / CMS text; Publish rewrites that year's snapshot. Page stays online throughout. |
| **Publish** | any draft change | Calls `publish-content`; shows commit link and Vercel deploy status. |

> Note vs. brainstorm wording: Un-archive was agreed as "allowed while the next year has no data". Under D4, the next year always has entries at Archive time, so the real guard is **no game rooms yet for the next year** — entries survive the undo, nothing is lost.

## 7. Publish pipeline

**When publishing happens (decided 2026-10-30):**
- **Automatic** on lifecycle actions: Finalize, Archive, Un-archive each call `publish-content` at the end of their transaction.
- **Manual** for everything else: entry edits, CMS text, media, `indexable` switches. The admin shows a persistent "N unpublished changes" badge with a Publish button and a diff summary (which years/pages change).
- Parser writes never publish on their own; the live game reads Supabase directly, the public hub catches up at Finalize.

- Edge function `publish-content` (Deno): verifies caller is super admin, reads all drafts, renders snapshot JSON deterministically (stable key order → clean diffs), and creates **one commit** on `main` via the GitHub Git Data API (tree + commit + ref update) containing changed `content/**`, new `public/media/**`, and the generated `redirects` block of `vercel.json`.
- Auth to GitHub: fine-grained PAT, single repo, `contents:write` only, stored as a Supabase function secret. Never exposed to the browser. `main` on `tsokid/EurovisionParty` has no branch protection or rulesets (checked 2026-10-30), so direct commits work; every Publish is a production deploy, same as any push today. If protection is added later, Publish must switch to open-and-merge a PR.
- No-op if nothing changed. Concurrent publishes serialize via a `publish_runs` row lock; the run row stores commit SHA, status, error.
- Vercel deploys on push as today. Admin shows "published, deploying…" with the commit SHA; deploy status is a link to Vercel (no Vercel API integration in v1).

## 8. Prerender (sub-project 1)

- After `vite build`, a script renders every public URL from the registry × locale with `react-dom/server` + React Router's static handler, writing `dist/{locale}/{path}/index.html` with the correct `<title>`, meta description, canonical, hreflang, OG tags and JSON-LD (`SchemaHead`). Vercel's `{ "handle": "filesystem" }` already serves these before the `/index.html` rewrite.
- Client boots with `hydrateRoot` on prerendered pages; `/room/*` and `/admin` stay client-only.
- Prerendered pages must not touch Supabase. Any component that does (e.g. `useParticipants` on `Predictions2026Page`) reads the snapshot instead.
- Registry becomes data-driven: guides from `content/pages`, plus generated URLs for hub, every archive year, every country. `generate-sitemap.ts` / `generate-llms-txt.ts` read the same list. `noindex` years/countries are excluded from the sitemap.
- Build check: every sitemap URL has a file; no file 404s; each page has unique title + description per locale.

## 9. Page content rules

- **Hub** (`/eurovision-{year}`): city, dates, host, entries table, semifinal split, schedule; after Finalize the top section becomes results. Text blocks from CMS per year.
- **Archive year page**: final ranking (place, country, artist, song, points; jury/televote where known), semifinal non-qualifiers with their entries, winner callout, link to previous/next year. "Where we have information": columns with no data for that year are hidden, not shown empty.
- **Country page**: participations count, wins, best place, last-10 table, full history table, link to each archive year. Indexable by default when the country has ≥ 3 participations; otherwise `noindex`.
- **`/eurovision-predictions`**: permanent guide; dynamic block "current entries" from the live year.
- **`/winners`**: generated from archive (all years), no hardcoded list.
- **Copy rule:** facts (places, points, names) come from data. Narrative text is written by us — nothing copied from Wikipedia or other sources.
- Every existing page is reviewed for purpose during migration: remove "2026" from titles/slugs of permanent pages; year-specific facts become dynamic blocks.

## 10. Historical import (sub-project 2)

- One-off script `scripts/import-history.ts`: reads an open Eurovision dataset (1956–latest available), maps country names → ISO via the existing `COUNTRY_TO_ISO` map in the parser, upserts `contests` (stage `archived`, `indexable=false`) and `contest_entries` with `source='import:<dataset>'`.
- **License gate:** the dataset's license must permit reuse of the data; record it in `content/SOURCES.md`. If no suitable dataset is found, fall back to the years we can verify (2016+ first).
- Gaps (e.g. 2024–2025 if the dataset ends earlier) filled manually in admin; 2025 seed ranking from `seed-2025-results.js` is the starting point.
- Spot-check: winners for every year must match `winnersCopy.ts`; points for 5 random years checked by hand. Script is idempotent (re-run = same result).
- 2020 (cancelled) gets a contest row with entries and no results; page explains the cancellation.

## 11. CMS (sub-project 3)

- **Page record:** `pageId`, type (home / guide / legal / hub-text / archive-text / country-text), per locale: slug (fixed English, see §3), title, meta description, H1, lede, OG image; ordered blocks; draft vs. published.
- **Blocks:** text (limited rich text: headings, bold, links, lists), image (alt text per locale required), video (file + poster + captions optional), FAQ, steps, table, CTA, related cards, and dynamic blocks: current entries, final ranking, winners list, country history. Block set maps to existing components: `PageHero`, `Section`, `DataTable`, `FaqAccordion`, `CtaBanner`, `RelatedCards`, `Breadcrumbs`, `SchemaHead`.
- **Editor UX:** form-based, not WYSIWYG. EN and EL side by side per field; a page cannot be published if a required field is empty in either locale. Preview renders the real page component with draft data.
- **Media:** upload in admin → Supabase Storage (draft) → copied into `public/media/` on Publish. Images resized to web sizes at upload (client-side), max 2 MB after resize. Video: MP4 (H.264) ≤ 20 MB, poster image required, played by a native `<video>` element with our own controls (muted autoplay optional per block, no third-party player). Storage drafts deleted after successful publish to respect the 1 GB free tier.

## 12. Constraints & risks

- **Supabase is currently restricted (402, DB size); no upgrade — the owner waits for it to unlock.** Therefore:
  - All development and testing runs against a **local Supabase** (`supabase start`, schema from the repo's migrations, 2026 data from fixtures/seed). Nothing touches production while it is locked.
  - **Single cutover:** sub-projects 1 and 2 ship together in one go-live once production unlocks — run new migrations, run the historical import, first Publish, deploy. A written cutover runbook (ordered steps, verification, rollback) is part of the sub-project 2 plan.
  - Cutover must happen before the 2027 lineup lands (≈ January 2027). Sub-project 3 (CMS) ships in a later release unless it is ready in time for the same cutover.
- **Deadline:** sub-projects 1 + 2 done before the 2027 lineup lands (target mid-January 2027) so Archive 2026 can run on real data. Sub-project 3 before March 2027 (pre-season content).
- **Parser cron is off** (migration 068). Re-enable `parser-tick` (migration 047) before the May 2027 final — unchanged by this design but must target `contest_entries`.
- **Repo growth from media:** acceptable at current scale (one 15 s video, dozens of images). Revisit if media exceeds ~200 MB.
- **Redirect count in `vercel.json`:** Vercel caps redirects (1,024 per project); ~70 years + soft-404 fixes is well under.

## 13. Out of scope

- In-game strings, quiz questions, room flows.
- Multi-user editing, roles beyond the two super admins, revision history beyond git.
- Vercel API integration for deploy status.
- Embedded third-party media.
