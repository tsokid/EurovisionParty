// The one deterministic JSON serializer for committed content: the publish
// snapshot (content/contests, countries, site.json), CMS pages
// (content/pages/*.json, written by publish-content and the 3a extraction
// script) and data/history/*.json. Byte-for-byte stability matters: publish
// detects no-op files by blob SHA.
//
// Pure and Deno-free (no imports).

/** JSON with object keys sorted at every level, 2-space indent, trailing newline. */
export function stableJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sort(o[k])]));
    }
    return v;
  };
  return JSON.stringify(sort(value), null, 2) + '\n';
}
