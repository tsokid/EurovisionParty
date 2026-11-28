// Data for the publish screens (CMS P5): the live and draft versions of a
// doc, the run log (publish_runs, readable by super admins under RLS) and a
// watcher that follows a run's deploy through publish-status.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatError } from '../lib/formatError';
import { cmsGet } from '../modules/pages/cmsApi';
import { pageBase } from '../modules/pages/PageEditor';
import { publishedSiteDoc } from '../../lib/cms/siteChrome';
import { editorialTitle, type EditorialTarget } from '../modules/pages/editorialPages';
import { docLabel } from '../siteStructure';
import { isEditorialDocId } from '../../../supabase/functions/_shared/cms/pagesIndex';
import type { SiteWideDocId } from '../../../supabase/functions/_shared/cms/siteLinks';
import { checkDeploys, deployPending, DEPLOY_POLL_MS, DEPLOY_WATCH_MS, type PublishRun } from '../modules/contests/publish';
import { isSiteWide } from './diff';
import { visibleInterval } from '../../lib/visibleInterval';

/** One doc as the site shows it now and as the next publish would ship it. */
export type DocPair = {
  docId: string;
  label: string;
  live: unknown;
  draft: unknown;
  /** The saved draft's version; null without a draft. */
  updatedAt: string | null;
};

export function docTitle(docId: string, targets?: readonly EditorialTarget[]): string {
  return isEditorialDocId(docId) ? editorialTitle(docId, targets ?? []) : docLabel(docId);
}

export async function loadDocPair(docId: string, targets?: readonly EditorialTarget[]): Promise<DocPair> {
  const [live, row] = await Promise.all([
    isSiteWide(docId) ? Promise.resolve(publishedSiteDoc(docId as SiteWideDocId)) : pageBase(docId).then((b) => b.value),
    cmsGet(docId),
  ]);
  return { docId, label: docTitle(docId, targets), live, draft: row ? row.data : live, updatedAt: row?.updated_at ?? null };
}

export const RUN_COLUMNS =
  'id, status, started_at, finished_at, commit_sha, files_changed, error, cms, doc_ids, target, promoted_from, shipped, deploy_state, deploy_url, deploy_note, reverted_sha';

const asRun = (r: Record<string, unknown>): PublishRun => ({ ...(r as unknown as PublishRun), id: Number(r.id), promoted_from: r.promoted_from == null ? null : Number(r.promoted_from) });

export async function listRuns(limit = 15): Promise<PublishRun[]> {
  const { data, error } = await supabase.from('publish_runs').select(RUN_COLUMNS).order('id', { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(asRun);
}

export async function getRun(id: number): Promise<PublishRun | null> {
  const { data, error } = await supabase.from('publish_runs').select(RUN_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? asRun(data as Record<string, unknown>) : null;
}

/** The newest preview of `docId` that has not gone live, if any. */
export function latestPreview(runs: readonly PublishRun[], docId: string): PublishRun | null {
  const promoted = new Set(runs.filter((r) => r.promoted_from != null && (r.status === 'ok' || r.status === 'noop' || r.status === 'running')).map((r) => r.promoted_from));
  const preview = runs.find((r) => r.target === 'preview' && r.status === 'ok' && r.commit_sha && r.doc_ids?.includes(docId));
  return preview && !promoted.has(preview.id) ? preview : null;
}

/** The main run that promoted a preview, if any. */
export function promotionOf(runs: readonly PublishRun[], previewId: number): PublishRun | null {
  return runs.find((r) => r.promoted_from === previewId) ?? null;
}

/**
 * Follows one run: polls publish-status every DEPLOY_POLL_MS while its deploy
 * builds (or a failed main build still needs its revert), for at most
 * DEPLOY_WATCH_MS after the commit. `set` replaces the run (after a publish).
 */
export function useRunWatch(initial: PublishRun | null) {
  const [run, setRun] = useState<PublishRun | null>(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setRun(initial); }, [initial]);
  const latest = useRef(run);
  latest.current = run;

  const fresh = !!run?.finished_at && Date.now() - Date.parse(run.finished_at) < DEPLOY_WATCH_MS;
  const watching = deployPending(run) && (fresh || !run?.finished_at);
  const id = watching ? run!.id : null;
  // Past the watch window but still recorded as building: one check on load.
  const staleId = run?.deploy_state === 'building' && !watching ? run.id : null;
  useEffect(() => {
    if (staleId === null) return;
    let off = false;
    void checkDeploys([staleId])
      .then(([next]) => { if (!off && next && latest.current?.id === next.id) setRun((r) => ({ ...(r ?? next), ...next })); })
      .catch(() => { /* offline: keep the last state */ });
    return () => { off = true; };
  }, [staleId]);
  useEffect(() => {
    if (id === null) return;
    let off = false;
    const tick = async () => {
      try {
        const [next] = await checkDeploys([id]);
        if (!off && next && latest.current?.id === next.id) setRun((r) => ({ ...(r ?? next), ...next }));
        if (!off) setError(null);
      } catch (e) {
        if (!off) setError(formatError(e));
      }
    };
    void tick();
    // Only while the admin tab is visible; once at once on return (28 Nov 2026).
    const stop = visibleInterval(() => { void tick(); }, DEPLOY_POLL_MS);
    return () => { off = true; stop(); };
  }, [id]);

  const set = useCallback((next: PublishRun | null) => setRun(next), []);
  return { run, set, watching, error };
}
