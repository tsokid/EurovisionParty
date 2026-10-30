# Production cutover runbook: eurovision.games (SP1 + SP2a + SP2b)

> Οδηγός μετάβασης στην παραγωγή. Ένα πέρασμα, με τη σειρά, χωρίς παράλειψη βημάτων.

| | |
|---|---|
| **Scope** | Sub-projects 1 (prerender/SEO), 2a (contests data layer) and 2b (archive pages + Publish) go live together. |
| **Branch** | `feat/foundation-prerender` (worktree `C:/Users/User/EurovisionParty-foundation`). Merge to `main` = Vercel production deploy. |
| **Supabase** | Project ref `ameneqrrfdhntfzvchnn`, free tier. Migrations are applied by hand in **Dashboard → SQL Editor** (paste the whole file, Run). Already applied: up to **069**. |
| **Apply at cutover** | 070, 071, 073, 074, then 072 **last**. |
| **Edge functions** | `eurovision-parse` (changed), `publish-content` (new). `admin-otp` unchanged, do not redeploy. |
| **Time** | ~2 hours for steps 0–11. Do not start late in the day: step 10 (072) must wait until steps 7–9 pass. |
| **Old admin** | From step 4 until rollback or 072, the **old** admin's Parser and Results controls stay unused (they would hit 071's functions or write the old tables). |
| **Placeholders** | `<ANON_KEY>`, `<OLD_MAIN_SHA>`, `<SUPABASE_ACCESS_TOKEN>`, `<GITHUB_PAT>`, `<ROOM_CODE>`. Never paste real values into this file, a commit or a chat. |

## Why this order (Γιατί αυτή η σειρά)

- The **new frontend** calls RPCs and views that exist only after **070/071** (`live_contest_year`, `current_participants`, `entries_with_names`, `contest_summaries` …). Merging before 071 breaks the game and the admin.
- The **old frontend** (live until the merge) reads `eurovision_2026_participants` / `eurovision_2026_results`. Those tables survive until **072**, so the old site keeps working between 070 and the merge.
- **072 drops the old tables.** It is the only step that cannot be undone by a Vercel rollback, so it runs last, after the new site is verified.
- **Publish** commits to `main`. It must run **after** the merge, or the bot commit lands on `main` while the branch is unmerged and the merge conflicts on `content/**` and `vercel.json`.

Order: **068/069 (done) → 070 → 071 → 073 → 074 → edge functions + secrets → merge to main → verify site, admin and game → first Publish → verify → 072**.

## Checklist (Λίστα ελέγχου)

| # | Step | Where | Undo without backup? | Done |
|---|---|---|---|---|
| P | Pre-cutover code fixes: P.1 AdminLogin "60 minutes" and P.2 edge-function imports **done in this branch**; rehearse the deploy | repo | yes | ☐ |
| 0 | Preconditions: unlocked, `select version()` ≥ 15, parser-tick unscheduled, backup taken | Dashboard, terminal | n/a | ☐ |
| 1 | OTP dashboard settings (Magic Link template, OTP length 6, expiry 600) | Dashboard → Auth | yes | ☐ |
| 2 | Pre-070 data checks (participants count, ISOs, `source_url`) | SQL Editor | n/a (read-only) | ☐ |
| 3 | Apply **070** + reconcile (`in_final` = old participants, `final_place` = old results) | SQL Editor | yes (old tables untouched) | ☐ |
| 4 | Apply **071** + privilege checks; **freeze 2026 edits until step 10** | SQL Editor | yes | ☐ |
| 5 | Apply **073** (history 1956–2025) and **074** (publish_runs) | SQL Editor | yes | ☐ |
| 6 | Deploy `eurovision-parse` + `publish-content`; set `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` | terminal / Dashboard | yes (redeploy old) | ☐ |
| 7 | Record `<OLD_MAIN_SHA>`; merge `feat/foundation-prerender` → `main`; verify production (SP1 checklist + 10 historical URLs + CLS) | git, Vercel, curl | yes (Instant Rollback) | ☐ |
| 8 | Admin smoke test (OTP login, Contests 1956–2026) and game reads (lobby lineup = 2026 finalists, `PredictionsResultsScreen`), before Publish | /admin, site, SQL | yes (Instant Rollback) | ☐ |
| 9 | First **Publish**; verify commit, Vercel build, `/en/eurovision-2026` | /admin, GitHub, Vercel | yes (git revert to `<OLD_MAIN_SHA>`; **not** Instant Rollback) | ☐ |
| 10 | Apply **072** (drops old 2026 tables, guarded) | SQL Editor | **no: restore from backup** | ☐ |
| 11 | Post-deploy: Search Console sitemap + URL Inspection, watch Pages 3 weeks; semis paste check; indexable switches | GSC, /admin | n/a | ☐ |
| 12 | Before May 2027: create 2027 (Burgas), lineup, Archive 2026, re-enable parser-tick (047) | /admin, SQL Editor | see step | ☐ |

Step format below: **Do** · **Run** · **Expect** · **If it fails**.

---

## P. Pre-cutover code fixes (Διορθώσεις κώδικα πριν τη μετάβαση)

1. **Done in this branch: AdminLogin copy.** `src/admin/AdminLogin.tsx` said "Both expire in 60 minutes" while the Magic Link email (`supabase/templates/magic-link.html`) and the OTP expiry (600 s) say 10. It now reads "Both expire in 10 minutes." Verified in 8.1.
2. **Done in this branch: edge-function imports.** `publish-content` imported its row/snapshot types from `src/content/contests/types.ts`, outside `supabase/functions/`, which the deploy bundler cannot see. The types now live in `supabase/functions/_shared/contestTypes.ts`; `src/content/contests/types.ts` re-exports them; `tests/functions/importBoundary.test.ts` fails if any function module imports from `src/` or from outside `supabase/functions/`. **Still rehearse** step 6.2 for `publish-content` before cutover day (harmless: nothing calls it until the new admin is live). The rehearsal is the verification.
3. **Do not run `deploy-functions.mjs`.** See step 6 for why.
4. **Open 2a T5 minors (recommended, not blocking; needed before May 2027):**

   | Item | Where | Status |
   |---|---|---|
   | A re-parse nulls an admin-typed running order: `final_running_order = excluded.final_running_order` (the parser always sends null). Fix: `coalesce(excluded.final_running_order, e.final_running_order)` | 071 `parser_upsert_entries`, participants branch | **open** |
   | `rowsUpserted` falls back to `?? rows.length` (should be `?? 0`), so a null RPC count logs a wrong number in `parse_runs` | `eurovision-parse/index.ts` (participants, results, semis) | **open** |
   | The results write silently updates 0 rows on a year with no `in_final` finalists | 071 `parser_upsert_entries`, results branch | **open** |
   | A demoted row (no longer in the final) keeps its result columns | 071 | addressed by the 2a final review (I1: results and scoring use finalists only) |

   Ship the 071 items before 071 is applied, or afterwards as a new migration (075).

