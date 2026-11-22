// The review and publish of one or more docs (CMS P5, spec §4 and §6, owner
// Q2 = A, Q3 = C):
// - what changes: the page side by side, live and after, with the changed
//   nodes tinted; the changed fields word by word; the SEO delta with the
//   guard's verdict;
// - a page publish ships only the reviewed docs (publish-content doc_ids),
//   after a confirm that names them;
// - a site-wide doc (header, footer, settings) goes through a Vercel preview
//   first: «Φτιάξε προεπισκόπηση» → the preview URL → «Βγάλ' το live»;
// - the run's deploy state follows the build («Χτίζεται…», «Live»,
//   «Απέτυχε»), with the notice when a failed build was reverted.
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Globe2, Rocket } from 'lucide-react';
import { CMS_DOC_TYPES, docTypeFor } from '../../../supabase/functions/_shared/cms/registry';
import { isEditorialDocId } from '../../../supabase/functions/_shared/cms/pagesIndex';
import { AdminLink, ConfirmDialog, StatusChip } from '../ui/kit';
import { formatError } from '../lib/formatError';
import { adminPaths } from '../paths';
import { formatRunTime, invokeScopedPublish, outcomeText, type PublishOutcome, type PublishRun } from '../modules/contests/publish';
import { editorialPreviewPath, editorialTargets, loadEditorialSources, type EditorialTarget } from '../modules/pages/editorialPages';
import { getRun, latestPreview, listRuns, loadDocPair, promotionOf, useRunWatch, type DocPair } from './api';
import { fieldChanges, isSiteWide, seoDelta } from './diff';
import { VisualDiff } from './VisualDiff';
import { SeoDelta, TextDiff } from './DiffParts';
import { DeployChip, FailureNotice } from './DeployState';
import { t } from '../i18n';
import { SeoGate } from '../seo/SeoPanel';
import type { SeoCheck } from '../seo/seoChecks';

/** Whether the SEO checks hold Publish: a failing check, or one not known yet (a doc not reported). */
function seoState(docIds: string[], blocking: Record<string, SeoCheck[]>): 'block' | 'pending' | null {
  if (docIds.some((id) => blocking[id]?.some((c) => c.severity === 'block'))) return 'block';
  if (docIds.some((id) => !blocking[id] || blocking[id].length > 0)) return 'pending';
  return null;
}

type View = 'visual' | 'text' | 'seo';

/** A run being followed: its deploy chip, the failure notice and a link to its page. */
export function RunCard({ run: initial, lead }: { run: PublishRun; lead?: string }) {
  const { run } = useRunWatch(initial);
  if (!run) return null;
  return (
    <div className="space-y-2" data-testid="run-card">
      <p className="flex flex-wrap items-center gap-2 t-small m-0">
        {lead && <span>{lead}</span>}
        <DeployChip run={run} />
        <AdminLink to={adminPaths.publishRun(run.id)} className="text-stage-pink-2 hover:underline">{t.publishFlow.runDetails}</AdminLink>
      </p>
      <FailureNotice run={run} />
    </div>
  );
}

/** The three steps of a site-wide publish, the current one lit. */
function Steps({ at }: { at: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs m-0 p-0 list-none" aria-label={t.publishFlow.siteWide}>
      {t.publishFlow.steps.map((s, i) => (
        <li key={s} className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold',
          i < at ? 'border-[#35d29a]/50 text-[#35d29a]' : i === at ? 'border-stage-gold text-stage-gold' : 'border-stage-line text-stage-text-3')}>
          <span className="num">{i + 1}</span>{s}
        </li>
      ))}
    </ol>
  );
}

