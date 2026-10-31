// src/admin/modules/contests/PublishBar.tsx
// Top of the Contests and Pages modules: how many years and CMS pages
// changed since the last successful publish, the last run (status, commit,
// time), the Publish button, the outcome of the latest publish and its
// content warnings. State lives in usePublisher (publish.ts) so a module's
// auto-publish shares it.

import { COMMIT_URL, formatRunTime, outcomeText, warningText, yearRanges, type Publisher } from './publish';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function changeCount(p: Publisher): number {
  return p.summary ? p.summary.changed_years.length + (p.summary.changed_docs?.length ?? 0) : 0;
}

function unpublishedText(p: Publisher): string | null {
  if (!p.summary) return null;
  if (p.summary.since === null) return 'Never published';
  const years = p.summary.changed_years;
  const docs = p.summary.changed_docs ?? [];
  const n = years.length + docs.length;
  if (n === 0) return 'No unpublished changes';
  const head = `${n} unpublished change${n === 1 ? '' : 's'}`;
  if (docs.length === 0) return `${head} (year${n === 1 ? '' : 's'} ${yearRanges(years)})`;
  const parts = [
    years.length > 0 && `${plural(years.length, 'year')} (${yearRanges(years)})`,
    `${plural(docs.length, 'page')} (${docs.join(', ')})`,
  ].filter(Boolean);
  return `${head}: ${parts.join(', ')}`;
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
  const hasChanges = !!p.summary && (p.summary.since === null || changeCount(p) > 0);
  const warnings = p.outcome?.warnings ?? [];

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { p.publish().catch(() => {}); }}
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
          {run.finished_at && ` · ${formatRunTime(run.finished_at)}`}
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
      {warnings.length > 0 && (
        <details className="text-xs text-amber-200">
          <summary className="cursor-pointer font-semibold">{plural(warnings.length, 'content warning')}</summary>
          <ul className="mt-1 space-y-0.5 pl-4 list-disc break-words">
            {warnings.map((w, i) => (
              <li key={i}>{warningText(w)}</li>
            ))}
          </ul>
        </details>
      )}
      {p.loadError && <p className="text-xs text-red-300">{p.loadError}</p>}

      <p className="text-xs text-white/40">The site updates about 2 minutes after a successful publish.</p>
    </section>
  );
}
