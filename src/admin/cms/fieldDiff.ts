// Field-level diff and three-way merge of CMS documents ({ en, el } JSON).
//
// A "field" is a path of keys and array indexes ("el.blocks.3.items.1.a").
// Objects are compared key by key and arrays index by index; an array whose
// length changed is one field as a whole (its items moved, so per-index
// paths would mean different things on each side).
//
// merge3(base, mine, theirs): my changes since base, replayed on top of
// theirs. Changes to disjoint fields merge silently; a field both sides
// changed to different values is a conflict (overlapping paths count: a
// list I reordered and an item in it they edited).

export type Path = readonly (string | number)[];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep equality for JSON values (reference-equal subtrees short-circuit). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  if (isObj(a)) {
    if (!isObj(b)) return false;
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!sameValue(a[k], b[k])) return false;
    return true;
  }
  return false;
}

export const pathKey = (p: Path): string => p.join('.');

/** The fields that differ between a and b, as paths (outermost changed node per branch). */
export function changedPaths(a: unknown, b: unknown, prefix: Path = []): Path[] {
  if (a === b) return [];
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.flatMap((x, i) => changedPaths(x, b[i], [...prefix, i]));
  }
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => changedPaths(a[k], b[k], [...prefix, k]));
  }
  return sameValue(a, b) ? [] : [prefix];
}

export function getAt(v: unknown, path: Path): unknown {
  let cur: unknown = v;
  for (const seg of path) {
    if (Array.isArray(cur) && typeof seg === 'number') cur = cur[seg];
    else if (isObj(cur)) cur = cur[String(seg)];
    else return undefined;
  }
  return cur;
}

/** A copy of v with path set to value (undefined deletes an object key); containers along the path are copied. */
export function setAt<T>(v: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [seg, ...rest] = path;
  if (Array.isArray(v) && typeof seg === 'number') {
    const out = [...v];
    out[seg] = setAt(out[seg], rest, value);
    return out as T;
  }
  const base: Record<string, unknown> = isObj(v) ? v : {};
  const next = setAt(base[String(seg)], rest, value);
  const out: Record<string, unknown> = { ...base };
  if (next === undefined && rest.length === 0) delete out[String(seg)];
  else out[String(seg)] = next;
  return out as T;
}

/** True when one path is a prefix of (or equal to) the other. */
export function overlaps(p: Path, q: Path): boolean {
  const n = Math.min(p.length, q.length);
  for (let i = 0; i < n; i++) if (String(p[i]) !== String(q[i])) return false;
  return true;
}

export type FieldConflict = {
  path: Path;
  /** The value before either change (the shared base). */
  base: unknown;
  mine: unknown;
  theirs: unknown;
};

export type MergeResult = {
  /** theirs with every non-conflicting change of mine applied (conflicting fields keep theirs). */
  merged: unknown;
  conflicts: FieldConflict[];
  /** The fields they changed (relative to base). */
  theirChanges: Path[];
  /** The fields I changed (relative to base). */
  myChanges: Path[];
};

export function merge3(base: unknown, mine: unknown, theirs: unknown): MergeResult {
  const myChanges = changedPaths(base, mine);
  const theirChanges = changedPaths(base, theirs);
  const conflicts: FieldConflict[] = [];
  const seen = new Set<string>();
  let merged = theirs;
  for (const p of myChanges) {
    const clash = theirChanges.filter((q) => overlaps(p, q));
    if (clash.length === 0) {
      merged = setAt(merged, p, getAt(mine, p));
      continue;
    }
    // Report the conflict at the coarser of the clashing paths.
    const at = [p, ...clash].reduce((s, q) => (q.length < s.length ? q : s));
    const mineAt = getAt(mine, at);
    const theirsAt = getAt(theirs, at);
    if (sameValue(mineAt, theirsAt)) continue; // both made the same change
    const key = pathKey(at);
    if (seen.has(key)) continue;
    seen.add(key);
    conflicts.push({ path: at, base: getAt(base, at), mine: mineAt, theirs: theirsAt });
  }
  // A coarse conflict swallows finer ones under it.
  const kept = conflicts.filter((c) => !conflicts.some((d) => d !== c && d.path.length < c.path.length && overlaps(d.path, c.path)));
  return { merged, conflicts: kept, theirChanges, myChanges };
}

export type Choice = 'mine' | 'theirs';

/** Applies the conflict choices to a merge result. */
export function resolveConflicts(merged: unknown, conflicts: readonly FieldConflict[], choose: (c: FieldConflict, i: number) => Choice): unknown {
  return conflicts.reduce((doc, c, i) => (choose(c, i) === 'mine' ? setAt(doc, c.path, c.mine) : doc), merged);
}

/** A field path in words for people: "EL · blocks 4 › items 2 › a". */
export function describePath(path: Path): string {
  const [locale, ...rest] = path;
  const head = locale === 'en' || locale === 'el' ? String(locale).toUpperCase() : null;
  const parts = (head ? rest : path).map((s) => (typeof s === 'number' ? `#${s + 1}` : s));
  const tail = parts.join(' › ');
  return head ? (tail ? `${head} · ${tail}` : head) : tail;
}