---

## 0. Preconditions (Προϋποθέσεις)

### 0.1 Production is unlocked (Η βάση είναι ξεκλείδωτη)
- **Do:** Supabase Dashboard → project home. No "restricted" / "exceeded" banner.
- **Run** (terminal):
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" \
    "https://ameneqrrfdhntfzvchnn.supabase.co/rest/v1/rooms?select=id&limit=1" \
    -H "apikey: <ANON_KEY>"
  ```
  and in SQL Editor:
  ```sql
  select pg_size_pretty(pg_database_size('postgres')) as db_size;
  ```
- **Expect:** `200` (not `402`). `db_size` well under 500 MB (068 truncated the 1.3 GB cron log).
- **If it fails:** `402` = still restricted. Stop; wait for the billing cycle. Do not start any later step.

### 0.2 Postgres version
- **Run:**
  ```sql
  select version();
  ```
- **Expect:** `PostgreSQL 15.x` or higher. 070's views use `security_invoker`, which needs 15+.
- **If it fails:** below 15 → stop. Upgrade the project (Dashboard → Settings → Infrastructure) first.

### 0.3 parser-tick is still unscheduled (Ο parser-tick είναι σβηστός)
- **Run:**
  ```sql
  select jobname, schedule, active from cron.job order by jobname;
  ```
- **Expect:** `purge-cron-logs` (`0 3 * * *`) present. **No** `parser-tick`, `send-email-drain`, `eurovision-parse-poll`. (`cleanup-inactive-rooms` may be present; fine.)
- **If it fails:** `parser-tick` is back → unschedule it now (it would write into 2026 while you migrate):
  ```sql
  select cron.unschedule('parser-tick');
  ```

### 0.4 Backup (Αντίγραφο ασφαλείας): mandatory
Free tier has **no** daily backups or PITR, and Dashboard → Database → Backups offers nothing to download. Use `pg_dump`.

**0.4a Shell session setup (Ρύθμιση τερματικού).** Run this block in Git Bash at the start of every session that uses `pg_dump`, `pg_restore` or `psql` (steps 0.4, 5.1, Rollback).
- Install client tools whose major version is **≥ the server's** (from 0.2): `winget install PostgreSQL.PostgreSQL.17`. winget does not add them to PATH; the first line below does (change `17` if you installed another major).
- Dashboard → **Connect** → **Session pooler** → copy the URI **unchanged** (host and region exactly as shown; do not retype or guess the host; the direct `db.<ref>.supabase.co` host is IPv6-only on free tier). Delete only the `:[YOUR-PASSWORD]` part; the password goes into `PGPASSWORD` instead, so it needs no URL-encoding. (If you ever put a password inside a URI, URL-encode its special characters: `@`→`%40`, `#`→`%23`, `/`→`%2F`, `:`→`%3A`, `?`→`%3F`, `%`→`%25`.)
- `read -s` keeps the password out of the shell history and off the screen.

```bash
export PATH="/c/Program Files/PostgreSQL/17/bin:$PATH"
pg_dump --version                       # expect: pg_dump (PostgreSQL) 17.x (≥ server major)
read -r -p  "Session pooler URI without password: " PGURL; export PGURL
read -r -s -p "Database password: " PGPASSWORD; echo; export PGPASSWORD
psql "$PGURL" -c "select 1"            # expect: one row, 1
```
End of session: `unset PGURL PGPASSWORD`.

- **Run** (after 0.4a, in a folder **outside** the repo, e.g. `C:/Users/User/backups`):
  ```bash
  # 1. Full logical backup of the app schema (schema + data + grants), custom format
  pg_dump "$PGURL" --schema=public --no-owner \
    --format=custom --file=eurogames-pre-cutover-$(date +%F).dump

  # 2. The two tables 072 drops, as plain SQL (schema + data + grants) for a quick restore
  pg_dump "$PGURL" --no-owner \
    --table=public.eurovision_2026_participants \
    --table=public.eurovision_2026_results \
    --file=old-2026-tables-$(date +%F).sql

  # 3. Sanity
  pg_restore --list eurogames-pre-cutover-*.dump | grep -c "TABLE DATA"
  grep -c "COPY public.eurovision_2026" old-2026-tables-*.sql
  ```
  Why these flags: `--no-owner` because the pooler login cannot recreate Supabase's internal owners; **no** `--no-privileges`, so the `GRANT`s for `anon` / `authenticated` / `service_role` come back with a restore (without them the API cannot read the restored tables).
- **Expect:** both files non-empty; the `grep -c` on the plain file prints `2`.
- **If it fails:** `server version mismatch` → install a newer major and fix the PATH line. `pg_dump: command not found` → PATH line missing or wrong major folder. `password authentication failed` → re-run the `read -s` line; still failing → Dashboard → Database → Settings → Reset database password (the app uses API keys, not this password). **Do not continue without both files.**

---

## 1. OTP dashboard settings (Ρυθμίσεις OTP στο Dashboard)

Can be done any time after 0.1; independent of the migrations.

- **Do:**
  1. Dashboard → **Authentication → Emails → Templates → Magic Link**. Subject: `Your Eurovision Games admin code`. Body: paste the whole of `supabase/templates/magic-link.html`. Save.
  2. Dashboard → **Authentication → Sign In / Providers → Email**: **Email OTP Length = 6**, **Email OTP Expiration = 600** (seconds). Save. Verify that **Confirm email** is ON (it should already be; turn it on only if it is off).
- **Expect:** the next admin login email (step 8.1) shows the branded template, a 6-digit code, "expires in 10 minutes".
- **If it fails:** an 8-digit code or "60 minutes" in the email → the setting did not save; repeat. Template shows raw `{{ .Token }}` → the body was pasted into the wrong template.

---

