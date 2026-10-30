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
