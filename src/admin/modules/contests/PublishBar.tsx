// src/admin/modules/contests/PublishBar.tsx
// Top of the Contests and Pages modules: how many years and CMS pages
// changed since the last successful publish, the last run (status, commit,
// time), the Publish button, the outcome of the latest publish and its
// content warnings. State lives in usePublisher (publish.ts) so a module's
// auto-publish shares it.

import { COMMIT_URL, formatRunTime, outcomeText, warningText, yearRanges, type Publisher } from './publish';
import { t } from '../../i18n';
import { AdminLink } from '../../ui/kit';
import { DeployChip, FailureNotice } from '../../publish/DeployState';
import { SITE_WIDE_DOC_IDS } from '../../../../supabase/functions/_shared/cms/siteLinks';

/** The page drafts the full Publish ships: the site-wide docs go through a preview instead (Q3 = C). */
const pageDrafts = (p: Publisher) => (p.summary?.changed_docs ?? []).filter((d) => !(SITE_WIDE_DOC_IDS as readonly string[]).includes(d));

/** "Publish", or "Publish (contests + N page drafts)" when the manual Publish will ship page drafts too. */
function publishLabel(p: Publisher): string {
  const docs = pageDrafts(p).length;
  return docs ? t.publish.buttonWithDocs(docs) : t.publish.button;
}

function changeCount(p: Publisher): number {
  return p.summary ? p.summary.changed_years.length + (p.summary.changed_docs?.length ?? 0) : 0;
}

function unpublishedText(p: Publisher): string | null {
  if (!p.summary) return null;
  if (p.summary.since === null) return t.publish.never;
  const years = p.summary.changed_years;
  const docs = p.summary.changed_docs ?? [];
  const n = years.length + docs.length;
  if (n === 0) return t.publish.none;
  const head = t.publish.pending(n);
  if (docs.length === 0) return `${head} ${t.publish.yearsOnly(yearRanges(years))}`;
  const parts = [
    years.length > 0 && t.publish.years(years.length, yearRanges(years)),
    t.publish.pages(docs.length, docs.join(', ')),
  ].filter(Boolean);
  return `${head}: ${parts.join(', ')}`;
}

const OUTCOME_STYLE = {
  ok: 'text-emerald-300',
  noop: 'text-white/70',
  busy: 'text-amber-300',
  error: 'text-red-300',
} as const;

/**
 * `reviewTo`: the Pages and Overview screens send people to the publish
 * screen (the diff, one page at a time) instead of publishing everything here.
 */
export function PublishBar({ publisher: p, reviewTo }: { publisher: Publisher; reviewTo?: string }) {
  const pending = unpublishedText(p);
  const run = p.lastRun;
  const hasChanges = !!p.summary && (p.summary.since === null || changeCount(p) > 0);
  const warnings = p.outcome?.warnings ?? [];

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {reviewTo ? (
          <AdminLink to={reviewTo} className="btn btn-primary btn-sm">{t.publishFlow.pageList}</AdminLink>
        ) : (
          <button
            type="button"
            onClick={() => { p.publish().catch(() => {}); }}
            disabled={p.publishing}
            className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          >
            {p.publishing ? t.publish.publishing : publishLabel(p)}
          </button>
        )}
        {pending && (
          <span className={`text-sm font-semibold ${hasChanges ? 'text-amber-200' : 'text-white/60'}`}>{pending}</span>
        )}
      </div>

      {run && (
        <p className="text-xs text-white/60">
          {t.publish.lastRun}: {t.publish.runStatus[run.status] ?? run.status}
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
          {run.status === 'ok' && run.commit_sha && <>{' '}<DeployChip run={run} /></>}
        </p>
      )}
      {run && <FailureNotice run={run} />}
      {run?.status === 'error' && run.error && <p className="text-xs text-red-300 break-all">{run.error}</p>}

      {p.outcome && (
        <p className={`text-sm ${OUTCOME_STYLE[p.outcome.status]}`}>
          {outcomeText(p.outcome)}
          {p.outcome.status === 'ok' && p.outcome.sha && (
            <>
              {` ${t.publish.commit} `}
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
      {p.outcome?.warning && <p className="text-xs text-amber-300 break-all">{t.publish.warning}: {p.outcome.warning}</p>}
      {warnings.length > 0 && (
        <details className="text-xs text-amber-200">
          <summary className="cursor-pointer font-semibold">{t.publish.contentWarnings(warnings.length)}</summary>
          <ul className="mt-1 space-y-0.5 pl-4 list-disc break-words">
            {warnings.map((w, i) => (
              <li key={i}>{warningText(w)}</li>
            ))}
          </ul>
        </details>
      )}
      {p.loadError && <p className="text-xs text-red-300">{p.loadError}</p>}

      <p className="text-xs text-white/40">{t.publish.siteUpdates}</p>
    </section>
  );
}
