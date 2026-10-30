# Sub-project 2a: Year-Agnostic Contest Data, Lifecycle & Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2026-named tables and hardcoded lineup with `contests` / `countries` / `contest_entries`. Move every SQL function, the parser edge function and every client reader onto them. Add the Finalize / Archive / Un-archive lifecycle RPCs and an admin **Contests** module. All SQL is tested in-process with PGlite.

**Architecture:** Migration `070` creates the new tables and views and copies the 2026 data. Migration `071` re-points the existing RPCs (`finalize_results`, `commit_manual_results`, `reset_manual_results`, `reset_contest`) and adds the lifecycle RPCs. Migration `072` drops the old tables once nothing reads them. The game reads `current_participants`, which contains finalists only. Pages and the hub read `current_entries` / `contest_entries`. Publishing to the repo is sub-project 2b. In this plan, lifecycle RPCs only change DB state.

**Tech Stack:** Postgres (Supabase), PGlite 0.5.x for tests, vitest 4, React 19, supabase-js 2, Deno edge function.

**Spec:** `docs/superpowers/specs/2026-10-30-contests-archive-cms-design.md` (§2 D2–D7, §5, §6, §10 semis, §12).
**Code inventory (facts this plan relies on):** `.superpowers/sdd/2026-10-30-contests-data-layer/inventory.md`

## Global Constraints

- Production Supabase is locked (402). Nothing in this plan touches production. No `supabase` CLI and no Docker. SQL runs only in PGlite inside vitest.
- Migrations are numbered `070_…`, `071_…`, `072_…`. Each is idempotent where practical (`if not exists`, `create or replace`) and wrapped in `begin; … commit;`.
- Every new RPC is `security definer`, `set search_path = public`, and gated by `public.is_super_admin()` unless stated. Grant `execute … to authenticated` only after `revoke … from public`.
- Lifecycle stage enum values, exactly: `upcoming`, `current`, `finalized`, `archived`. At most one contest is in (`current`, `finalized`).
- Slugs: `countries.slug` is lowercase English with hyphens (`greece`, `north-macedonia`, `serbia-and-montenegro`). `contests.city_slug` is lowercase English (`vienna`, `basel`).
- Successor states are separate `countries` rows (EBU listing). `related_iso text[]` links them.
- The game sees **finalists only**: `current_participants` = rows of the live year with `final_running_order is not null`.
- `rooms.year` already exists (int, default 2026). It **is** the contest year. Do not add `contest_year`. Its default becomes `public.live_contest_year()`.
- Do not change game mechanics, phases, scoring rules, `super_admins`, OTP auth or migrations 068/069.
- Admin modules follow the existing pattern: `src/admin/modules/index.ts` `MODULES` entry; RPC calls via `supabase.rpc(...)` with `try / if (error) throw error / catch → formatError(e)`; `window.confirm` for destructive actions.
- Tests live in `tests/**` (vitest include). DB tests use `// @vitest-environment node`.

## Review Focus

1. **Data loss on migration.** Every 2026 participant and result row in the old tables must land in `contest_entries` with identical values. → Task 2 test `copies 2026 participants and results losslessly`.
2. **Wrong-year writes.** Every RPC that used to `delete … where true` on the 2026 tables must now touch only `year = p_year`, and must leave other years' entries intact. → Task 3 tests `reset_contest only touches p_year` and `commit_manual_results only replaces p_year results`.
3. **Lifecycle guards.** Un-archive refuses once any room has `year = Y+1`. Archive refuses when Y is not `finalized` or Y+1 has no entries. A second live contest is impossible. → Task 4 tests.
4. **Non-admin callers.** Every new or changed RPC raises `forbidden` for an authenticated non-admin. → One parametrised test in Task 4.
5. **Game lineup before the final is known.** `current_participants` is empty, and `useParticipants` must still fall back to `COUNTRIES_2026` exactly as today, with no crash and no empty picker. → Task 6 test.

---

