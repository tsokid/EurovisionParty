# Sub-project 2b: History, Public Contest Pages, Publish & Cutover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** This plan builds everything visitors see from the contest data. That covers:
- the hub for the current year;
- `/past-contests` with one page per year;
- `/countries` with one page per country;
- `/winners` generated from data;
- the renamed `/eurovision-predictions`.

All of these are prerendered from a snapshot kept in the repo. The plan also adds three pipeline pieces. A one-off Wikipedia import fills 1956–2025. A `publish-content` edge function commits snapshots to GitHub. Every URL that was ever in the sitemap keeps working. It ends with the cutover runbook.

**Architecture:** The public site reads only from `content/` in the repo. That is the published snapshot, and the build and prerender never call Supabase. Supabase stays the source of truth for editing. The `publish-content` edge function turns DB rows into snapshot files using pure, vitest-tested modules. It commits them to `main` together with the regenerated `vercel.json` redirects, and Vercel rebuilds.

**Tech Stack:** React 19, react-router-dom 7, the sub-project-1 prerender pipeline, vitest 4, PGlite, Deno edge function (thin wrapper), GitHub Git Data API, MediaWiki API (import only).

**Spec:** `docs/superpowers/specs/2026-10-30-contests-archive-cms-design.md` (§3, §4, §7, §8, §9, §10, §12).
**Prior plans on this branch:**
- `docs/superpowers/plans/2026-10-30-foundation-prerender.md` (prerender, registry, `vercel.json`, check-prerender);
- `docs/superpowers/plans/2026-10-30-contests-data-layer.md` (tables, RPCs, admin Contests module).

Their ledgers in `.superpowers/sdd/*/progress.md` hold the rulings and the CUTOVER CHECKLIST items.

## Global Constraints

- Production Supabase stays locked, and nothing here touches it. DB work is tested in PGlite (`tests/db/harness.ts`). Edge-function logic lives in Deno-free modules tested by vitest, and `index.ts` stays a thin wrapper.
- **SEO safety is the top priority:**
  - Every URL in `tests/fixtures/historical-urls.txt` (85 URLs, created in Task 9) must resolve to a built 200 page directly or through exactly one permanent redirect.
  - Titles and descriptions of pages that already exist stay unchanged, except where this plan says otherwise.
  - Each locale gets one canonical. No soft-404s.
- Slugs are English in both locales.
  - Archive: `/past-contests/eurovision-{year}-{city_slug}`.
  - Hub: `/eurovision-{year}` plus `/schedule`, `/semifinals`, `/songs`.
  - Countries: `/countries/{slug}`.
- **Indexing rules:**
  - An archive year is indexable only when `contests.indexable` is true.
  - A country is indexable when it has ≥ 3 participations.
  - Non-indexable pages are still prerendered and linked, but carry `robots noindex`, are left out of the sitemap, and are skipped by check-prerender's sitemap rule.
- **Copy rule:**
  - Facts (places, points, names, dates) come from data.
  - Narrative sentences are templates written by us, in EN and EL.
  - Nothing is copied from Wikipedia prose.
  - The imported data is credited in `content/SOURCES.md`, with source, license CC BY-SA 4.0 and retrieval date.
- The import's User-Agent is `EurovisionGamesImporter/1.0 (+https://eurovision.games)`. No personal email goes in requests.
- Requests are throttled to ≤ 1 request/second, and responses are cached under `.cache/wikipedia/` (gitignored).
- 2026 stays the live contest, at stage `finalized`. 2027 does not exist yet; its data arrives through the admin after cutover.
- Tests live in `tests/**`. DB tests start with `// @vitest-environment node`. `tests/scripts/sitemap.test.ts` is flaky under load: re-run it alone if it is the only failure.

## Review Focus

1. **Historical URLs.** Every one of the 85 URLs ends at a built page. That includes the never-built slugs: `eurovision-bingo`, `eurovision-drinking-game`, `eurovision-sweepstake`, `glossary`, `printables`, `best-eurovision-app`, `compare/*`. → Task 9 test `every historical URL resolves`.
2. **Wikipedia data quality.**
   - Ties, such as the 4-way 1969 win.
   - Years with no semis, before 2004.
   - The 2008–2023 two-semi era with automatic qualifiers.
   - 2020, which was cancelled.
   - Withdrawn and disqualified entries.
   - Successor-state names, such as "Serbia and Montenegro" and "FYR Macedonia".
   - → Task 1 invariant tests over every imported year.
