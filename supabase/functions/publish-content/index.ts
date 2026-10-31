// Edge Function: publish-content (spec §7).
//
// POST, super-admin JWT only. Snapshots the contest tables into content/**,
// writes each unpublished CMS draft (cms_documents) to
// content/pages/{doc_id}.json (skipped with body { cms: false }: the contest
// lifecycle auto-publish ships contests only),
// commits the media those drafts reference (Storage bucket cms-media) to
// public/media/<sha12>.<ext> with the references rewritten to /media/...,
// regenerates the archived-year redirects in vercel.json, and commits it all
// to GITHUB_BRANCH of GITHUB_REPO as one commit (Git Data API). Files are
// added or updated, never deleted. After a successful CMS publish the media
// rows are marked published and cms-media objects with no cms_media row,
// older than a day, are deleted from Storage.
//
// Response: { status: 'ok' | 'noop' | 'error' | 'busy', sha, files_changed,
// run_id, error?, warnings? }. warnings: CMS validation advice per doc
// ({ doc_id, locale, path, message }), never blocking. A CMS validation
// error refuses the whole publish. 200 for ok/noop, 409 busy, 500 error,
// 403 forbidden.
//
// Secrets: GITHUB_TOKEN (fine-grained, contents read/write, this repo only),
// GITHUB_REPO (tsokid/EurovisionParty), GITHUB_BRANCH (main).
//
// This file only wires I/O; the flow is runPublish in run.ts (unit-tested).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { commitFiles, readFiles } from "./github.ts";
import { pagesFromFiles } from "./cmsFiles.ts";
import { publishOptions, runPublish, type PublishResult } from "./run.ts";
import type { SnapshotInput } from "./snapshot.ts";

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
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, noSession);
}

function userClient(authorization: string) {
  return createClient(SUPABASE_URL, ANON_KEY, { ...noSession, global: { headers: { Authorization: authorization } } });
}

// Same check as eurovision-parse: a valid user JWT whose user is in super_admins.
async function isSuperAdmin(authorization: string): Promise<boolean> {
  if (!authorization.startsWith("Bearer ")) return false;
  const { data: { user } } = await userClient(authorization).auth.getUser();
  if (!user) return false;
  const { data } = await serviceClient()
    .from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
}

const BUCKET = "cms-media";
/** Page size of the Storage listing and of the cms_media read. */
const PAGE = 1000;

/** Every file object of the cms-media bucket (its root: uploads are not in folders). */
async function listBucket(service: ReturnType<typeof serviceClient>) {
  const out: Array<{ name: string; created_at: string | null }> = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await service.storage.from(BUCKET).list("", { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`storage list: ${error.message}`);
    // A folder entry has no id.
    for (const o of data ?? []) if (o.id) out.push({ name: o.name, created_at: o.created_at ?? null });
    if (!data || data.length < PAGE) return out;
  }
}

/** Every cms_media.storage_path (service role; RLS has no policies). */
async function registeredPaths(service: ReturnType<typeof serviceClient>) {
  const out: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service.from("cms_media").select("storage_path").order("storage_path").range(from, from + PAGE - 1);
    if (error) throw new Error(`cms_media: ${error.message}`);
    for (const r of data ?? []) out.push(r.storage_path as string);
    if (!data || data.length < PAGE) return out;
  }
}

const HTTP_STATUS: Record<PublishResult["status"], number> = { ok: 200, noop: 200, busy: 409, error: 500 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  try {
    if (!(await isSuperAdmin(authorization))) return jsonResponse({ error: "forbidden" }, 403);
    if (!GITHUB_TOKEN) return jsonResponse({ status: "error", error: "GITHUB_TOKEN is not set" }, 500);

    const options = publishOptions(await req.json().catch(() => null));
    const user = userClient(authorization);
    const service = serviceClient();
    const github = { token: GITHUB_TOKEN, repo: GITHUB_REPO, branch: GITHUB_BRANCH, fetch };

    const result = await runPublish({
      rpc: {
        async beginPublish(cms) {
          const { data, error } = await user.rpc("begin_publish", { p_cms: cms });
          if (error) throw new Error(error.message);
          return Number(data);
        },
        async publishInput() {
          const { data, error } = await service.rpc("publish_input");
          if (error) throw new Error(error.message);
          return data as SnapshotInput;
        },
        async endPublish({ id, status, sha, files, error: runError }) {
          const { error } = await service.rpc("end_publish", {
            p_id: id, p_status: status, p_sha: sha, p_files: files, p_error: runError,
          });
          if (error) throw new Error(error.message);
        },
      },
      readCommittedPages: async () =>
        pagesFromFiles(await readFiles({ ...github, match: (path) => path.startsWith("content/pages/") })),
      commitFiles: (files, message, transforms, limits) => commitFiles({ ...github, files, message, transforms, ...limits }),
      media: {
        async download(storagePath) {
          const { data, error } = await service.storage.from(BUCKET).download(storagePath);
          if (error || !data) throw new Error(error?.message ?? "no data");
          return new Uint8Array(await data.arrayBuffer());
        },
        async markPublished(id, path) {
          const { error } = await service.rpc("media_mark_published", { p_id: id, p_path: path });
          if (error) throw new Error(error.message);
        },
        listObjects: () => listBucket(service),
        registeredPaths: () => registeredPaths(service),
        async removeObjects(names) {
          const { error } = await service.storage.from(BUCKET).remove(names);
          if (error) throw new Error(`storage remove: ${error.message}`);
        },
      },
    }, options);
    return jsonResponse(result, HTTP_STATUS[result.status]);
  } catch (e) {
    return jsonResponse({ status: "error", error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
