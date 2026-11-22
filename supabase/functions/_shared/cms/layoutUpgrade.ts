// Moves a document to the list-based page layout (CMS P6, owner decision
// Q4 = B). The section-based pages (about, cookies, privacy, terms and the
// five article pages) replaced their `extraBlocks` zone with a `layout`: the
// page's sections in order, with blocks between them. A doc saved before
// that, a draft in cms_documents, an unsent buffer, a revision, a committed
// file, still has `extraBlocks`; upgradeDocument turns it into
//
//   layout: [ every section in its default order, ...the extraBlocks ]
//
// which renders exactly what the old doc rendered (the zone sat after the
// last section). A doc without extraBlocks is returned as it is: no layout
// means the default order, so nothing is written for it.
//
// Used by publish-content (before validation), the admin editor and preview
// (on load), and scripts/cms/migrate-layout.ts (the committed files).
//
// Pure and Deno-free.
import { defaultLayout, fieldMeta, type LayoutSection } from './fields.ts';
import { CMS_DOC_TYPES, docTypeFor } from './registry.ts';
import { walkSchema } from './walk.ts';

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The sections of a doc type's top-level `layout` field, or null when the type has none. */
export function layoutSections(docType: string): LayoutSection[] | null {
  const def = Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, docType) ? CMS_DOC_TYPES[docType] : undefined;
  if (!def) return null;
  let found: LayoutSection[] | null = null;
  walkSchema(def.schema, (n) => {
    if (n.segments.length === 0) return true;
    if (n.segments.length === 1 && n.segments[0] === 'layout' && fieldMeta(n.schema).sections) found = fieldMeta(n.schema).sections!;
    return false;
  });
  return found;
}

/**
 * The document with `extraBlocks` folded into `layout`, per locale. The input
 * is never changed; the same object comes back when there is nothing to do.
 */
export function upgradeDocument(docId: string, doc: unknown): unknown {
  const sections = layoutSections(docTypeFor(docId));
  if (!sections || !isRecord(doc)) return doc;
  let changed = false;
  const out: Record<string, unknown> = { ...doc };
  for (const locale of ['en', 'el'] as const) {
    const slice = doc[locale];
    if (!isRecord(slice) || !('extraBlocks' in slice)) continue;
    const { extraBlocks, ...rest } = slice;
    const blocks = Array.isArray(extraBlocks) ? extraBlocks : [];
    const layout = Array.isArray(rest.layout) ? rest.layout : [...defaultLayout(sections), ...blocks];
    out[locale] = blocks.length || Array.isArray(rest.layout) ? { ...rest, layout } : rest;
    changed = true;
  }
  return changed ? out : doc;
}
