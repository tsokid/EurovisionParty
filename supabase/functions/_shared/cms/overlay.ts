// How CMS drafts overlay the committed content (CMS 3b, Track 3 §5, §9).
//
// One rule, used by publish-content (cmsFiles: the pages after a publish)
// and by the admin preview (the documents the previewed page reads), so the
// editor never sees something the build would not render:
//
// - a draft replaces its document as a whole (drafts are complete documents,
//   never patches);
// - a document without a draft stays exactly as committed;
// - a later draft for the same doc_id wins (callers pass one per doc).
//
// Pure, Deno-free, no imports.

/** One draft: the document a doc_id would be published as. */
export interface DraftDoc {
  doc_id: string;
  data: unknown;
}

/** The documents after `drafts` are applied over `committed` (doc_id -> document). Neither input is changed. */
export function overlayDrafts(
  committed: Readonly<Record<string, unknown>>,
  drafts: Iterable<DraftDoc>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...committed };
  for (const d of drafts) out[d.doc_id] = d.data;
  return out;
}
