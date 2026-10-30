// GitHub Git Data API: commit a set of files to a branch as one commit.
//
// Deno-free: fetch is injected, hashing uses Web Crypto (crypto.subtle),
// which Deno and Node both provide. Imported by the publish-content edge
// function and by vitest.
//
// Files are only added or updated, never deleted.

type Fetch = typeof fetch;

export const GITHUB_API = 'https://api.github.com';

type GitHubOpts = {
  token: string;
  /** owner/name, e.g. tsokid/EurovisionParty. */
  repo: string;
  branch: string;
  fetch: Fetch;
  /** Defaults to https://api.github.com. */
  apiBase?: string;
};

export type CommitFilesOpts = GitHubOpts & {
  /** Repo path → UTF-8 file text. */
  files: Record<string, string>;
  /** Commit message, or a function of the changed paths (sorted). */
  message: string | ((changedPaths: string[]) => string);
};

export type CommitResult = {
  /** The new commit, or null when nothing changed. */
  sha: string | null;
  changed: number;
  /** Changed paths, sorted. */
  paths: string[];
};

/** git's blob id: sha1("blob <byte length>\0" + content), over UTF-8 bytes. */
export async function gitBlobSha(content: string): Promise<string> {
  const body = new TextEncoder().encode(content);
  const header = new TextEncoder().encode(`blob ${body.byteLength}\0`);
  const bytes = new Uint8Array(header.byteLength + body.byteLength);
  bytes.set(header, 0);
  bytes.set(body, header.byteLength);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function client(opts: GitHubOpts) {
  const base = opts.apiBase ?? GITHUB_API;
  return async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await opts.fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // non-JSON error body; reported below as text
    }
    if (!res.ok) {
      const msg = (json as { message?: string } | undefined)?.message ?? (text.slice(0, 200) || res.statusText);
      throw new Error(`GitHub ${res.status} ${method} ${path}: ${msg}`);
    }
    return json as T;
  };
}

const enc = encodeURIComponent;

type TreeEntry = { path: string; mode: string; type: string; sha: string };

export async function commitFiles(opts: CommitFilesOpts): Promise<CommitResult> {
  const call = client(opts);
  const repo = `/repos/${opts.repo}`;
  const refPath = `heads/${opts.branch}`;

  const ref = await call<{ object: { sha: string } }>('GET', `${repo}/git/ref/${refPath}`);
  const parent = ref.object.sha;
  const commit = await call<{ tree: { sha: string } }>('GET', `${repo}/git/commits/${parent}`);
  const baseTree = commit.tree.sha;
  const tree = await call<{ truncated: boolean; tree: TreeEntry[] }>(
    'GET',
    `${repo}/git/trees/${baseTree}?recursive=1`,
  );
  if (tree.truncated) {
    throw new Error(`GitHub tree ${baseTree} is truncated; cannot compare files`);
  }
  const existing = new Map(tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e]));

  const changed: Array<{ path: string; content: string; mode: string }> = [];
  for (const path of Object.keys(opts.files).sort()) {
    const content = opts.files[path];
    const prev = existing.get(path);
    if (prev && prev.sha === (await gitBlobSha(content))) continue;
    changed.push({ path, content, mode: prev?.mode ?? '100644' });
  }
  if (changed.length === 0) return { sha: null, changed: 0, paths: [] };

  const entries: TreeEntry[] = [];
  for (const f of changed) {
    const blob = await call<{ sha: string }>('POST', `${repo}/git/blobs`, { content: f.content, encoding: 'utf-8' });
    entries.push({ path: f.path, mode: f.mode, type: 'blob', sha: blob.sha });
  }
  const newTree = await call<{ sha: string }>('POST', `${repo}/git/trees`, { base_tree: baseTree, tree: entries });
  // An identical tree means there is nothing to commit.
  if (newTree.sha === baseTree) return { sha: null, changed: 0, paths: [] };

  const paths = changed.map((f) => f.path);
  const message = typeof opts.message === 'function' ? opts.message(paths) : opts.message;
  const newCommit = await call<{ sha: string }>('POST', `${repo}/git/commits`, {
    message,
    tree: newTree.sha,
    parents: [parent],
  });
  await call('PATCH', `${repo}/git/refs/${refPath}`, { sha: newCommit.sha, force: false });
  return { sha: newCommit.sha, changed: paths.length, paths };
}

/** A file's UTF-8 text at the branch head, via the contents API (files up to 1 MB). */
export async function readRepoFile(opts: GitHubOpts & { path: string }): Promise<string> {
  const call = client(opts);
  const res = await call<{ encoding: string; content: string }>(
    'GET',
    `/repos/${opts.repo}/contents/${opts.path.split('/').map(enc).join('/')}?ref=${enc(opts.branch)}`,
  );
  if (res.encoding !== 'base64') throw new Error(`GitHub contents ${opts.path}: unexpected encoding ${res.encoding}`);
  const bin = atob(res.content.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