/** Q3 = C: preview on Vercel, check it, go live. */
function SitePreviewFlow({ pair, changed }: { pair: DocPair; changed: boolean }) {
  const [runs, setRuns] = useState<PublishRun[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRuns(await listRuns(30));
      setErr(null);
    } catch (e) {
      setErr(formatError(e));
      setRuns([]);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const preview = runs ? latestPreview(runs, pair.docId) : null;
  const lastPromote = runs?.find((r) => r.promoted_from != null && r.doc_ids?.includes(pair.docId)) ?? null;
  const watch = useRunWatch(preview);
  const p = watch.run && preview && watch.run.id === preview.id ? watch.run : preview;
  const shipped = p?.shipped?.find((s) => s.doc_id === pair.docId)?.updated_at ?? null;
  const stale = !!p && !!pair.updatedAt && (!shipped || Date.parse(shipped) !== Date.parse(pair.updatedAt));

  const start = async () => {
    setBusy(true);
    setOutcome(null);
    const o = await invokeScopedPublish({ docIds: [pair.docId], target: 'preview' });
    setOutcome(o);
    setBusy(false);
    await reload();
  };
  const goLive = async () => {
    if (!p) return;
    setConfirming(false);
    setBusy(true);
    setOutcome(null);
    const o = await invokeScopedPublish({ promote: p.id });
    setOutcome(o);
    setBusy(false);
    await reload();
  };

  const promoted = p ? promotionOf(runs ?? [], p.id) : null;
  const state = p?.deploy_state ?? (p ? 'building' : null);
  // 0 preview (to make, or building), 1 check it (ready), 2 going live, 3 live.
  const at: 0 | 1 | 2 | 3 = promoted ? (promoted.deploy_state === 'ready' ? 3 : 2) : p && state === 'ready' && !stale ? 1 : 0;
  const canStart = !busy && (changed || stale);

  return (
    <div className="space-y-3" data-testid="site-preview-flow" data-step={at}>
      <p className="flex items-start gap-2 font-semibold text-stage-text m-0">
        <Globe2 size={18} aria-hidden className="mt-0.5 shrink-0 text-stage-gold" />{t.publishFlow.siteWide}
      </p>
      <Steps at={at} />
      {runs === null && <p className="t-small m-0">{t.common.loading}</p>}
      {runs !== null && !p && (
        <>
          <p className="t-small m-0">{t.publishFlow.previewStartText}</p>
          {lastPromote && !changed && <RunCard run={lastPromote} lead={t.publishFlow.wentLive} />}
        </>
      )}
      {p && (
        <div className="rounded-stage border border-stage-line bg-stage-bg-2 p-3 space-y-2">
          <p className="flex flex-wrap items-center gap-2 t-small m-0">
            <span className="font-semibold text-stage-text">{t.publishFlow.previewMade(p.finished_at ? formatRunTime(p.finished_at) : `#${p.id}`)}</span>
            <DeployChip run={p} />
            <AdminLink to={adminPaths.publishRun(p.id)} className="text-stage-pink-2 hover:underline">{t.publishFlow.runDetails}</AdminLink>
          </p>
          {state === 'building' && <p className="t-small m-0">{t.publishFlow.previewBuilding}</p>}
          {state === 'ready' && !stale && <p className="t-small m-0">{t.publishFlow.previewReady}</p>}
          {stale && <p className="t-small text-stage-gold m-0" data-testid="preview-stale">{t.publishFlow.previewStale}</p>}
          <FailureNotice run={p} />
          {p.deploy_url && state === 'ready' && (
            <a href={p.deploy_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm inline-flex" data-testid="preview-url">
              <ExternalLink size={15} aria-hidden />{t.publishFlow.previewOpen}
            </a>
          )}
        </div>
      )}
      {promoted && <RunCard run={promoted} lead={t.publishFlow.goLiveDone} />}
      {outcome && outcome.status !== 'ok' && <p className={clsx('t-small m-0', outcome.status === 'noop' ? '' : 'text-stage-bad')}>{outcomeText(outcome)}</p>}
      {err && <p className="t-small text-stage-bad m-0">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {(!p || stale || state === 'error') && (
          <button type="button" className={clsx('btn btn-sm', p ? 'btn-ghost' : 'btn-primary')} disabled={!canStart && !(p && state === 'error')} onClick={() => { void start(); }}>
            {busy ? t.publishFlow.publishing : p ? t.publishFlow.previewAgain : t.publishFlow.previewStart}
          </button>
        )}
        {p && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || state !== 'ready' || stale || !!promoted} onClick={() => setConfirming(true)} data-testid="go-live">
            <Rocket size={15} aria-hidden />{t.publishFlow.goLive}
          </button>
        )}
      </div>
      <ConfirmDialog open={confirming} title={t.publishFlow.goLiveTitle} confirmLabel={t.publishFlow.goLive} onCancel={() => setConfirming(false)} onConfirm={() => { void goLive(); }}>
        <p className="flex gap-2 items-start text-stage-text">
          <Globe2 size={18} aria-hidden className="shrink-0 mt-0.5 text-stage-gold" />
          <span>{t.publishFlow.goLiveText}</span>
        </p>
        <p>{t.publishFlow.eta}</p>
      </ConfirmDialog>
    </div>
  );
}

/** Publishes exactly the reviewed page docs. */
function PagePublish({ pairs, changedIds, seoBlocked }: { pairs: DocPair[]; changedIds: string[]; seoBlocked: 'block' | 'pending' | null }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  const [run, setRun] = useState<PublishRun | null>(null);
  const shipping = pairs.filter((p) => changedIds.includes(p.docId));
  const one = shipping.length === 1;

  const publish = async () => {
    setConfirming(false);
    setBusy(true);
    setOutcome(null);
    setRun(null);
    const o = await invokeScopedPublish({ docIds: shipping.map((p) => p.docId) });
    setOutcome(o);
    if ((o.status === 'ok' || o.status === 'noop') && o.run_id) {
      try { setRun(await getRun(o.run_id)); } catch { /* the outcome line still says what happened */ }
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || shipping.length === 0 || !!seoBlocked} onClick={() => setConfirming(true)} data-testid="publish-docs">
          <Rocket size={15} aria-hidden />{busy ? t.publishFlow.publishing : pairs.length > 1 ? t.publishFlow.publishSelected(shipping.length) : t.publishFlow.publishOne}
        </button>
        <span className="t-meta">{t.publishFlow.eta}</span>
      </div>
      {seoBlocked && (
        <p role="status" className={clsx('t-small m-0', seoBlocked === 'block' ? 'text-stage-bad' : 'text-stage-text-3')} data-testid="seo-blocked">
          {seoBlocked === 'block' ? t.seo.publishBlocked : t.seo.publishPending}
        </p>
      )}
      {outcome && outcome.status === 'ok' && run && <RunCard run={run} lead={t.publishFlow.published} />}
      {outcome && outcome.status === 'noop' && <p className="t-small m-0">{t.publishFlow.nothingSent}</p>}
      {outcome && (outcome.status === 'error' || outcome.status === 'busy') && <p role="alert" className="t-small text-stage-bad m-0">{outcomeText(outcome)}</p>}
      <ConfirmDialog
        open={confirming}
        title={one ? t.publishFlow.publishOneTitle(shipping[0].label) : t.publishFlow.publishManyTitle(shipping.length)}
        confirmLabel={t.publishFlow.publishOne}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { void publish(); }}
      >
        {one ? <p>{t.publishFlow.publishOneText}</p> : (
          <>
            <p>{t.publishFlow.publishManyText}</p>
            <ul className="list-disc pl-5">{shipping.map((p) => <li key={p.docId}>{p.label}</li>)}</ul>
          </>
        )}
        <p>{t.publishFlow.eta}</p>
      </ConfirmDialog>
    </div>
  );
}

