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

  // 1. Gate on job state
  const { data: job } = await db.from("parse_jobs")
    .select("status").eq("year", 2026).eq("kind", "participants").single();
  if (!job) return jsonResponse({ error: "no participants job" }, 500);
  if (job.status !== "running") {
    return jsonResponse({ error: "job not running", state: job.status }, 409);
  }

  // 2. Fetch + extract (with Wikipedia fallback inside fetchParticipants)
  let entries: ParsedEntry[] = [];
  let httpStatus = 0;
  let source: "eurovision" | "wikipedia" = "eurovision";
  let runStatus: "ok" | "error" | "blocked" = "ok";
  let err: string | null = null;
  let payloadHash: string | null = null;

  try {
    const result = await fetchParticipants(PROD_URL_2026);
    entries = result.entries;
    httpStatus = result.httpStatus;
    source = result.source;
    payloadHash = await sha256(JSON.stringify(entries));
    if (entries.length === 0) {
      runStatus = "blocked";
      err = "no participants extracted from primary or wikipedia";
    }
  } catch (e) {
    runStatus = "error";
    err = e instanceof Error ? e.message : String(e);
  }

  // 3. Upsert (only on ok)
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
    }
  }

  // 4. Transition job to done on success, leave running on blocked, leave for streak on error
  if (runStatus === "ok") {
    await db.from("parse_jobs")
      .update({
        status: "done",
        last_poll_at: new Date().toISOString(),
        poll_count: 1,
      })
      .eq("year", 2026).eq("kind", "participants");
  }

  await logRun({
    year: 2026, kind: "participants",
    httpStatus, status: runStatus, rowsUpserted,
    payloadHash, error: err,
  });

  if (runStatus === "error") await autoErrorIfStreak(2026, "participants");

  return jsonResponse(
    { ok: runStatus === "ok", rows: rowsUpserted, source, error: err },
    runStatus === "ok" ? 200 : 502,
  );
}

async function handleResults(): Promise<Response> {
  const db = admin();

  // 1. Gate on job state + manual override flag
  const { data: job } = await db.from("parse_jobs")
    .select("status, manual_override").eq("year", 2026).eq("kind", "results").single();
  if (!job) return jsonResponse({ error: "no results job" }, 500);
  if (job.manual_override) {
    return jsonResponse({ error: "manual override active", state: job.status }, 409);
  }
  if (job.status !== "running") {
    return jsonResponse({ error: "job not running", state: job.status }, 409);
  }

  let rows: ResultRow[] = [];
  let httpStatus = 0;
  let runStatus: "ok" | "error" | "blocked" = "ok";
  let err: string | null = null;
  let payloadHash: string | null = null;

  // 2. Fetch + extract
  try {
    const fetched = await fetchHtml(PROD_URL_2026);
    httpStatus = fetched.httpStatus;
    if (httpStatus !== 200) {
      runStatus = "error";
      err = `http ${httpStatus}`;
    } else {
      rows = parseResults(fetched.html, PROD_URL_2026);
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
  await db.rpc("increment_poll_count", { p_year: 2026, p_kind: "results" });

  await logRun({
    year: 2026, kind: "results",
    httpStatus, status: runStatus, rowsUpserted,
    payloadHash, error: err,
  });

  if (runStatus === "error") await autoErrorIfStreak(2026, "results");

  return jsonResponse(
    { ok: runStatus === "ok", rows: rowsUpserted, error: err },
    runStatus === "ok" ? 200 : (runStatus === "blocked" ? 200 : 502),
  );
}

// ---------------------------------------------------------------------------
// Test handlers (no DB writes)
// ---------------------------------------------------------------------------
async function handleTestParticipants(overrideUrl?: string): Promise<Response> {
  const url = overrideUrl?.trim() || TEST_URL_2025;
  try {
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
