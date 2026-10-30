// supabase/functions/eurovision-parse/index.ts
// Action-routed edge function. Replaces the polled-jobs design from 020.
//
// Actions:
//   participants            production participants parser (one-off, gated by job state)
//   results                 production results parser (poll, gated by job state)
//   test-participants-2025  ephemeral test (auth required, no DB write)
//   test-results-2025       ephemeral test (auth required, no DB write)
//   semis                   semi-final results of { year } (super-admin JWT only)
//
// Auth:
//   - Cron calls present `Authorization: Bearer <SERVICE_ROLE_KEY>`.
//   - Admin UI calls present a user JWT; we verify via super_admins membership.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import {
  fetchHtml,
  fetchParticipants,
  type ParsedEntry,
} from "./parse.ts";
import { parseResults, type ResultRow } from "./parseResults.ts";
import { participantRows, resultRows, semiRows, type SemiEntryRow } from "./rows.ts";
import { parseSemis, semiProblem, semiUrl } from "./parseSemis.ts";

// Every write to contest_entries goes through the parser_upsert_entries
// RPC (migration 071, section C): it sets app.writer = 'parser' for its
// transaction, so finalized and archived years are refused, and it never
// deletes rows. Value of contest_entries.source for parser writes.
const ENTRY_SOURCE = "parser";

const TEST_URL_2025 =
  "https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-grand-final/";

const ERROR_STREAK_FOR_AUTO_ERROR = 5;

type Action =
  | "participants"
  | "results"
  | "test-participants-2025"
  | "test-results-2025"
  | "semis";

interface RequestBody {
  action: Action;
  override_url?: string;
  /** semis: the contest year. */
  year?: number;
  /** semis: page HTML pasted by the admin when eurovision.com blocks our fetch. Checked to be strings. */
  html_sf1?: unknown;
  html_sf2?: unknown;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Custom shared secret used by the parser-tick cron. Set via Supabase
// Dashboard → Edge Functions → eurovision-parse → Secrets, mirrored in
// Postgres vault under name 'parser_cron_secret'. We added this because
// SUPABASE_SERVICE_ROLE_KEY auto-injection drifted from the dashboard
// value in this project, leaving cron calls permanently 403.
const CRON_SECRET = Deno.env.get("PARSER_CRON_SECRET") ?? "";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
// "service": the cron (service role key or PARSER_CRON_SECRET).
// "admin": a super-admin user JWT. null: anyone else.
async function callerKind(req: Request): Promise<"service" | "admin" | null> {
  const auth = req.headers.get("Authorization") ?? "";
  // Cron path 1: legacy — service role key (only works while
  // SUPABASE_SERVICE_ROLE_KEY env matches what the cron sends)
  if (auth === `Bearer ${SERVICE_KEY}`) return "service";
  // Cron path 2: custom shared secret (PARSER_CRON_SECRET). This is the
  // path actually used by parser-tick from migration 046 onward.
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return "service";
  if (!auth.startsWith("Bearer ")) return null;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data } = await admin()
    .from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? "admin" : null;
}

// ---------------------------------------------------------------------------
// CORS — admin UI calls from https://eurovision.games (or localhost dev)
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

// ---------------------------------------------------------------------------
// Production handlers
// ---------------------------------------------------------------------------
function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