3. **Greek pages.** Every new page renders Greek copy on `/el/...` with Greek country names from `countries.name_el`. → Task 5 and 6 render tests.
4. **Publish idempotency and failure.**
   - A second publish with no changes creates no commit.
   - A GitHub API failure leaves `publish_runs` in `error` with the message, and does not half-commit.
   - → Task 3 tests.
5. **Snapshot drift.** Pages must render from snapshot files alone, even when Supabase env vars are missing. → Task 5 SSR test with the env stub removed.

---

### Task 1: Wikipedia history import (1956–2025)

**Files:**
- Create:
  - `scripts/history/fetchWikitext.ts`
  - `scripts/history/parseContest.ts`
  - `scripts/history/import.ts`
  - `scripts/history/countryNames.ts`
  - `data/history/{year}.json` (generated, committed)
  - `content/SOURCES.md`
  - `supabase/migrations/073_history_import.sql` (generated, committed)
- Modify: `.gitignore` (add `.cache/`)
- Test:
  - `tests/scripts/history/parseContest.test.ts`, with fixtures `tests/scripts/history/fixtures/{1969,1975,2005,2019,2023}.wikitext` saved once from the API
  - `tests/scripts/history/invariants.test.ts`
  - `tests/db/historyImport.test.ts`

**Interfaces:**
- `parseContest(year: number, wikitext: string): ContestRecord`. The types are:
  - `ContestRecord = { year; city; host_iso; final_date: string|null; semi1_date; semi2_date; cancelled: boolean; entries: EntryRecord[] }`
  - `EntryRecord = { iso; artist; song; semi: 1|2|null; semi_place; semi_points; qualified: boolean|null; in_final: boolean; final_running_order; final_place; total_points; jury_points; televote_points }`
  - Unknown fields are `null`.
- `countryNames.ts` exports `toIso(name: string): string`. It covers every historical spelling (e.g. "Macedonia", "F.Y.R. Macedonia", "North Macedonia" → `MK`; "Yugoslavia" → `YU`; "Serbia and Montenegro" → `CS`; "Bosnia & Herzegovina" → `BA`; "Türkiye"/"Turkey" → `TR`; "Czech Republic"/"Czechia" → `CZ`) and throws on unknown names.
- `import.ts`:
  - CLI: `tsx scripts/history/import.ts [--from 1956] [--to 2025]`.
  - It fetches each year's article `Eurovision_Song_Contest_{year}` via `action=parse&prop=wikitext`, then parses it.
  - It writes `data/history/{year}.json` with keys sorted and 2-space indent.
  - It regenerates `073_history_import.sql`. That file inserts `contests` (stage `archived`, `indexable false`, `city_slug` = slugified city) and `contest_entries` (`source 'import:wikipedia'`) for years ≤ 2025, all `on conflict do nothing`, in `begin/commit`, and never touches 2026.

- [ ] **Step 1: Save the fixtures.** Fetch the five fixture years once and commit them as `.wikitext`.
- [ ] **Step 2: Write failing parser tests.** Use exact values. Look them up in the fixtures, and cross-check winners against `src/pages/seo/content/winnersCopy.ts` for 2010–2025.
  - 1969 has 4 entries with `final_place 1` (FR, ES, NL, GB).
  - 1975 has 19 entries, the winner is NL with 152 points, and there are no semis.
  - 2005 has one semi with 25 entries and 10 qualified, plus 14 pre-qualified finalists (`semi null`, `in_final true`).
  - 2019 has two semis with jury and televote splits, and the winner is NL with 498 points.
  - 2023 has the winner SE with 583 points.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement** the parser and `countryNames`. Handle the result tables by their header row: Place/Country/Artist/Song/Points, and Jury/Televote where present.
- [ ] **Step 5: Run.** Expected: PASS.
- [ ] **Step 6: Run the import for 1956–2025** and commit the `data/history` JSON plus the generated 073.
- [ ] **Step 7: Write the invariants test** over every `data/history/*.json`:
  - Every year from 1956 to 2025 exists.
  - 2020 has `cancelled: true` and no places.
  - Every other year has ≥ 1 `final_place 1`, and the winners match `winnersCopy.ts` for 2010–2025.
  - Final places run from 1..N with ties allowed only in 1969.
  - Every ISO is in the countries seed of 070.
  - Years ≥ 2004 have semi data.
  - No duplicate ISO within a year.
