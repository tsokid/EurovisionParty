// Edge Function: publish-content (spec §7).
//
// POST, super-admin JWT only. Snapshots the contest tables into content/**,
// writes each unpublished CMS draft (cms_documents) to
// content/pages/{doc_id}.json (skipped with body { cms: false }: the contest
// lifecycle auto-publish ships contests only),
// commits the media those drafts reference (Storage bucket cms-media) to
// public/media/<sha12>.<ext> with the references rewritten to /media/...,
// regenerates the archived-year redirects in vercel.json, and commits it all
// to GITHUB_BRANCH of GITHUB_REPO as one commit (Git Data API), with the
// commit's SEO intent appended to seo-intent.json for the build's SEO guard
// (_shared/cms/seoIntent.ts). Files are
// added or updated, never deleted. After a successful CMS publish the media
// rows are marked published and cms-media objects with no cms_media row,
// older than a day, are deleted from Storage.
//
// Per-doc publish (CMS P5, migration 086): the body may carry doc_ids (only
// those drafts, no contests), target: 'preview' (the site-wide docs, to the
// content-preview branch cut from main) or promote: <preview run id> (the
// preview commit's files onto main). See run.ts.
//
// Response: { status: 'ok' | 'noop' | 'error' | 'busy', sha, files_changed,
// run_id, error?, warnings? }. warnings: CMS validation advice per doc
// ({ doc_id, locale, path, message }), never blocking. A CMS validation
// error refuses the whole publish. 200 for ok/noop, 409 busy, 500 error,
// 403 forbidden.
//
// Secrets: GITHUB_TOKEN (fine-grained, contents read/write, this repo only),
// GITHUB_REPO (tsokid/EurovisionParty), GITHUB_BRANCH (main). Optional:
// GITHUB_PREVIEW_BRANCH (default content-preview).
//
// This file only wires I/O; the flow is runPublish in run.ts (unit-tested).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { commitChanges, commitFiles, listPaths, readFiles } from "./github.ts";
import { pagesFromFiles } from "./cmsFiles.ts";
import { publishOptions, runPublish, type PreviewRun, type PublishResult } from "./run.ts";
import { collectRegisteredPaths } from "./media.ts";
import type { SnapshotInput } from "./snapshot.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? "tsokid/EurovisionParty";
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") ?? "main";
const PREVIEW_BRANCH = Deno.env.get("GITHUB_PREVIEW_BRANCH") ?? "content-preview";

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

/**
 * Every cms_media.storage_path (service role; RLS has no policies), by
 * keyset pages; throws (so the sweep deletes nothing) unless the paths read
 * match the table's exact count.
 */
function registeredPaths(service: ReturnType<typeof serviceClient>) {
  return collectRegisteredPaths(async (after) => {
    let q = service.from("cms_media").select("storage_path", { count: "exact" });
    if (after !== null) q = q.gt("storage_path", after);
    const { data, error, count } = await q.order("storage_path").limit(PAGE);
    if (error) throw new Error(`cms_media: ${error.message}`);
    return { paths: (data ?? []).map((r) => r.storage_path as string), count };
  });
}

const HTTP_STATUS: Record<PublishResult["status"], number> = { ok: 200, noop: 200, busy: 409, error: 500 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  try {
    if (!(await isSuperAdmin(authorization))) return jsonResponse({ error: "forbidden" }, 403);
    if (!GITHUB_TOKEN) return jsonResponse({ status: "error", error: "GITHUB_TOKEN is not set" }, 500);

    let options;
    try {
      options = publishOptions(await req.json().catch(() => null));
    } catch (e) {
      return jsonResponse({ status: "error", error: e instanceof Error ? e.message : String(e) }, 400);
    }
    const user = userClient(authorization);
    const service = serviceClient();
    const github = { token: GITHUB_TOKEN, repo: GITHUB_REPO, branch: GITHUB_BRANCH, fetch };

    const result = await runPublish({
      rpc: {
        async beginPublish(cms, scope) {
          const { data, error } = await user.rpc("begin_publish", {
            p_cms: cms,
            p_doc_ids: scope?.docIds ?? null,
            p_target: scope?.target ?? "main",
            p_promote: scope?.promote ?? null,
          });
          if (error) throw new Error(error.message);
          return Number(data);
        },
        async publishInput(filter) {
          const { data, error } = await service.rpc("publish_input", {
            p_doc_ids: filter?.docIds ?? null,
            p_skip_site_wide: filter?.skipSiteWide ?? false,
          });
          if (error) throw new Error(error.message);
          return data as SnapshotInput;
        },
        async endPublish({ id, status, sha, files, error: runError, shipped }) {
          const { error } = await service.rpc("end_publish", {
            p_id: id, p_status: status, p_sha: sha, p_files: files, p_error: runError, p_shipped: shipped ?? null,
          });
          if (error) throw new Error(error.message);
        },
        async stillRunning(id) {
          const { data, error } = await service.from("publish_runs").select("status").eq("id", id).maybeSingle();
          if (error) throw new Error(error.message);
          return data?.status === "running";
        },
        async previewRun(id) {
          const { data, error } = await service
            .from("publish_runs").select("id, commit_sha, doc_ids, shipped").eq("id", id).single();
          if (error || !data?.commit_sha) throw new Error(error?.message ?? `run ${id} has no commit`);
          return { id: Number(data.id), commit_sha: data.commit_sha, doc_ids: data.doc_ids ?? [], shipped: data.shipped ?? [] } as PreviewRun;
        },
      },
      commitChanges: (sha) => commitChanges({ ...github, sha, textOf: (path) => /^content\/pages\/[a-z0-9-]+\.json$/.test(path) }),
      readCommittedPages: async () =>
        pagesFromFiles(await readFiles({ ...github, match: (path) => path.startsWith("content/pages/") })),
      commitFiles: (files, message, transforms, limits, derived, extra) => commitFiles({
        ...github,
        ...(extra?.target === "preview" ? { branch: PREVIEW_BRANCH, base: GITHUB_BRANCH } : {}),
        files, message, transforms, derived, blobs: extra?.blobs, guard: extra?.guard, ...limits,
      }),
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
        publishedPaths: () => listPaths({ ...github, match: (path) => path.startsWith("public/media/") }),
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
