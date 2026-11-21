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
 */
export default function DataTable({ caption, headers, rows, align }: Props) {
  const numericFirst = align?.[0] === 'right';
  return (
    <div className="dt-card">
      <table className={`dt${numericFirst ? ' dt-pos' : ''}`}>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={ALIGN[align?.[i] ?? 'left']}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => {
                const a = align?.[ci] ?? 'left';
                const cls = [ALIGN[a], a === 'right' && 'dt-num'].filter(Boolean).join(' ') || undefined;
                return (
                  <td key={ci} className={cls} data-label={headers[ci]}>
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