- [ ] **Step 8: Write the DB test.** Apply all migrations including 073, then check:
  - `select count(*) from contests where stage='archived'` = 70 (1956–2025 inclusive; 2020 included as cancelled-archived);
  - 2026 is unchanged;
  - re-applying 073 is a no-op.
- [ ] **Step 9: Write `content/SOURCES.md`** with the attribution (source URLs pattern, CC BY-SA 4.0, retrieval date) and the note that facts were extracted and verified against the invariants.
- [ ] **Step 10: Run the full suite.** Expected: PASS.
- [ ] **Step 11: Commit** `feat(history): import 1956–2025 from Wikipedia (073)`.

---

### Task 2: Snapshot model and builder (pure)

**Files:**
- Create:
  - `src/content/contests/types.ts`
  - `supabase/functions/publish-content/snapshot.ts` (Deno-free; imported by both the edge function and vitest)
  - `scripts/snapshot/build-local.ts`
  - `content/site.json`, `content/contests/{year}.json`, `content/countries/{iso}.json` (generated, committed)
- Test: `tests/snapshot/snapshot.test.ts`

**Interfaces:**
- `types.ts`:
  - `ContestSnapshot = { year; city; city_slug; host_iso; dates: { semi1; semi2; final }; stage; indexable; cancelled; entries: EntrySnapshot[] }`
  - `EntrySnapshot`, which is the entry columns plus `name_en`, `name_el` and `country_slug`
  - `CountrySnapshot = { iso; slug; name_en; name_el; related_iso; participations: { year; city_slug; final_place; semi; semi_place; qualified; artist; song; points }[] }`
  - `SiteSnapshot = { current_year: number; live_stage: string; generated_at: string }`
- `snapshot.ts`:
  - `buildSnapshotFiles(input: { contests: ContestRow[]; countries: CountryRow[]; entries: EntryRow[] }): Record<string, string>`.
  - Paths are relative to the repo root, e.g. `content/contests/2025.json`.
  - JSON is serialized deterministically: sorted keys, 2-space indent, trailing newline.
  - `generated_at` is passed in so output is stable in tests.
- `build-local.ts` builds the initial snapshot without a DB:
  - 1956–2025 come from `data/history/*.json`.
  - 2026 comes from `COUNTRIES_2026` (lineup only, `stage 'finalized'`, no places) plus the 070 seed constants (city Vienna, dates).
  - `countries` come from a JSON export of the 070 seed. Extract the VALUES block from 070 with a small parser and keep it as the single source.
  - It writes the files with `buildSnapshotFiles`.
  - At cutover, the first Publish replaces 2026 with the real production data.

