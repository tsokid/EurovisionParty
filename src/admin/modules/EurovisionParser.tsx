// src/admin/modules/EurovisionParser.tsx
// Thin composition over four parser cards. State lives in useParserState; this
// component just slots data into the right card and provides a refresh handle.
// In the admin shell a picked year is the URL (/admin/game/parser/:year): the
// route passes `year` and `onPickYear`. Without a year it opens on the game year.

import { useEffect, useState } from "react";
import { useParserState } from "./parser/useParserState";
import { fetchLiveContestYear } from "../../lib/liveContestYear";
import { ParticipantsCard } from "./parser/ParticipantsCard";
import { ResultsCard } from "./parser/ResultsCard";
import { FinalizeCard } from "./parser/FinalizeCard";
import { ResetContestCard } from "./parser/ResetContestCard";
import { TestCard } from "./parser/TestCard";
import { ManualRankingCard } from "./parser/ManualRankingCard";
import { GamePhaseCard } from "./parser/GamePhaseCard";
import { t } from '../i18n';

export interface EurovisionParserProps {
  /** A year picked through the URL; null/undefined: the game year. */
  year?: number | null;
  /** Picks a year, e.g. by navigating. */
  onPickYear?: (year: number) => void;
}

export default function EurovisionParser({ year: routeYear = null, onPickYear }: EurovisionParserProps = {}) {
  // The page opens on the game year (the contest new rooms play), not on the
  // newest contest created; the picker switches to any year with parse jobs.
  const [localPicked, setPicked] = useState<number | null>(null);
  const picked = routeYear ?? localPicked;
  useEffect(() => {
    let cancelled = false;
    fetchLiveContestYear()
      .then((y) => { if (!cancelled) setPicked((p) => p ?? y); })
      .catch(() => { /* fall back to the latest parse_jobs year */ });
    return () => { cancelled = true; };
  }, []);
  const { jobs, runs, loading, refresh, year, years, error } = useParserState(picked);

  if (loading && Object.keys(jobs).length === 0) {
    return (
      <div className="p-4 text-white/60">
        {t.parser.loading}
        {error && (
          <div className="mt-3 text-xs">
            <p className="text-red-300">⚠️ {error}</p>
            <button
              type="button"
              onClick={() => refresh()}
              className="mt-2 px-3 py-1 rounded bg-white/10 text-white text-xs cursor-pointer"
            >
              {t.parser.retry}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (year == null) {
    return (
      <div className="p-4 text-white/60">
        {t.parser.noJobs1}<code>parse_jobs</code>{t.parser.noJobs2}
      </div>
    );
  }

  const lastParticipantsRun = runs.find((r) => r.kind === "participants");
  const resultsRuns = runs.filter((r) => r.kind === "results").slice(0, 10);
  const overrideOn = jobs.results?.manual_override === true;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-stage-text flex flex-wrap items-center gap-2 m-0">
          {t.parser.title}
          <select
            aria-label={t.parser.year}
            value={year}
            onChange={(e) => (onPickYear ? onPickYear(Number(e.target.value)) : setPicked(Number(e.target.value)))}
            className="bg-white/10 text-white/80 font-normal text-base rounded px-2 py-0.5 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y} className="text-black">{y}</option>
            ))}
          </select>
        </h2>
        <p className="text-xs text-white/50 mt-1">
          {t.parser.scope(year)}
        </p>
        <p className="text-sm text-white/60 mt-1">
          {t.parser.lede}
        </p>
      </header>

      {/* Background-refresh error banner. Cached data still renders below
          so the dashboard isn't blocked, but the user sees that the most
          recent poll failed and can retry on demand. */}
      {error && Object.keys(jobs).length > 0 && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-center justify-between">
          <span>{t.parser.cached(error)}</span>
          <button
            type="button"
            onClick={() => refresh()}
            className="px-2 py-1 rounded bg-white/10 text-white text-xs cursor-pointer"
          >
            {t.parser.retry}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GamePhaseCard year={year} />
        <ParticipantsCard
          job={jobs.participants}
          recentRun={lastParticipantsRun}
          runs={runs.filter((r) => r.kind === "participants")}
          onRefresh={refresh}
        />
        {/* When manual override is ON, the ResultsCard auto-parsing controls
            don't apply — ManualRankingCard takes over below as the source of
            truth. We still render ResultsCard so the run history stays visible,
            but it's effectively read-only (start/stop is gated by the override
            flag in the edge function). */}
        <ResultsCard
          job={jobs.results}
          recentRuns={resultsRuns}
          onRefresh={refresh}
        />
        <FinalizeCard job={jobs.results} onRefresh={refresh} />
        <ResetContestCard year={year} onRefresh={refresh} />
        <TestCard />
        <ManualRankingCard job={jobs.results} onRefresh={refresh} />
      </div>
      {overrideOn && (
        <div className="text-xs text-white/40 text-center">
          {t.parser.override}
        </div>
      )}
    </div>
  );
}
