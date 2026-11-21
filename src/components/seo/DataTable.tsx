import type { ReactNode } from 'react';

interface Props {
  caption?: string;
  headers: string[];
  rows: ReactNode[][];
  align?: ('left' | 'center' | 'right')[];
}

const ALIGN = { left: undefined, center: 'dt-c', right: 'dt-r' } as const;

/**
 * One semantic `<table>` for every viewport (Stage).
 * - ≥768px: a real table in a card, eyebrow headers on the bg-2 band.
 * - <768px: CSS stacks each row like an `.entry`: the first cell leads; a
 *   right-aligned (numeric) first column becomes the left position rail;
 *   numeric cells show their header as a small label (`data-label`).
 * The explicit ARIA roles keep the table semantics in browsers that drop them
 * from the accessibility tree once a table is no longer `display: table`.
 */
export default function DataTable({ caption, headers, rows, align }: Props) {
  const numericFirst = align?.[0] === 'right';
  return (
    <div className="dt-card">
      <table role="table" className={`dt${numericFirst ? ' dt-pos' : ''}`}>
        {caption && <caption>{caption}</caption>}
        <thead role="rowgroup">
          <tr role="row">
            {headers.map((h, i) => (
              <th key={h} role="columnheader" className={ALIGN[align?.[i] ?? 'left']}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((r, ri) => (
            <tr key={ri} role="row">
              {r.map((cell, ci) => {
                const a = align?.[ci] ?? 'left';
                const cls = [ALIGN[a], a === 'right' && 'dt-num'].filter(Boolean).join(' ') || undefined;
                return (
                  <td key={ci} role="cell" className={cls} data-label={headers[ci]}>
                    {cell}
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