## 2. Pre-070 data checks (Έλεγχοι δεδομένων πριν το 070)

Read-only. All three must pass before 070.

### 2.1 Old participants: count, ISOs, running order
- **Run:**
  ```sql
  select iso, running_order from eurovision_2026_participants order by running_order nulls last, iso;

  select count(*)                                       as participants,
         count(*) filter (where running_order is null)  as null_running_order
    from public.eurovision_2026_participants;

  -- ISOs that 070's countries seed does not know (must be empty)
  select iso from public.eurovision_2026_participants
   where iso not in ('AD','AL','AM','AT','AU','AZ','BA','BE','BG','BY','CH','CS','CY','CZ','DE','DK',
                     'EE','ES','FI','FR','GB','GE','GR','HR','HU','IE','IL','IS','IT','LT','LU','LV',
                     'MA','MC','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SK',
                     'SM','TR','UA','YU');

  select count(*) as results from public.eurovision_2026_results;
  ```
- **Expect:**
  - `participants` = the 2026 grand-final size, **25–26**. Every row becomes an `in_final` finalist in 070, so a stray row would become a fake finalist. 070 itself aborts outside 20–30.
  - Unknown-ISO query: **0 rows**.
  - `null_running_order`: informational. The parser never fills running order; since the 2a T5 ruling, finalists are marked by `in_final`, so nulls are allowed. Write the number down.
  - `results`: write it down (should equal `participants` when 2026 was fully scored). Step 3 must reproduce it.
- **If it fails:** count outside 25–26 → list the rows, identify the strays (non-finalists or duplicates), and decide with the 2026 Wikipedia final before deleting anything; take the backup again after any change. Unknown ISO → stop; it needs a countries-seed fix in 070 (repo change).

### 2.2 Every parse_jobs row has a source_url
The new parser has no Vienna fallback URL: a job without `source_url` errors.
- **Run:**
  ```sql
  select year, kind, status, source_url from public.parse_jobs order by year, kind;
  ```
- **Expect:** no row with `source_url` null.
- **If it fails:** fill it for each such row, pattern `https://www.eurovision.com/eurovision-song-contest/<city>-<year>/<city>-<year>-grand-final/`. For 2026:
  ```sql
  update public.parse_jobs
     set source_url = 'https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/'
   where year = 2026 and source_url is null;
  ```

---

## 3. Apply 070: contests core + 2026 copy (Εφαρμογή 070)

- **Do:** SQL Editor → paste all of `supabase/migrations/070_contests_core.sql` → Run. It is idempotent (safe to run twice) and refuses to copy unless the old participants table holds 20–30 rows with known ISOs.
- **Run** (reconcile):
  ```sql
  select (select count(*) from public.contest_entries where year = 2026 and in_final)                   as in_final,
         (select count(*) from public.eurovision_2026_participants)                                   as old_participants,
         (select count(*) from public.contest_entries where year = 2026 and final_place is not null)  as final_place_set,
         (select count(*) from public.eurovision_2026_results)                                        as old_results,
         (select count(*) from public.contest_entries where year = 2026)                              as entries_2026,
         (select count(*) from public.countries)                                                      as countries,
         public.live_contest_year()                                                                   as live_year;

  select year, city, stage from public.contests;

  select iso, final_place, total_points from public.contest_entries where year = 2026 and final_place = 1;
  ```
- **Expect:** `in_final` = `old_participants`; `final_place_set` = `old_results`; `entries_2026` = **35**; `countries` = **52**; `live_year` = **2026**; one contest `2026 | Vienna | finalized`. Winner row: expected from Wikipedia `BG | 1 | 516`, but the authority is the old results table. Confirm with `select iso, ranking, total_points from eurovision_2026_results where ranking = 1;` (the same source as `old_results`). A mismatch with Wikipedia is a data question, not a migration failure.
- **If it fails:**
  - "070 aborted" exception → nothing was committed (single transaction). Fix the data named in the message (step 2.1), re-run.
  - Counts differ → do **not** continue. Compare: `select p.iso from eurovision_2026_participants p left join contest_entries e on e.year=2026 and e.iso=p.iso and e.in_final where e.iso is null;`. The old site is unaffected (it does not read the new tables); safe to investigate.

---

## 4. Apply 071: RPCs, lifecycle, parser guard, phase triggers (Εφαρμογή 071)

> **Freeze rule (Πάγωμα):** from now until 072 (step 10) is applied, **do not edit 2026 entries** — not in the old admin, not in the new admin, not by SQL, no parser runs. 072's guard compares the 070 copy with the old tables and would abort. (The one exception is the first Publish in step 8, which only reads.)

- **Do:** SQL Editor → paste all of `supabase/migrations/071_rpcs_on_contest_entries.sql` → Run.
- **Run** (function privileges; a missing function raises an error, which is also a failure):
  ```sql
  with fns(sig, kind) as (values
    ('public.finalize_results(integer)',                                  'admin'),
    ('public.commit_manual_results(integer,text[])',                      'admin'),
    ('public.reset_manual_results(integer)',                              'admin'),
    ('public.reset_contest(integer,boolean,boolean,boolean)',             'admin'),
    ('public.create_contest(integer,text,text,text,date,date,date)',      'admin'),
    ('public.update_contest(integer,jsonb)',                              'admin'),
    ('public.upsert_contest_entry(integer,text,jsonb)',                   'admin'),
    ('public.delete_contest_entry(integer,text)',                         'admin'),
    ('public.start_contest(integer)',                                     'admin'),
    ('public.finalize_contest(integer)',                                  'admin'),
    ('public.archive_contest(integer)',                                   'admin'),
    ('public.unarchive_contest(integer)',                                 'admin'),
    ('public.contest_summaries()',                                        'admin'),
    ('public.contest_has_rooms(integer)',                                 'admin'),
    ('public.parser_upsert_entries(integer,jsonb,text)',                  'service'),
    ('public._open_predictions_for_pre_night_rooms(integer)',             'trigger'),
    ('public._open_voting_for_predictions_rooms(integer)',                'trigger'),
    ('public._move_all_to_final(integer)',                                'trigger'),
    ('public.live_contest_year()',                                        'public')
  ),
  expected(sig, role, ok) as (
    select sig, 'anon',          kind = 'public'                    from fns union all
    select sig, 'authenticated', kind in ('admin', 'public')        from fns union all
    select sig, 'service_role',  true                               from fns where kind = 'service'
  )
  select sig, role, ok as expected, has_function_privilege(role, sig, 'execute') as actual
    from expected
   where has_function_privilege(role, sig, 'execute') <> ok
   order by sig, role;
  ```
  Table/view privileges (from 070):
  ```sql
  select rel, role, priv, has_table_privilege(role, 'public.' || rel, priv) as actual
    from unnest(array['contests','countries','contest_entries',
                      'current_entries','current_participants','entries_with_names']) rel,
         unnest(array['anon','authenticated']) role,
         unnest(array['select','insert','update','delete','truncate']) priv
   where has_table_privilege(role, 'public.' || rel, priv) <> (priv = 'select');

  select has_table_privilege('service_role', 'public.contest_entries', 'select') as service_reads,
         to_regprocedure('public.reset_contest(integer)')                       as legacy_overload;

  select count(*) as current_participants from public.current_participants;
  ```
