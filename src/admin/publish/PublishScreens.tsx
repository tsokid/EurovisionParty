// The publish screens (spec §3, CMS P5):
// - /admin/publish: every unpublished change, grouped like the site; pick
//   pages to review and publish them, or «Δημοσίευση όλων» (with the list of
//   what it sends); the recent runs with their deploy state.
// - /admin/pages/:docId/publish, /admin/header|footer|settings/publish: one
//   doc's diff and its publish (site-wide docs through the Vercel preview).
// - /admin/publish/runs/:runId: one run, its commit, deploy and revert.
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Globe2, Rocket } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatError } from '../lib/formatError';
import { AdminLink, ConfirmDialog } from '../ui/kit';
import { adminPaths } from '../paths';
import { t } from '../i18n';
import { cmsList, type CmsListRow } from '../modules/pages/cmsApi';
import { COMMIT_URL, formatRunTime, invokePublish, outcomeText, yearRanges, type PublishOutcome, type PublishRun, type UnpublishedSummary } from '../modules/contests/publish';
import { docTitle, getRun, listRuns, useRunWatch } from './api';
import { isSiteWide } from './diff';
import { DeployChip, FailureNotice } from './DeployState';
import { PublishReview, RunCard } from './PublishReview';

const LINK = 'text-stage-pink-2 hover:underline';

function Title({ title, lede }: { title: string; lede?: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold text-stage-text m-0">{title}</h1>
      {lede && <p className="t-small mt-1.5 max-w-2xl">{lede}</p>}
    </header>
  );
}

/** What a run shipped, in words. */
export function runWhat(run: PublishRun): string {
  if (run.promoted_from != null) return t.publishFlow.runPromote(run.promoted_from);
  const docs = (run.doc_ids ?? []).map((d) => docTitle(d)).join(', ');
  if (run.target === 'preview') return t.publishFlow.runPreviewOf(docs);
  if (run.doc_ids?.length) return docs;
  return run.cms === false ? t.publishFlow.runContests : t.publishFlow.runAll;
}

function RunRow({ run }: { run: PublishRun }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-stage-line px-3 py-2.5 last:border-0" data-testid="run-row">
      <span className="num t-meta w-12">#{run.id}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-stage-text">{runWhat(run)}</span>
      <span className="t-meta num">{run.finished_at ? formatRunTime(run.finished_at) : t.publish.runStatus.running}</span>
      {run.status === 'error' ? <span className="text-xs font-semibold text-stage-bad">{t.publish.runStatus.error}</span> : <DeployChip run={run} />}
      <AdminLink to={adminPaths.publishRun(run.id)} className={`${LINK} text-xs`}>{t.publishFlow.runDetails}</AdminLink>
    </li>
  );
}

