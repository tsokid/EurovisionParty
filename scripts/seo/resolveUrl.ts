// Emulates how Vercel routes a request path through vercel.json, for tests
// that check URLs resolve to real pages without deploying. Order, as on
// Vercel: trailingSlash, cleanUrls .html strip, redirects (first match,
// `has` honoured), filesystem (cleanUrls), rewrites, else 404. Every
// redirect is a hop and the request restarts; rewrites are internal.
//
// Only the subset of path-to-regexp that vercel.json uses is supported:
// literals, `:name`, `:name(regex)`, unnamed `(regex)`, and the `*`, `+`, `?`
// modifiers (a preceding `/` becomes part of an optional param).

export type VercelHas = { type: string; key: string; value?: string };
export type VercelRoute = { source: string; destination: string; permanent?: boolean; has?: VercelHas[] };
export type VercelConfig = {
  cleanUrls?: boolean;
  trailingSlash?: boolean;
  redirects?: VercelRoute[];
  rewrites?: VercelRoute[];
};

export type Resolution = {
  /** Path the client ends on (after redirects; rewrites do not change it). */
  final: string;
  /** Number of redirects (308/301) the client followed. */
  hops: number;
  status: 200 | 404;
  /** `file`: a built page; `rewrite`: served via a rewrite (SPA shell); `none`: 404. */
  via: 'file' | 'rewrite' | 'none';
};

export type ResolveOptions = { acceptLanguage?: string };

type Matcher = (path: string) => Record<string, string> | null;

const MAX_HOPS = 10;

/** Index of the `)` closing the group that opens at `src[start]`. */
function closeParen(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') i++;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  throw new Error(`Unbalanced parenthesis in route source: ${src}`);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Compile a vercel.json `source` to a matcher returning its params, or null. */
export function compileSource(source: string): Matcher {
  const names: string[] = [];
  let re = '';
  let unnamed = 0;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    let name: string | null = null;
    let pattern = '[^/]+?';
    if (c === ':') {
      const m = /^:(\w+)/.exec(source.slice(i))!;
      name = m[1];
      i += m[0].length;
      if (source[i] === '(') {
        const end = closeParen(source, i);
        pattern = source.slice(i + 1, end);
        i = end + 1;
      }
    } else if (c === '(') {
      const end = closeParen(source, i);
      name = String(unnamed++);
      pattern = source.slice(i + 1, end);
      i = end + 1;
    } else {
      re += escapeRe(c);
      i++;
      continue;
    }
    const mod = '*+?'.includes(source[i] ?? '') ? source[i++] : '';
    names.push(name);
    if (!mod) {
      re += `(${pattern})`;
      continue;
    }
    // A `/` right before a modified param belongs to it (`/:any*` matches `` too).
    const prefix = re.endsWith('/') ? '/' : '';
    if (prefix) re = re.slice(0, -1);
    const repeat = mod === '?' ? '' : `(?:${escapeRe(prefix)}(?:${pattern}))*`;
    const body = `(?:${pattern})${repeat}`;
    re += mod === '+' ? `${escapeRe(prefix)}(${body})` : `(?:${escapeRe(prefix)}(${body}))?`;
  }
  const rx = new RegExp(`^${re}$`, 'i');
  return (path) => {
    const m = rx.exec(path);
    if (!m) return null;
    return Object.fromEntries(names.map((n, k) => [n, m[k + 1] ?? '']));
  };
}

function hasMatches(has: VercelHas[] | undefined, headers: Record<string, string>): boolean {
  return (has ?? []).every((h) => {
    if (h.type !== 'header') return false;
    const v = headers[h.key.toLowerCase()];
    if (v === undefined) return false;
    return h.value === undefined || new RegExp(`^${h.value}$`).test(v);
  });
}

function applyDestination(dest: string, params: Record<string, string>): string {
  const out = dest.replace(/:(\w+)\*?/g, (m, n: string) => (n in params ? params[n] : m));
  return out.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
}

/** Route `path` through `vercel` against the set of built clean paths. */
export function resolveUrl(
  path: string,
  vercel: VercelConfig,
  builtPaths: Set<string>,
  opts: ResolveOptions = {},
): Resolution {
  const headers: Record<string, string> = {};
  if (opts.acceptLanguage !== undefined) headers['accept-language'] = opts.acceptLanguage;
  const redirects = (vercel.redirects ?? []).map((r) => ({ r, match: compileSource(r.source) }));
  const rewrites = (vercel.rewrites ?? []).map((r) => ({ r, match: compileSource(r.source) }));
  const seen = new Set<string>();
  let hops = 0;
  let cur = path;

  const hop = (to: string) => {
    if (seen.has(to) || hops >= MAX_HOPS) throw new Error(`Redirect loop resolving ${path}: ${[...seen, to].join(' → ')}`);
    seen.add(cur);
    hops++;
    cur = to;
  };

  for (;;) {
    if (vercel.trailingSlash === false && cur.length > 1 && cur.endsWith('/')) {
      hop(cur.replace(/\/+$/, '') || '/');
      continue;
    }
    if (vercel.cleanUrls && cur.endsWith('.html')) {
      const clean = cur.slice(0, -'.html'.length).replace(/\/index$/, '') || '/';
      if (builtPaths.has(clean)) {
        hop(clean);
        continue;
      }
    }
    const red = redirects.find(({ r, match }) => match(cur) && hasMatches(r.has, headers));
    if (red) {
      hop(applyDestination(red.r.destination, red.match(cur)!));
      continue;
    }
    if (builtPaths.has(cur)) return { final: cur, hops, status: 200, via: 'file' };
    for (const { r, match } of rewrites) {
      if (!hasMatches(r.has, headers)) continue;
      const params = match(cur);
      if (!params) continue;
      const target = applyDestination(r.destination, params);
      return builtPaths.has(target)
        ? { final: cur, hops, status: 200, via: 'rewrite' }
        : { final: cur, hops, status: 404, via: 'none' };
    }
    return { final: cur, hops, status: 404, via: 'none' };
  }
}
