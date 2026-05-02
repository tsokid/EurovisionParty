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
  const { jobs, runs, loading, refresh } = useParserState(2026);

  if (loading && Object.keys(jobs).length === 0) {
    return <div className="p-4 text-white/60">Loading parser state…</div>;
  }

  const lastParticipantsRun = runs.find((r) => r.kind === "participants");
  const resultsRuns = runs.filter((r) => r.kind === "results").slice(0, 10);
  const overrideOn = jobs.results?.manual_override === true;

  return (
    <div className="p-4 space-y-4">
      <header>
        <h2 className="text-xl font-bold text-white">
          🛰️ Eurovision Parser
        </h2>
        <p className="text-sm text-white/60 mt-1">
          Manual host control with cron fallbacks. Each parser has its own
          schedule (start, end, poll interval) editable below — all times in
          Athens (Europe/Athens) timezone.
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
