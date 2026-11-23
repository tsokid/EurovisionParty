import type { ReactNode } from 'react';

type Align = 'left' | 'center' | 'right';

export interface Column<R> {
  header: string;
  /** The cell, or null/undefined when this row has no data for the column. */
  value: (row: R) => ReactNode | null | undefined;
  align?: Align;
}

export interface TableProps {
  headers: string[];
  rows: ReactNode[][];
  align: Align[];
}

const MISSING = '—';

/**
 * DataTable props with "where we have information" applied (spec §9): a column
 * no row has data for is dropped; a gap in a kept column shows a dash.
 */
export function visibleTable<R>(rows: R[], columns: Column<R>[]): TableProps {
  const kept = columns.filter((c) => rows.some((r) => c.value(r) != null));
  return {
    headers: kept.map((c) => c.header),
    rows: rows.map((r) => kept.map((c) => c.value(r) ?? MISSING)),
    align: kept.map((c) => c.align ?? 'left'),
  };
}

// ─── Stage results table (archive, country, winners) ─────────────────────────

/**
 * Where a column sits in a Stage results row.
 * - pos:  left rail (place or year, numeral font).
 * - main: the lead cell (flag + title, optional second line).
 * - sub:  its own column from 768px; on phones it joins the second line under
 *         the title (the first two sub columns, "a · b").
 * - num:  numeric column shown from 768px only (jury / televote).
 * - pts:  right rail (points, numeral font).
 * - aux:  its own column from 768px; on phones a small line under the rail.
 * - desk: text column shown from 768px only (its data is also in another cell).
 */
export type ResultRole = 'pos' | 'main' | 'sub' | 'num' | 'pts' | 'aux' | 'desk';

export interface ResultColumn<R> {
  header: string;
  role: ResultRole;
  /** The cell, or null/undefined when this row has no data for the column. */
  cell: (row: R) => ReactNode | null | undefined;
}

/** Columns no row has data for are dropped (the lead cell always stays). */
export function visibleColumns<R>(rows: R[], columns: ResultColumn<R>[]): ResultColumn<R>[] {
  return columns.filter((c) => c.role === 'main' || rows.some((r) => c.cell(r) != null));
}

export interface Decade<R> {
  /** Anchor id, e.g. `d2020`. */
  id: string;
  /** "2020–2026" (heading) and "2020–26" (menu). */
  label: string;
  short: string;
  rows: R[];
}

/**
 * Rows grouped by decade, in the rows' own order. The label runs from the
 * first to the last year present in that decade (1956–1959, 2020–2026).
 */
export function byDecade<R>(rows: R[], year: (r: R) => number): Decade<R>[] {
  const groups = new Map<number, R[]>();
  for (const r of rows) {
    const d = Math.floor(year(r) / 10) * 10;
    const g = groups.get(d);
    if (g) g.push(r);
    else groups.set(d, [r]);
  }
  return [...groups.entries()].map(([d, rs]) => {
    const ys = rs.map(year);
    const from = Math.min(...ys);
    const to = Math.max(...ys);
    return {
      id: `d${d}`,
      label: from === to ? String(from) : `${from}–${to}`,
      short: from === to ? String(from) : `${from}–${String(to).slice(2)}`,
      rows: rs,
    };
  });
}
