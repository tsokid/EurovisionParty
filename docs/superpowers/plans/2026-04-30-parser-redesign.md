# Eurovision Parser Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-job parser with two production parsers (one-off Participants, continuous Results with Stop/Resume/Finalize), plus two manual test parsers for 2025 dry-runs.

**Architecture:** Migration `021_parser_split.sql` reshapes `parse_jobs` / `parse_runs` and renames `eurovision_2026_live → eurovision_2026_participants`, adds `eurovision_2026_results`. Edge function `eurovision-parse` becomes action-routed (`participants | results | test-participants-2025 | test-results-2025`). Admin module `EurovisionParser.tsx` is fully rewritten into 4 cards (Participants / Results / Finalize / Test). Three new pg_cron rows replace the existing two.

**Tech Stack:** Supabase Postgres 15 + pg_cron + pg_net, Deno edge functions, React 19, Tailwind v4, Zustand for client state in the admin module.

**Spec:** `docs/superpowers/specs/2026-04-30-parser-redesign-design.md`

**Boundary:** Does NOT touch `winners`, `WinnerCard`, `WinnerGrid`, `SuddenDeathPanel`, `RoomPage` Final phase, `is_super_admin()`, OTP auth, or any home-page / SEO surface.

---

## Pre-flight

### Task 0: Branch + clean working tree

**Files:** none (git only)

- [ ] **Step 1: Stash or commit the in-flight admin changes on main**

The current working tree has uncommitted changes from a parallel admin session (`Winners.tsx`, `BottomNav.tsx`, `Header.tsx`, etc.). They are unrelated to this plan. Either:

```bash
# Option A: commit them first if they're ready
git add -A && git commit -m "wip: admin in-flight changes from parallel session"

# Option B: stash them
git stash push -u -m "in-flight admin changes pre-parser-redesign"
```

- [ ] **Step 2: Branch from main**

```bash
git checkout main && git pull
git checkout -b feat/parser-redesign
```

- [ ] **Step 3: Verify build is green before changes**

```bash
npm run build
```
Expected: build succeeds, only the pre-existing CSS warning on `[data-theme="light"]` selectors.

- [ ] **Step 4: Snapshot the existing parser files for diff reference**

```bash
cp supabase/functions/eurovision-parse/index.ts /tmp/eurovision-parse-v2.ts
cp supabase/functions/eurovision-parse/parse.ts /tmp/parse-v2.ts
cp src/admin/modules/EurovisionParser.tsx /tmp/EurovisionParser-v2.tsx
```

---

## Phase 1 — Database migration

### Task 1: Migration `021_parser_split.sql`

**Files:**
- Create: `supabase/migrations/021_parser_split.sql`

- [ ] **Step 1: Write migration**