### Task 1: PGlite migration harness

**Files:**
- Create: `tests/db/harness.ts`, `tests/db/platformStubs.sql`
- Modify: `package.json` (devDependency `@electric-sql/pglite@0.5.13`)
- Test: `tests/db/harness.test.ts`

**Interfaces:**
- Produces:
  - `createDb(opts?: { upTo?: string }): Promise<PGlite>`. Applies `platformStubs.sql`, then every file in `supabase/migrations/` in filename sort order, up to and including the file whose name starts with `opts.upTo` (default: all).
  - `asUser(db: PGlite, uid: string | null): Promise<void>`. Makes `auth.uid()` return `uid`.
  - `makeAdmin(db: PGlite, uid: string, email: string): Promise<void>`. Inserts `auth.users` and `super_admins` rows.
  - `PATCHES: Record<string, (sql: string) => string>`. Per-migration text patches for statements PGlite cannot run, each with a one-line reason comment.

- [ ] **Step 1: Write `platformStubs.sql`.** It must create:
  - schema `auth` with table `users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now())`;
  - `auth.uid()` returning `nullif(current_setting('test.uid', true), '')::uuid`;
  - `auth.jwt()` returning `'{}'::jsonb`;
  - `auth.role()` returning `'authenticated'`;
  - roles `anon`, `authenticated`, `service_role` (`do $$ … if not exists … create role … $$`);
  - schema `cron` with `schedule(text,text,text) returns bigint`, `unschedule(text) returns boolean`, `unschedule(bigint) returns boolean`, all no-ops, and table `job_run_details(end_time timestamptz)`;
  - schema `vault` with view `decrypted_secrets(name text, decrypted_secret text)` over an empty table;
  - schema `net` with `http_post(url text, body jsonb default '{}', headers jsonb default '{}', params jsonb default '{}', timeout_milliseconds int default 5000) returns bigint`, a no-op;
  - publication `supabase_realtime`, if PGlite supports publications. Otherwise list it in `PATCHES`.
- [ ] **Step 2: Write failing test** `harness.test.ts`:
  - `applies every migration`: `await createDb()` resolves.
  - `auth.uid follows asUser`: after `asUser(db, U)`, `select auth.uid()` returns `U`.
  - `is_super_admin true only for admins`: `makeAdmin(db, A, …)`; with `asUser(db, A)` → `is_super_admin() = true`; with `asUser(db, B)` → `false`.
  - `upTo stops early`: `createDb({ upTo: '020' })` → table `eurovision_2026_live` exists and `contests` does not.
