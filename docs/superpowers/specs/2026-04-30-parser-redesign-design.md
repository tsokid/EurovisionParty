# Eurovision Parser Redesign — Design Spec

**Status:** Approved 2026-04-30 (brainstorm with tsokid@gmail.com)
**Author:** Claude
**Replaces:** Single-job parser shipped in `0073e89` / migration `020_eurovision_parser.sql`
**Touches:** `parse_jobs`, `parse_runs`, `eurovision_2026_live` (renamed), `eurovision-parse` edge function, `EurovisionParser.tsx` admin module, `pg_cron` rows
**Does NOT touch:** Winners table, WinnerCard, WinnerGrid, SuddenDeathPanel, RoomPage Final phase, `is_super_admin()`, `super_admins`, OTP auth.

---

## 1. Problem

The current parser is a single job that does everything: it polls the Eurovision grand-final URL, parses both participant info and (would-be) results, and writes to a single `eurovision_2026_live` table. This is wrong for two reasons:

1. **Participants and results are different jobs with different lifecycles.** Participants are fixed once after semi-2 (Thursday 14 May 2026); they shouldn't be re-fetched every 2 minutes for 4 hours. Results are dynamic during the show (Saturday 16 May 2026) and need continuous polling for ~3-4 hours.
2. **No recovery story.** If polling crashes, hits a rate limit, or eurovision.com restructures the page mid-show, there's no way for the admin to pause, fix, and resume. There's also no "we're done — lock it" terminal state for hosts to know it's safe to advance their rooms to the Final phase.

Plus: there's no test mechanism. Today the parser is "trust it works on the night."

## 2. Solution overview

Split into **two production parsers** with separate state machines, plus **two test parsers** that admin can run manually against historical (2025) data to dry-run the extraction logic.

| Parser | Purpose | Cadence | Source URL |
|---|---|---|---|
| Participants | Fetch grand-final lineup once | One-off (manual or cron Fri 15 May 03:00 Athens) | `https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/` |
| Results | Fetch live scoreboard | Every 2 min while running (manual Start, or cron Sat 16 May 23:30 Athens) | Same URL |
| Test — Participants 2025 | Dry-run participants extractor | Manual only | `https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-grand-final/` (default, override allowed) |
| Test — Results 2025 | Dry-run results extractor | Manual only | Same default, override allowed |

## 3. Data model

Each parser owns its own table. Participants are static; results are dynamic. They share `iso` (the ISO 3166-1 alpha-2 country code derived from country name via the existing `COUNTRY_TO_ISO` map in `parse.ts`) as the join key.

### `eurovision_2026_participants` (renamed from `eurovision_2026_live`)

```sql
iso         text primary key
name        text not null   -- country display name
artist      text not null
song        text not null
source      text not null   -- URL parsed from
updated_at  timestamptz not null default now()
```

### `eurovision_2026_results` (new)

```sql
iso              text primary key references eurovision_2026_participants(iso)
ranking          int  not null   -- 1 = winner, 26 = last
total_points     int  not null
jury_points      int  not null
televote_points  int  not null
source           text not null
updated_at       timestamptz not null default now()
```

`final_rank` from earlier discussion = `ranking` field. Naming chosen for symmetry with eurovision.com page labels ("Ranking", "Total points", "Jury points", "Audience points").

### `parse_jobs` (modified)

Add `kind` column so each parser has its own row.

```sql
alter table parse_jobs add column kind text not null default 'results';
alter table parse_jobs drop constraint parse_jobs_status_check;
alter table parse_jobs add constraint parse_jobs_status_check
  check (status in ('idle','running','stopped','finalized','done','error'));
alter table parse_jobs drop constraint if exists parse_jobs_year_key;
alter table parse_jobs add constraint parse_jobs_year_kind_key unique (year, kind);
```

Two rows for 2026 are seeded by migration: `(2026, 'participants')` and `(2026, 'results')`, both starting at `status='idle'`.

### `parse_runs` (modified)