async function logRun(args: {
  year: number;
  kind: "participants" | "results";
  httpStatus: number | null;
  status: "ok" | "error" | "blocked";
  rowsUpserted: number;
  payloadHash: string | null;
  error: string | null;
}) {
  await admin().from("parse_runs").insert({
    year: args.year,
    kind: args.kind,
    http_status: args.httpStatus,
    status: args.status,
    rows_upserted: args.rowsUpserted,
    payload_hash: args.payloadHash,
    error: args.error,
    finished_at: new Date().toISOString(),
  });
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function autoErrorIfStreak(year: number, kind: "participants" | "results") {
  const { data } = await admin()
    .from("parse_runs")
    .select("status")
    .eq("year", year).eq("kind", kind)
    .order("finished_at", { ascending: false })
    .limit(ERROR_STREAK_FOR_AUTO_ERROR);
  if (!data || data.length < ERROR_STREAK_FOR_AUTO_ERROR) return;
  if (data.every((r) => r.status === "error")) {
    await admin().from("parse_jobs")
      .update({ status: "error" })
      .eq("year", year).eq("kind", kind);
  }
}

async function handleParticipants(): Promise<Response> {
  const db = admin();

  // 1. Gate on job state + read source_url. No hardcoded year — find whichever
  //    participants job is currently running (there should only ever be one).
  const { data: job } = await db.from("parse_jobs")
    .select("year, status, source_url")
    .eq("kind", "participants")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  if (!job) return jsonResponse({ error: "no running participants job" }, 409);

  const year = job.year as number;
  const sourceUrl = (job.source_url as string | null) ?? null;

  // 2. Fetch + extract from eurovision.com only — no Wikipedia fallback.
  // We want the Grand Final lineup as it stands on the official page,
  // not the full announced-contestant list Wikipedia keeps. source_url
  // is required: there is no hardcoded fallback URL any more.
  let entries: ParsedEntry[] = [];
  let httpStatus = 0;
  let source: "eurovision" = "eurovision";
  let runStatus: "ok" | "error" | "blocked" = "ok";
  let err: string | null = null;
  let payloadHash: string | null = null;

  if (!sourceUrl) {
    runStatus = "error";
    err = `no source_url for year ${year}`;
  } else {
    try {
      const result = await fetchParticipants(sourceUrl);
      entries = result.entries;
      httpStatus = result.httpStatus;
      source = result.source;
      payloadHash = await sha256(JSON.stringify(entries));
      if (entries.length === 0) {
        runStatus = "blocked";
        err = `no participants extracted from ${sourceUrl} (http ${httpStatus})`;
      }
    } catch (e) {
      runStatus = "error";
      err = e instanceof Error ? e.message : String(e);
    }
  }

  // 3. Write the lineup (only on ok) into contest_entries through
  // parser_upsert_entries, upserting on (year, iso). Countries that were
  // in the year's lineup but are missing from this parse keep their rows
  // with in_final = false; nothing is deleted. Country names
  // are not written (they live in countries). The RPC raises on an
  // unknown ISO or a finalized/archived year, which becomes an error run.
  let rowsUpserted = 0;
  if (runStatus === "ok") {
    const rows = participantRows(year, entries, ENTRY_SOURCE);
    const { data: n, error: upErr } = await db.rpc("parser_upsert_entries", {
      p_year: year, p_rows: rows, p_kind: "participants",
    });
    if (upErr) {
      runStatus = "error";
      err = upErr.message;
    } else {
      rowsUpserted = (n as number | null) ?? rows.length;
    }
  }

  // 4. Transition job status. done on ok, error on blocked/error (participants
  //    is one-shot — leaving it "running" after the edge fn exits is a
  //    stuck state the cron can't recover from).
  const nowIso = new Date().toISOString();
  if (runStatus === "ok") {
    await db.from("parse_jobs")
      .update({ status: "done", last_poll_at: nowIso, poll_count: 1 })
      .eq("year", year).eq("kind", "participants");
  } else {
    await db.from("parse_jobs")
      .update({ status: "error", last_poll_at: nowIso })
      .eq("year", year).eq("kind", "participants");
  }

  await logRun({
    year, kind: "participants",
    httpStatus, status: runStatus, rowsUpserted,
    payloadHash, error: err,
  });

  await autoErrorIfStreak(year, "participants");

  return jsonResponse(
    { ok: runStatus === "ok", rows: rowsUpserted, source, error: err },
    runStatus === "ok" ? 200 : 502,
  );
}

async function handleResults(): Promise<Response> {
  const db = admin();

  // 1. Gate on job state + manual override flag, read source_url.
  //    No hardcoded year — find whichever results job is currently running.
  const { data: job } = await db.from("parse_jobs")
    .select("year, status, manual_override, source_url")
    .eq("kind", "results")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  if (!job) return jsonResponse({ error: "no running results job" }, 409);
  if (job.manual_override) {
    return jsonResponse({ error: "manual override active", state: job.status }, 409);
  }

  const year = job.year as number;
  const sourceUrl = (job.source_url as string | null) ?? null;

  let rows: ResultRow[] = [];
  let httpStatus = 0;
  let runStatus: "ok" | "error" | "blocked" = "ok";
  let err: string | null = null;
  let payloadHash: string | null = null;

  // 2. Fetch + extract. source_url is required (no hardcoded fallback).
  if (!sourceUrl) {
    runStatus = "error";
    err = `no source_url for year ${year}`;
  } else {
    try {
      const fetched = await fetchHtml(sourceUrl);
      httpStatus = fetched.httpStatus;
      if (httpStatus !== 200) {
        runStatus = "error";
        err = `http ${httpStatus}`;
      } else {
        rows = parseResults(fetched.html, sourceUrl);
        payloadHash = await sha256(JSON.stringify(rows));
        if (rows.length === 0) {
          runStatus = "blocked";
          err = "no scoreboard rows extracted (results not yet published?)";
        }
      }
    } catch (e) {
      runStatus = "error";
      err = e instanceof Error ? e.message : String(e);
    }
  }

  // 3. Write results into contest_entries through parser_upsert_entries,
  //    only for the year's grand finalists (in_final; the running order
  //    is not parsed). Filtering here keeps a prior-year or wrong page from sending
  //    ISOs outside the lineup; the RPC applies the same finalist filter.
  let rowsUpserted = 0;
  if (runStatus === "ok") {
    const { data: fData, error: fErr } = await db
      .from("contest_entries")
      .select("iso")
      .eq("year", year)
      .eq("in_final", true);
    if (fErr) {
      runStatus = "error";
      err = fErr.message;
    } else {
      const finalists = new Set<string>((fData ?? []).map((f: { iso: string }) => f.iso));
      const records = resultRows(
        year,
        rows
          .filter((r) => finalists.has(r.iso))
          .map((r) => ({
            iso: r.iso,
            ranking: r.ranking,
            total: r.total_points,
            jury: r.jury_points,
            televote: r.televote_points,
          })),
        ENTRY_SOURCE,
      );
      const { data: n, error: upErr } = await db.rpc("parser_upsert_entries", {
        p_year: year, p_rows: records, p_kind: "results",
      });
      if (upErr) {
        runStatus = "error";
        err = upErr.message;
      } else {
        rowsUpserted = (n as number | null) ?? records.length;
      }
    }
  }

  // 4. Increment poll count regardless of ok|blocked|error (a poll happened)
  await db.rpc("increment_poll_count", { p_year: year, p_kind: "results" });

  await logRun({
    year, kind: "results",
    httpStatus, status: runStatus, rowsUpserted,
    payloadHash, error: err,
  });

  if (runStatus === "error") await autoErrorIfStreak(year, "results");

  return jsonResponse(
    { ok: runStatus === "ok", rows: rowsUpserted, error: err },
    runStatus === "ok" ? 200 : (runStatus === "blocked" ? 200 : 502),
  );
}

// ---------------------------------------------------------------------------
// Semi-finals (admin button in the Contests entries editor)
//
// Fetches both semi-final pages of `year` (URLs derived from
// contests.city_slug) and writes semi, semi_running_order, semi_place,
// semi_points and qualified through parser_upsert_entries kind 'semis',
// filling a null artist/song and inserting countries that have no row yet.
// Allowed for stages current and finalized (the RPC and its guard refuse
// the others too). eurovision.com sits behind Cloudflare and may refuse our
// fetch, so the admin can paste the pages instead: when html_sf1 or
// html_sf2 is given, only the given pages are parsed and nothing is
// fetched. In fetch mode a non-200 for semi-final 2 (not held or not
// published yet) still writes semi-final 1 and reports sf2: 'not available';
// a failure on semi-final 1 is an error. Every parsed page must pass
// semiProblem() (complete results) before anything is written. Not logged
// in parse_runs (its kinds are participants and results).
// ---------------------------------------------------------------------------
async function handleSemis(body: RequestBody): Promise<Response> {
  const year = body.year;
  if (typeof year !== "number" || !Number.isInteger(year)) {
    return jsonResponse({ ok: false, error: "semis needs an integer year" }, 400);
  }
  for (const key of ["html_sf1", "html_sf2"] as const) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== "string") {
      return jsonResponse({ ok: false, error: `${key} must be a string` }, 400);
    }
  }
  const db = admin();
  const { data: contest, error: cErr } = await db.from("contests")
    .select("stage, city_slug").eq("year", year).maybeSingle();
  if (cErr) return jsonResponse({ ok: false, error: cErr.message }, 500);
  if (!contest) return jsonResponse({ ok: false, error: `contest ${year} not found` }, 404);
  if (contest.stage !== "current" && contest.stage !== "finalized") {
    return jsonResponse({ ok: false, error: `contest ${year} is ${contest.stage}; semis need current or finalized` }, 409);
  }

  const asHtml = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const pasted: Record<1 | 2, string | undefined> = { 1: asHtml(body.html_sf1), 2: asHtml(body.html_sf2) };
  const usePasted = !!(pasted[1] || pasted[2]);

  const rows: SemiEntryRow[] = [];
  const counts: Record<string, number | "not available"> = {};
  for (const semi of [1, 2] as const) {
    let html = pasted[semi];
    if (usePasted && !html) continue;
    if (!html) {
      const url = semiUrl(contest.city_slug as string, year, semi);
      try {
        const fetched = await fetchHtml(url);
        if (fetched.httpStatus !== 200) {
          if (semi === 2) {
            counts.sf2 = "not available";
            continue;
          }
          return jsonResponse({
            ok: false,
            error: `semi-final ${semi}: http ${fetched.httpStatus} from ${url}; paste the page HTML instead`,
          }, 502);
        }
        html = fetched.html;
      } catch (e) {
        return jsonResponse({ ok: false, error: `semi-final ${semi}: ${e instanceof Error ? e.message : String(e)}` }, 502);
      }
    }
    let parsed;
    try {
      parsed = parseSemis(html);
    } catch (e) {
      return jsonResponse({ ok: false, error: `semi-final ${semi}: ${e instanceof Error ? e.message : String(e)}` }, 422);
    }
    const problem = semiProblem(parsed);
    if (problem) {
      return jsonResponse({ ok: false, error: `semi-final ${semi}: ${problem}; nothing written` }, 422);
    }
    counts[`sf${semi}`] = parsed.length;
    rows.push(...semiRows(year, semi, parsed, ENTRY_SOURCE));
  }

  const { data: n, error: upErr } = await db.rpc("parser_upsert_entries", {
    p_year: year, p_rows: rows, p_kind: "semis",
  });
  if (upErr) return jsonResponse({ ok: false, error: upErr.message }, 502);
  return jsonResponse({ ok: true, rows: (n as number | null) ?? rows.length, ...counts });
}