- [ ] **Step 3: Run** `npx vitest run tests/db/harness.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** the harness. Iterate: when a migration fails on a platform-only construct (extensions, `alter publication`, `grant … on schema cron`, `pg_net`), add a minimal entry to `PATCHES` with a reason comment. Never patch away business logic (tables, functions, policies, triggers). If a migration fails for a non-platform reason, stop and report BLOCKED with the file and error.
- [ ] **Step 5: Run.** Expected: PASS. Record the `PATCHES` list in the report.
- [ ] **Step 6: Commit** `test(db): PGlite harness that applies all migrations`

---

### Task 2: Migration 070 — contests, countries, contest_entries, views, 2026 copy

**Files:**
- Create: `supabase/migrations/070_contests_core.sql`, `supabase/seed/countries.sql` (included by 070 via inline insert; keep the data block at the bottom of 070 if simpler)
- Test: `tests/db/contestsCore.test.ts`

**Interfaces:**
- Produces (SQL), exactly as spec §5, plus:
  - `create type contest_stage as enum ('upcoming','current','finalized','archived')`.
  - `contests (year int pk, host_iso text references countries(iso), city text not null, city_slug text not null, semi1_date date, semi2_date date, final_date date, stage contest_stage not null default 'upcoming', indexable boolean not null default false, finalized_at timestamptz, archived_at timestamptz, published_at timestamptz, updated_at timestamptz not null default now())`, plus the unique partial index `one_live_contest`.
  - `countries (iso text pk, name_en text not null, name_el text not null, slug text not null unique, related_iso text[] not null default '{}')`.
  - `contest_entries`, with the spec §5 columns, pk `(year, iso)` and FKs.
  - Views `current_entries` and `current_participants`. Both expose all entry columns plus `name_en` and `name_el` joined from `countries`. The views are `security_invoker = true`.
  - `live_contest_year() returns int`: the year in (`current`, `finalized`), else the max year that is not archived, else `extract(year from now())`. Stable, `security definer`.
  - `rooms.year` default changed to `public.live_contest_year()`.
  - RLS: `select` for `anon, authenticated` on the three tables. No direct write policies; writes go through RPCs (Tasks 3–4).
  - Countries seed: every country that has ever taken part in Eurovision (1956–2026) **plus** every ISO the parser's `COUNTRY_TO_ISO` can emit. That includes historical entities `YU` (Yugoslavia), `CS` (Serbia and Montenegro) and `MA` (Morocco). For `related_iso`, link YU↔CS↔RS↔ME↔MK↔BA↔HR↔SI. Greek names (`name_el`) are the standard Greek country names, e.g. `GR` Ελλάδα, `CY` Κύπρος, `MK` Βόρεια Μακεδονία, `CZ` Τσεχία, `GB` Ηνωμένο Βασίλειο.
  - 2026 copy:
    - `insert into contests values (2026, 'AT', 'Vienna', 'vienna', '2026-05-12', '2026-05-14', '2026-05-16', 'finalized', …)` with `finalized_at = now()`.
    - Insert into `contest_entries` from `eurovision_2026_participants` p left join `eurovision_2026_results` r using (iso): `final_running_order = p.running_order`, `artist`, `song`, `final_place = r.ranking`, the three points columns from r, `source = coalesce(r.source, p.source)`.
    - Then insert 2026 entries for every non-finalist country in `src/lib/countries2026.ts` `COUNTRIES_2026` that is not already present, with artist/song from that file, `final_running_order null`, `qualified false`, `source 'manual'`. Hardcode them as VALUES in the migration.

- [ ] **Step 1: Write failing tests** in `contestsCore.test.ts`, using `createDb({ upTo: '069' })`, inserting fixture rows into `eurovision_2026_participants` (3 rows) and `eurovision_2026_results` (2 rows), then applying `070`:
  - `copies 2026 participants and results losslessly`: each fixture row maps to `contest_entries` with the exact values above; the participant without a result has `final_place is null`.
  - `adds non-finalist 2026 countries from COUNTRIES_2026`: count of 2026 rows = 3 + (35 − overlap); non-finalists have `final_running_order is null`.
  - `current_participants has finalists only, with names`: returns 3 rows with `name_en`/`name_el` non-null.
  - `one live contest`: inserting `(2027, …, stage 'current')` while 2026 is `finalized` raises a unique violation.
  - `live_contest_year`: returns 2026.
  - `every parser ISO is a country`: the 41 ISO values of `COUNTRY_TO_ISO` (import from `supabase/functions/eurovision-parse/parse.ts`) all exist in `countries`.
  - `rooms default year`: inserting a room without `year` gets 2026.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `070_contests_core.sql`.
- [ ] **Step 4: Run** the test and `tests/db/harness.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): contests, countries, contest_entries + 2026 copy (070)`

---

### Task 3: Migration 071a — existing RPCs on contest_entries, year-scoped

**Files:**
- Create: `supabase/migrations/071_rpcs_on_contest_entries.sql`
- Test: `tests/db/rpcsOnEntries.test.ts`

**Interfaces:**
- Consumes: Task 2 tables.
- Produces: `create or replace` of these, with **unchanged signatures and return types** (see inventory §1):
  - `finalize_results(p_year int) returns int`: reads ranking from `contest_entries` where `year = p_year and final_place is not null`, ordered by `final_place`, instead of `eurovision_2026_results`. Everything else unchanged.
  - `commit_manual_results(p_year int, p_isos text[]) returns int`: clears `final_place`, `total_points`, `jury_points` and `televote_points` only for `year = p_year`. Sets `final_place = ordinality` for the given ISOs, with `source = 'manual'`. Validates that every ISO is a finalist of `p_year`. Calls `finalize_results`.
  - `reset_manual_results(p_year int)`: clears result columns for `p_year` only. Room-level effects stay as in 043, but are scoped to rooms with `rooms.year = p_year`.
  - `reset_contest(p_year int, p_delete_predictions bool, p_reset_points bool, p_delete_rooms bool)`: deletes **result and lineup data of `p_year` only**. It sets `final_running_order`, result columns and `qualified` to null; the rows stay, so semis and non-finalists survive. It also resets `p_year` parse jobs, and scopes `results`, `predictions`, `players` and `rooms` effects to `rooms.year = p_year`. It **raises** `'contest % is %; reset refused'` when the contest stage is `finalized` or `archived`. It also drops the legacy 1-argument overload `reset_contest(int)` if it exists.

- [ ] **Step 1: Write failing tests.** Seed with `createDb()` (all migrations, through 071 once written), an admin, contest 2026 `current` with 3 finalists, contest 2025 `archived` with 2 entries that have results, and 2 rooms with `year` 2026 and 1 room with `year` 2025 that has a `results` row.
  - `commit_manual_results only replaces p_year results`: 2026 gets places 1..3 and the 2025 entries are unchanged.
  - `finalize_results reads contest_entries`: after a manual commit, every 2026 room has a `results.final_ranking` equal to the ISO array ordered by `final_place`.
  - `reset_contest only touches p_year`: the 2025 entries and the 2025 room's `results` row are unchanged, and 2026 entries keep their rows but have null `final_running_order` and `final_place`.
  - `reset_contest refuses finalized`: set 2026 to `finalized`, then call it; it raises `reset refused`.
  - `legacy reset_contest(int) gone`: `to_regprocedure('public.reset_contest(int)') is null`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** 071.
- [ ] **Step 4: Run** all `tests/db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): year-scoped result RPCs on contest_entries (071)`

---

### Task 4: Migration 071b — lifecycle and entry RPCs

**Files:**
- Modify: `supabase/migrations/071_rpcs_on_contest_entries.sql` (append; one migration file)
- Test: `tests/db/lifecycle.test.ts`

**Interfaces:**
- Produces (all super-admin gated, all `returns void` unless stated):
  - `create_contest(p_year int, p_city text, p_city_slug text, p_host_iso text, p_semi1 date, p_semi2 date, p_final date)`. Inserts with stage `upcoming`. Also inserts `parse_jobs` rows `(p_year,'participants')` and `(p_year,'results')` with `source_url` = `'https://www.eurovision.com/eurovision-song-contest/' || p_city_slug || '-' || p_year || '/' || p_city_slug || '-' || p_year || '-grand-final/'`, `on conflict (year, kind) do nothing`.
  - `update_contest(p_year int, p_fields jsonb)`. Allowed keys: `city`, `city_slug`, `host_iso`, `semi1_date`, `semi2_date`, `final_date`, `indexable`. Any other key raises `unknown field %`.
  - `upsert_contest_entry(p_year int, p_iso text, p_fields jsonb)`. Allowed keys are the entry columns except `year`/`iso`. It refuses when the stage is `archived` (`'contest % is archived; use Edit + Republish'`). Edit + Republish of archived years is sub-project 2b, which will relax this through a separate RPC.
  - `delete_contest_entry(p_year int, p_iso text)`. Same archived refusal.
  - `start_contest(p_year int)`. Requires `upcoming` and that no contest is in (`current`, `finalized`). Sets `current`.
  - `finalize_contest(p_year int) returns int`. Requires `current`. Calls `finalize_results(p_year)`. Sets `stage = 'finalized'` and `finalized_at = now()`. Then runs `compute_winners(r.id)` for every room with `year = p_year` that has no `winners` rows. Returns the number of rooms whose winners were computed.
  - `archive_contest(p_year int)`. Requires `p_year` to be `finalized`, and requires contest `p_year+1` to exist with ≥ 1 entry. In one transaction: `p_year` → `archived`, `archived_at = now()`; `p_year+1` → `current`.
  - `unarchive_contest(p_year int)`. Requires `p_year` to be the max archived year and `p_year+1` to be `current`. Refuses when `exists (select 1 from rooms where year = p_year + 1)` (`'rooms exist for %; un-archive refused'`). Then `p_year` → `finalized`, `archived_at = null`; `p_year+1` → `upcoming`. Entries of `p_year+1` are kept.
- Parser write guard: a `before insert or update` trigger on `contest_entries`. It raises `'contest % is %; parser writes refused'` when `current_setting('app.writer', true) = 'parser'` and the stage is `finalized` or `archived`. The edge function sets `app.writer` (Task 5).

- [ ] **Step 1: Write failing tests**, one per guard and effect:
  - `create_contest seeds parse_jobs with derived URL`.
  - `start_contest refuses while another is live`.
  - `finalize_contest computes winners only for rooms without winners`. Seed 2 rooms with players and points, one of which already has winners. The return value is 1.
  - `archive refuses unless finalized`.
  - `archive refuses when next year has no entries`.
  - `archive flips both years`.
  - `unarchive refuses when rooms exist for next year`.
  - `unarchive restores and keeps next-year entries`.
  - `entry edits refused on archived year`.
  - `update_contest rejects unknown field`.
  - `parser writes refused after finalize`: `set app.writer = 'parser'`, then upsert; it raises.
  - `non-admin forbidden`: for each of the 9 RPCs above, as a non-admin uid, the call raises `forbidden`. Use a parametrised table.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all `tests/db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): contest lifecycle and entry RPCs (071)`

---

### Task 5: Parser edge function writes contest_entries

**Files:**
- Modify: `supabase/functions/eurovision-parse/index.ts`
- Create: `supabase/functions/eurovision-parse/rows.ts`
- Test: `tests/functions/parserRows.test.ts` (vitest imports `rows.ts`, which must stay free of Deno APIs)

**Interfaces:**
- Produces in `rows.ts`, both pure:
  - `participantRows(year: number, parsed: { iso: string; artist: string; song: string; runningOrder: number }[], source: string)` returns rows `{ year, iso, artist, song, final_running_order, source }`.
  - `resultRows(year: number, parsed: { iso: string; ranking: number; total: number; jury: number; televote: number }[], source: string)` returns `{ year, iso, final_place, total_points, jury_points, televote_points, source }`.
- `index.ts` changes:
  - Upserts into `contest_entries` with `onConflict: 'year,iso'`, via the service-role client. Before writing, it calls RPC `set_config('app.writer','parser', true)`, or sends the same value through a dedicated `parser_upsert_entries(p_rows jsonb)` SQL function. **Use the RPC approach:** add `parser_upsert_entries(p_year int, p_rows jsonb, p_kind text)` to migration 071, `security definer`, executable by `service_role` only, which sets `app.writer` locally and upserts.
  - "Delete rows whose iso is not in the parsed set" becomes: set `final_running_order = null` for `year` rows not in the parsed set. It no longer deletes rows.
  - Results filtering reads finalists from `contest_entries` where `year = job.year and final_running_order is not null`.
  - `PROD_URL_2026` fallback is replaced by `parse_jobs.source_url` (required; if null, error with `'no source_url for year %'`).

- [ ] **Step 1: Write failing tests** for `participantRows` and `resultRows`, covering exact field mapping and an empty input. Add a db test in `tests/db/lifecycle.test.ts`: `parser_upsert_entries refused after finalize`, and `parser_upsert_entries not executable by authenticated`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `rows.ts`, the `parser_upsert_entries` SQL, and the `index.ts` changes. Keep the existing Deno tests passing in principle. There is no Deno runtime here, so note in the report that `__tests__` were not run.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(parser): write contest_entries via parser_upsert_entries`