- **Expect:** both privilege queries return **0 rows**. `service_reads` = true, `legacy_overload` = null (the 1-argument `reset_contest` is dropped). `current_participants` = `old_participants` from step 3.
- **If it fails:** a row in the first query = a grant is wrong; 071 is idempotent (`create or replace` + explicit revoke/grant), so re-run the file once. Still wrong → run the matching `revoke`/`grant` line from 071 by hand. An error "function … does not exist" = 071 did not fully apply; read the error, fix, re-run.
- **Note:** the old admin's parser/results buttons now hit 071's functions. Do not use the old admin from here until the merge.

---

## 5. Apply 073 (history 1956–2025) and 074 (publish_runs) (Εφαρμογή 073 και 074)

### 5.1 Apply 073
- **Do:** SQL Editor → paste all of `supabase/migrations/073_history_import.sql` (≈ 230 KB, generated) → Run. Idempotent (`on conflict do nothing`); never touches 2026.
- **Run:**
  ```sql
  select count(*)                                as contests,
         min(year)                               as first_year,
         max(year)                               as last_year,
         count(*) filter (where indexable)       as indexable,
         count(*) filter (where cancelled)       as cancelled
    from public.contests where year between 1956 and 2025;

  select count(*)                                                    as entries,
         count(*) filter (where source <> 'import:wikipedia')        as other_source
    from public.contest_entries where year between 1956 and 2025;

  select count(*) as entries_2020 from public.contest_entries where year = 2020;
  select count(*) as entries_2026 from public.contest_entries where year = 2026;
  select count(*) as contests_total from public.contests;
  ```
- **Expect:** `70 | 1956 | 2025 | 0 | 1`; `1789 | 0`; `entries_2020` = 41; `entries_2026` = 35 (unchanged); `contests_total` = 71.
- **If it fails:** the editor times out or truncates the paste → run it with psql instead. Run the 0.4a setup block first (it was unset), then run from **the repo root**, because the `-f` path is relative to it:
  ```bash
  cd C:/Users/User/EurovisionParty-foundation
  psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/migrations/073_history_import.sql
  ```
  Any error rolls back the whole file (single `begin … commit`); fix and re-run.

### 5.2 Apply 074
- **Do:** SQL Editor → paste all of `supabase/migrations/074_publish_runs.sql` → Run. Idempotent.
- **Run:**
  ```sql
  select to_regclass('public.publish_runs') as tbl, (select count(*) from public.publish_runs) as runs;

  with fns(sig, kind) as (values
    ('public.begin_publish()',                                'admin'),
    ('public.unpublished_summary()',                          'admin'),
    ('public.last_publish_run()',                             'admin'),
    ('public.end_publish(bigint,text,text,integer,text)',     'service'),
    ('public.publish_input()',                                'service')
  ),
  expected(sig, role, ok) as (
    select sig, 'anon',          false                 from fns union all
    select sig, 'authenticated', kind = 'admin'        from fns union all
    select sig, 'service_role',  true                  from fns where kind = 'service'
  )
  select sig, role, ok as expected, has_function_privilege(role, sig, 'execute') as actual
    from expected where has_function_privilege(role, sig, 'execute') <> ok;
  ```
- **Expect:** `publish_runs | 0`; privilege query **0 rows**.
- **If it fails:** re-run 074 (idempotent).

---

## 6. Edge functions and secrets (Edge functions και secrets)

### Why not `deploy-functions.mjs` (Γιατί όχι το deploy-functions.mjs)
The repo script **cannot** deploy these functions and is unsafe to run:
- It reads `supabase/functions/send-email/index.bundled.ts` and `supabase/functions/eurovision-parse/index.bundled.ts`; neither file exists, so it crashes on start.
- It uploads one file per function. `eurovision-parse` is 5 modules (`index.ts`, `parse.ts`, `parseResults.ts`, `parseSemis.ts`, `rows.ts`), `publish-content` is 5 (`index.ts`, `github.ts`, `run.ts`, `snapshot.ts`, `redirects.ts`).
- It does not know `publish-content`.
- Side effects: it rewrites the `app.settings.service_role_key` DB setting and **re-runs migrations 018–022** against production, which would put old function bodies back.

Use the Supabase CLI through `npx` (no install, no Docker) or the Dashboard.

### 6.1 Access token
- **Do:** https://supabase.com/dashboard/account/tokens → Generate new token, name `cutover-2026`. Keep it in your password manager only.

### 6.2 Deploy both functions
- **Run** (Git Bash, from `C:/Users/User/EurovisionParty-foundation`):
  ```bash
  cd C:/Users/User/EurovisionParty-foundation
  read -r -s -p "Supabase access token: " SUPABASE_ACCESS_TOKEN; echo; export SUPABASE_ACCESS_TOKEN
  npx supabase@2.122.0 functions deploy eurovision-parse --project-ref ameneqrrfdhntfzvchnn --workdir . --no-verify-jwt --use-api
  npx supabase@2.122.0 functions deploy publish-content  --project-ref ameneqrrfdhntfzvchnn --workdir . --no-verify-jwt --use-api
  unset SUPABASE_ACCESS_TOKEN
  ```
  `--no-verify-jwt` is required: the parser cron authenticates with `PARSER_CRON_SECRET`, which is not a JWT, and both functions check the caller themselves (super-admin JWT). `--use-api` bundles on Supabase's side, so Docker is not needed. The CLI version is pinned to 2.122.0 (the latest stable on npm when this was written) so the flags above stay valid.
