import type { ReactNode } from 'react';

interface Props {
  caption?: string;
  headers: string[];
  rows: ReactNode[][];
  align?: ('left' | 'center' | 'right')[];
}

export default function DataTable({ caption, headers, rows, align }: Props) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[480px] text-sm">
        {caption && <caption className="text-left text-white/50 text-xs mb-2 px-4 sm:px-0">{caption}</caption>}
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`py-3 px-4 sm:px-2 text-white/70 font-semibold text-xs uppercase tracking-wider text-${align?.[i] ?? 'left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-white/5 last:border-b-0">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`py-3.5 px-4 sm:px-2 text-white/85 text-${align?.[ci] ?? 'left'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