---

### Task 6: Client readers on the new views

**Files:**
- Modify: `src/hooks/useParticipants.ts`, `src/components/results/PredictionsResultsScreen.tsx`, `src/admin/modules/parser/ManualRankingCard.tsx`, `src/admin/modules/PhaseMonitor.tsx`
- Test: `tests/hooks/useParticipants.test.tsx`, `tests/components/PredictionsResultsScreen.test.tsx`

**Interfaces:**
- `useParticipants`:
  - Selects `current_participants` with `iso, name_en, name_el, artist, song, final_running_order`, ordered by `name_en`.
  - Maps to `Country` with `name = name_en` and `name_el = name_el` (no `COUNTRIES_2026` lookup), `runningOrder = final_running_order`.
  - The fallback to `COUNTRIES_2026` on error or 0 rows is unchanged.
  - Return shape is unchanged.
- `PredictionsResultsScreen`:
  - One query on `current_entries` with `iso, name_en, artist, song, final_place, total_points, jury_points, televote_points`, filtered to `final_place is not null` and ordered by `final_place`.
  - It replaces the two old queries. Rendering is unchanged (the ranking field formerly named `ranking` is now `final_place`).
- `ManualRankingCard`: reads `current_participants`. Year comes from `job?.year ?? live year`, where the live year is fetched via `supabase.rpc('live_contest_year')`. Grant execute to authenticated in 071.
- `PhaseMonitor`: replace `.eq("year", 2026)` with the `live_contest_year` result.

