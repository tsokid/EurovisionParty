import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Flag } from '../../components/stage';
import { visibleColumns, type ResultColumn, type ResultRole } from './table';

export type RowTone = 'p1' | 'p2' | 'p3' | 'hl' | 'muted' | 'gold';

interface Props<R> {
  columns: ResultColumn<R>[];
  rows: R[];
  rowKey: (row: R, i: number) => string | number;
  /** Flag in the lead cell. */
  iso?: (row: R) => string | null | undefined;
  tone?: (row: R) => RowTone | null | undefined;
  caption?: string;
  className?: string;
}

const MISSING = '—';

const CELL: Record<ResultRole, string> = {
  pos: 'rt-pos',
  main: 'rt-main',
  sub: 'rt-sub',
  num: 'rt-num',
  pts: 'rt-pts',
  aux: 'rt-aux',
  desk: 'rt-desk',
};

/** Lead cell content: a bold title and an optional second line. */
export function Lead({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <span className="rt-t">{title}</span>
      {sub != null && sub !== '' && <span className="rt-s">{sub}</span>}
    </>
  );
}

/**
 * Stage results table. One semantic `<table>`:
 * - ≥768px: real columns in a card (board desktop tables).
 * - <768px: each row is a Stage entry row: position rail, flag + title,
 *   a second line from the `sub` columns, points on the right rail.
 * Columns with no data in any row are dropped; a gap shows a dash.
 */
export default function ResultsTable<R>({ columns, rows, rowKey, iso, tone, caption, className }: Props<R>) {
  const cols = visibleColumns(rows, columns);
  const roles = new Set(cols.map((c) => c.role));
  return (
    <div className={clsx('rt-card', className)}>
      <table
        role="table"
        className={clsx('rt', !roles.has('pos') && 'rt-nopos', roles.has('aux') && 'rt-has-aux', !!iso && 'rt-flags')}
      >
        {caption && <caption>{caption}</caption>}
        <thead role="rowgroup">
          <tr role="row">
            {cols.map((c) => (
              <th key={c.header} role="columnheader" className={CELL[c.role]}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} role="row" className={tone?.(r) ?? undefined}>
              {cols.map((c) => {
                const v = c.cell(r);
                if (c.role === 'main') {
                  return (
                    <td key={c.header} role="cell" className="rt-main">
                      <div className="rt-lead">
                        {iso && <Flag iso={iso(r)} />}
                        <div className="rt-lead-t">{v ?? MISSING}</div>
                      </div>
                    </td>
                  );
                }
                return (
                  <td key={c.header} role="cell" className={clsx(CELL[c.role], v == null && 'rt-gap')}>
                    {v ?? MISSING}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `.seg` menu of in-page anchors (decades, result tables). */
export function AnchorNav({ label, items, className }: { label: string; items: { id: string; label: string }[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className={clsx('seg anchor-nav', className)}>
      {items.map((it) => (
        <a key={it.id} href={`#${it.id}`}>{it.label}</a>
      ))}
    </nav>
  );
}
