// src/admin/modules/parser/StatusPill.tsx
// Small colored pill that renders a parse_jobs.status value.
import type { JobStatus } from "./useParserState";

const COLORS: Record<JobStatus, string> = {
  idle: "bg-white/10 text-white/70",
  running: "bg-yellow-400/20 text-yellow-300 animate-pulse",
  stopped: "bg-orange-400/20 text-orange-300",
  finalized: "bg-purple-400/20 text-purple-300",
  done: "bg-emerald-400/20 text-emerald-300",
  error: "bg-red-400/20 text-red-300",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
