// The deploy state of a publish run (CMS P5): a chip («Χτίζεται…», «Live»,
// «Απέτυχε») and, for a failed build, the notice that says what happened to
// the site and to the commit.
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { StatusChip, type ChipTone } from '../ui/kit';
import { COMMIT_URL, DEPLOY_WATCH_MS, type PublishRun } from '../modules/contests/publish';
import { t } from '../i18n';

const TONE: Record<string, ChipTone> = {
  building: 'gold', ready: 'ok', error: 'bad', reverted: 'bad', revert_blocked: 'bad', none: 'muted',
};

/** The deploy state of a run as one word or two. */
type DeployFields = Pick<PublishRun, 'status' | 'commit_sha' | 'deploy_state' | 'target' | 'finished_at'>;

export function deployLabel(run: DeployFields): { key: string; text: string; tone: ChipTone } | null {
  if (run.status !== 'ok' || !run.commit_sha) return { key: 'none', text: t.publishFlow.deploy.none, tone: 'muted' };
  // A run from before 086 (or one nobody followed) has no recorded state: say nothing.
  const fresh = !run.finished_at || Date.now() - Date.parse(run.finished_at) < DEPLOY_WATCH_MS;
  if (!run.deploy_state && !fresh) return null;
  const key = run.deploy_state ?? 'building';
  const text = key === 'ready' && run.target === 'preview' ? t.publishFlow.deploy.previewReady : t.publishFlow.deploy[key];
  return { key, text, tone: TONE[key] ?? 'muted' };
}

export function DeployChip({ run }: { run: DeployFields }) {
  const d = deployLabel(run);
  if (!d) return null;
  return (
    <span data-testid="deploy-chip" data-state={d.key} className="inline-flex">
      <StatusChip tone={d.tone}>
        {d.key === 'building' && <Loader2 size={12} aria-hidden className="mr-1 inline animate-spin motion-reduce:animate-none" />}
        {d.text}
      </StatusChip>
    </span>
  );
}

const short = (sha: string) => sha.slice(0, 7);

/** What a failed build did: reverted (the site is as it was), or blocked (someone has to look). */
export function FailureNotice({ run }: { run: PublishRun }) {
  const state = run.deploy_state;
  if (state !== 'reverted' && state !== 'revert_blocked' && state !== 'error') return null;
  if (state === 'error' && run.target !== 'preview') return null; // the revert is on its way
  const reverted = state === 'reverted';
  const title = reverted ? t.publishFlow.revertedTitle : state === 'revert_blocked' ? t.publishFlow.blockedTitle : t.publishFlow.previewFailed;
  return (
    <div role="alert" data-testid="failure-notice" data-state={state} className="rounded-stage border border-stage-bad/50 bg-stage-bad/10 p-4 space-y-2">
      <p className="flex items-start gap-2 font-semibold text-stage-text m-0">
        {reverted ? <RotateCcw size={18} aria-hidden className="mt-0.5 shrink-0 text-stage-bad" /> : <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0 text-stage-bad" />}
        <span>{title}</span>
      </p>
      {state !== 'error' && (
        <p className="t-small m-0">
          {reverted ? (
            <>
              {t.publishFlow.revertedText}{' '}
              {t.publishFlow.revertCommit}:{' '}
              <a href={`${COMMIT_URL}${run.reverted_sha}`} target="_blank" rel="noreferrer" className="font-mono text-stage-pink-2 underline">{short(run.reverted_sha ?? '')}</a>
            </>
          ) : t.publishFlow.blockedText}
        </p>
      )}
      {run.deploy_note && (
        <p className="t-meta m-0 break-words"><span className="font-semibold">{t.publishFlow.buildMessage}:</span> {run.deploy_note}</p>
      )}
      {run.deploy_url && (
        <a href={run.deploy_url} target="_blank" rel="noreferrer" className="t-meta text-stage-pink-2 underline">{t.publishFlow.openDeployment} ↗</a>
      )}
    </div>
  );
}