```sql
-- 021_parser_split.sql
-- Split the single Eurovision parser job into two: participants (one-off) and
-- results (continuous polling). Rename the live table for clarity, add a new
-- results table, generalize parse_jobs / parse_runs with a kind column, and
-- replace the cron rows.

begin;

-- ---------------------------------------------------------------------------
-- 1. Rename eurovision_2026_live → eurovision_2026_participants
-- ---------------------------------------------------------------------------
alter table public.eurovision_2026_live
  rename to eurovision_2026_participants;

-- ---------------------------------------------------------------------------
-- 2. Create eurovision_2026_results
-- ---------------------------------------------------------------------------
create table if not exists public.eurovision_2026_results (
  iso              text primary key
    references public.eurovision_2026_participants(iso) on delete cascade,
  ranking          int not null check (ranking between 1 and 50),
  total_points     int not null check (total_points >= 0),
  jury_points      int not null check (jury_points >= 0),
  televote_points  int not null check (televote_points >= 0),
  source           text not null,
  updated_at       timestamptz not null default now()
);

alter table public.eurovision_2026_results enable row level security;

create policy "results readable by authenticated"
  on public.eurovision_2026_results for select
  to authenticated using (true);

-- service_role bypasses RLS; admins write via edge function only.

-- ---------------------------------------------------------------------------
-- 3. parse_jobs: add kind, expand status enum, swap unique constraint
-- ---------------------------------------------------------------------------
alter table public.parse_jobs
  add column if not exists kind text not null default 'results';

alter table public.parse_jobs
  drop constraint if exists parse_jobs_status_check;

alter table public.parse_jobs
  add constraint parse_jobs_status_check
  check (status in ('idle','running','stopped','finalized','done','error'));

alter table public.parse_jobs
  drop constraint if exists parse_jobs_year_key;

alter table public.parse_jobs
  add constraint parse_jobs_year_kind_key unique (year, kind);

-- Backfill any existing rows as kind='results' (default already set, safe re-assert)
update public.parse_jobs set kind = 'results' where kind is null;

-- ---------------------------------------------------------------------------
-- 4. parse_runs: add kind
-- ---------------------------------------------------------------------------
alter table public.parse_runs
  add column if not exists kind text not null default 'results';

create index if not exists parse_runs_kind_year_finished_idx
  on public.parse_runs(year, kind, finished_at desc);

-- ---------------------------------------------------------------------------
-- 5. Drop old schedule table (replaced by cron expressions)
-- ---------------------------------------------------------------------------
drop table if exists public.eurovision_parse_schedule;

-- ---------------------------------------------------------------------------
-- 6. Seed 2026 jobs
-- ---------------------------------------------------------------------------
insert into public.parse_jobs (year, kind, status)
values (2026, 'participants', 'idle')
on conflict (year, kind) do nothing;

insert into public.parse_jobs (year, kind, status)
values (2026, 'results', 'idle')
on conflict (year, kind) do update set status =
  case when public.parse_jobs.status = 'finalized'
       then 'finalized'  -- never resurrect a finalized year
       else 'idle'
  end;

-- ---------------------------------------------------------------------------
-- 7. Replace RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.start_parse_job(int);
drop function if exists public.stop_parse_job(int);

create or replace function public.start_parse_job(p_year int, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  select status into v_status from public.parse_jobs where year = p_year and kind = p_kind;
  if v_status is null then
    raise exception 'no such job: % %', p_year, p_kind;
  end if;
  if v_status <> 'idle' then
    raise exception 'invalid state transition: % → running (kind=%)', v_status, p_kind;
  end if;
  update public.parse_jobs
    set status='running', started_at=now(), started_by=auth.uid(),
        triggered_by_user=true, last_poll_at=null, poll_count=0, stopped_at=null
    where year = p_year and kind = p_kind;
end $$;

create or replace function public.stop_parse_job(p_year int)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  select status into v_status from public.parse_jobs where year=p_year and kind='results';
  if v_status <> 'running' then
    raise exception 'invalid state transition: % → stopped', coalesce(v_status,'<null>');
  end if;
  update public.parse_jobs set status='stopped', stopped_at=now()
    where year=p_year and kind='results';
end $$;

create or replace function public.resume_parse_job(p_year int)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  select status into v_status from public.parse_jobs where year=p_year and kind='results';
  if v_status <> 'stopped' then
    raise exception 'invalid state transition: % → running (resume)', coalesce(v_status,'<null>');
  end if;
  update public.parse_jobs set status='running', stopped_at=null
    where year=p_year and kind='results';
end $$;

create or replace function public.finalize_results(p_year int)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  select status into v_status from public.parse_jobs where year=p_year and kind='results';
  if v_status = 'finalized' then return; end if;
  if v_status is null then raise exception 'no such job: % results', p_year; end if;
  update public.parse_jobs set status='finalized', stopped_at=now()
    where year=p_year and kind='results';
end $$;

create or replace function public.reset_parse_job(p_year int, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  select status into v_status from public.parse_jobs where year=p_year and kind=p_kind;
  if v_status = 'finalized' then
    raise exception 'cannot reset a finalized job';
  end if;
  if p_kind = 'results' and v_status not in ('error','stopped') then
    raise exception 'reset only allowed from error|stopped (results)';
  end if;
  if p_kind = 'participants' and v_status not in ('error','done') then
    raise exception 'reset only allowed from error|done (participants)';
  end if;
  update public.parse_jobs
    set status='idle', started_at=null, stopped_at=null, last_poll_at=null, poll_count=0
    where year=p_year and kind=p_kind;
end $$;

grant execute on function
  public.start_parse_job(int, text),
  public.stop_parse_job(int),
  public.resume_parse_job(int),
  public.finalize_results(int),
  public.reset_parse_job(int, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Cron rows
-- ---------------------------------------------------------------------------
do $$
begin
  perform cron.unschedule('eurovision-2026-fallback');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('eurovision-parse-poll');
exception when others then null;
end $$;

-- Note: the cron bodies use current_setting('app.settings.service_role_key')
-- which must be set at the project level: alter database <db> set app.settings.service_role_key = '...'.
-- Without it, the http_post returns auth-required.

-- 8a. Participants fallback — Fri 15 May 00:00 UTC (= 03:00 Athens EEST)
select cron.schedule(
  'parser-participants-2026-fallback',
  '0 0 15 5 *',
  $cron$
    select net.http_post(
      url := current_setting('app.settings.parse_function_url'),
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('action','participants')
    )
    where (select status from public.parse_jobs
            where year=2026 and kind='participants') = 'idle';
  $cron$
);

-- 8b. Results auto-start — Sat 16 May 20:30 UTC (= 23:30 Athens EEST)
select cron.schedule(
  'parser-results-2026-start',
  '30 20 16 5 *',
  $cron$
    update public.parse_jobs
      set status='running', started_at=now(), triggered_by_user=false,
          last_poll_at=null, poll_count=0
      where year=2026 and kind='results' and status='idle';
  $cron$
);

-- 8c. Results poller — every 2 min, gated by state and 03:00 Athens cutoff
select cron.schedule(
  'parser-results-2026-poll',
  '*/2 * * * *',
  $cron$
    select net.http_post(
      url := current_setting('app.settings.parse_function_url'),
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('action','results')
    )
    where (select status from public.parse_jobs
            where year=2026 and kind='results') = 'running'
      and now() < timestamptz '2026-05-17 00:00:00+00';
  $cron$
);

commit;
```

