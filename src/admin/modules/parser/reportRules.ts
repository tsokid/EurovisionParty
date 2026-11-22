// Parse confirmation report (owner, 19 Nov 2026): what a parse run found,
// what changed since the previous run of the same kind, and warnings.
// Pure; the rows come from parse_runs.rows (migration 080). The warnings are
// in Greek (src/admin/i18n.ts).
import { t } from "../../i18n";

const R = t.parserUi.report;

export type ParseKind = "participants" | "results";

/** One row as the edge function logs it: participants carry name/artist/song, results place/points. */
export interface ReportRow {
  iso: string;
  name?: string;
  artist?: string;
  song?: string;
  place?: number;
  points?: number;
}

export interface RunDiff {
  added: string[];
  removed: string[];
  /** ISO and the fields that changed. */
  changed: Array<{ iso: string; fields: string[] }>;
}

/** Same bounds as the edge function's participants gate (rule C). */
export const MIN_FINALISTS = 20;
export const MAX_FINALISTS = 27;

const FIELDS: Record<ParseKind, Array<keyof ReportRow>> = {
  participants: ["artist", "song"],
  results: ["place", "points"],
};

/** Added, removed and changed countries of `cur` against the previous run `prev` (null: first run). */
export function diffRuns(kind: ParseKind, prev: ReportRow[] | null, cur: ReportRow[]): RunDiff {
  if (!prev) return { added: [], removed: [], changed: [] };
  const before = new Map(prev.map((r) => [r.iso, r]));
  const after = new Map(cur.map((r) => [r.iso, r]));
  const added = cur.filter((r) => !before.has(r.iso)).map((r) => r.iso);
  const removed = prev.filter((r) => !after.has(r.iso)).map((r) => r.iso);
  const changed = cur
    .filter((r) => before.has(r.iso))
    .map((r) => ({
      iso: r.iso,
      fields: FIELDS[kind].filter((f) => (before.get(r.iso)![f] ?? null) !== (r[f] ?? null)) as string[],
    }))
    .filter((c) => c.fields.length > 0);
  return { added, removed, changed };
}

/**
 * Warnings for one run:
 * - participants: a country without artist or song; a count outside 20–27;
 * - results: a country outside the year's grand final; a count different
 *   from the finalists; a place used twice;
 * - both: a page of another year, or not the grand-final page.
 * `finalists` is the year's grand-final line-up (ISOs), for results.
 */
export function runWarnings(
  kind: ParseKind,
  year: number,
  sourceUrl: string | null,
  rows: ReportRow[],
  finalists: string[] = [],
): string[] {
  const out: string[] = [];
  if (sourceUrl) {
    const years = [...sourceUrl.matchAll(/(?:^|\D)((?:19|20)\d{2})(?!\d)/g)].map((m) => Number(m[1]));
    if (years.some((y) => y !== year)) out.push(R.otherYear([...new Set(years)].join(", "), year));
    if (!/grand-final/i.test(sourceUrl)) out.push(R.notFinal);
  }
  if (kind === "participants") {
    const missing = rows.filter((r) => !r.artist?.trim() || !r.song?.trim()).map((r) => r.iso);
    if (missing.length) out.push(R.noArtist(missing.join(", ")));
    if (rows.length && (rows.length < MIN_FINALISTS || rows.length > MAX_FINALISTS)) {
      out.push(R.count(rows.length, MIN_FINALISTS, MAX_FINALISTS));
    }
  } else {
    if (finalists.length) {
      const final = new Set(finalists);
      const outside = rows.filter((r) => !final.has(r.iso)).map((r) => r.iso);
      if (outside.length) out.push(R.outside(year, outside.join(", ")));
      if (rows.length && rows.length !== finalists.length) {
        out.push(R.resultsCount(rows.length, finalists.length));
      }
    }
    const seen = new Set<number>();
    const dup = new Set<number>();
    for (const r of rows) {
      if (r.place == null) continue;
      if (seen.has(r.place)) dup.add(r.place);
      seen.add(r.place);
    }
    if (dup.size) out.push(R.dupPlace([...dup].sort((a, b) => a - b).join(", ")));
  }
  return out;
}