- **Verify:**
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/publish-content
  curl -s -X POST https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/publish-content
  curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS https://ameneqrrfdhntfzvchnn.supabase.co/functions/v1/eurovision-parse
  ```
- **Expect:** `204`; `{"error":"forbidden"}` (403: the function runs and refuses an anonymous caller); `204`. Dashboard → Edge Functions lists both with today's deploy time and "Verify JWT" **off**.
- **If it fails:**
  - `401 Missing authorization header` → deployed with JWT verification on. Redeploy with `--no-verify-jwt`, or Dashboard → function → Details → toggle "Enforce JWT verification" off.
  - "Module not found …" for a path outside `supabase/functions/` → should not happen after P.2 (`tests/functions/importBoundary.test.ts` guards it). Stop, fix in the repo, redeploy. Nothing user-facing depends on it yet.
  - "open supabase/config.toml: no such file or directory" (or "Cannot find project ref") → the repo has no `supabase/config.toml`. Keep `--project-ref` and `--workdir .` as above and run from the repo root. Still failing → `npx supabase@2.122.0 init` (answer **N** to the editor-settings prompts) to create `supabase/config.toml`, deploy again, then delete that generated `supabase/config.toml` (do not commit it).
  - CLI unusable → Dashboard fallback: Edge Functions → `eurovision-parse` → **Code** → replace each of the 5 files with the repo version (same names), **Deploy**. For `publish-content`: Edge Functions → **Deploy a new function → Via editor**, name `publish-content`, create the 5 files with the repo contents, Deploy, then turn JWT verification off in Details. The editor only has the files you add, so also create `_shared/contestTypes.ts` with the contents of `supabase/functions/_shared/contestTypes.ts`, to match the `../_shared/contestTypes.ts` import.
- **Then:** revoke the access token (account/tokens → Revoke).

### 6.3 publish-content secrets
Names are exactly as read in `supabase/functions/publish-content/index.ts`.
- **Do:**
  1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate. Resource owner `tsokid`; **Only select repositories → `tsokid/EurovisionParty`**; Repository permissions → **Contents: Read and write** (Metadata read-only is added automatically); nothing else. Expiration: 1 year; put the expiry date in your calendar.
  2. Supabase Dashboard → **Edge Functions → Secrets** → add:
     | Name | Value |
     |---|---|
     | `GITHUB_TOKEN` | `<GITHUB_PAT>` |
     | `GITHUB_REPO` | `tsokid/EurovisionParty` |
     | `GITHUB_BRANCH` | `main` |
  3. Leave `PARSER_CRON_SECRET` (used by `eurovision-parse`) as it is.
- **Expect:** all three names listed under Secrets. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase; do not add them.
- **If it fails:** `main` has branch protection that requires pull requests → the token cannot push; allow it (GitHub → Settings → Branches) or the first Publish fails with 403/422.

---

## 7. Merge to main and verify production (Merge στο main και έλεγχος παραγωγής)

### 7.0 Before the merge: CLS on the latest preview (SP1 ruling M3)
- **Do:** https://pagespeed.web.dev/ → the latest Vercel preview URL of the branch, `/en` → Mobile.
- **Expect:** CLS ≤ 0.1 (green). Write the number down; repeat on `https://eurovision.games/en` after the merge.
- **If it fails:** CLS > 0.1 → not a blocker for cutover; open a follow-up (home spinner layout shift).

### 7.1 Merge
- **Run** (worktree `C:/Users/User/EurovisionParty-foundation`):
  ```bash
  git status --short                                   # expect: clean
  git fetch origin
  git rev-parse origin/main                            # write this down: <OLD_MAIN_SHA> (rollback target)
  git merge-base --is-ancestor origin/main feat/foundation-prerender && echo FAST-FORWARD-OK
  git push origin feat/foundation-prerender            # branch up to date on GitHub
  git push origin feat/foundation-prerender:main       # fast-forward main = production deploy
  ```
  (Alternative with a record: `gh pr create --base main --head feat/foundation-prerender --title "SP1+SP2 cutover"`, then Merge in GitHub.)
- **Also write down** the current Production deployment in Vercel → Deployments (its URL; its commit is `<OLD_MAIN_SHA>`).
- **Expect:** `FAST-FORWARD-OK`; push succeeds; Vercel → Deployments shows a **Production** build from `main` → Ready (build prerenders ~290 pages).
- **If it fails:** no `FAST-FORWARD-OK` → `main` moved; merge `origin/main` into the branch, re-run tests, push, retry. Vercel build fails → production stays on the old deployment automatically; fix on the branch and push again.
- **Main worktree hygiene:** `C:/Users/User/EurovisionParty` has untracked copies of `068_stop_idle_crons.sql` / `069_lock_definer_rpcs.sql` (identical to the committed ones) and local edits to `.gitignore` / `public/sitemap.xml`. Before `git pull` there: delete the two untracked migration files and `git stash` the rest, or the pull refuses.

### 7.2 SP1 preview checklist, on production
- **Run:**
  ```bash
  S=https://eurovision.games
  for p in /en/how-to-play /el/faq /en/winners /en; do
    printf "%-18s " "$p"; curl -s "$S$p" | grep -o '<title>[^<]*</title>\|data-prerendered="true"' | tr '\n' ' '; echo
  done
  for p in /en/no-such-page /en/faq/ /en/eurovision-quiz /room/ABCD /how-to-play / /content/site.json; do
    printf "%-20s " "$p"; curl -s -o /dev/null -w "%{http_code} %{redirect_url} %{content_type}\n" "$S$p"
  done
  curl -s -o /dev/null -w "el: %{http_code} %{redirect_url}\n" -H "Accept-Language: el-GR,el;q=0.9" "$S/faq"
  ```
- **Expect:**
  - Each of the four pages: its own `<title>` and `data-prerendered="true"`.
  - `/en/no-such-page` → `404`; `/en/faq/` → `308` to `/en/faq`; `/en/eurovision-quiz` → `308` to `/en/eurovision-trivia`; `/room/ABCD` → `200` (app shell); `/how-to-play` → `308` to `/en/how-to-play`; `/` → `308` to `/en`; `/content/site.json` → `200 application/json`.
  - `el:` → `308` to `/el/faq`.