- [ ] **Step 2: Apply migration locally and verify**

```bash
npx supabase db reset   # if using local dev DB
# or push to remote
npx supabase db push
```

Expected: 4 new RPCs visible in `pg_proc`, 3 new cron rows in `cron.job`, `eurovision_2026_results` table exists, `parse_jobs` has 2 rows for 2026.

- [ ] **Step 3: Set Postgres GUCs for cron URL + service role**

```sql
-- Run once per environment in the Supabase SQL editor:
alter database postgres set app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
alter database postgres set app.settings.parse_function_url =
  'https://<project-ref>.supabase.co/functions/v1/eurovision-parse';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/021_parser_split.sql
git commit -m "feat(parser): migration 021 — split into participants + results jobs"
```

---

## Phase 2 — Edge function rewrite

### Task 2: Action router + results extractor

**Files:**
- Modify: `supabase/functions/eurovision-parse/index.ts`
- Modify: `supabase/functions/eurovision-parse/parse.ts`
- Create: `supabase/functions/eurovision-parse/parseResults.ts`
- Create: `supabase/functions/eurovision-parse/__tests__/parseResults.test.ts`

- [ ] **Step 1: Add `parseResults` extractor with failing test**

Create `parseResults.test.ts` first:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { parseResults } from "../parseResults.ts";

const SAMPLE_HTML = `
<html><body>
<table class="scoreboard">
  <thead><tr><th>Rank</th><th>Country</th><th>Total</th><th>Jury</th><th>Audience</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Sweden</td><td>583</td><td>340</td><td>243</td></tr>
    <tr><td>2</td><td>Finland</td><td>526</td><td>150</td><td>376</td></tr>
    <tr><td>26</td><td>Germany</td><td>18</td><td>15</td><td>3</td></tr>
  </tbody>
</table>
</body></html>
`;

Deno.test("parseResults extracts ranking, totals, jury, televote", () => {
  const rows = parseResults(SAMPLE_HTML, "https://example.test/");
  assertEquals(rows.length, 3);
  assertEquals(rows[0], {
    iso: "SE", ranking: 1, total_points: 583,
    jury_points: 340, televote_points: 243,
    source: "https://example.test/",
  });
  assertEquals(rows[2].iso, "DE");
});

Deno.test("parseResults skips countries not in COUNTRY_TO_ISO", () => {
  const html = `<table class="scoreboard"><tbody>
    <tr><td>1</td><td>Atlantis</td><td>10</td><td>5</td><td>5</td></tr>
  </tbody></table>`;
  const rows = parseResults(html, "https://x");
  assertEquals(rows.length, 0);
});
```

- [ ] **Step 2: Run test — expect FAIL (parseResults not defined)**

```bash
cd supabase/functions/eurovision-parse
deno test --allow-net __tests__/parseResults.test.ts
```
Expected: `error: Module not found`.

- [ ] **Step 3: Implement `parseResults`**

```ts
// supabase/functions/eurovision-parse/parseResults.ts
import { COUNTRY_TO_ISO } from "./parse.ts";

