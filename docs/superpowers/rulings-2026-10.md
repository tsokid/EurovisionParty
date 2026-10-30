# Rulings made during autonomous execution (2026-10-30/31)

## 2026-10-30-foundation-prerender
- Ruling: T1 — allPageUrls takes optional `registry: PageEntry[] = PAGE_REGISTRY`; exclusivity test uses a synthetic greekExclusive entry — vacuous test otherwise — cost if wrong: trivial signature change.
- Ruling: T4 — StaticRouterProvider with hydrate={false} — client router has no loaders, script is dead weight — cost if wrong: add script back.
- Ruling: T5 — wrap boot in async function instead of top-level await — avoids build-target risk — cost: none.
- Ruling: T6 — VitePWA plugin disabled when isSsrBuild (defineConfig callback) — SSR bundle needs no SW — cost if wrong: SSR build noise only.
- Ruling: T8 — 404.html and index.html excluded from duplicate/canonical rules; 404 presence via has404 — they are not registry pages — cost: none.
- Ruling: T4 — pages hardcoded unprefixed canonicals (redirecting URLs); migrate all SEO pages to PageSeo (extended to pass through SchemaHead props) inside Task 4 — spec §8 requires correct canonical per URL; plan wrongly assumed PageSeo in use — cost if wrong: larger T4 diff, pure SEO-correctness change
- Ruling: T4 — HomePage gets PageSeo unconditionally; static content renders during authLoading, spinner only replaces game panel — prerendered home must have content; SSR and client first render share loading state so hydration matches — cost if wrong: small layout change while auth loads
- Ruling: T4 — home og:title/og:description now equal page title/description (index.html had distinct og copy) — accepted; one source of truth per page, og copy can be customised later via CMS — cost if wrong: slightly different social preview text on home
- Ruling: T7 — rewrite source simplified and destination '/' — Vercel cleanUrls rewrites .html destinations; verified empirically on preview — cost if wrong: none, verified
- Ruling: I2 — option A: 308 '/' -> '/en', Accept-Language el variant -> '/el' (Googlebot gets /en) — matches sitemap/hreflang x-default already /en; standard locale-site pattern; B (keep '/' as EN home) needs shell/prerender restructure — cost if wrong: a few weeks of ranking consolidation from / to /en; reversible
- Ruling: M3 — not fixed in this wave; measure CLS with PageSpeed on preview before cutover (added to cutover checklist) — cost if wrong: CLS regression on home
- Ruling: CSP Google Fonts — out of scope, asked owner (changes site look)
- Ruling: Winners breadcrumb -> /eurovision-history (404, pre-existing, now locale-prefixed) — repoint to /past-contests in SP2b when that page exists (joint cutover) — cost if wrong: broken crumb if SP2b slips
- Ruling: Accept-Language containing 'el' at any q -> /el on unprefixed URLs — accepted; Googlebot sends none -> /en — cost: rare EN users with el secondary land on /el

## 2026-10-30-contests-data-layer
- Ruling: T1 — harness also produces `applyMigration(db: PGlite, prefix: string): Promise<void>` (applies the single migration file starting with prefix, with PATCHES) — T2 test needs to insert fixtures between 069 and 070 — cost: none.
- Ruling: 071 is edited by T3,T4,T5,T6,T8,T9 — single file kept for cutover simplicity — nothing is applied to prod until cutover — cost if wrong: larger single migration.
- Ruling: T1 — 065_fix_quiz_scoring_threshold.sql is invalid SQL as committed (duplicate LANGUAGE/SECURITY/SET options before and after body); fix file to $$; (definition unchanged) rather than PATCH — repo correctness; prod already has the function — cost if wrong: none (file never re-run in prod)
- Ruling: related_iso as predecessor/successor graph (not full mesh) — matches spec "see also" intent — cost: trivial data change
- Ruling: T3 — finalize_results scoped to rooms.year = p_year (deviation from "else unchanged") — global year-scoping constraint/Review Focus 2; unscoped would write N's ranking into older rooms — cost if wrong: none for single-year operation
- Ruling: T3 minor 1 (reset_manual_results/commit_manual_results lack stage guard -> could wipe archived results) — add same finalized/archived refusal to both, carried into Task 4 (same file) — archive data must be protected (spec D3) — cost if wrong: admin must use Edit path after finalize
- Ruling: T5 concern 1 — parser never yields running order (parse.ts:145,172 runningOrder:null) so "finalist = final_running_order not null" leaves every parsed year (and the 070 copy of 2026) with zero finalists -> empty game lineup. Add contest_entries.in_final boolean; views/RPCs/parser use it; running order stays optional — spec §5 defined finalists via running order on a false assumption — cost if wrong: one extra column
- Ruling: T8 — contest-detail editing (city/dates) and per-year 'indexable' switch UI deferred to SP2b (needed with archive pages/publish; update_contest RPC already exists) — cost if wrong: none, RPC ready
- Ruling: T9 — semis action accepts optional html_sf1/html_sf2 (admin paste fallback when server fetch is blocked) — production fetch may be blocked by Cloudflare too — cost: small extra UI
- Ruling: T9 — semis inserts/updates must also set artist and song when the row's value is null (non-qualifiers' entries are required on archive pages per user request) — relaxes 'semi data only' ruling for null-fill of artist/song — cost if wrong: none (never overwrites)
- Ruling: I3 helper grants — revoked from all client roles (trigger-only), deviating from "grant authenticated" rule — granting would let any user move all rooms of a year to final — cost if wrong: none
- Ruling: FinalizeCard "Reset Finalized" dead after finalize_contest (reset_manual_results refuses finalized) — hide/repoint in SP2b admin pass — cost if wrong: confusing disabled-path error in admin until then

