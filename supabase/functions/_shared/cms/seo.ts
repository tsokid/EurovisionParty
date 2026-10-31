// Cross-page SEO uniqueness (CMS 3b, I2).
//
// scripts/seo/checkPrerender.ts fails the build when two pages of one locale
// share a <title> or a meta description. Each page's draft validates on its
// own, so this is checked over the set of pages: Publish runs it over the
// committed pages overlaid with the drafts it ships, the editor over the
// published pages overlaid with the draft being edited.
//
// The fields are found from their metadata (seoTitle() / metaDescription()
// mark seo: 'title' / 'description'), so the paths live in one place. A doc's
// type comes from docTypeFor, so editorial docs (archive-2005 ->
// archive-editorial) are checked too: their optional metaDescription override
// must differ from every other page's description. (The templated
// descriptions of the data pages are not CMS docs: check-prerender covers them.)
// Values are compared as stored (templates, trimmed): two equal templates
// always render equal.
//
// Pure and Deno-free.
import { CMS_DOC_TYPES, docTypeFor } from './registry.ts';
import { walkSchema } from './walk.ts';
import type { Locale } from './validate.ts';

export type SeoKind = 'title' | 'description';

/** Dotted paths of a doc type's SEO title and meta description (an editorial type has only a description). */
export type SeoPaths = Partial<Record<SeoKind, string>>;

export type SeoIssue = { doc_id: string; locale: Locale; path: string; message: string };

const KINDS: readonly SeoKind[] = ['title', 'description'];
const LOCALES: readonly Locale[] = ['en', 'el'];
const cache = new Map<string, SeoPaths | null>();

/**
 * The paths of `docType`'s title and description (either may be absent), or
 * null when the type is unknown or marks neither. Throws if a schema marks two fields of one kind
 * (or one inside a list): the page has a single <title>.
 */
export function seoFields(docType: string): SeoPaths | null {
  if (cache.has(docType)) return cache.get(docType)!;
  const def = Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, docType) ? CMS_DOC_TYPES[docType] : undefined;
  let out: SeoPaths | null = null;
  if (def) {
    const found: Partial<SeoPaths> = {};
    walkSchema(def.schema, (n) => {
      const kind = n.meta.seo;
      if (!kind || n.type !== 'string') return;
      if (found[kind] !== undefined || n.segments.includes('*')) {
        throw new Error(`seoFields: ${docType} marks more than one ${kind} field (${found[kind] ?? n.path}, ${n.path})`);
      }
      found[kind] = n.path;
    });
    out = found.title !== undefined || found.description !== undefined ? found : null;
  }
  cache.set(docType, out);
  return out;
}

function valueAt(root: unknown, path: string): unknown {
  let v = root;
  for (const seg of path.split('.')) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    v = (v as Record<string, unknown>)[seg];
  }
  return v;
}

/**
 * Title / description collisions within one locale across `docs` (doc id ->
 * { en, el }) that involve a doc in `changed`: one issue per changed doc,
 * locale and field, naming the other doc(s). Unknown doc types and values
 * that are not non-blank strings are skipped (validation reports those).
 */
export function seoDuplicates(docs: Record<string, unknown>, changed: Iterable<string>): SeoIssue[] {
  const changedSet = new Set(changed);
  const issues: SeoIssue[] = [];
  const ids = Object.keys(docs).sort();
  for (const locale of LOCALES) {
    for (const kind of KINDS) {
      const byValue = new Map<string, string[]>();
      const paths = new Map<string, string>();
      for (const id of ids) {
        const path = seoFields(docTypeFor(id))?.[kind];
        if (path === undefined) continue;
        const doc = docs[id];
        const raw = doc && typeof doc === 'object' ? valueAt((doc as Record<string, unknown>)[locale], path) : undefined;
        if (typeof raw !== 'string' || raw.trim() === '') continue;
        const key = raw.trim();
        byValue.set(key, [...(byValue.get(key) ?? []), id]);
        paths.set(id, path);
      }
      for (const group of byValue.values()) {
        if (group.length < 2) continue;
        for (const id of group) {
          if (!changedSet.has(id)) continue;
          const others = group.filter((o) => o !== id).map((o) => `"${o}"`).join(', ');
          const what = kind === 'title' ? 'SEO title' : 'meta description';
          issues.push({
            doc_id: id,
            locale,
            path: paths.get(id)!,
            message: `Same ${what} as ${others}: each page needs its own ${what} in every language`,
          });
        }
      }
    }
  }
  return issues.sort((a, b) => (a.doc_id < b.doc_id ? -1 : a.doc_id > b.doc_id ? 1 : 0));
}
