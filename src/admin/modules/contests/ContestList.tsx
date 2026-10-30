// src/admin/modules/contests/ContestList.tsx
// Table of contests, newest first, with stage badges and only the
// lifecycle buttons that allowedActions permits.

import { ACTION_LABELS, allowedActions, type ContestAction, type ContestRow, type ContestStage } from './lifecycle';

export type ContestSummary = ContestRow & { finalist_count: number };

const STAGE_BADGE: Record<ContestStage, string> = {
  upcoming: 'bg-sky-500/20 text-sky-200 border-sky-400/30',
  current: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  finalized: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  archived: 'bg-white/10 text-white/60 border-white/20',
};

const ACTION_BUTTON: Record<ContestAction, string> = {
  start: 'bg-emerald-500 text-black',
  finalize: 'bg-amber-500 text-black',
  archive: 'bg-fuchsia-500 text-black',
  unarchive: 'bg-white/15 text-white',
};

interface Props {
  contests: ContestSummary[];
  /** Whether a room of `year` exists; only Y+1 of the latest archived year is ever asked. */
  hasRooms: (year: number) => boolean;
  selectedYear: number | null;
  busy: boolean;
  onAction: (action: ContestAction, contest: ContestSummary) => void;
  onSelect: (year: number) => void;
}

export function ContestList({ contests, hasRooms, selectedYear, busy, onAction, onSelect }: Props) {
  const sorted = [...contests].sort((a, b) => b.year - a.year);

  if (sorted.length === 0) {
    return <p className="text-sm text-white/50">No contests yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-white/50 uppercase tracking-wide border-b border-white/10">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2">City</th>
            <th className="px-3 py-2">Host</th>
            <th className="px-3 py-2">Final</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Entries</th>
            <th className="px-3 py-2">Finalists</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const actions = allowedActions(c, sorted, hasRooms(c.year + 1));
            const selected = c.year === selectedYear;
            return (
              <tr
                key={c.year}
                className={`border-b border-white/5 last:border-0 ${selected ? 'bg-white/10' : ''}`}
              >
                <td className="px-3 py-2 font-bold text-white">{c.year}</td>
                <td className="px-3 py-2 text-white/80">{c.city}</td>
                <td className="px-3 py-2 text-white/60">{c.host_iso ?? '—'}</td>
                <td className="px-3 py-2 text-white/60">{c.final_date ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STAGE_BADGE[c.stage]}`}>
                    {c.stage}
                  </span>
                </td>
                <td className="px-3 py-2 text-white/80">{c.entry_count}</td>
                <td className="px-3 py-2 text-white/80">{c.finalist_count}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(c.year)}
                      className="px-2.5 py-1 rounded border border-white/15 text-white/80 text-xs cursor-pointer"
                    >
                      Entries
                    </button>
                    {actions.map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={busy}
                        onClick={() => onAction(a, c)}
                        className={`px-2.5 py-1 rounded font-bold text-xs disabled:opacity-40 cursor-pointer ${ACTION_BUTTON[a]}`}
                      >
                        {ACTION_LABELS[a]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