export function PublishQueueScreen() {
  const [params, setParams] = useSearchParams();
  const selected = useMemo(() => (params.get('docs') ?? '').split(',').filter(Boolean), [params]);
  const [summary, setSummary] = useState<UnpublishedSummary | null>(null);
  const [rows, setRows] = useState<CmsListRow[]>([]);
  const [runs, setRuns] = useState<PublishRun[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  const [allRun, setAllRun] = useState<PublishRun | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, list, r] = await Promise.all([
        supabase.rpc('unpublished_summary').then((res: { data: unknown; error: unknown }) => { if (res.error) throw res.error; return res.data as UnpublishedSummary; }),
        cmsList(),
        listRuns(12).catch(() => [] as PublishRun[]),
      ]);
      setSummary(s);
      setRows(list);
      setRuns(r);
      setErr(null);
    } catch (e) {
      setErr(formatError(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const changed = summary?.changed_docs ?? [];
  const pages = changed.filter((d) => !isSiteWide(d));
  const siteWide = changed.filter(isSiteWide);
  const years = summary?.changed_years ?? [];
  const savedAt = (docId: string) => rows.find((r) => r.doc_id === docId)?.updated_at;
  const toggle = (docId: string) => {
    const next = selected.includes(docId) ? selected.filter((d) => d !== docId) : [...selected, docId];
    setParams(next.length ? { docs: next.join(',') } : {}, { replace: true });
  };

  const publishAll = async () => {
    setConfirming(false);
    setBusy(true);
    setOutcome(null);
    setAllRun(null);
    const o = await invokePublish();
    setOutcome(o);
    if (o.status === 'ok' && o.run_id) setAllRun(await getRun(o.run_id).catch(() => null));
    setBusy(false);
    await load();
  };

  const nothing = summary && pages.length + siteWide.length + years.length === 0;

  return (
    <div className="max-w-[1600px] space-y-5 pb-10">
      <Title title={t.publishFlow.title} lede={t.publishFlow.lede} />
      {err && <p role="alert" className="text-sm text-stage-bad">{t.publishFlow.loadError(err)}</p>}
      {!summary && !err && <p className="t-small">{t.publishFlow.loading}</p>}
      {nothing && <p className="card card-pad t-small">{t.publishFlow.nothing}</p>}

      {summary && !nothing && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          <section className="card p-0 overflow-hidden" data-testid="publish-queue">
            {pages.length > 0 && (
              <div>
                <h2 className="t-eyebrow text-[11px] px-4 pt-4 pb-2 m-0">{t.publishFlow.groupPages}</h2>
                <ul className="m-0 p-0 list-none">
                  {pages.map((d) => (
                    <li key={d} className={clsx('flex items-center gap-3 px-4 py-2.5 border-t border-stage-line', selected.includes(d) && 'bg-stage-surface-2')}>
                      <input type="checkbox" className="h-4 w-4 accent-[var(--color-stage-pink)] cursor-pointer" aria-label={t.publishFlow.pick(docTitle(d))} checked={selected.includes(d)} onChange={() => toggle(d)} />
                      <button type="button" onClick={() => toggle(d)} className="min-w-0 flex-1 text-left cursor-pointer">
                        <span className="block truncate text-sm font-semibold text-stage-text">{docTitle(d)}</span>
                        {savedAt(d) && <span className="t-meta">{t.publishFlow.saved(formatRunTime(savedAt(d)!))}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {siteWide.length > 0 && (
              <div>
                <h2 className="t-eyebrow text-[11px] px-4 pt-4 pb-1 m-0">{t.publishFlow.groupSiteWide}</h2>
                <p className="t-meta px-4 pb-2 m-0">{t.publishFlow.groupSiteWideHint}</p>
                <ul className="m-0 p-0 list-none">
                  {siteWide.map((d) => (
                    <li key={d} className="flex items-center gap-3 px-4 py-2.5 border-t border-stage-line">
                      <Globe2 size={16} aria-hidden className="shrink-0 text-stage-gold" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stage-text">{docTitle(d)}</span>
                      <AdminLink to={adminPaths.docPublish(d)} className="btn btn-ghost btn-sm">{t.publishFlow.openPreview}</AdminLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {years.length > 0 && (
              <div>
                <h2 className="t-eyebrow text-[11px] px-4 pt-4 pb-1 m-0">{t.publishFlow.groupContests}</h2>
                <p className="t-small px-4 m-0">{yearRanges(years)}</p>
                <p className="t-meta px-4 pb-3 m-0">{t.publishFlow.groupContestsHint}</p>
              </div>
            )}
            <div className="border-t border-stage-line p-4 space-y-2">
              <button type="button" className="btn btn-ghost btn-sm w-full" disabled={busy || (pages.length === 0 && years.length === 0)} onClick={() => setConfirming(true)} data-testid="publish-all">
                <Rocket size={15} aria-hidden />{busy ? t.publishFlow.publishing : t.publishFlow.publishAll}
              </button>
              {outcome && outcome.status !== 'ok' && <p className="t-small m-0">{outcomeText(outcome)}</p>}
              {allRun && <RunCard run={allRun} lead={t.publishFlow.published} />}
            </div>
          </section>

          <div className="min-w-0">
            {selected.length > 0 ? <PublishReview docIds={selected} /> : (
              <p className="card card-pad t-small">{t.publishFlow.reviewHint}</p>
            )}
          </div>
        </div>
      )}

      <section className="card p-0 overflow-hidden" data-testid="run-log">
        <h2 className="t-h3 text-stage-text px-4 pt-4 pb-2 m-0">{t.publishFlow.runs}</h2>
        {runs && runs.length === 0 && <p className="t-small px-4 pb-4">{t.publishFlow.runsEmpty}</p>}
        {runs && runs.length > 0 && <ul className="m-0 p-0 list-none">{runs.map((r) => <RunRow key={r.id} run={r} />)}</ul>}
      </section>

      <ConfirmDialog open={confirming} title={t.publishFlow.publishAllTitle} confirmLabel={t.publishFlow.publishAll} onCancel={() => setConfirming(false)} onConfirm={() => { void publishAll(); }}>
        {pages.length > 0 ? (
          <>
            <p>{t.publishFlow.publishAllList}</p>
            <ul className="list-disc pl-5" data-testid="publish-all-list">{pages.map((d) => <li key={d}>{docTitle(d)}</li>)}</ul>
          </>
        ) : <p>{t.publishFlow.publishAllEmpty}</p>}
        {years.length > 0 && <p>{t.publishFlow.publishAllContests(yearRanges(years))}</p>}
        {siteWide.length > 0 && <p>{t.publishFlow.publishAllSkips(siteWide.map((d) => docTitle(d)).join(', '))}</p>}
        <p>{t.publishFlow.eta}</p>
      </ConfirmDialog>
    </div>
  );
}

export function DocPublishScreen({ docId, label }: { docId: string; label: string }) {
  return (
    <div className="max-w-[1600px] space-y-4 pb-10">
      <AdminLink to={adminPaths.editorOf(docId)} className={`${LINK} inline-flex items-center gap-1 text-sm`}>
        <ArrowLeft size={15} aria-hidden />{t.history.back}
      </AdminLink>
      <Title title={`${t.publishFlow.title}: ${label}`} />
      <PublishReview docIds={[docId]} />
    </div>
  );
}

export function RunScreen({ runId }: { runId: number }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<PublishRun | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getRun(runId).then((r) => { if (live) setLoaded(r); }, (e: unknown) => { if (live) { setErr(formatError(e)); setLoaded(null); } });
    return () => { live = false; };
  }, [runId]);
  const { run } = useRunWatch(loaded ?? null);

  if (loaded === undefined) return <p className="t-small">{t.common.loading}</p>;
  if (!run) return <p className="t-small">{err ? t.publishFlow.loadError(err) : t.publishFlow.runNotFound}</p>;
  const sha = run.commit_sha;
  const rowsOf: Array<[string, ReactNode]> = [
    [t.publishFlow.runDocs, runWhat(run)],
    [t.publishFlow.runStarted, run.started_at ? formatRunTime(run.started_at) : '—'],
    [t.publishFlow.runFinished, run.finished_at ? formatRunTime(run.finished_at) : t.publish.runStatus.running],
    [t.publishFlow.runCommit, sha ? <a href={`${COMMIT_URL}${sha}`} target="_blank" rel="noreferrer" className="font-mono text-stage-pink-2 underline">{sha.slice(0, 7)}</a> : '—'],
    [t.publishFlow.runDeploy, <span key="d" className="inline-flex flex-wrap items-center gap-2"><DeployChip run={run} />{run.deploy_url && <a href={run.deploy_url} target="_blank" rel="noreferrer" className={`${LINK} text-xs`}>{t.publishFlow.openDeployment} ↗</a>}</span>],
  ];
  if (run.reverted_sha) rowsOf.push([t.publishFlow.runRevert, <a key="r" href={`${COMMIT_URL}${run.reverted_sha}`} target="_blank" rel="noreferrer" className="font-mono text-stage-pink-2 underline">{run.reverted_sha.slice(0, 7)}</a>]);

  return (
    <div className="max-w-3xl space-y-4 pb-10" data-testid="run-screen">
      <button type="button" onClick={() => navigate(adminPaths.publish())} className={`${LINK} inline-flex items-center gap-1 text-sm cursor-pointer`}>
        <ArrowLeft size={15} aria-hidden />{t.publishFlow.back}
      </button>
      <Title title={t.nav.run(run.id)} />
      <FailureNotice run={run} />
      {run.status === 'error' && run.error && <p role="alert" className="card card-pad text-sm text-stage-bad break-words">{t.publish.failed(run.error)}</p>}
      <dl className="card p-4 sm:p-5 grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_minmax(0,1fr)] m-0">
        {rowsOf.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="t-meta">{k}</dt>
            <dd className="m-0 text-sm text-stage-text break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {run.target === 'preview' && run.doc_ids?.length === 1 && (
        <AdminLink to={adminPaths.docPublish(run.doc_ids[0])} className="btn btn-primary btn-sm inline-flex">
          <Rocket size={15} aria-hidden />{t.publishFlow.goLive}
        </AdminLink>
      )}
    </div>
  );
}