export interface ResultRow {
  iso: string;
  ranking: number;
  total_points: number;
  jury_points: number;
  televote_points: number;
  source: string;
}

const ROW_RX =
  /<tr[^>]*>\s*<td[^>]*>(\d{1,2})<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>(\d{1,4})<\/td>\s*<td[^>]*>(\d{1,4})<\/td>\s*<td[^>]*>(\d{1,4})<\/td>/gi;

export function parseResults(html: string, source: string): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const m of html.matchAll(ROW_RX)) {
    const country = m[2].trim();
    const iso = COUNTRY_TO_ISO[country];
    if (!iso) continue;
    rows.push({
      iso,
      ranking: parseInt(m[1], 10),
      total_points: parseInt(m[3], 10),
      jury_points: parseInt(m[4], 10),
      televote_points: parseInt(m[5], 10),
      source,
    });
  }
  return rows;
}
```

Also export `COUNTRY_TO_ISO` from `parse.ts` if it isn't already:
```ts
// in parse.ts, change `const COUNTRY_TO_ISO` to `export const COUNTRY_TO_ISO`
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
deno test --allow-net __tests__/parseResults.test.ts
```
Expected: `2 passed`.

- [ ] **Step 5: Rewrite `index.ts` as action router**

Replace the entire body of `supabase/functions/eurovision-parse/index.ts` with:

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { parseEurovision } from "./parse.ts";
import { parseResults } from "./parseResults.ts";

const PROD_URL_2026 =
  "https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/";
const TEST_URL_2025 =
  "https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-grand-final/";

type Action =
  | "participants" | "results"
  | "test-participants-2025" | "test-results-2025";

interface Body { action: Action; override_url?: string }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchHtml(url: string): Promise<{ status: number; html: string }> {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  return { status: r.status, html: await r.text() };
}

async function isCallerSuperAdmin(req: Request): Promise<boolean> {
  // service_role calls (cron) are trusted by header.
  const auth = req.headers.get("Authorization") ?? "";
  if (auth === `Bearer ${SERVICE_KEY}`) return true;
  // user calls: verify JWT and check super_admins
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;
  const { data } = await adminClient()
    .from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
}

async function handleProduction(action: "participants" | "results") {
  const db = adminClient();
  const { data: job } = await db.from("parse_jobs")
    .select("status").eq("year", 2026).eq("kind", action).single();
  if (!job || job.status !== "running") {
    return new Response(JSON.stringify({ error: "job not running", state: job?.status }),
      { status: 409, headers: { "Content-Type": "application/json" } });
  }

  const { status, html } = await fetchHtml(PROD_URL_2026);
  let rows = 0; let runStatus: "ok" | "error" = "ok"; let err: string | null = null;

  try {
    if (action === "participants") {
      const parsed = parseEurovision(html, PROD_URL_2026);
      if (parsed.length === 0) throw new Error("no participants extracted");
      const { error } = await db.from("eurovision_2026_participants").upsert(parsed);
      if (error) throw error;
      rows = parsed.length;
      // transition to done on success
      await db.from("parse_jobs").update({
        status: "done", last_poll_at: new Date().toISOString(),
      }).eq("year", 2026).eq("kind", "participants");
    } else {
      const parsed = parseResults(html, PROD_URL_2026);
      if (parsed.length === 0) throw new Error("no results rows");
      const { error } = await db.from("eurovision_2026_results").upsert(parsed);
      if (error) throw error;
      rows = parsed.length;
      await db.rpc("increment_poll_count", { p_year: 2026, p_kind: "results" })
        .then(() => {}).catch(() => {});
    }
  } catch (e) {
    runStatus = "error";
    err = e instanceof Error ? e.message : String(e);
  }

  await db.from("parse_runs").insert({
    year: 2026, kind: action, http_status: status,
    status: runStatus === "ok" ? "ok" : "error",
    rows_upserted: rows, error: err, finished_at: new Date().toISOString(),
  });

  // 5-strike auto-error for results
  if (action === "results" && runStatus === "error") {
    const { data: recent } = await db.from("parse_runs")
      .select("status").eq("year", 2026).eq("kind", "results")
      .order("finished_at", { ascending: false }).limit(5);
    if (recent && recent.length === 5 && recent.every(r => r.status === "error")) {
      await db.from("parse_jobs").update({ status: "error" })
        .eq("year", 2026).eq("kind", "results");
    }
  }

  return new Response(JSON.stringify({ ok: runStatus === "ok", rows, error: err }), {
    status: runStatus === "ok" ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleTest(action: "test-participants-2025" | "test-results-2025", overrideUrl?: string) {
  const url = overrideUrl ?? TEST_URL_2025;
  const { status, html } = await fetchHtml(url);
  if (status !== 200) {
    return new Response(JSON.stringify({ error: "fetch failed", http_status: status }),
      { status: 502, headers: { "Content-Type": "application/json" } });
  }
  const rows = action === "test-participants-2025"
    ? parseEurovision(html, url)
    : parseResults(html, url);
  return new Response(JSON.stringify({ url, rows }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!await isCallerSuperAdmin(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } });
  }

  let body: Body;
  try { body = await req.json(); }
  catch { return new Response("bad json", { status: 400 }); }

  switch (body.action) {
    case "participants":
    case "results":
      return await handleProduction(body.action);
    case "test-participants-2025":
    case "test-results-2025":
      return await handleTest(body.action, body.override_url);
    default:
      return new Response(JSON.stringify({ error: "unknown action" }),
        { status: 400, headers: { "Content-Type": "application/json" } });
  }
});
```