- [ ] **Step 1: Write failing tests:**
  - `deterministic output` (same input in any order → byte-identical files)
  - `country participations aggregate across years`
  - `site.json current_year is the live contest`
  - `entries carry Greek names`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, then run `tsx scripts/snapshot/build-local.ts` and commit the generated `content/`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(snapshot): deterministic content snapshot + initial build`.

---

### Task 3: `publish-content` edge function and publish_runs

**Files:**
- Create:
  - `supabase/migrations/074_publish_runs.sql`
  - `supabase/functions/publish-content/index.ts` (thin)
  - `supabase/functions/publish-content/github.ts` (Deno-free; `fetch` injected)
  - `supabase/functions/publish-content/redirects.ts` (Deno-free)
- Test:
  - `tests/db/publishRuns.test.ts`
  - `tests/functions/publishGithub.test.ts`
  - `tests/functions/publishRedirects.test.ts`

**Interfaces:**
- Migration 074:
  - Table `publish_runs (id bigserial pk, started_at timestamptz default now(), finished_at timestamptz, status text check (status in ('running','ok','noop','error')), commit_sha text, files_changed int, error text, started_by uuid)`.
  - `begin_publish() returns bigint` (super admin). It raises `'publish already running'` if a run is `running` and started < 10 min ago, and inserts a running row.
  - `end_publish(p_id bigint, p_status text, p_sha text, p_files int, p_error text)` (service_role).
  - `publish_input() returns jsonb` (service_role) returns `{contests, countries, entries}` with every needed column.
  - `unpublished_summary() returns jsonb` (super admin) returns `{ changed_years: int[], since: timestamptz }`, comparing `contests.updated_at` and `contest_entries.updated_at` against the last `ok` run's `finished_at`.
  - Grants follow the revoke-from-public-and-anon pattern.
  - On a successful publish, update `contests.published_at` for the published years.
- `github.ts` exports `commitFiles(opts: { token; repo; branch; files: Record<string,string>; message; fetch }): Promise<{ sha: string | null; changed: number }>`. It uses the Git Data API:
  1. get the ref, commit and tree;
  2. compare each file's blob SHA (computed locally as git's `blob <len>\0<content>` SHA-1) with the tree entry, and skip unchanged files;
  3. if nothing changed, return `{ sha: null, changed: 0 }`;
  4. otherwise create blobs, the tree (base_tree), the commit and update the ref (`force: false`).
- `redirects.ts`:
  - `generatedRedirects(contests: ContestRow[]): VercelRedirect[]`. For every archived year Y it emits:
    - `/:locale(en|el)/eurovision-Y` → `/:locale/past-contests/eurovision-Y-{city_slug}`;
    - the same for the hub subpages `/:locale(en|el)/eurovision-Y/:sub(schedule|semifinals|songs)`;
    - unprefixed `/eurovision-Y` → `/en/past-contests/…`.
  - `mergeVercelRedirects(vercelJson: string, generated: VercelRedirect[]): string`. It removes every existing redirect whose `source` matches `/^(\/:locale\(en\|el\))?\/eurovision-\d{4}(\/|$)/`, appends the generated ones, and keeps everything else and the formatting (2-space JSON).
- `index.ts`:
  - Verifies the caller is a super admin (same pattern as `eurovision-parse`).
  - Calls `begin_publish` with the caller's JWT, then `publish_input` with service role.
  - Builds `buildSnapshotFiles` plus the merged `vercel.json` (it reads the current `vercel.json` via the GitHub contents API).
  - Calls `commitFiles`, then `end_publish`.
  - Returns `{ status, sha, files_changed }`.
  - Secrets: `GITHUB_TOKEN`, `GITHUB_REPO` (`tsokid/EurovisionParty`), `GITHUB_BRANCH` (`main`).
  - The commit message is `content: publish <years>` plus the Co-Authored-By trailer.

- [ ] **Step 1: Write failing tests:**
  - DB: the begin/end lock, `unpublished_summary` after an entry edit, non-admin forbidden.
  - GitHub, with a mocked fetch:
    - unchanged files → no commit;
    - changed file → blob/tree/commit/ref calls in order, with `base_tree` set;
    - a 409 on the ref update throws.
  - Redirects:
    - an archived 2026 adds 3 redirect shapes;
    - un-archiving removes them;
    - non-year redirects (`/faq` etc.) are untouched.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests and the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(publish): publish-content function, publish_runs, redirect merge (074)`.

---

### Task 4: Data-driven registry and URL list

**Files:**
- Create: `src/lib/seo/contentData.ts`, `src/lib/seo/dynamicPages.ts`
- Modify: `src/lib/seo/registry.ts`, `scripts/seo/generate-sitemap.ts`, `scripts/seo/generate-llms-txt.ts`, `scripts/prerender.ts`, `scripts/seo/check-prerender.ts`, `src/routeConfig.tsx`
- Test: `tests/lib/seo/dynamicPages.test.ts`, plus updates to `tests/lib/seo/routeParity.test.ts`

**Interfaces:**
- `contentData.ts`:
  - Loads `content/**` via `import.meta.glob` (eager), so it works in both SSR and the client.
  - Exports `getSite()`, `getContest(year)`, `allContests()`, `getCountryBySlug(slug)`, `allCountries()`.
- `dynamicPages.ts` exports `dynamicPageUrls(): { locale; path; indexable: boolean; kind: 'hub'|'archive'|'archive-index'|'country'|'country-index' }[]` for:
  - the live year's hub and its 3 subpages;
  - `/past-contests`;
  - every archived year;
  - `/countries`;
  - every country with ≥ 1 participation.
