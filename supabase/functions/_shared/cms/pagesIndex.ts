// Editorial document ids and content/pages/index.json (CMS 3c, spec §5).
//
// The data pages (archive years, countries, the live hub) take an optional
// editorial document each: archive-{year}, country-{iso}, hub-{year}. Most
// have none, so publish also writes content/pages/index.json, the sorted list
// of the editorial doc ids that exist. The public client reads it to skip
// fetching a doc that does not exist, the admin to know what is published.
//
// Pure, Deno-free and zod-free: the public bundle imports it.

export const EDITORIAL_FAMILIES = ['archive', 'country', 'hub'] as const;

export type EditorialFamily = (typeof EDITORIAL_FAMILIES)[number];

/** The index file, relative to content/ (useContent paths). */
export const PAGES_INDEX_PATH = 'pages/index.json';

/** The index file in the repo. */
export const PAGES_INDEX_FILE = `content/${PAGES_INDEX_PATH}`;

/** content/pages/index.json */
export type PagesIndex = { editorial: string[] };

/** The family of an editorial doc id (archive-2005 -> archive), or null for any other id. */
export function editorialFamily(docId: string): EditorialFamily | null {
  for (const family of EDITORIAL_FAMILIES) {
    if (docId.startsWith(`${family}-`) && docId.length > family.length + 1) return family;
  }
  return null;
}

export const isEditorialDocId = (docId: string): boolean => editorialFamily(docId) !== null;

/** The doc id of a year's or a country's editorial; lowercase, as cms_documents.doc_id requires. */
export function editorialDocId(family: EditorialFamily, key: string | number): string {
  return `${family}-${String(key).toLowerCase()}`;
}

/** The index for a set of doc ids: the editorial ones, sorted and unique. */
export function pagesIndex(docIds: Iterable<string>): PagesIndex {
  return { editorial: [...new Set([...docIds].filter(isEditorialDocId))].sort() };
}

/** The editorial ids of a parsed index file, or null when it is not one. */
export function readPagesIndex(data: unknown): string[] | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const ids = (data as Record<string, unknown>).editorial;
  return Array.isArray(ids) && ids.every((id) => typeof id === 'string') ? ids : null;
}
