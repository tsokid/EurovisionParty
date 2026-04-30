import { useState } from 'react';

export interface FaqItem {
  q: string;
  a: string;
}

interface Props {
  items: FaqItem[];
  // singleOpen=true → expanding one closes the others (matches inspiration)
  singleOpen?: boolean;
}

export default function FaqAccordion({ items, singleOpen = true }: Props) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(singleOpen ? [] : prev);
      if (prev.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const isOpen = open.has(i);
        return (
          <div
            key={it.q}
            className={`rounded-xl border ${isOpen ? 'border-euro-pink/40 bg-white/[0.03]' : 'border-white/10'} transition-colors`}
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              aria-controls={`faq-${i}`}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-semibold text-white text-[15px] sm:text-base">{it.q}</span>
              <span
                className={`shrink-0 w-6 h-6 flex items-center justify-center text-euro-pink-light text-xl transition-transform ${
                  isOpen ? 'rotate-45' : ''
                }`}
                aria-hidden
              >
                +
              </span>
            </button>
            {isOpen && (
              <div id={`faq-${i}`} className="px-5 pb-5 pt-0 text-white/75 leading-relaxed border-t border-white/5">
                <p className="pt-4">{it.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
