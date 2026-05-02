// supabase/functions/eurovision-parse/index.ts
// Action-routed edge function. Replaces the polled-jobs design from 020.
//
// Actions:
//   participants            production participants parser (one-off, gated by job state)
//   results                 production results parser (poll, gated by job state)
//   test-participants-2025  ephemeral test (auth required, no DB write)
//   test-results-2025       ephemeral test (auth required, no DB write)
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

const PROD_URL_2026 =
  "https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/";
const TEST_URL_2025 =
  "https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-grand-final/";

const ERROR_STREAK_FOR_AUTO_ERROR = 5;

type Action =
  | "participants"
  | "results"
  | "test-participants-2025"
  | "test-results-2025";

interface RequestBody {
  action: Action;
  override_url?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function isCallerSuperAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (auth === `Bearer ${SERVICE_KEY}`) return true; // cron path
  if (!auth.startsWith("Bearer ")) return false;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;
  const { data } = await admin()
    .from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
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
  const sourceUrl = job.source_url ?? PROD_URL_2026;

  // 2. Fetch + extract from eurovision.com only — no Wikipedia fallback.
  // We want the Grand Final lineup as it stands on the official page,
  // not the full announced-contestant list Wikipedia keeps.
  let entries: ParsedEntry[] = [];
  let httpStatus = 0;
  let source: "eurovision" = "eurovision";
  let runStatus: "ok" | "error" | "blocked" = "ok";
  let err: string | null = null;
  let payloadHash: string | null = null;

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

  // 3. Replace the set (only on ok). Upsert + delete-missing so a
  // shrunk lineup (e.g. switching from a polluted Wikipedia run with
  // 37 rows to a real eurovision.com run with 26) doesn't leave stale
  // rows behind.
  let rowsUpserted = 0;
  if (runStatus === "ok") {
    const nowIso = new Date().toISOString();
    const rows = entries.map((e) => ({
      iso: e.iso, name: e.name, artist: e.artist, song: e.song,
      running_order: e.runningOrder, source, updated_at: nowIso,
    }));
    const { error: upErr, count } = await db
      .from("eurovision_2026_participants")
      .upsert(rows, { onConflict: "iso", count: "exact" });
    if (upErr) {
      runStatus = "error";
      err = upErr.message;
    } else {
      rowsUpserted = count ?? rows.length;
      // Drop any country that was in the table but is no longer in the
      // current parsed lineup. Keeps the table in sync with whatever
      // eurovision.com currently shows for the Grand Final.
      const keepIsos = rows.map((r) => r.iso);
      if (keepIsos.length > 0) {
        await db.from("eurovision_2026_participants")
          .delete()
          .not("iso", "in", `(${keepIsos.map((i) => `"${i}"`).join(",")})`);
      }
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
  const sourceUrl = job.source_url ?? PROD_URL_2026;

  let rows: ResultRow[] = [];
  let httpStatus = 0;
  let runStatus: "ok" | "error" | "blocked" = "ok";
  let err: string | null = null;
  let payloadHash: string | null = null;

  // 2. Fetch + extract
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

  // 3. Upsert
  let rowsUpserted = 0;
  if (runStatus === "ok") {
    const nowIso = new Date().toISOString();
    const records = rows.map((r) => ({
      iso: r.iso,
      ranking: r.ranking,
      total_points: r.total_points,
      jury_points: r.jury_points,
      televote_points: r.televote_points,
      source: r.source,
      updated_at: nowIso,
    }));
    const { error: upErr, count } = await db
      .from("eurovision_2026_results")
      .upsert(records, { onConflict: "iso", count: "exact" });
    if (upErr) {
      runStatus = "error";
      err = upErr.message;
    } else {
      rowsUpserted = count ?? records.length;
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
  if (!await isCallerSuperAdmin(req)) {
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
    default:
      return jsonResponse({ error: `unknown action: ${body.action}` }, 400);
  }
});