Add `kind` column so the run log is filterable per parser.

```sql
alter table parse_runs add column kind text not null default 'results';
```

### `eurovision_parse_schedule` (dropped)

Replaced by cron expressions. No longer needed.

## 4. State machines

### Participants
```
       Start | cron
 idle ───────────────► running ──► done
   ▲                       │
   │                       └──fail──► error
   │                                    │
   └──────── Reset ─────────────────────┘
```

Single shot. Cron fires only when `status = 'idle'`. After a successful fetch the row goes to `done`. After a failure it goes to `error`. `Reset` is an admin-only escape hatch back to `idle` (in case of mis-fire or known-bad upstream HTML).

### Results
```
       Start | cron
 idle ───────────────► running ◄──Resume── stopped
   │                       │  │              │
   │                       │  └────Stop──────┘
   │                       │
   │                       ├──fail per poll──► (run logged, state stays running)
   │                       │
   │       Finalize        ▼
   └────────────────► finalized (terminal)
                          ▲
                          │
                  Finalize from any state
```

- **Start** — admin click or `parser-results-2026-start` cron. Allowed only from `idle`.
- **Stop** — admin click. Allowed only from `running`. Polling halts; existing rows in `eurovision_2026_results` are preserved.
- **Resume** — admin click. Allowed only from `stopped`. Returns to `running`. Latest poll wins on every country (upsert).
- **Finalize** — admin click. Allowed from `idle | running | stopped | error`. Terminal. Results parser cannot be restarted for this year. Hosts can advance their rooms to the Final phase.
- **Reset** — admin escape hatch from `error → idle`. Same as participants.
- **Per-poll failures do not change state.** They write a `parse_runs` row with `status='error'` and the run-log table surfaces them in the admin UI. Five consecutive errors auto-transition the job to `error` (admin must Reset to retry); this is implemented in the edge function.

## 5. Edge function — `eurovision-parse`

Single edge function, action-routed:

```ts
type Action =
  | 'participants'
  | 'results'
  | 'test-participants-2025'
  | 'test-results-2025';

interface RequestBody {
  action: Action;
  override_url?: string;    // test actions only
}
```

### Production actions (`participants`, `results`)
1. Verify `Authorization: Bearer <SERVICE_ROLE_KEY>` (cron) **or** authenticated user is in `super_admins` (admin Parse-Now button).
2. Read `parse_jobs` row for `(2026, kind)`; if status != `running`, return 409 with current state.
3. Fetch the grand-final URL with `User-Agent` header (eurovision.com 403s default Deno UA — already handled in current `parse.ts`).
4. Parse the HTML:
   - **participants**: existing extractor in `parse.ts` (country list → iso/name/artist/song).
   - **results**: new extractor that reads the `<table>` with class `scoreboard` (or whatever the page uses on the night — selector TBD when the live page goes up; test parser is the dev tool for nailing this down).
5. Upsert into the appropriate table.
6. Increment `parse_jobs.poll_count`, set `last_poll_at`. For `participants` on success, transition `running → done`.
7. Insert a `parse_runs` row with `kind`, `http_status`, `status`, `rows_upserted`, `payload_hash` (sha256 of the HTML body for dedup), `error` (if any).
8. **Five-strike auto-error**: if the most recent 5 `parse_runs` for `(year, kind)` all have `status='error'`, transition the job to `error`.

### Test actions (`test-participants-2025`, `test-results-2025`)
1. Verify caller is in `super_admins`.
2. Fetch `override_url` if provided, else the hardcoded 2025 URL.
3. Run the same extractor used by the production action.
4. Return parsed rows in the HTTP response body as JSON. **Never write to production tables. Never write to `parse_runs`.**

The test actions exist so admins can verify the extractor still works against a known-good page when eurovision.com restructures their site.

## 6. Cron schedule