- [ ] **Step 1: Write failing tests**, mocking `../lib/supabase` with `vi.mock`, following the pattern in `src/admin/__tests__/useAdminAuth.test.ts`:
  - `useParticipants maps view rows to Country with Greek names`.
  - `useParticipants falls back to COUNTRIES_2026 when the view is empty` (Review Focus 5): returns 35 countries and `source: 'hardcoded'`.
  - `PredictionsResultsScreen orders by final_place`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests, `npx tsc -b`, and the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(game): read lineup and results from contest views`

---

### Task 7: Migration 072 — drop the old tables

**Files:**
- Create: `supabase/migrations/072_drop_2026_tables.sql`
- Test: `tests/db/dropOld.test.ts`; repo grep test `tests/scripts/no2026Tables.test.ts`

- [ ] **Step 1: Write failing tests.**
  - `old tables gone`: after all migrations, `to_regclass('public.eurovision_2026_participants') is null`, and the same for `_results`.
  - `no code references old tables`: grep `src/`, `supabase/functions/` and `scripts/` (excluding `supabase/migrations/`) for `eurovision_2026_` and `eurovision_${` and expect no matches.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** 072. It does `drop table if exists … cascade` for both tables, in results-then-participants order. Also update the stale comments that mention the old table names.
- [ ] **Step 4: Run** all tests. Expected: PASS.
- [ ] **Step 5: Commit** `chore(db): drop eurovision_2026_* tables (072)`

---

### Task 8: Admin Contests module

**Files:**
- Create: `src/admin/modules/Contests.tsx`, `src/admin/modules/contests/ContestList.tsx`, `src/admin/modules/contests/EntriesEditor.tsx`, `src/admin/modules/contests/lifecycle.ts`
- Modify: `src/admin/modules/index.ts` (add `{ id: 'contests', label: 'Contests', emoji: '🗓️', Component: Contests }` as the **first** entry)
- Test: `tests/admin/contestsLifecycle.test.ts`, `tests/admin/Contests.test.tsx`

**Interfaces:**
- `lifecycle.ts`, pure:
  - `allowedActions(c: ContestRow, all: ContestRow[], nextHasRooms: boolean): Array<'start'|'finalize'|'archive'|'unarchive'>`. It mirrors the SQL guards so the UI only shows legal buttons. The SQL stays authoritative.
  - `confirmText(action, c: ContestRow, all: ContestRow[]): string`. One plain-English sentence saying exactly what changes, e.g. `"Archive 2026: 2026 becomes archived and 2027 becomes the current contest. You can undo with Un-archive until a 2027 room is created."`.
- `ContestRow = { year: number; city: string; city_slug: string; host_iso: string | null; stage: 'upcoming'|'current'|'finalized'|'archived'; final_date: string | null; indexable: boolean; entry_count: number }`.
- UI behaviour:
  - The list shows contests newest first with stage badges.
  - "Create year" opens a form for year, city, slug, host ISO and the 3 dates.
  - Each row offers only the buttons from `allowedActions`. Each action calls `window.confirm(confirmText(...))`, then the RPC, then reloads.
  - Selecting a year opens `EntriesEditor`: a table of entries (country name, artist, song, semi, semi place, qualified, final running order, final place, points) with inline edit through `upsert_contest_entry`, add-country, and delete through `delete_contest_entry`.
  - For an archived year, the editor is read-only with the note "Edit + Republish arrives with publishing (2b)".
  - Errors show through `formatError`.

- [ ] **Step 1: Write failing tests.**
  - `allowedActions` covers each stage combination, including the un-archive room guard.
  - `confirmText` checks the archive and un-archive sentences exactly.
  - In `Contests.test.tsx`, with mocked supabase: clicking Archive calls `rpc('archive_contest', { p_year: 2026 })` only after confirm returns true.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Data comes from a `contests` select plus an entry count via `contest_entries` `select('year', { count: 'exact', head: true })` per year, or one grouped select through an RPC `contest_summaries()` that you add to 071 if simpler. Next-year room existence comes through an RPC `contest_has_rooms(p_year int) returns boolean` (super admin) added to 071.
- [ ] **Step 4: Run** the tests, `npx tsc -b` and the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): Contests module with lifecycle and entries editor`

---

### Task 9: Semifinal parsing

**Files:**
- Create: `supabase/functions/eurovision-parse/parseSemis.ts`, `tests/functions/fixtures/semi-<city>-<year>.html` (one real page saved as fixture)
- Modify: `supabase/functions/eurovision-parse/index.ts` (action `semis`), `src/admin/modules/parser/` (a "Parse semifinals" button on the Contests entries editor, calling `functions.invoke('eurovision-parse', { body: { action: 'semis', year } })`)
- Test: `tests/functions/parseSemis.test.ts`

**Interfaces:**
- `parseSemis(html: string): { iso: string; runningOrder: number; place: number | null; points: number | null; qualified: boolean | null }[]` reuses `isoFor` from `parse.ts`.
- Action `semis` (super admin JWT only):
  - URLs are `…/{city_slug}-{year}/{city_slug}-{year}-first-semi-final/` and `…-second-semi-final/`, derived from `contests`.
  - Writes `semi`, `semi_running_order`, `semi_place`, `semi_points` and `qualified` via `parser_upsert_entries` (kind `semis`), and inserts missing countries' entries.
  - Allowed for stages `current` and `finalized`. Kind `semis` is exempt from the finalized guard. Update the trigger from Task 4 to allow `kind = 'semis'` writes that touch only semi columns.

- [ ] **Step 1: Save the fixture.** Fetch `https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-first-semi-final/` once and save it as the fixture. If the page does not contain results in static HTML, report NEEDS_CONTEXT with what the page contains. Do not invent a format.
- [ ] **Step 2: Write failing tests** for `parseSemis` on the fixture: the row count equals the number of 2025 SF1 entrants, there are exactly 10 `qualified: true`, and one known row matches exactly (look it up in the fixture). Add a db test that semis writes on a `finalized` year succeed and change only semi columns.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(parser): semifinal results into contest_entries`
