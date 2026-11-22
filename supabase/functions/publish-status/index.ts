// Edge Function: publish-status (CMS P5, spec §6).
//
// POST, super-admin JWT only. Body { run_ids: number[] } (at most 10; or
// { run_id }). For each publish run with a commit, reads the Vercel build of
// that commit from GitHub (deployments, then commit statuses) and records it
// with set_deploy_state: building | ready (with the deployment URL; for a
// site-wide preview, the preview URL) | error. A failed main build is
// reverted automatically, only while main's head is still the run's commit;
// otherwise the run becomes revert_blocked and the admin shows the alert.
// The flow is checkRun in status.ts (unit-tested); this file only wires I/O.
//
// Response: { runs: [publish_runs row without shipped] } (200), 400 for a
// bad body, 403 forbidden, 500 { error }.
//
// Secrets: the ones publish-content has, GITHUB_TOKEN, GITHUB_REPO and
// GITHUB_BRANCH. The fine-grained token additionally needs read access to
// "Deployments" (and "Commit statuses" for the fallback); contents
// read/write is already granted (the revert commit).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { checkRun, type RunRow } from "./status.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? "tsokid/EurovisionParty";
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") ?? "main";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const serviceClient = () => createClient(SUPABASE_URL, SERVICE_KEY, noSession);
const userClient = (authorization: string) =>
  createClient(SUPABASE_URL, ANON_KEY, { ...noSession, global: { headers: { Authorization: authorization } } });

// Same check as publish-content: a valid user JWT whose user is in super_admins.
async function isSuperAdmin(authorization: string): Promise<boolean> {
  if (!authorization.startsWith("Bearer ")) return false;
  const { data: { user } } = await userClient(authorization).auth.getUser();
  if (!user) return false;
  const { data } = await serviceClient().from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
}

const COLUMNS = "id, status, target, commit_sha, finished_at, deploy_state, deploy_url, deploy_note, reverted_sha, doc_ids, started_at, files_changed, error, promoted_from, cms";

function runIds(body: unknown): number[] | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const raw = Array.isArray(b.run_ids) ? b.run_ids : b.run_id !== undefined ? [b.run_id] : null;
  if (!raw || raw.length === 0 || raw.length > 10) return null;
  return raw.every((n) => Number.isInteger(n) && (n as number) > 0) ? [...new Set(raw as number[])] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  try {
    if (!(await isSuperAdmin(authorization))) return jsonResponse({ error: "forbidden" }, 403);
    if (!GITHUB_TOKEN) return jsonResponse({ error: "GITHUB_TOKEN is not set" }, 500);
    const ids = runIds(await req.json().catch(() => null));
    if (!ids) return jsonResponse({ error: "run_ids must be 1 to 10 run ids" }, 400);

    const service = serviceClient();
    const { data, error } = await service.from("publish_runs").select(COLUMNS).in("id", ids);
    if (error) throw new Error(error.message);

    const github = { token: GITHUB_TOKEN, repo: GITHUB_REPO, branch: GITHUB_BRANCH, fetch };
    const runs: RunRow[] = [];
    for (const row of (data ?? []) as RunRow[]) {
      runs.push(await checkRun({
        github,
        async setDeployState({ id, state, url, revertedSha, note }) {
          const { data: next, error: e } = await service.rpc("set_deploy_state", {
            p_run_id: id, p_state: state, p_url: url, p_reverted_sha: revertedSha, p_note: note,
          });
          if (e) throw new Error(e.message);
          return next as RunRow;
        },
      }, { ...row, id: Number(row.id) }));
    }
    return jsonResponse({ runs });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