| Cron name | Expression (UTC) | Athens local | Purpose |
|---|---|---|---|
| `parser-participants-2026-fallback` | `0 0 15 5 *` | Fri 15 May 03:00 | One-off participants fetch if admin hasn't run it manually |
| `parser-results-2026-start` | `30 20 16 5 *` | Sat 16 May 23:30 | Auto-Start results parser if `idle` |
| `parser-results-2026-poll` | `*/2 * * * *` | every 2 min | Poll results URL while `running`, self-skip when `now > Sun 17 May 00:00 UTC` |

All three crons are conditional in their SQL bodies — they no-op when the gating predicate fails. Specifically:

```sql
-- parser-participants-2026-fallback body:
select net.http_post(
  url := 'https://<project>.supabase.co/functions/v1/eurovision-parse',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.settings.service_role_key')),
  body := jsonb_build_object('action','participants')
)
where (select status from parse_jobs where year=2026 and kind='participants') = 'idle';

-- parser-results-2026-start body:
update parse_jobs set status='running', started_at=now(), started_by=null
where year=2026 and kind='results' and status='idle';

-- parser-results-2026-poll body:
select net.http_post(...action=results...)
where (select status from parse_jobs where year=2026 and kind='results') = 'running'
  and now() < timestamptz '2026-05-17 00:00:00+00';
```

The auto-stop cutoff is enforced **only by the polling cron**. The admin can manually `Resume` past 03:00 Athens if eurovision.com is still updating; the poller just won't auto-fire after that point.

## 7. Admin UI — `EurovisionParser.tsx`

Full rewrite of the existing module. Four cards stacked vertically (mobile-first; desktop ≥1024px shows them in a 2-col grid):

### Card A — Participants Parser
- Status pill (color: idle gray, running yellow pulse, done green, error red)
- Counters: `last fetch at`, `last source URL`
- Buttons: **Run Now** (enabled only when `idle | error`), **Reset** (enabled only when `done | error`)
- Below: most recent participants run row (timestamp, http status, rows upserted, error message if any)

### Card B — Results Parser
- Status pill (idle gray, running yellow pulse, stopped orange, finalized purple, error red)
- Counters: `polls`, `last poll at`, `next auto-stop at`
- Buttons: **Start** (idle only), **Stop** (running only), **Resume** (stopped only), **Parse Now** (running | stopped, single extra fetch)
- Recent runs table (last 10): timestamp, http status, ok/error, rows upserted, error excerpt
- Live "next poll in: 1m 47s" countdown when running (client-side, derived from `last_poll_at + 2min`)

### Card C — Finalize
- Big red button: **Finalize Results 2026**
- Confirmation modal: "This stops the Results parser permanently for 2026. Hosts can advance rooms to Final phase. Cannot be undone."
- Disabled when state is already `finalized`

### Card D — Test parsers (2025)
- Single override URL input (shared between both test buttons; placeholder = the 2025 default URL)
- Two buttons side-by-side: **Test Participants** | **Test Results**
- Output area: ephemeral `<table>` of parsed rows; replaces previous output on every test run; never written to DB
- Helper text: "Output is for verification only. Nothing is saved."

### Reuse from current module
- `refresh()` polling loop — extend to read both job rows.
- Status pill component — refactor to a `<StatusPill kind={'participants'|'results'} status={...} />`.
- Error toast pattern — keep.

### State-button matrix (results parser)

| State | Start | Stop | Resume | Parse Now | Finalize | Reset |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| idle | ✓ | — | — | — | ✓ | — |
| running | — | ✓ | — | ✓ | ✓ | — |
| stopped | — | — | ✓ | ✓ | ✓ | — |
| finalized | — | — | — | — | — | — |
| error | — | — | — | — | ✓ | ✓ |

(Participants has only `Run Now` and `Reset`, gated by the simpler state machine.)

## 8. RPCs (all `security definer`, gated by `is_super_admin()`)

```sql
start_parse_job(p_year int, p_kind text)        -- idle → running
stop_parse_job(p_year int)                      -- results: running → stopped
resume_parse_job(p_year int)                    -- results: stopped → running
finalize_results(p_year int)                    -- any non-terminal → finalized
reset_parse_job(p_year int, p_kind text)        -- error → idle, also done → idle for participants
```