export function PublishReview({ docIds, actions = true }: { docIds: string[]; actions?: boolean }) {
  const [pairs, setPairs] = useState<DocPair[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [targets, setTargets] = useState<EditorialTarget[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [view, setView] = useState<View>('visual');
  const [seoBlocking, setSeoBlocking] = useState<Record<string, SeoCheck[]>>({});
  const onBlocking = useCallback((id: string, b: SeoCheck[]) => setSeoBlocking((prev) => ({ ...prev, [id]: b })), []);
  const key = docIds.join(',');

  useEffect(() => {
    let live = true;
    setPairs(null);
    setErr(null);
    setCurrent(0);
    const ids = key.split(',').filter(Boolean);
    const needTargets = ids.some(isEditorialDocId);
    (needTargets ? loadEditorialSources().then(editorialTargets).catch(() => [] as EditorialTarget[]) : Promise.resolve([] as EditorialTarget[]))
      .then(async (tg) => {
        if (!live) return;
        setTargets(tg);
        const loaded = await Promise.all(ids.map((id) => loadDocPair(id, tg)));
        if (live) setPairs(loaded);
      })
      .catch((e: unknown) => { if (live) setErr(formatError(e)); });
    return () => { live = false; };
  }, [key]);

  const changesById = useMemo(() => new Map((pairs ?? []).map((p) => [p.docId, fieldChanges(p.live, p.draft)])), [pairs]);

  if (err) return <p role="alert" className="text-sm text-stage-bad">{t.publishFlow.loadError(err)}</p>;
  if (!pairs) return <p className="t-small">{t.common.loading}</p>;
  const pair = pairs[Math.min(current, pairs.length - 1)];
  if (!pair) return null;
  const changes = changesById.get(pair.docId) ?? [];
  const siteWide = isSiteWide(pair.docId);
  const editorialPath = isEditorialDocId(pair.docId) ? editorialPreviewPath(pair.docId, targets) ?? null : undefined;
  const seo = seoDelta(pair.docId, pair.live, pair.draft, editorialPath ? { en: editorialPath, el: editorialPath } : undefined);
  const schema = CMS_DOC_TYPES[docTypeFor(pair.docId)]?.schema;
  const changedIds = pairs.filter((p) => (changesById.get(p.docId) ?? []).length > 0).map((p) => p.docId);
  const counts: Record<View, number | null> = { visual: null, text: changes.length, seo: siteWide ? null : seo.length };

  return (
    <div className="space-y-4" data-testid="publish-review">
      {pairs.length > 1 && (
        <div role="tablist" aria-label={t.publishFlow.diffTitle} className="flex flex-wrap gap-1.5">
          {pairs.map((p, i) => (
            <button key={p.docId} type="button" role="tab" aria-selected={i === current} onClick={() => setCurrent(i)}
              className={clsx('rounded-full border px-3 py-1 text-sm font-semibold cursor-pointer', i === current ? 'border-stage-pink bg-stage-surface-2 text-stage-text' : 'border-stage-line text-stage-text-3 hover:text-stage-text')}>
              {p.label} <span className="num font-normal text-stage-text-3">{(changesById.get(p.docId) ?? []).length}</span>
            </button>
          ))}
        </div>
      )}

      <section className="card p-4 sm:p-5 space-y-4">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="t-h3 text-stage-text m-0">{t.publishFlow.diffTitle}: {pair.label}</h2>
          {siteWide && <StatusChip tone="gold">{t.publishFlow.siteWide}</StatusChip>}
          <span className="t-meta">{changes.length ? t.publishFlow.fieldsChanged(changes.length) : t.publishFlow.noChange}</span>
        </header>
        <div role="tablist" aria-label={t.publishFlow.diffTitle} className="flex gap-1 rounded-stage-sm bg-stage-bg p-0.5 w-fit">
          {(['visual', 'text', 'seo'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={clsx('rounded px-3 py-1 text-sm font-semibold cursor-pointer', view === v ? 'bg-stage-surface-2 text-stage-text' : 'text-stage-text-3 hover:text-stage-text')}>
              {t.publishFlow.views[v]}{counts[v] !== null && <span className="num ml-1.5 font-normal text-stage-text-3">{counts[v]}</span>}
            </button>
          ))}
        </div>
        {view === 'visual' && <VisualDiff docId={pair.docId} live={pair.live} draft={pair.draft} changes={changes} path={editorialPath} />}
        {view === 'text' && <TextDiff schema={schema} live={pair.live} draft={pair.draft} changes={changes} />}
        {view === 'seo' && <SeoDelta rows={seo} siteWide={siteWide} />}
      </section>

      {actions && !siteWide && (
        // The SEO checks of every page being published (spec §4.1): a blocking one holds Publish.
        <section className="space-y-3" data-testid="publish-seo">
          {pairs.filter((p) => !isSiteWide(p.docId) && changedIds.includes(p.docId)).map((p) => (
            <div key={p.docId} className="space-y-1">
              {pairs.length > 1 && <h3 className="t-eyebrow text-[11px] m-0">{t.seo.gateTitle(p.label)}</h3>}
              <SeoGate
                docId={p.docId}
                doc={p.draft}
                path={isEditorialDocId(p.docId) ? editorialPreviewPath(p.docId, targets) ?? null : undefined}
                onBlocking={onBlocking}
              />
            </div>
          ))}
        </section>
      )}

      {actions && (
        <section className="card p-4 sm:p-5" data-testid="publish-actions">
          {siteWide ? <SitePreviewFlow pair={pair} changed={changes.length > 0} /> : (
            <PagePublish
              pairs={pairs.filter((p) => !isSiteWide(p.docId))}
              changedIds={changedIds}
              seoBlocked={seoState(pairs.filter((p) => !isSiteWide(p.docId) && changedIds.includes(p.docId)).map((p) => p.docId), seoBlocking)}
            />
          )}
        </section>
      )}
    </div>
  );
}