- [ ] **Step 6: Add `increment_poll_count` RPC to migration 021**

Append to migration before commit (or as `022_increment_poll_count.sql` if 021 is already pushed):

```sql
create or replace function public.increment_poll_count(p_year int, p_kind text)
returns void language sql security definer set search_path = public as $$
  update public.parse_jobs
    set poll_count = coalesce(poll_count,0) + 1, last_poll_at = now()
    where year = p_year and kind = p_kind and status = 'running';
$$;
grant execute on function public.increment_poll_count(int, text) to authenticated, service_role;
```

- [ ] **Step 7: Deploy edge function**

```bash
npx supabase functions deploy eurovision-parse --no-verify-jwt
```

(`--no-verify-jwt` because we do our own auth check via `isCallerSuperAdmin`.)

- [ ] **Step 8: Smoke-test the edge function from the SQL editor**

```sql
-- as a super admin (replace with real session JWT)
select net.http_post(
  url := current_setting('app.settings.parse_function_url'),
  headers := jsonb_build_object('Content-Type','application/json',
                                'Authorization','Bearer '||current_setting('app.settings.service_role_key')),
  body := jsonb_build_object('action','test-participants-2025')
);
```
Expected: 200 with a JSON array of ~26 participant rows.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/eurovision-parse/
git commit -m "feat(parser): action-routed edge function (participants|results|test-*)"
```

---

## Phase 3 — Admin module rewrite

### Task 3: `EurovisionParser.tsx` — 4-card UI

**Files:**
- Rewrite: `src/admin/modules/EurovisionParser.tsx`
- Create: `src/admin/modules/parser/StatusPill.tsx`
- Create: `src/admin/modules/parser/ParticipantsCard.tsx`
- Create: `src/admin/modules/parser/ResultsCard.tsx`
- Create: `src/admin/modules/parser/FinalizeCard.tsx`
- Create: `src/admin/modules/parser/TestCard.tsx`
- Create: `src/admin/modules/parser/useParserState.ts`
- Test: `src/admin/modules/parser/__tests__/useParserState.test.ts`

- [ ] **Step 1: Write failing test for `useParserState`**

```ts
// src/admin/modules/parser/__tests__/useParserState.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useParserState } from "../useParserState";

vi.mock("../../../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn((cb) => cb({ data: [
        { kind: "participants", status: "idle", poll_count: 0, last_poll_at: null },
        { kind: "results", status: "idle", poll_count: 0, last_poll_at: null },
      ], error: null })),
    })),
  },
}));