Each RPC raises `exception 'invalid state transition: % → %'` if called from a state the matrix doesn't allow. The admin UI keeps button-disable logic in sync with the matrix; the RPC is the second line of defense against client bugs.

## 9. Migration plan (data + cron)

1. **Migration `021_parser_split.sql`**:
   - `alter table eurovision_2026_live rename to eurovision_2026_participants` (preserves any existing rows from manual testing).
   - Create `eurovision_2026_results` table.
   - Add `kind` to `parse_jobs` and `parse_runs`.
   - Drop `eurovision_parse_schedule` (no longer used).
   - Drop existing crons: `eurovision-2026-fallback`, `eurovision-parse-poll`.
   - Create new crons: `parser-participants-2026-fallback`, `parser-results-2026-start`, `parser-results-2026-poll`.
   - Seed `parse_jobs` rows for `(2026, 'participants')` and `(2026, 'results')` both `status='idle'`.
   - Drop old RPCs `start_parse_job(int)`, `stop_parse_job(int)` (single-arg) and create new ones with the signatures in §8.

2. **Edge function deploy**: `eurovision-parse` v3 with action router. v2 remains live until v3 deploys; Supabase deploys are atomic per function.

3. **Frontend deploy**: `EurovisionParser.tsx` rewrite. Backwards-compatible with v2 of the edge function only during the brief window between migration and edge-function deploy, so deploy order is: **migration → edge function → frontend** to avoid broken-button states.

4. **Rollback**: migration is reversible by manual SQL (rename table back, drop new columns/tables/crons, recreate old crons). Edge function rollback is one click in Supabase dashboard. Frontend rollback is `git revert` + redeploy.

## 10. Out of scope (deliberately)

- Jury panel breakdown (which national jury gave which country how many) — punted to a v2 if requested. Schema for this would require a separate `eurovision_2026_jury_votes` table; not needed for Top-5 / Worst-5 scoring.
- Per-broadcaster televote breakdown — same reason.
- 2027 and beyond — schema is year-parameterized; future seasons get a new pair of `parse_jobs` rows and new cron entries pointed at the next year's URL. No code changes expected.
- Winners — explicitly off-limits per user instruction. The Finalize button does not write to or read from any winners table; it only stops the results parser. Hosts then click "Advance to Final" inside their rooms (existing flow, unchanged).
- Multi-region cron / failover — single cron in Supabase is sufficient; if it misses, manual Start works.

## 11. Acceptance criteria

A successful deploy means:

1. Visiting `/admin` and clicking the Eurovision Parser module shows four cards (Participants, Results, Finalize, Test Parsers).
2. Clicking **Test Participants** with no override URL fetches the 2025 grand-final page and shows a table with 25-26 rows of `iso, name, artist, song`. Nothing is written to the database.
3. Clicking **Run Now** on Participants writes 26 rows to `eurovision_2026_participants` and transitions that job to `done`.
4. Clicking **Start** on Results transitions the job to `running`. The polling cron writes a `parse_runs` row every 2 minutes. The status pill shows the next-poll countdown.
5. Clicking **Stop** halts polling within 2 minutes. Clicking **Resume** restarts it.
6. Clicking **Finalize Results 2026** confirms, then transitions to `finalized`. Polling cron stops firing for that year. Hosts can advance their rooms to Final phase.
7. The cron `parser-participants-2026-fallback` fires at Fri 15 May 00:00 UTC and runs the participants parser if it's still `idle` at that moment.
8. The cron `parser-results-2026-start` fires at Sat 16 May 20:30 UTC and transitions Results to `running` if it's still `idle`.
9. The cron `parser-results-2026-poll` fires every 2 minutes and self-skips when state is not `running` or when `now > Sun 17 May 00:00 UTC`.
10. RLS prevents non-super-admins from reading `parse_jobs`, `parse_runs`, or calling any RPC. Verified by attempting from an anon session.
