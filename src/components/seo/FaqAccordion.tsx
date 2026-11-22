import { useState, type ReactNode } from 'react';

export interface FaqItem {
  q: string;
  a: string;
  /** Rich answer (replaces the plain `a` paragraph). */
  body?: ReactNode;
  /** Anchor id on the item (e.g. /faq#leave). */
  id?: string;
}

interface Props {
  items: FaqItem[];
  // singleOpen=true → expanding one closes the others (matches inspiration)
  singleOpen?: boolean;
  /** Prefix of the panel ids; must be unique per page when there are several accordions. */
  idPrefix?: string;
  /** Indexes open on first render (and in the prerendered HTML). */
  defaultOpen?: number[];
}

export default function FaqAccordion({ items, singleOpen = true, idPrefix = 'faq', defaultOpen }: Props) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(defaultOpen ?? []));

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
    <div className="acc">
      {items.map((it, i) => {
        const isOpen = open.has(i);
        return (
          <div key={it.q} id={it.id} className={`acc-item${isOpen ? ' open' : ''}`}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              aria-controls={`${idPrefix}-${i}`}
              className="acc-btn"
            >
              <span className="acc-q">{it.q}</span>
              <span className="acc-ico" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {isOpen ? <path d="M5 12h14" /> : <path d="M12 5v14M5 12h14" />}
                </svg>
              </span>
            </button>
            {isOpen && (
              <div id={`${idPrefix}-${i}`} className="acc-panel">
                {it.body ?? <p>{it.a}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