- **Browser:** open `/el/faq`, `/en/how-to-play`, `/en/winners`, `/en/past-contests/eurovision-2005-kyiv`; DevTools console has **no hydration errors**; click between pages and the tab title changes. On `/en/winners` the breadcrumb reads "Past contests" and links to `/en/past-contests`.
- **If it fails:** wrong status or missing prerender on production only → Vercel → Instant Rollback (see Rollback) and investigate on a preview.

### 7.3 Ten random historical URLs (10 τυχαία παλιά URL)
- **Run:**
  ```bash
  shuf -n 10 tests/fixtures/historical-urls.txt | while read p; do
    curl -s -L -o /dev/null -w "%{http_code} hops=%{num_redirects} $p -> %{url_effective}\n" "https://eurovision.games$p"
  done
  ```
- **Expect:** every line `200` with `hops=0` or `hops=1` (spec §3: one hop, real page).
- **If it fails:** a `404` or `hops=2` → note the URL; fix in `vercel.json` on a follow-up commit. Not a rollback reason unless many fail.

### 7.4 CLS on production
- **Do:** PageSpeed on `https://eurovision.games/en`. **Expect:** same as 7.0.

---

## 8. Admin smoke test and game reads, before Publish (Έλεγχος admin και παιχνιδιού πριν το Publish)

None of these reads depend on Publish. The admin and the game read Supabase (`contest_summaries`, `current_participants`, `entries_with_names`, `predictions`), not the committed `content/**`. So they run first, while Instant Rollback is still a one-click undo.

### 8.1 OTP login
- **Do:** `https://eurovision.games/admin` → your super-admin email → code from the email.
- **Expect:** branded email, 6-digit code, "expires in 10 minutes"; the login screen also says 10 minutes (P.1); login succeeds.
- **If it fails:** no email → Dashboard → Authentication → Logs. "Token has expired or is invalid" immediately → OTP expiry not saved (step 1).

### 8.2 Contests module
- **Do:** Admin → **Contests**.
- **Expect:** 71 rows, **1956–2026**; 2026 `finalized`, 1956–2025 `archived`, 2020 marked cancelled. The Publish bar shows "never published" / all years unpublished.

### 8.3 Game reads (Έλεγχος παιχνιδιού)

- **Run:**
  ```sql
  select public.live_contest_year() as live_year, count(*) as finalists from public.current_participants;
  ```
  **Expect:** `2026 | <old_participants from step 3>`.
- **Lobby lineup:** on `https://eurovision.games/en` create a test room; join from a second browser (private window); host clicks Start. **Expect:** the room goes straight to predictions; the Predictions tab lists the **2026 finalists** (same count as above, country names in EN and in `/el`).
- **PredictionsResultsScreen:** either open a May 2026 room you played in that is in phase `final` —
  ```sql
  select code, phase, created_at from public.rooms where year = 2026 and phase = 'final' order by created_at desc limit 5;
  ```
  — or move your test room to final:
  ```sql
  update public.rooms set phase = 'final' where code = '<ROOM_CODE>';
  ```
  **Expect:** Predictions tab shows the ranked finalists with your hits highlighted; Board tab shows winners. No console errors.
- **Clean up** the test room afterwards (Your Rooms → delete, as host).
- **If it fails:** empty lineup → `current_participants` is empty or the client still has the old bundle (hard reload). Errors calling an RPC → check 071 applied (step 4). Not fixable quickly → Instant Rollback (still valid: nothing published yet); DB stays as is (old tables still exist).

---

## 9. First Publish (Πρώτο Publish)

After this step, Vercel's Instant Rollback (Hobby: previous deployment only) would land on the **new** frontend's pre-Publish build, not the old site. From here on, roll back with the git path in Rollback.

### 9.1 Publish
- **Do:** Contests → **Publish**. Wait (up to ~90 s).
- **Run:**
  ```sql
  select id, status, commit_sha, files_changed, error, started_at, finished_at
    from public.publish_runs order by id desc limit 3;
  select count(*) as unpublished_contests from public.contests where published_at is null;
  ```
- **Expect:**
  - `publish_runs` newest row `ok` with a `commit_sha` and `files_changed` > 0; `unpublished_contests` = 0.
  - GitHub → `tsokid/EurovisionParty` → commits on `main`: one new commit by the token owner, message naming the changed years, **no** `Co-Authored-By` trailer, touching `content/**` (and `vercel.json` only if redirects changed).
  - Vercel builds that commit to Production → Ready.
  - `https://eurovision.games/en/eurovision-2026` shows the real final: **25-ish finalists** (not the 5 from the Wikipedia-only local snapshot) and the winner confirmed in step 3 (expected Bulgaria, 516).
- **If it fails:**
  - `status = error`, `error` "Bad credentials" / 401 → `GITHUB_TOKEN` wrong or expired (6.3).
  - 403/404 from GitHub → token not scoped to this repo or lacks Contents write.
  - The admin's Publish outcome says `GITHUB_TOKEN is not set` → secret missing or name typo. This is checked before a run starts, so it shows only in the admin response and **no** `publish_runs` row is written.
  - Busy (409) → a run is in flight; wait. A row stuck `running` > 10 min is closed as error by the next `begin_publish`.
  - Publish failure does not affect the live site; fix and press Publish again.
- **After this step:** local clones must `git pull` before their next push (the bot commits to `main`).

---

## 10. Apply 072: drop the old 2026 tables (Εφαρμογή 072 — μη αναστρέψιμο)

Only after steps 7–9 pass (site, admin, game, first Publish). After this, rollback needs the backup from 0.4.

- **Run first** (same numbers as step 3 — the freeze held):
  ```sql
  select (select count(*) from public.contest_entries where year = 2026 and in_final)                  as in_final,
         (select count(*) from public.eurovision_2026_participants)                                  as old_participants,
         (select count(*) from public.contest_entries where year = 2026 and final_place is not null) as final_place_set,
         (select count(*) from public.eurovision_2026_results)                                       as old_results;
  ```
- **Do:** SQL Editor → paste all of `supabase/migrations/072_drop_2026_tables.sql` → Run. Guarded: raises unless finalists = old participants and placed = old results; drops without `cascade`, results first.
- **Verify:**
  ```sql
  select to_regclass('public.eurovision_2026_participants') as participants_tbl,
         to_regclass('public.eurovision_2026_results')      as results_tbl;
  ```