- Indexable follows the Global Constraints.
- `allPublicUrls()` in `registry.ts` = static registry URLs ∪ `dynamicPageUrls()`. The prerender, sitemap (indexable only), llms.txt and check-prerender all use it.
- `check-prerender`:
  - Sitemap rule: indexable pages only.
  - New rule: every non-indexable page has `<meta name="robots" content="noindex">` and is absent from the sitemap.
- Routes (`routeConfig.tsx`):
  - `eurovision-:year` (hub, with child routes `schedule|semifinals|songs`);
  - `past-contests`;
  - `past-contests/:slug`;
  - `countries`;
  - `countries/:slug`.
  - Unknown params render `NotFoundPage` (404 status).
- `routeParity` is updated: static routes still match the static registry, and dynamic patterns are excluded from the parity check.

- [ ] **Step 1: Write failing tests** for `dynamicPageUrls` against the committed snapshot:
  - the hub is 2026;
  - the 70 archive years exist;
  - 1975's indexable is false;
  - country GR is indexable;
  - a one-time participant (MA) is not indexable.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The pages from Tasks 5 and 6 don't exist yet, so route elements may be temporary placeholders that render `NotFoundPage`, as long as Tasks 5 and 6 replace them. Do not prerender dynamic URLs until Task 6. Gate the inclusion with `INCLUDE_DYNAMIC` in `allPublicUrls`, defaulting to false, and Task 6 flips it.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(seo): data-driven page list from content snapshot`.

---

### Task 5: Hub pages for the live contest

**Files:**
- Create: `src/pages/contest/HubPage.tsx`, `HubSchedulePage.tsx`, `HubSemifinalsPage.tsx`, `HubSongsPage.tsx`, `src/pages/contest/content/hubCopy.ts`
- Test: `tests/ssr/contestPages.test.ts` (node env, Supabase env stub removed for this file → Review Focus 5)

**Interfaces:**
- All pages read through `contentData.ts`.
- They reuse `PageSeo` (with a `robots` prop for noindex), `PageHero`, `ContentLayout`, `Section`, `DataTable`, `Breadcrumbs`/`breadcrumbJsonLd` and `RelatedCards`.
- JSON-LD:
  - hub: `Event` (`name` "Eurovision Song Contest {year}", `startDate` = the final date, `location` the city);
  - songs: `ItemList`;
  - all pages: `BreadcrumbList`.
- `hubCopy.ts` holds EN/EL templates as functions of the data, e.g. `title: (y, city) => \`Eurovision ${y} in ${city}: dates, semi-finals & songs\``, with an EL equivalent. Titles and descriptions are unique per page.
- When the stage is `finalized`, the hub's top section is a results table (place, country, artist, song, points). Otherwise it is the lineup.
- Hub, semifinals and songs hide columns that have no data (spec §9).
- `PageSeo` needs dynamic page ids. Extend `PageSeo` to accept `{ path: string }` in place of `pageId` for dynamic pages. It builds the canonical and hreflang from the path with `absoluteUrl`.