## 2026-10-31-archive-pages-publish
- Ruling: T1 ties — shared places allowed when points equal; shared 1st only 1969 (brief's "ties only 1969" was historically wrong) — cost: none
- Ruling: T1 host_iso from venue country (2023 = GB hosting on behalf of UA) — infobox host is broadcaster — cost: archive page could add "on behalf of Ukraine" note later
- Ruling: T1 — contests.cancelled column (070) set for 2020 in 073 (snapshot built from DB would lose JSON-only flag); archived_at constant for imported rows; pin per-year counts in invariants — cost: none (070 unapplied)
- Ruling: T2 — local snapshot 2026 from Wikipedia (--snapshot-only, not in 073); participations get cancelled + semi_points — COUNTRIES_2026 has no finalist marker, hub would show 5 finalists until first prod publish — cost: none
- Ruling: T3 deviations accepted — noop counts as published; generated_at = max updated_at (enables noop); commitFiles returns changed paths, message names changed years
- Ruling: T3 — runtime publish commits must NOT carry the Claude Co-Authored-By trailer (admin-triggered, not Claude-authored); unpublished_summary 'since' must use started_at of last ok/noop run (edits during a run must stay unpublished) — to fix in review loop
- Ruling: T4 concern 1 (whole ~1.7MB snapshot would ship in client bundle once pages import contentData) — Task 5 must implement split loading: SSR/prerender reads eagerly; build copies content/** to dist/content/** (static JSON); prerender tracks which content files a page read and inlines them as <script type="application/json" id="__content__"> ; client contentData = sync cache seeded from that script before hydrate + fetch('/content/...') for client-side navigation (useContent hook, brief loading state). No eager glob in client bundle. Test: client bundle size budget (main chunk must not grow > 30KB vs before Task 5) — Core Web Vitals/SEO priority — cost: more plumbing
- Ruling: T4 — countries indexable count excludes cancelled 2020 — accepted
- Ruling: T5 — hub of live contest always indexable (contests.indexable governs archive pages only) — spec D5 is about archive years — cost: none
- Ruling: T5→T6 — snapshot builder emits small index files (content/countries/index.json slug→{iso,name_en,name_el,participations count}; content/contests/index.json year→{city,city_slug,winner iso/artist/song/points,stage,indexable,cancelled}) so client index pages/slug lookups need one small fetch, no whole-snapshot getters on client
- Ruling: T6 — co_winners in contests index accepted (1969 four winners); 290 pages correct
- Ruling: T6 — winners breadcrumb label must match target: "Past contests" / "Προηγούμενοι διαγωνισμοί" (to fix in review loop)
- Ruling: T6 — 'completed' = finalized|archived for wins/best place and /winners (overrides archived-only; avoids Bulgaria 2026 contradiction); /winners description end-year from data (justified exception to byte-identical rule) — cost: description text changes once at cutover
- Ruling: T7 — guide pages must not flash on client nav: snapshot site.json gains `current: {year, city, city_slug, dates, stage, entry_count, finalist_count}` (tiny, already inlined on every page); useCurrentContest reads site.json only; only predictions lineup reads contests/{year}.json — to fix in review loop
- Ruling: T7 — dropping 2026-only withdrawn/Big Four paragraph accepted (cannot be data-driven)
- Ruling: T7 — site.json (383 B) bundled into client JS accepted (no wait from non-prerendered /room pages; rebuilt on every publish); host field added to current — cost: none
- Ruling: T8 — FinalizeCard auto-publishes after Finalize accepted (spec §7); 'Entries'->'Edit' accepted
- Ruling: T9 — unprefixed Greek-only old slugs (ellada, kypros, elliniko-tragoudi, programma) -> /el/... unconditionally (spec §3); resolver case-sensitive + throws on unsupported has/missing — follow-up after approval
- Ruling: T10 — publish-content imports types from src/ (outside supabase/functions) -> deploy bundling risk; must be fixed (move shared types under supabase/functions/_shared, src re-exports) in final fix wave; AdminLogin "60 minutes" -> "10 minutes" in final fix wave; deploy-functions.mjs flagged unsafe (runbook uses supabase CLI via npx)
- Ruling: T10 — 2027 sequence: create 2027 -> lineup -> Archive 2026 (makes 2027 current) -> Publish (start_contest refused while 2026 finalized) — accepted
- Ruling: I1 — archive_contest sets indexable=true for the archived year (it was the live, indexed hub) — protects hub equity — cost: archive page indexed without extra owner text (it has full results)
- Task final: parked — un-archive restores legacy 2026 sub-slug redirects to hub root, not subpage — Ruling: accept (option A), add manual restore line to runbook later — cost: 6 legacy URLs consolidate to hub after a rare un-archive
- Task final: parked — M1 equality test will fail after first prod Archive (compares repo vercel.json to local snapshot) — Ruling: make conditional on local snapshot before May 2027 — cost: red test on main after Archive, no prod effect
- Task final: parked — runbook 8.4 should cross-check qualified vs in_final (qualified&!in_final=0; in_final&semi null=5) — Ruling: add before cutover — cost: a Wikipedia/prod mismatch could go unnoticed
- Task final: parked — tests/docs/runbookCoverage.test.ts reads gitignored ledgers (.superpowers/) — Ruling: move checklist lines into a tracked doc before cleanup — cost: test fails in a fresh clone

