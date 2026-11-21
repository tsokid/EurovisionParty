import { useState } from 'react';

interface Props {
  title: string;
  items: string[];
}

export default function ChecklistCard({ title, items }: Props) {
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <div className="card card-pad">
      <h3 className="t-h3 text-stage-text mb-4">{title}</h3>
      <ul className="space-y-3">
        {items.map((it, i) => {
          const checked = done.has(i);
          return (
            <li key={it} className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  setDone((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  });
                }}
                aria-pressed={checked}
                aria-label={`${checked ? 'Uncheck' : 'Check'} ${it}`}
                className={`mt-0.5 w-[22px] h-[22px] rounded-[7px] border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                  checked
                    ? 'border-transparent text-white'
                    : 'bg-stage-surface-2 border-stage-line-2 hover:border-stage-pink-2'
                }`}
                style={checked ? { background: 'var(--stage-gradient)' } : undefined}
              >
                {checked && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={`${checked ? 'text-stage-text-3 line-through' : 'text-stage-text-2'} leading-relaxed`}>{it}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