- **Expect:** both `null`. Site, room and admin still work (reload `/en/eurovision-2026`, a room, Admin → Contests).
- **If it fails:**
  - "072 aborted" → nothing dropped. Someone edited 2026 after 070 (freeze broken). Find the difference, reconcile, re-run.
  - "cannot drop table … because other objects depend on it" → a view/FK still uses the old table. Nothing dropped (transaction). Find the real dependents (views through `pg_rewrite`, foreign keys from other tables through `pg_constraint`):
    ```sql
    select c.relname as old_table,
           coalesce(v.relname::text, con.conrelid::regclass::text) as dependent,
           case when rw.oid is not null then 'view' else 'foreign key ' || con.conname end as kind
      from pg_depend d
      join pg_class c on c.oid = d.refobjid and c.relname in ('eurovision_2026_participants', 'eurovision_2026_results')
      left join pg_rewrite rw     on d.classid = 'pg_rewrite'::regclass    and rw.oid = d.objid
      left join pg_class v        on v.oid = rw.ev_class
      left join pg_constraint con on d.classid = 'pg_constraint'::regclass and con.oid = d.objid
     where d.deptype = 'n'
       and ((v.oid is not null and v.oid <> c.oid)
            or (con.oid is not null and con.conrelid <> c.oid));
    ```
    The results → participants foreign key is expected (072 drops results first). Anything else must be dropped or repointed deliberately; then re-run 072.

---

## 11. Post-deploy (Μετά τη μετάβαση)

### 11.1 Google Search Console
- **Do:**
  1. Sitemaps → resubmit `https://eurovision.games/sitemap.xml`. **Expect:** "Success", discovered URLs ≈ the prerendered page count.
  2. **URL Inspection → Test live URL** on 5 URLs:
     | URL | Expect |
     |---|---|
     | `https://eurovision.games/en/eurovision-2026` (hub) | indexable, canonical = itself |
     | `https://eurovision.games/en/past-contests/eurovision-2025-basel` (archive year) | "Excluded by noindex" until you switch it indexable (11.3) |
     | `https://eurovision.games/en/countries/greece` (country) | indexable |
     | `https://eurovision.games/en/eurovision-predictions` | indexable |
     | `https://eurovision.games/en/eurovision-history` (old redirect) | "Page with redirect" → `/en/past-contests` |
     Request indexing for the indexable ones.
  3. **Pages** report: check weekly for **3 weeks**. Watch "Not found (404)", "Duplicate without user-selected canonical", "Redirect error". Expected movement: `/` → `/en` consolidation and the `/en/winners` description change (one-off, SP2b T6 ruling).
- **If it fails:** a spike of 404s → compare with `tests/fixtures/historical-urls.txt` and add redirects.

### 11.2 Semis paste check (2a T9 note)
- **Do (after 072 only — it writes 2026 rows):** Admin → Parser → **Parse semis** for 2026. eurovision.com usually blocks the server fetch (Cloudflare 403); then open each semi-final results page in your browser, View source, copy all, paste into SF1 / SF2, submit. Then Publish.
- **Expect:** non-qualifiers on `/en/eurovision-2026/semifinals` show semi places and points.
- **If it fails:** "sanity" refusal → you pasted the wrong page (e.g. SF2 into SF1) or a client-rendered page without the scoreboard; the parser writes nothing. Optional step; skipping it loses nothing.

### 11.3 Archive years: noindex → indexable
All 1956–2025 years import as `indexable = false`. For each year where you add real text and images: Admin → Contests → year → Details → **Indexable** on → Save → Publish. **Expect:** the page loses `noindex` and enters the sitemap after the Vercel build.

### 11.4 Owner decisions still open (not blockers)
- Never-built old slugs (`bingo`, `sweepstake`, `drinking-game`, `printables`, `glossary`) redirect to related pages; add short sections there to keep relevance (2b T9).
- CSP blocks Google Fonts (owner decision 2026-10-30: keep as is).

---

## 12. Before May 2027 (Πριν τον Μάιο 2027)

### 12.1 Create 2027 (Δημιουργία 2027)
- **Do:** Admin → Contests → **New contest**: year `2027`, city `Burgas`, slug `burgas`, host `BG`. **Verify** city and dates on eurovision.com when announced (eurovision.com already shows "Burgas 2027"; 2026 winner Bulgaria). Admin UI only: the RPC checks `is_super_admin()`, which is false in the SQL Editor.
- **Run:**
  ```sql
  select year, city, city_slug, host_iso, stage, semi1_date, semi2_date, final_date from public.contests where year = 2027;
  select year, kind, status, source_url from public.parse_jobs where year = 2027;
  ```
- **Expect:** `2027 | Burgas | burgas | BG | upcoming`; two parse jobs with `https://www.eurovision.com/eurovision-song-contest/burgas-2027/burgas-2027-grand-final/`. If eurovision.com uses a different URL, update `source_url`.

### 12.2 Lineup, then Archive 2026 (Συμμετοχές, μετά Αρχειοθέτηση 2026)
- **Do:** Contests → 2027 → **Edit**: enter the announced lineup as it lands. When the 2027 lineup is in: Contests → 2026 → **Archive**, then Publish.
- **Important:** there is **no separate "Start 2027"** step in this cycle. `start_contest(2027)` is refused while 2026 is `finalized` ("contest 2026 is finalized; start of 2027 refused"). `archive_contest(2026)` archives 2026 **and** makes 2027 `current` in one transaction, and requires 2027 `upcoming` with at least one entry. `start_contest` is only for a year with nothing live.
- **Expect:** `select public.live_contest_year();` = 2027; `/en/eurovision-2026` redirects to `/en/past-contests/eurovision-2026-vienna` after the Publish (generated redirect in `vercel.json`).

### 12.3 Re-enable parser-tick (047) (Επανενεργοποίηση parser-tick)
047 re-creates the per-minute `parser-tick` cron that 068 removed. Its body only touches `parse_jobs` (columns unchanged by 070–074) and calls `eurovision-parse` with `{"action":"participants"}` / `{"action":"results"}` — both still exist, and both now write through `parser_upsert_entries` into `contest_entries`. Compatible, with these checks first:
- **Run:**
  ```sql
  -- a) cron secret still in vault
  select name from vault.decrypted_secrets where name = 'parser_cron_secret';
  -- b) no leftover 2026 job that the cron would pick up
  select year, kind, status, respect_schedule, manual_override, scheduled_start_at, scheduled_end_at, source_url
    from public.parse_jobs order by year, kind;
  ```
