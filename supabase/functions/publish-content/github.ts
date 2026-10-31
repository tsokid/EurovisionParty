// GitHub Git Data API: commit a set of files to a branch as one commit.
//
// Deno-free: fetch is injected, hashing uses Web Crypto (crypto.subtle),
// which Deno and Node both provide. Imported by the publish-content edge
// function and by vitest.
//
// Files are only added or updated, never deleted. A text file goes inline
// in the tree; a binary file (Uint8Array, the CMS media) is uploaded first as
// a base64 blob and referenced by its sha. Either way an unchanged file (same
// git blob sha as the parent tree's) is skipped.

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
  /** Repo path → UTF-8 file text, or the bytes of a binary file. */
  files: Record<string, string | Uint8Array>;
  /** Commit message, or a function of the changed paths (sorted). */
  message: string | ((changedPaths: string[]) => string);
  /**
   * Files derived from their current content: each gets the path's text in
   * the parent commit's tree (null if absent) and returns the new text.
   * Reading the parent itself means a push between reading and committing
   * cannot be reverted (the ref update is fast-forward only).
   */
  transforms?: FileTransforms;
  /**
   * Refuse (before writing anything) when the binary files that are new or
   * changed against the parent tree total more than this many bytes. Files
   * already in the tree with the same content do not count; text never does.
   */
  maxNewBinaryBytes?: number;
};

export type FileTransforms = Record<string, (current: string | null) => string>;

export type CommitResult = {
  /** The new commit, or null when nothing changed. */
  sha: string | null;
  changed: number;
  /** Changed paths, sorted. */
  paths: string[];
};

/** git's blob id: sha1("blob <byte length>\0" + content), over the UTF-8 bytes of a string. */
export async function gitBlobSha(content: string | Uint8Array): Promise<string> {
  const body = typeof content === 'string' ? new TextEncoder().encode(content) : content;
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

type TreeEntry = { path: string; mode: string; type: string; sha: string };

type Call = ReturnType<typeof client>;

/** The branch head: its commit, that commit's tree, and the tree's blobs by path. */
async function headTree(call: Call, repo: string, refPath: string) {
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
  return { parent, baseTree, existing };
}

/**
 * The UTF-8 text of every file in the branch head whose path `match`es
 * (read-only). publish-content reads content/pages/*.json with it.
 */
export async function readFiles(opts: GitHubOpts & { match: (path: string) => boolean }): Promise<Record<string, string>> {
  const call = client(opts);
  const repo = `/repos/${opts.repo}`;
  const { existing } = await headTree(call, repo, `heads/${opts.branch}`);
  const out: Record<string, string> = {};
  for (const [path, entry] of [...existing].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (opts.match(path)) out[path] = await readBlob(call, repo, entry.sha);
  }
  return out;
}

export async function commitFiles(opts: CommitFilesOpts): Promise<CommitResult> {
  const call = client(opts);
  const repo = `/repos/${opts.repo}`;
  const refPath = `heads/${opts.branch}`;

  const { parent, baseTree, existing } = await headTree(call, repo, refPath);

  const files = { ...opts.files };
  for (const [path, transform] of Object.entries(opts.transforms ?? {})) {
    const prev = existing.get(path);
    files[path] = transform(prev ? await readBlob(call, repo, prev.sha) : null);
  }

  const changed: Array<{ path: string; content: string | Uint8Array; mode: string }> = [];
  for (const path of Object.keys(files).sort()) {
    const content = files[path];
    const prev = existing.get(path);
    if (prev && prev.sha === (await gitBlobSha(content))) continue;
    changed.push({ path, content, mode: prev?.mode ?? '100644' });
  }
  if (changed.length === 0) return { sha: null, changed: 0, paths: [] };

  if (opts.maxNewBinaryBytes !== undefined) {
    const added = changed.reduce((n, f) => n + (typeof f.content === 'string' ? 0 : f.content.byteLength), 0);
    if (added > opts.maxNewBinaryBytes) {
      throw new Error(`Publish would add ${added} bytes of new media (max ${opts.maxNewBinaryBytes}); publish fewer media at a time`);
    }
  }

  // File text goes inline in the tree entries (GitHub creates those blobs),
  // so text alone is one tree request however many files changed. Binary
  // content cannot go inline: each binary file is uploaded as a base64 blob
  // first and its tree entry points at the blob's sha.
  const entries: Array<{ path: string; mode: string; type: 'blob'; content?: string; sha?: string }> = [];
  for (const f of changed) {
    if (typeof f.content === 'string') {
      entries.push({ path: f.path, mode: f.mode, type: 'blob', content: f.content });
    } else {
      const blob = await call<{ sha: string }>('POST', `${repo}/git/blobs`, { content: toBase64(f.content), encoding: 'base64' });
      entries.push({ path: f.path, mode: f.mode, type: 'blob', sha: blob.sha });
    }
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

/** A blob's UTF-8 text (blobs API, base64). */
async function readBlob(call: Call, repo: string, sha: string): Promise<string> {
  const res = await call<{ encoding: string; content: string }>('GET', `${repo}/git/blobs/${sha}`);
  if (res.encoding !== 'base64') throw new Error(`GitHub blob ${sha}: unexpected encoding ${res.encoding}`);
  const bin = atob(res.content.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** A multiple of 3 bytes, so each chunk encodes to base64 without padding and the pieces concatenate. */
const BASE64_CHUNK = 3 * 8192;

/**
 * Base64 of `bytes`, encoded chunk by chunk: no binary string of the whole
 * file is ever built (a 20 MB video would otherwise need a 20 M-character
 * intermediate on top of the result), and no spread or apply over it.
 */
export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK);
    let bin = '';
    for (let j = 0; j < chunk.length; j++) bin += String.fromCharCode(chunk[j]);
    parts.push(btoa(bin));
  }
  return parts.join('');
}
