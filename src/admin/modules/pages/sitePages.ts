// The static site pages the Pages module edits (CMS doc types of group
// 'site'), and the state of each one's draft.
import { CMS_DOC_TYPES } from '../../../../supabase/functions/_shared/cms/registry';
import type { CmsListRow } from './cmsApi';

/** published: the last successful publish included the draft; draft: saved, not yet published; never: no draft. */
export type PageState = 'published' | 'draft' | 'never';

export const SITE_PAGES = Object.entries(CMS_DOC_TYPES)
  .filter(([, def]) => def.group === 'site')
  .map(([docId, def]) => ({ docId, label: def.label }));

export function pageState(row: CmsListRow | undefined): PageState {
  if (!row) return 'never';
  return row.published ? 'published' : 'draft';
}