- **Expect:** a) one row; Dashboard → Edge Functions → Secrets still lists `PARSER_CRON_SECRET` (same value as the vault secret). b) 2026 rows are `done`, `finalized` or `stopped`, **not** `running` and not `idle` with a past `scheduled_start_at`; 2027 rows have the Burgas `source_url` and the schedule you want (set in Admin → Parser).
- **Do:** SQL Editor → paste all of `supabase/migrations/047_results_auto_done.sql` → Run. Then `select jobname, schedule, active from cron.job;` → `parser-tick | * * * * * | t`.
- **Incompatibilities to know:**
  - The parser takes **any** `running` job (`limit 1`, no year filter). A 2026 job left `running` would be polled; its writes are refused (2026 finalized/archived) and five errors flip it to `error`. Hence check b).
  - The URL in 047 is hardcoded to this project (`ameneqrrfdhntfzvchnn`) — still correct.
  - The participants parser reads the grand-final page: finalists only, no running order. The full 2027 lineup (semi-finalists) comes from the admin (12.2), not the cron. Schedule the participants start after the second semi.
  - A re-parse sets `final_running_order` to null on existing rows (P.4). Fix before May or re-enter running order after each participants parse.
  - Cron logs come back at ~1,440 rows/day; `purge-cron-logs` keeps 7 days. After the 2027 final, unschedule again: `select cron.unschedule('parser-tick');`.

---

## Rollback (Επαναφορά)

In every case below the **old admin's Parser and Results controls stay unused** until the cause is fixed and the cutover is re-run. They would call 071's functions or write the old tables, breaking the 070 copy that 072's guard checks.

| Point reached | How to roll back | Data loss |
|---|---|---|
| Steps 3–6 (before merge) | Nothing to do for users: the old site still reads the old tables. Leave 070/071/073/074 in place. To undo the parser deploy, redeploy `eurovision-parse` with the 6.2 command from a checkout of `<OLD_MAIN_SHA>`. | none |
| Steps 7–8 (merged, **no Publish yet**) | Vercel → Deployments → the previous Production deployment (commit `<OLD_MAIN_SHA>`) → **Instant Rollback**. Leave 070–074 in place; the old tables still exist. After a rollback Vercel stops auto-promoting new `main` builds until you **Undo Rollback** / Promote; that is fine, because `main` still holds the new code. Fix forward on the branch, then undo the rollback. | none (2026 edits are frozen) |
| Step 9 onwards (**after the first Publish**), 072 not applied | Instant Rollback no longer reaches the old site on Hobby: the previous deployment is the new frontend's pre-Publish build. Use **Git revert to the old tree** (below). Alternative, if that deployment's ⋯ menu in the Deployments list offers it: the deployment noted in 7.1 (commit `<OLD_MAIN_SHA>`) → **Promote to Production**. Do not Publish while rolled back; it would commit to `main` again. | none |
| After 072 | 1. **Restore the old 2026 tables** (below). 2. Then **Git revert to the old tree**. | full restore loses all changes since 0.4 |

**Git revert to the old tree** (run in `C:/Users/User/EurovisionParty-foundation`). This works whether `main` was fast-forwarded or merged with a PR, and it also reverts the bot's Publish commits:
```bash
git fetch origin
git switch -c rollback-main origin/main
git rm -r -q .                                   # tracked files only; .superpowers/ and other ignored files stay
git checkout <OLD_MAIN_SHA> -- .
git commit -m "revert: roll production back to pre-cutover <OLD_MAIN_SHA>"
git diff --stat <OLD_MAIN_SHA> HEAD               # expect: empty (tree identical to the old main)
git push origin rollback-main:main                # Vercel builds the old site to Production
git switch feat/foundation-prerender
```
Expect: Vercel → Production build of the revert commit → Ready; `https://eurovision.games/en/how-to-play` serves the old site. To re-cutover later, branch from the new `main` and revert the revert commit.

**Restore the old 2026 tables** (after 072 only). Run the 0.4a setup block, then in the backups folder:
```bash
cd C:/Users/User/backups
psql "$PGURL" -v ON_ERROR_STOP=1 -f old-2026-tables-<DATE>.sql
psql "$PGURL" -c "select count(*) from public.eurovision_2026_participants"   # expect: old_participants from step 3
```
Full disaster only: `pg_restore --dbname="$PGURL" --no-owner --clean --if-exists --schema=public eurogames-pre-cutover-<DATE>.dump`. It overwrites everything since the backup (rooms, players, predictions); grants come back with it. Run `unset PGURL PGPASSWORD` afterwards.

## Ledger coverage (Αντιστοίχιση με τα ledgers)

| Ledger item | Covered in |
|---|---|
| 2a: `select iso, running_order from eurovision_2026_participants` — ISOs in seed, running order, 25–26 rows | 2.1 |
| 2a: every `parse_jobs` row has `source_url` (no Vienna fallback) | 2.2 |
| 2a: `count(*)` of `eurovision_2026_participants` = grand-final size; stray rows become `in_final` | 2.1, 3 |
| 2a: do not edit 2026 entries between 070 and 072 | 4 (freeze), 10 |
| 2a T3: 070–072 ship with the reader changes in one cutover | Why this order |
| 2a T5: re-parse nulls `final_running_order`, plus the other T5 minors | P.4, 12.3 |
| 2a T9: paste path unverified, verify with a real paste | 11.2 |
| 2a note: "Burgas 2027" | 12.1 |
| SP1 M3: measure CLS with PageSpeed before cutover | 7.0, 7.4 |
| SP1 T9: preview checklist | 7.2 |
| SP1: `/` → `/en` 308, Accept-Language `el` → `/el` | 7.2 |
| SP1: CSP Google Fonts, owner keeps | 11.4 |
| 2b T2: hub shows 5 finalists until first prod publish | 9.1 |
| 2b T3: runtime publish commits carry no Co-Authored-By trailer | 9.1 |
| 2b T6: winners breadcrumb → Past contests; `/winners` description changes once | 7.2, 11.1 |
| 2b T9: never-built slugs, owner decision | 11.4 |
| Brief: OTP Magic Link template, OTP length 6, expiry 600 | 1 |
| Brief: AdminLogin "60 minutes" (done) | P.1, 8.1 |
| Brief: publish-content imports outside `supabase/functions` (done) | P.2, 6.2 |