// ---------------------------------------------------------------------------
// Test handlers (no DB writes)
//
// CONTRACT: Test handlers MUST call the exact same extractor functions
// that production handlers call. This is what guarantees a fix to
// parse.ts / parseResults.ts (e.g. the youtube.com/watch + youtu.be fix,
// the linear-scan anti-backtracking rewrite) automatically applies to
// both Test buttons in /admin AND the cron-driven production runs.
//
// Specifically:
//   - handleTestParticipants → fetchParticipants() ← same as handleParticipants
//   - handleTestResults      → parseResults()      ← same as handleResults
//
// Do not duplicate extractor logic here.
// ---------------------------------------------------------------------------
async function handleTestParticipants(overrideUrl?: string): Promise<Response> {
  const url = overrideUrl?.trim() || TEST_URL_2025;
  try {
    // Same extractor as production handleParticipants — eurovision.com only.
    const result = await fetchParticipants(url);
    return jsonResponse({
      url,
      source: result.source,
      http_status: result.httpStatus,
      rows: result.entries,
      count: result.entries.length,
    });
  } catch (e) {
    return jsonResponse({
      url,
      error: e instanceof Error ? e.message : String(e),
    }, 502);
  }
}

async function handleTestResults(overrideUrl?: string): Promise<Response> {
  const url = overrideUrl?.trim() || TEST_URL_2025;
  try {
    const fetched = await fetchHtml(url);
    if (fetched.httpStatus !== 200) {
      return jsonResponse({ url, error: `http ${fetched.httpStatus}` }, 502);
    }
    // Same extractor as production handleResults
    const rows = parseResults(fetched.html, url);
    return jsonResponse({
      url,
      http_status: fetched.httpStatus,
      rows,
      count: rows.length,
    });
  } catch (e) {
    return jsonResponse({
      url,
      error: e instanceof Error ? e.message : String(e),
    }, 502);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  // CORS preflight (admin UI calls this from the browser via supabase-js)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
      },
    });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }
  const caller = await callerKind(req);
  if (!caller) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "bad json" }, 400);
  }
  if (!body || typeof body.action !== "string") {
    return jsonResponse({ error: "missing action" }, 400);
  }

  switch (body.action) {
    case "participants":           return await handleParticipants();
    case "results":                return await handleResults();
    case "test-participants-2025": return await handleTestParticipants(body.override_url);
    case "test-results-2025":      return await handleTestResults(body.override_url);
    case "semis":
      // Admin-initiated only: the cron never parses semis.
      if (caller !== "admin") return jsonResponse({ error: "forbidden" }, 403);
      return await handleSemis(body);
    default:
      return jsonResponse({ error: `unknown action: ${body.action}` }, 400);
  }
});
