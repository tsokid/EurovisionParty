// The cms_* RPCs of migration 076 and the published copy of a page, for the
// Pages module. Every call throws on failure (show it with formatError).
import { supabase } from '../../../lib/supabase';
import { formatError } from '../../lib/formatError';
import type { DocValue } from './form/SchemaForm';
import { PAGES_INDEX_PATH, readPagesIndex } from '../../../../supabase/functions/_shared/cms/pagesIndex';

/** A row of cms_list(): a saved draft and whether the last publish included it. */
export type CmsListRow = { doc_id: string; doc_type: string; updated_at: string; published: boolean };

/** cms_get(): the saved draft of one document. */
export type CmsDraft = { doc_id: string; doc_type: string; data: DocValue; updated_at: string };

/** cms_save's refusal of a save against an outdated updated_at. */
const CONFLICT = 'document changed by someone else';

export const isConflict = (e: unknown): boolean => formatError(e).includes(CONFLICT);

export async function cmsList(): Promise<CmsListRow[]> {
  const { data, error } = await supabase.rpc('cms_list');
  if (error) throw error;
  return (data ?? []) as CmsListRow[];
}

export async function cmsGet(docId: string): Promise<CmsDraft | null> {
  const { data, error } = await supabase.rpc('cms_get', { p_doc_id: docId });
  if (error) throw error;
  return (data ?? null) as CmsDraft | null;
}

/** Saves the draft; returns its new updated_at (the next save's expected value). */
export async function cmsSave(docId: string, docType: string, data: DocValue, expectedUpdatedAt: string | null): Promise<string> {
  const res = await supabase.rpc('cms_save', {
    p_doc_id: docId,
    p_doc_type: docType,
    p_data: data,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (res.error) throw res.error;
  if (typeof res.data !== 'string') throw new Error('cms_save returned no timestamp');
  return res.data;
}

export async function cmsDiscard(docId: string): Promise<void> {
  const { error } = await supabase.rpc('cms_discard', { p_doc_id: docId });
  if (error) throw error;
}

/** The live (published) document, content/pages/{docId}.json, bypassing the HTTP cache. */
export async function fetchPublished(docId: string): Promise<DocValue> {
  const res = await fetch(`/content/pages/${docId}.json`, { cache: 'no-store' });
  const json = (res.headers.get('content-type') ?? '').includes('json');
  if (!res.ok || !json) throw new Error(`Could not load the published ${docId} page (HTTP ${res.status}${res.ok ? ', not JSON' : ''})`);
  return (await res.json()) as DocValue;
}

// The published copies of the other site pages, for the cross-page SEO
// title/description check (I2). Each is fetched at most once per editor
// session (Pages module mount: resetPublishedPages); a page that fails to
// load is left out (Publish checks again against the repo).
const publishedPages = new Map<string, Promise<DocValue | null>>();

/** Forget the cached published pages (a new editor session). */
export function resetPublishedPages(): void {
  publishedPages.clear();
}

/** Test-only alias of resetPublishedPages. */
export const __resetPublishedPagesForTests = resetPublishedPages;

/** The published documents of `docIds` that loaded, as { doc_id: document }. */
export async function fetchPublishedPages(docIds: readonly string[]): Promise<Record<string, DocValue>> {
  const entries = await Promise.all(docIds.map(async (id) => {
    let p = publishedPages.get(id);
    if (!p) {
      p = fetchPublished(id).catch(() => {
        publishedPages.delete(id); // try again next time
        return null;
      });
      publishedPages.set(id, p);
    }
    return [id, await p] as const;
  }));
  return Object.fromEntries(entries.filter((e): e is readonly [string, DocValue] => e[1] !== null));
}

/**
 * The editorial doc ids that are published (content/pages/index.json),
 * bypassing the HTTP cache. Throws when the index cannot be read: callers
 * must not mistake "unknown" for "none" (creating a draft over a published
 * editorial doc would replace it at the next Publish).
 */
export async function fetchPublishedEditorialIds(): Promise<string[]> {
  const res = await fetch(`/content/${PAGES_INDEX_PATH}`, { cache: 'no-store' });
  const json = (res.headers.get('content-type') ?? '').includes('json');
  if (!res.ok || !json) throw new Error(`Could not load the editorial index (HTTP ${res.status}${res.ok ? ', not JSON' : ''})`);
  const ids = readPagesIndex(await res.json());
  if (!ids) throw new Error('The editorial index is malformed');
  return ids;
}