- [ ] **Step 1: Write failing SSR tests:**
  - `/en/eurovision-2026` and `/el/eurovision-2026` render with status 200, their own canonical, and an H1 containing "2026"; the Greek H1 is in Greek.
  - `/en/eurovision-2026/songs` lists ≥ 30 entries.
  - `/el/eurovision-2026/songs` shows Greek country names (e.g. "Ελλάδα").
  - Rendering succeeds with `VITE_SUPABASE_URL` unset (`vi.unstubAllEnvs` for this file, with the supabase import mocked to throw if called).
  - `/en/eurovision-1999` → 404.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(pages): live contest hub with schedule, semi-finals and songs`.

---

### Task 6: Archive and country pages, winners from data

**Files:**
- Create:
  - `src/pages/contest/PastContestsPage.tsx`
  - `src/pages/contest/ArchiveYearPage.tsx`
  - `src/pages/contest/CountriesPage.tsx`
  - `src/pages/contest/CountryPage.tsx`
  - `src/pages/contest/content/archiveCopy.ts`
  - `src/pages/contest/content/countryCopy.ts`
- Modify:
  - `src/pages/seo/WinnersPage.tsx`: winners table and leaderboard from snapshot data; copy unchanged except numbers. The breadcrumb `/eurovision-history` → `/past-contests` (ledger ruling).
  - `src/pages/seo/content/winnersCopy.ts`: remove the hardcoded arrays.
  - `src/lib/seo/registry.ts`: flip `INCLUDE_DYNAMIC`.
- Test: extend `tests/ssr/contestPages.test.ts`

**Interfaces:**
- **Archive year page:**
  - sections: winner callout, final ranking, then semi-final 1 and semi-final 2 (qualifiers marked, non-qualifiers listed with artist and song);
  - links to the previous and next year;
  - links to each country page;
  - `robots noindex` when `!indexable`;
  - JSON-LD `Event` (past) + `ItemList` + `BreadcrumbList`.
- **Past contests index:** a table of all years (year, city, winner country, winner song, winner points), newest first.
- **Country page:**
  - summary (participations, wins, best place, first year);
  - a last-10 table and the full history table, each row linking to its archive year;
  - a "see also" list from `related_iso`;
  - indexable when it has ≥ 3 participations.
- **Countries index:** grouped alphabetically by the localized name.
- 2020 renders a "cancelled" note with the entries and no results.

- [ ] **Step 1: Write failing SSR tests:**
  - `/en/past-contests/eurovision-2019-tel-aviv`: winner NL, Arcade, 498; the semi sections are present.
  - `/el/past-contests/eurovision-1975-stockholm`: Greek; noindex meta present; no semi section.
  - `/en/countries/greece`: shows the 2005 win.
  - `/el/countries/greece`: H1 contains "Ελλάδα".
  - `/en/countries/morocco`: noindex.
  - `/en/winners`: lists 2025 Austria JJ "Wasted Love" 436, and 1956.
  - `npm run build` passes check-prerender with the dynamic pages included.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests and `npm run build`. Expected: PASS, and the check prints a page count above 300.
- [ ] **Step 5: Commit** `feat(pages): past contests, year archive, countries, winners from data`.

---

### Task 7: Predictions page rename, and de-hardcoding 2026 in guide pages

**Files:**
- Modify:
  - `src/pages/seo/Predictions2026Page.tsx`, renamed to `PredictionsPage.tsx`; PageId `eurovision-predictions`, slug `/eurovision-predictions`;
  - `predictionsCopy.ts`;
  - `routeConfig.tsx`, `registry.ts`, `generate-sitemap.ts` (`PAGE_FILES`), `generate-llms-txt.ts`;
  - `SiteHeader.tsx`, `SiteFooter.tsx`, `HomeSeoBlock.tsx`;
  - the copy files listed in the inventory with year facts (`eurovisionNightCopy`, `eurovisionPartyCopy`, `eurovisionGamesCopy`, `triviaCopy`, `rulesCopy`, `howToPlayCopy`, `aboutCopy`, `homeCopy`, `notFoundCopy`);
  - `src/i18n/locales/{en,el}.json` (`siteNav.predictions`, `location`);
  - `WelcomeScreen.tsx`, `index.html` (noscript link only), `vite.config.ts` manifest name;
  - `scripts/seo/validate-schema.ts`.
- Create: `src/lib/currentContest.ts`. It exports `currentContest(): { year; city; finalDate; semi1Date; semi2Date; hostName: {en; el} }`, read from the snapshot.
- Test: `tests/lib/currentContest.test.ts`, `tests/ssr/render.test.ts` (updated), `tests/content/no2026Hardcode.test.ts`

**Interfaces and rules:**
- **Copy:**
  - Facts that change every year (year, city, dates, lineup, "35 countries") become calls to `currentContest()` or snapshot data.
  - Sentences about a specific past fact stay as they are (e.g. "JJ won in 2025 in Basel").
- **Titles and descriptions:** at cutover `currentContest().year` is 2026, so every rendered title and description must be **byte-identical** to the pre-change output. A test compares them against a frozen list captured before the change.
- **Predictions page:**
  - The title drops "2026" only where the copy says "2026 predictions" as the page subject. It becomes "Eurovision predictions game: …".
  - The lineup block is dynamic, from the live contest.
  - `PUBLISHED` stays as it is, and `MODIFIED` becomes the build date.
- **Nav:**
  - The header dropdown gets "Predictions" (no year) and "Eurovision {year}" (the hub).
  - The footer gets "Past contests", "Countries" and "Winners".
  - In EL: "Προβλέψεις", "Eurovision {year}", "Προηγούμενοι διαγωνισμοί", "Χώρες", "Νικητές".
- **Manifest name:** `Eurovision Games`.
- **`no2026Hardcode.test.ts`:**
  - Greps `src/pages/**/*Copy.ts`, `src/i18n/locales/*.json`, `SiteHeader`, `SiteFooter` and `WelcomeScreen` for `2026`/`Vienna`/`Βιέννη`.
  - Allowlist: lines that state a dated past fact. Each allowlisted line carries a `// fact:` comment, and the test reads that marker.

- [ ] **Step 1: Capture the frozen titles.** Before changing anything, write `tests/fixtures/titles-before.json` from `npm run build` output: url → title and description for every static page.
- [ ] **Step 2: Write failing tests:**
  - `currentContest` returns 2026/Vienna;
  - the grep test;
  - frozen titles equal for every page except predictions;
  - predictions at `/en/eurovision-predictions` renders the lineup.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** the tests and `npm run build`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(content): predictions guide without year; guide pages read the live contest`.

---

### Task 8: Admin — details, indexable, Publish, Edit + Republish

**Files:**
- Modify:
  - `src/admin/modules/Contests.tsx` and `contests/*`;
  - `src/admin/modules/parser/FinalizeCard.tsx` (hide "Reset Finalized" when the live contest is finalized, and update its copy; ledger ruling);
  - `supabase/migrations/071_rpcs_on_contest_entries.sql` (allow `upsert_contest_entry` / `delete_contest_entry` on archived years; the parser guard still refuses parser writes).
- Create: `src/admin/modules/contests/PublishBar.tsx`, `ContestDetailsForm.tsx`
- Test: `tests/admin/PublishBar.test.tsx`, `tests/admin/ContestDetails.test.tsx`, `tests/db/lifecycle.test.ts` (updated: an admin edit on an archived year is allowed)

**Interfaces:**
- **PublishBar** sits at the top of the Contests module.
  - It shows "N unpublished changes (years …)" from `unpublished_summary()`.
  - It has a **Publish** button that calls `functions.invoke('publish-content')`.
  - It shows the last run: status, short sha with a link to `https://github.com/tsokid/EurovisionParty/commit/<sha>`, and a "Vercel deploys in ~2 min" note.
- **Auto-publish:** after a successful Finalize, Archive or Un-archive, the module calls publish automatically and shows the result. A publish failure does not undo the lifecycle action; it shows the error and leaves the Publish button available.
- **ContestDetailsForm:** city, city_slug, host, three dates and the `indexable` switch, through `update_contest`. Switching `indexable` shows the note: "Turn on after you've added your own text or image for this year."
- **Archived years:** the entries editor is enabled, with a banner: "Edits to an archived year go live after Publish."

- [ ] **Step 1: Write failing tests** for each behaviour above, with supabase mocked:
  - auto-publish is called after archive;
  - a publish error leaves the stage changed and shows the error;
  - an admin upsert on an archived year is allowed in SQL;
  - a parser write on an archived year is still refused.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): publish bar, contest details, edit + republish`.

---

### Task 9: Preserve every historical URL

**Files:**
- Create: `tests/fixtures/historical-urls.txt` (the 85 paths, one per line; copy from `C:/Users/User/AppData/Local/Temp/claude/C--Users-User-EurovisionParty/543f013a-673c-4058-89c3-1cba80ea08ad/scratchpad/historical-urls.txt`), `tests/scripts/historicalUrls.test.ts`, `scripts/seo/resolveUrl.ts`
- Modify: `vercel.json` (static redirects)

**Interfaces:**
- `resolveUrl(path: string, vercel: VercelConfig, builtPaths: Set<string>): { final: string; hops: number; status: 200|404 }`. It emulates Vercel:
  1. `trailingSlash: false`;
  2. redirects in order, including `has` (assume no Accept-Language);
  3. the filesystem (built pages; `cleanUrls`);
  4. rewrites → `/` (counted as 200 shell, **not** acceptable for `/en/…` or `/el/…` paths);
  5. otherwise 404.
- Static permanent redirects. Each one exists for `/:locale(en|el)/<old>` and for unprefixed `/<old>` → `/en/<new>`:

| Old | New |
|---|---|
| `eurovision-2026-predictions` | `eurovision-predictions` |
| `eurovision-2026-schedule` | `eurovision-2026/schedule` |
| `eurovision-2026-semifinals` | `eurovision-2026/semifinals` |
| `eurovision-2026-songs` | `eurovision-2026/songs` |
| `eurovision-history` | `past-contests` |
| `eurovision-ellada` | `countries/greece` |
| `eurovision-kypros` | `countries/cyprus` |
| `eurovision-2026-elliniko-tragoudi` | `countries/greece` |
| `eurovision-2026-programma` | `eurovision-2026/schedule` |
| `eurovision-bingo` | `eurovision-games` |
| `eurovision-drinking-game` | `eurovision-party` |
| `eurovision-sweepstake` | `eurovision-games` |
| `glossary` | `faq` |
| `printables` | `eurovision-party` |
| `best-eurovision-app` | `eurovision-games` |
| `compare/:any*` | `eurovision-games` |

- Already present from SP1: `eurovision-quiz` and `host-eurovision-party`.
- `/eurovision-2026` (the hub) is a real page, so no redirect.
- Generated redirects for archived years come from Task 3 at publish time. This test also runs `mergeVercelRedirects` with 2026 archived and asserts the 2026 URLs then resolve to the archive page.

- [ ] **Step 1: Write the failing test.** For every line of the fixture, `resolveUrl` ends at a built page (from `dist/`, so the test runs after `npm run build`; skip with a clear message if `dist/` is missing) with status 200 and `hops ≤ 1`. Also run the 2026-archived scenario.
- [ ] **Step 2: Run** after `npm run build`. Expected: FAIL.
- [ ] **Step 3: Implement** the redirects and the resolver.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(seo): every historical URL resolves to a live page`.

---

### Task 10: Cutover runbook

**Files:**
- Create: `docs/superpowers/runbooks/2026-cutover.md`

**Contents (ordered, each with a verification query or command and a rollback note):**
1. **Preconditions:**
   - production unlocked;
   - `select version()` ≥ 15;
   - parser-tick still unscheduled;
   - backup taken (Supabase dashboard → Database → Backups, or `pg_dump`).
2. **Pre-070 checks** (from the ledgers):
   - participants count 20–30;
   - ISOs known;
   - `source_url` set on every `parse_jobs` row.
3. **Apply 070 and reconcile:** `in_final` count = old participants, `final_place` set = old results.
4. **Apply 071:**
   - `has_function_privilege` / `has_table_privilege` checks for anon, authenticated and service_role.
   - Do not edit 2026 entries between 070 and 072.
5. **Apply 073 and 074.**
6. **Deploy edge functions** (`eurovision-parse`, `publish-content`), then set secrets `GITHUB_TOKEN` (fine-grained, repo contents RW), `GITHUB_REPO`, `GITHUB_BRANCH`.
7. **Merge `feat/foundation-prerender` to `main`.** Vercel deploys. Verify the preview checklist from SP1 Task 9 on production, plus 10 random historical URLs.
8. **Admin smoke test on production:**
   - login with OTP;
   - Contests module lists 1956–2026;
   - Publish → a commit appears, Vercel redeploys, and `/en/eurovision-2026` shows real results.
9. **Verify reads:** the game lobby lists 2026 finalists, and a test room renders `PredictionsResultsScreen`.
10. **Apply 072** (its guards check counts).
11. **Post-deploy:**
    - Google Search Console: resubmit the sitemap, inspect 5 URLs;
    - watch "Pages" for 3 weeks.
12. **Before May 2027:**
    - re-run 047 (parser-tick);
    - create 2027 (Burgas — verify);
    - Start 2027, then Archive 2026 when the 2027 lineup is in.

Include each OTP dashboard setting noted earlier: Magic Link template, OTP length 6, expiry 600.

- [ ] **Step 1: Write the runbook** from the two ledgers' CUTOVER CHECKLIST lines and this list.
- [ ] **Step 2: Have a reviewer check** every checklist line in `.superpowers/sdd/*/progress.md` against the runbook.
- [ ] **Step 3: Commit** `docs: cutover runbook`.
