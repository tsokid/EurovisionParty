// src/admin/modules/contests/PublishBar.tsx
// Top of the Contests module: how many years changed since the last
// successful publish, the last run (status, commit, time), the Publish
// button and the outcome of the latest publish. State lives in
// usePublisher (publish.ts) so the module's auto-publish shares it.

import { COMMIT_URL, outcomeText, yearRanges, type Publisher } from './publish';

function unpublishedText(p: Publisher): string | null {
  if (!p.summary) return null;
  if (p.summary.since === null) return 'Never published';
  const n = p.summary.changed_years.length;
  if (n === 0) return 'No unpublished changes';
  return `${n} unpublished change${n === 1 ? '' : 's'} (year${n === 1 ? '' : 's'} ${yearRanges(p.summary.changed_years)})`;
}

const OUTCOME_STYLE = {
  ok: 'text-emerald-300',
  noop: 'text-white/70',
  busy: 'text-amber-300',
  error: 'text-red-300',
} as const;

export function PublishBar({ publisher: p }: { publisher: Publisher }) {
  const pending = unpublishedText(p);
  const run = p.lastRun;
  const hasChanges = !!p.summary && (p.summary.since === null || p.summary.changed_years.length > 0);

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { p.publish(); }}
          disabled={p.publishing}
          className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
        >
          {p.publishing ? 'Publishing…' : 'Publish'}
        </button>
        {pending && (
          <span className={`text-sm font-semibold ${hasChanges ? 'text-amber-200' : 'text-white/60'}`}>{pending}</span>
        )}
      </div>

      {run && (
        <p className="text-xs text-white/60">
          Last publish: {run.status}
          {run.commit_sha && (
            <>
              {' · '}
              <a
                href={`${COMMIT_URL}${run.commit_sha}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sky-300 underline"
              >
                {run.commit_sha.slice(0, 7)}
              </a>
            </>
          )}
          {run.finished_at && ` · ${new Date(run.finished_at).toLocaleString()}`}
        </p>
      )}
      {run?.status === 'error' && run.error && <p className="text-xs text-red-300 break-all">{run.error}</p>}

      {p.outcome && (
        <p className={`text-sm ${OUTCOME_STYLE[p.outcome.status]}`}>
          {outcomeText(p.outcome)}
          {p.outcome.status === 'ok' && p.outcome.sha && (
            <>
              {' Commit '}
              <a
                href={`${COMMIT_URL}${p.outcome.sha}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sky-300 underline"
              >
                {p.outcome.sha.slice(0, 7)}
              </a>
              .
            </>
          )}
        </p>
      )}
      {p.outcome?.warning && <p className="text-xs text-amber-300 break-all">Warning: {p.outcome.warning}</p>}
      {p.loadError && <p className="text-xs text-red-300">{p.loadError}</p>}

      <p className="text-xs text-white/40">The site updates about 2 minutes after a successful publish.</p>
    </section>
  );
}
