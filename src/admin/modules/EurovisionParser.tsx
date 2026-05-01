// src/admin/modules/EurovisionParser.tsx
// Thin composition over four parser cards. State lives in useParserState; this
// component just slots data into the right card and provides a refresh handle.

import { useParserState } from "./parser/useParserState";
import { ParticipantsCard } from "./parser/ParticipantsCard";
import { ResultsCard } from "./parser/ResultsCard";
import { FinalizeCard } from "./parser/FinalizeCard";
import { TestCard } from "./parser/TestCard";
import { ManualRankingCard } from "./parser/ManualRankingCard";

export default function EurovisionParser() {
  const { jobs, runs, loading, error, refresh } = useParserState(2026);

  if (loading) {
    return <div className="p-4 text-white/60">Loading parser state…</div>;
  }
  if (error) {
    return <div className="p-4 text-red-300">Error: {error}</div>;
  }

  const lastParticipantsRun = runs.find((r) => r.kind === "participants");
  const resultsRuns = runs.filter((r) => r.kind === "results").slice(0, 10);
  const overrideOn = jobs.results?.manual_override === true;

  // Pick the year to display. Prefer the participants job year, fall back to
  // results, then a sensible default. Keeps the UI year-agnostic.
  const displayYear = jobs.participants?.year ?? jobs.results?.year ?? 2026;

  return (
    <div className="p-4 space-y-4">
      <header>
        <h2 className="text-xl font-bold text-white">
          🛰️ Eurovision Parser ({displayYear})
        </h2>
        <p className="text-sm text-white/60 mt-1">
          Manual host control with cron fallbacks. Participants auto-runs the
          morning of grand-final week (Athens time) if still idle. Results
          auto-starts at kick-off and polls every 2 min.
        </p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ParticipantsCard
          job={jobs.participants}
          recentRun={lastParticipantsRun}
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
        <TestCard />
        <ManualRankingCard job={jobs.results} onRefresh={refresh} />
      </div>
      {overrideOn && (
        <div className="text-xs text-white/40 text-center">
          🔧 Manual override is active. The Results parser cron + on-demand calls
          are disabled until you toggle override OFF.
        </div>
      )}
    </div>
  );
}