describe("useParserState", () => {
  beforeEach(() => vi.useFakeTimers());

  it("loads both job rows and exposes them by kind", async () => {
    const { result } = renderHook(() => useParserState(2026));
    await waitFor(() => {
      expect(result.current.jobs.participants?.status).toBe("idle");
      expect(result.current.jobs.results?.status).toBe("idle");
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/admin/modules/parser/__tests__/useParserState.test.ts
```

- [ ] **Step 3: Implement `useParserState`**

```ts
// src/admin/modules/parser/useParserState.ts
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

export type JobKind = "participants" | "results";
export type JobStatus = "idle"|"running"|"stopped"|"finalized"|"done"|"error";

export interface ParseJob {
  kind: JobKind;
  status: JobStatus;
  poll_count: number;
  last_poll_at: string | null;
  started_at: string | null;
  stopped_at: string | null;
}

export interface ParseRun {
  id: string;
  kind: JobKind;
  finished_at: string;
  http_status: number | null;
  status: "ok" | "error" | "blocked";
  rows_upserted: number | null;
  error: string | null;
}

export function useParserState(year: number, pollMs = 5000) {
  const [jobs, setJobs] = useState<{ participants?: ParseJob; results?: ParseJob }>({});
  const [runs, setRuns] = useState<ParseRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [{ data: js, error: je }, { data: rs, error: re }] = await Promise.all([
      supabase.from("parse_jobs").select("*").eq("year", year),
      supabase.from("parse_runs").select("*").eq("year", year)
        .order("finished_at", { ascending: false }).limit(20),
    ]);
    if (je || re) { setError((je ?? re)!.message); return; }
    const next: typeof jobs = {};
    for (const j of js ?? []) next[j.kind as JobKind] = j as ParseJob;
    setJobs(next);
    setRuns((rs ?? []) as ParseRun[]);
    setError(null);
    setLoading(false);
  }, [year]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { jobs, runs, loading, error, refresh };
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Build `StatusPill`**

```tsx
// src/admin/modules/parser/StatusPill.tsx
import type { JobStatus } from "./useParserState";

const COLORS: Record<JobStatus, string> = {
  idle:      "bg-white/10 text-white/70",
  running:   "bg-yellow-400/20 text-yellow-300 animate-pulse",
  stopped:   "bg-orange-400/20 text-orange-300",
  finalized: "bg-purple-400/20 text-purple-300",
  done:      "bg-emerald-400/20 text-emerald-300",
  error:     "bg-red-400/20 text-red-300",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
```

- [ ] **Step 6: Build `ParticipantsCard`**

```tsx
// src/admin/modules/parser/ParticipantsCard.tsx
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { StatusPill } from "./StatusPill";
import type { ParseJob, ParseRun } from "./useParserState";

export function ParticipantsCard({
  job, recentRun, onRefresh,
}: { job?: ParseJob; recentRun?: ParseRun; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!job) return <div className="card">Loading…</div>;

  const canRun = job.status === "idle" || job.status === "error";
  const canReset = job.status === "done" || job.status === "error";

  const runNow = async () => {
    setBusy(true);
    try {
      await supabase.rpc("start_parse_job", { p_year: 2026, p_kind: "participants" });
      await supabase.functions.invoke("eurovision-parse", { body: { action: "participants" } });
      onRefresh();
    } finally { setBusy(false); }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await supabase.rpc("reset_parse_job", { p_year: 2026, p_kind: "participants" });
      onRefresh();
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Participants Parser</h3>
        <StatusPill status={job.status} />
      </header>
      <p className="text-sm text-white/60 mb-3">
        Last fetch: {job.last_poll_at ? new Date(job.last_poll_at).toLocaleString() : "—"}
      </p>
      <div className="flex gap-2 mb-3">
        <button className="btn-primary" onClick={runNow} disabled={!canRun || busy}>Run Now</button>
        <button className="btn-secondary" onClick={reset} disabled={!canReset || busy}>Reset</button>
      </div>
      {recentRun && (
        <div className="text-xs text-white/60">
          Last run: {new Date(recentRun.finished_at).toLocaleString()} · http {recentRun.http_status} ·{" "}
          {recentRun.status === "ok" ? `${recentRun.rows_upserted} rows` : recentRun.error}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Build `ResultsCard`**

```tsx
// src/admin/modules/parser/ResultsCard.tsx
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { StatusPill } from "./StatusPill";
import type { ParseJob, ParseRun } from "./useParserState";

interface Props {
  job?: ParseJob;
  recentRuns: ParseRun[];
  onRefresh: () => void;
}

export function ResultsCard({ job, recentRuns, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  if (!job) return <div className="card">Loading…</div>;

  const can = (s: string[]) => s.includes(job.status);
  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true); try { await fn(); onRefresh(); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Results Parser</h3>
        <StatusPill status={job.status} />
      </header>
      <p className="text-sm text-white/60 mb-1">Polls: {job.poll_count}</p>
      <p className="text-sm text-white/60 mb-3">
        Last poll: {job.last_poll_at ? new Date(job.last_poll_at).toLocaleString() : "—"}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <button className="btn-primary" disabled={!can(["idle"]) || busy}
          onClick={() => call(() => supabase.rpc("start_parse_job", { p_year: 2026, p_kind: "results" }))}>
          Start
        </button>
        <button className="btn-secondary" disabled={!can(["running"]) || busy}
          onClick={() => call(() => supabase.rpc("stop_parse_job", { p_year: 2026 }))}>
          Stop
        </button>
        <button className="btn-secondary" disabled={!can(["stopped"]) || busy}
          onClick={() => call(() => supabase.rpc("resume_parse_job", { p_year: 2026 }))}>
          Resume
        </button>
        <button className="btn-tertiary" disabled={!can(["running","stopped"]) || busy}
          onClick={() => call(() => supabase.functions.invoke("eurovision-parse",
            { body: { action: "results" } }))}>
          Parse Now
        </button>
      </div>
      <details className="mt-2">
        <summary className="text-sm text-white/70 cursor-pointer">Recent runs ({recentRuns.length})</summary>
        <table className="w-full text-xs mt-2">
          <thead className="text-white/50"><tr>
            <th className="text-left">Finished</th><th>HTTP</th><th>Status</th><th>Rows</th><th>Error</th>
          </tr></thead>
          <tbody>
            {recentRuns.map(r => (
              <tr key={r.id} className="border-t border-white/5">
                <td>{new Date(r.finished_at).toLocaleTimeString()}</td>
                <td className="text-center">{r.http_status ?? "—"}</td>
                <td className="text-center">{r.status}</td>
                <td className="text-center">{r.rows_upserted ?? "—"}</td>
                <td className="text-white/60 truncate max-w-[200px]">{r.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
```

- [ ] **Step 8: Build `FinalizeCard`**

```tsx
// src/admin/modules/parser/FinalizeCard.tsx
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { ParseJob } from "./useParserState";

export function FinalizeCard({ job, onRefresh }: { job?: ParseJob; onRefresh: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const finalized = job?.status === "finalized";

  const finalize = async () => {
    setBusy(true);
    try {
      await supabase.rpc("finalize_results", { p_year: 2026 });
      onRefresh();
      setConfirm(false);
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border border-red-400/30 bg-red-500/5 p-4">
      <h3 className="font-semibold text-red-300 mb-2">Finalize Results 2026</h3>
      <p className="text-sm text-white/70 mb-3">
        Stops the Results parser permanently. Hosts can advance their rooms to Final phase.
        This cannot be undone.
      </p>
      {!confirm ? (
        <button className="btn-danger" onClick={() => setConfirm(true)} disabled={finalized || busy}>
          {finalized ? "Already finalized" : "Finalize"}
        </button>
      ) : (
        <div className="flex gap-2">
          <button className="btn-danger" onClick={finalize} disabled={busy}>Yes, finalize</button>
          <button className="btn-secondary" onClick={() => setConfirm(false)} disabled={busy}>Cancel</button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 9: Build `TestCard`**

```tsx
// src/admin/modules/parser/TestCard.tsx
import { useState } from "react";
import { supabase } from "../../../lib/supabase";

const TEST_DEFAULT =
  "https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-grand-final/";

export function TestCard() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (action: "test-participants-2025" | "test-results-2025") => {
    setBusy(true); setErr(null); setRows(null);
    try {
      const { data, error } = await supabase.functions.invoke("eurovision-parse", {
        body: { action, override_url: url.trim() || undefined },
      });
      if (error) throw error;
      setRows((data as { rows: Record<string, unknown>[] }).rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="font-semibold mb-2">Test Parsers (2025)</h3>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={TEST_DEFAULT}
        className="w-full mb-3 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm"
      />
      <div className="flex gap-2 mb-3">
        <button className="btn-secondary" disabled={busy}
          onClick={() => run("test-participants-2025")}>Test Participants</button>
        <button className="btn-secondary" disabled={busy}
          onClick={() => run("test-results-2025")}>Test Results</button>
      </div>
      <p className="text-xs text-white/50 mb-2">
        Output is for verification only. Nothing is saved.
      </p>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/50">
              <tr>{Object.keys(rows[0] ?? {}).map(k => (
                <th key={k} className="text-left px-2 py-1">{k}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  {Object.values(r).map((v, j) => (
                    <td key={j} className="px-2 py-1">{String(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 10: Rewrite `EurovisionParser.tsx` as a thin composition**

```tsx
// src/admin/modules/EurovisionParser.tsx
import { useParserState } from "./parser/useParserState";
import { ParticipantsCard } from "./parser/ParticipantsCard";
import { ResultsCard } from "./parser/ResultsCard";
import { FinalizeCard } from "./parser/FinalizeCard";
import { TestCard } from "./parser/TestCard";

export default function EurovisionParser() {
  const { jobs, runs, loading, error, refresh } = useParserState(2026);

  const lastParticipantsRun = runs.find(r => r.kind === "participants");
  const resultsRuns = runs.filter(r => r.kind === "results").slice(0, 10);

  if (loading) return <div className="p-4">Loading…</div>;
  if (error) return <div className="p-4 text-red-300">Error: {error}</div>;

  return (
    <div className="p-4 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
      <ParticipantsCard job={jobs.participants} recentRun={lastParticipantsRun} onRefresh={refresh} />
      <ResultsCard job={jobs.results} recentRuns={resultsRuns} onRefresh={refresh} />
      <FinalizeCard job={jobs.results} onRefresh={refresh} />
      <TestCard />
    </div>
  );
}
```

- [ ] **Step 11: Run tests**

```bash
npx vitest run src/admin/modules/parser
```

- [ ] **Step 12: Verify build**

```bash
npm run build
```

- [ ] **Step 13: Commit**

```bash
git add src/admin/modules/parser/ src/admin/modules/EurovisionParser.tsx
git commit -m "feat(parser): admin UI rewrite — 4 cards (Participants/Results/Finalize/Test)"
```

---

## Phase 4 — End-to-end smoke test

### Task 4: Verify against the live deployed stack

- [ ] **Step 1: Visit `/admin` in production, log in via OTP**

- [ ] **Step 2: Click **Test Participants** with empty URL**
  - Expected: ~26 rows from 2025 grand final (Sweden first), output rendered as table.

- [ ] **Step 3: Click **Test Results** with empty URL**
  - Expected: 26 ranked rows. If the regex doesn't match Basel-2025's table, log the discrepancy and tighten `parseResults.ts` selectors.

- [ ] **Step 4: Click **Run Now** on Participants**
  - Expected: state goes `idle → running → done`, 26 rows in `eurovision_2026_participants`. (NOTE: the page won't have 2026 participants until late April 2026; until then this will fail at "no participants extracted". That's expected before semi-2.)

- [ ] **Step 5: Click **Start** on Results**
  - Expected: state `idle → running`. Within 2 minutes, a `parse_runs` row appears (likely with `error: "no results rows"` since the show hasn't happened yet — that's fine, it confirms the pipeline runs).

- [ ] **Step 6: Click **Stop** then **Resume** then **Parse Now****
  - Verify state transitions in the pill.

- [ ] **Step 7: Click **Finalize Results 2026** → confirm**
  - Expected: state `finalized`. All buttons disabled. Polling cron will self-skip from this point on.

- [ ] **Step 8: Reset for the actual show**

```sql
-- in SQL editor, before the show — restore Results to idle
update parse_jobs set status='idle', poll_count=0, last_poll_at=null, started_at=null, stopped_at=null
  where year=2026 and kind='results';
```

- [ ] **Step 9: Open PR + merge**

```bash
git push -u origin feat/parser-redesign
gh pr create --title "feat(parser): split into participants + results + tests" --body "Implements docs/superpowers/specs/2026-04-30-parser-redesign-design.md"
```

---

## Risk register

| Risk | Mitigation |
|---|---|
| eurovision.com restructures the page between now and 16 May | Test parsers + regex-based extraction. Re-run Test buttons on the morning of, fix `parseResults.ts` if needed, redeploy edge function. |
| Cron `parser-results-2026-poll` keeps firing after Finalize because of the `*/2 * * * *` schedule | The cron body has `where status = 'running'` — `finalized` won't match, so `net.http_post` never runs. |
| 5-strike auto-error misfires from a transient eurovision.com 5xx | Admin sees `error` state, clicks `Reset → Start`. Cron won't auto-recover; deliberate so we don't spam during outages. |
| Migration 021 leaves orphan `eurovision_parse_schedule` rows in someone's local DB | `drop table if exists` is unconditional; no orphan possible. |
| Admin clicks Stop just before cron fires, race condition | Stop sets `status='stopped'` synchronously; cron WHERE clause re-checks status at fire time. Race window is sub-second. |
