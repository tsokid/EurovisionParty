import { useState } from 'react';

interface Props {
  title: string;
  items: string[];
}

export default function ChecklistCard({ title, items }: Props) {
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
      <h3 className="font-bold text-white text-lg mb-4">{title}</h3>
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
                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                  checked
                    ? 'bg-euro-pink border-euro-pink text-white'
                    : 'bg-transparent border-white/30 hover:border-euro-pink-light/60'
                }`}
              >
                {checked && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={`${checked ? 'text-white/45 line-through' : 'text-white/85'} leading-relaxed`}>{it}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
