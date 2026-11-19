// src/admin/modules/parser/ParseReport.tsx
// What the last parse run found (owner request, 19 Nov 2026): one row per
// country with flag, country and artist/song (or place/points), the changes
// since the previous run of the same kind, and warnings. Blocked runs are
// reported too: their rows show what the page held, nothing was written.

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { flagEmoji } from "../../../pages/seo/content/contestText";
import type { ParseRun } from "./useParserState";
import { diffRuns, runWarnings, type ParseKind, type ReportRow } from "./reportRules";

interface Props {
  kind: ParseKind;
  year: number;
  /** Runs of this kind and year, newest first. */
  runs: ParseRun[];
}

export function ParseReport({ kind, year, runs }: Props) {
  const withRows = runs.filter((r) => Array.isArray(r.rows));
  const last = withRows[0];
  const prev = withRows[1] ?? null;
  const [finalists, setFinalists] = useState<string[]>([]);

  useEffect(() => {
    if (kind !== "results") return;
    let cancelled = false;
    Promise.resolve(
      supabase.from("game_entries").select("iso").eq("year", year).eq("in_final", true),
    )
      .then((res) => {
        const data = (res as { data?: { iso: string }[] | null } | undefined)?.data;
        if (!cancelled) setFinalists((data ?? []).map((r) => r.iso));
      })
      .catch(() => { /* the finalist warnings are skipped */ });
    return () => { cancelled = true; };
  }, [kind, year, last?.id]);

  if (!last) return null;
  const rows = (last.rows ?? []) as ReportRow[];
  const warnings = runWarnings(kind, year, last.source_url ?? null, rows, finalists);
  const diff = diffRuns(kind, (prev?.rows ?? null) as ReportRow[] | null, rows);
  const changedIso = new Map(diff.changed.map((c) => [c.iso, c.fields]));
  const written = last.status === "ok";
  const sorted = kind === "results" ? [...rows].sort((a, b) => (a.place ?? 999) - (b.place ?? 999)) : rows;

  return (
    <details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs" open={!written || warnings.length > 0}>
      <summary className="cursor-pointer text-white/80 font-semibold">
        Parse report · {rows.length} {rows.length === 1 ? "country" : "countries"} ·{" "}
        {written ? (
          <span className="text-emerald-300">written to the game</span>
        ) : (
          <span className="text-amber-300">not written ({last.status})</span>
        )}
      </summary>

      <p className="mt-2 text-white/50 break-all">
        {new Date(last.finished_at).toLocaleString()}
        {last.source_url && <> · source: <span className="text-white/70">{last.source_url}</span></>}
      </p>
      {!written && last.error && <p className="mt-1 text-amber-300">Blocked: {last.error}</p>}

      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-amber-300">
          {warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
        </ul>
      )}

      <p className="mt-2 text-white/60">
        {prev ? (
          <>
            Since the previous run: <span className="text-emerald-300">+{diff.added.length} added</span>
            {diff.added.length > 0 && ` (${diff.added.join(", ")})`} ·{" "}
            <span className="text-red-300">−{diff.removed.length} removed</span>
            {diff.removed.length > 0 && ` (${diff.removed.join(", ")})`} ·{" "}
            <span className="text-sky-300">{diff.changed.length} changed</span>
          </>
        ) : (
          "First run with a report: nothing to compare yet."
        )}
      </p>

      {rows.length > 0 && (
        <div className="mt-2 max-h-80 overflow-auto">
          <table className="w-full text-left">
            <thead className="text-white/40">
              <tr>
                {kind === "results" && <th className="py-1 pr-2">#</th>}
                <th className="py-1 pr-2">Country</th>
                {kind === "participants" ? (
                  <>
                    <th className="py-1 pr-2">Artist</th>
                    <th className="py-1">Song</th>
                  </>
                ) : (
                  <th className="py-1">Points</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const changed = changedIso.get(r.iso) ?? [];
                const isNew = diff.added.includes(r.iso);
                const cell = (field: string, value: string | number | undefined) => (
                  <span className={changed.includes(field) ? "text-sky-300 font-semibold" : undefined}>
                    {value === undefined || value === "" ? <span className="text-red-300">missing</span> : value}
                  </span>
                );
                return (
                  <tr key={r.iso} className={`border-t border-white/5 ${isNew ? "bg-emerald-500/10" : ""}`}>
                    {kind === "results" && <td className="py-1 pr-2 tabular-nums">{cell("place", r.place)}</td>}
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {flagEmoji(r.iso)} {r.name ?? r.iso}
                    </td>
                    {kind === "participants" ? (
                      <>
                        <td className="py-1 pr-2">{cell("artist", r.artist)}</td>
                        <td className="py-1">{cell("song", r.song)}</td>
                      </>
                    ) : (
                      <td className="py-1 tabular-nums">{cell("points", r.points)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
