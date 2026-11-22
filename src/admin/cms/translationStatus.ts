// Missing translations per doc, for the tree-level flags (CMS P6, spec §4
// "EN/EL"): the sidebar's page tree, the Pages list and the site-wide rows
// show a dot on a doc missing EN or EL.
//
// The counts come from each doc's current version: its saved draft when it
// has one, else the published file (site pages) or the bundled doc (header,
// footer, settings). They are loaded once per session (the published files
// are cached by cmsApi) and an open editor reports its live counts while
// typing, so the dot follows the edit without another request.
import { useEffect, useSyncExternalStore } from 'react';
import { docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import { missingTranslationsOf } from '../../../supabase/functions/_shared/cms/translations';
import { bundledContent } from '../../lib/seo/contentData';
import { cmsGet, cmsList, fetchPublishedPages } from '../modules/pages/cmsApi';
import { SITE_PAGES } from '../modules/pages/sitePages';

export type Gaps = { en: number; el: number };

const SITE_WIDE = ['site-header', 'site-footer', 'site-settings'] as const;

let gaps = new Map<string, Gaps>();
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

const emit = () => listeners.forEach((l) => l());

const same = (a: Gaps | undefined, b: Gaps) => !!a && a.en === b.en && a.el === b.el;

/** Records a doc's missing counts (an editor reports its live value). */
export function reportGaps(docId: string, next: Gaps): void {
  if (same(gaps.get(docId), next)) return;
  gaps = new Map(gaps).set(docId, next);
  emit();
}

/** The counts of a doc version. */
export function gapsOf(docId: string, doc: unknown): Gaps {
  const m = missingTranslationsOf(docTypeFor(docId), doc);
  return { en: m.en.length, el: m.el.length };
}

async function loadAll(): Promise<void> {
  const ids = SITE_PAGES.map((p) => p.docId);
  const [published, rows] = await Promise.all([fetchPublishedPages(ids), cmsList().catch(() => [])]);
  const base: Record<string, unknown> = { ...published };
  for (const id of SITE_WIDE) base[id] = bundledContent(`pages/${id}.json`);
  const drafts = await Promise.all(rows
    .filter((r) => r.doc_id in base || SITE_WIDE.includes(r.doc_id as (typeof SITE_WIDE)[number]))
    .map((r) => cmsGet(r.doc_id).catch(() => null)));
  for (const d of drafts) if (d) base[d.doc_id] = d.data;
  const next = new Map(gaps);
  for (const [id, doc] of Object.entries(base)) {
    // An editor's live report wins over what was loaded.
    if (!gaps.has(id)) next.set(id, gapsOf(id, doc));
  }
  gaps = next;
  emit();
}

/** Test hook: forget everything. */
export function __resetTranslationStatusForTests(): void {
  gaps = new Map();
  loading = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => gaps;

/** Every known doc's counts; starts the session's load on first use. */
export function useTranslationGaps(): ReadonlyMap<string, Gaps> {
  useEffect(() => {
    if (!loading) loading = loadAll().catch(() => { loading = null; });
  }, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Whether a doc misses either language. */
export const hasGaps = (g: Gaps | undefined) => !!g && (g.en > 0 || g.el > 0);
