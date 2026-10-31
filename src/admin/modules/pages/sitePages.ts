// The static site pages the Pages module edits (CMS doc types of group
// 'site'), and the state of each one's draft.
import { CMS_DOC_TYPES } from '../../../../supabase/functions/_shared/cms/registry';
import type { CmsListRow } from './cmsApi';

/** published: the last successful publish included the draft; draft: saved, not yet published; never: no draft. */
export type PageState = 'published' | 'draft' | 'never';

/**
 * What Publish does with page drafts (I3): the site rebuilds in about 2
 * minutes, and the saved draft is kept as the editor's base (it is not
 * re-sent by later publishes unless edited again).
 */
export const PUBLISH_PAGES_TEXT =
  'Publish sends the page drafts saved since the last Publish; the site shows them about 2 minutes later. ' +
  'A published draft stays here as the starting point for your next edit. ' +
  'Finalize, Archive and Un-archive publish contests only, never page drafts.';

export const SITE_PAGES = Object.entries(CMS_DOC_TYPES)
  .filter(([, def]) => def.group === 'site')
  .map(([docId, def]) => ({ docId, label: def.label }));

export function pageState(row: CmsListRow | undefined): PageState {
  if (!row) return 'never';
  return row.published ? 'published' : 'draft';
}
