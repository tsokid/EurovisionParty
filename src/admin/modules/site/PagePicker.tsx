// Pick where a link goes: a searchable list of the site's pages, FAQ
// questions and contest pages, plus (footer only) «Άλλο site» with an
// https:// address. Destinations already in the list are shown but disabled.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Check, ExternalLink, Search, X } from 'lucide-react';
import { IconButton, TextInput } from '../../ui/kit';
import type { LinkTarget } from '../../../../supabase/functions/_shared/cms/siteLinks';
import type { TargetOption } from './targets';

export interface PagePickerProps {
  open: boolean;
  title: string;
  options: TargetOption[];
  /** Keys already used in this list (disabled), except the link being changed. */
  taken: ReadonlySet<string>;
  allowExternal: boolean;
  onPick: (option: { target: LinkTarget; label: { en: string; el: string } }) => void;
  onClose: () => void;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function PagePicker({ open, title, options, taken, allowExternal, onPick, onClose }: PagePickerProps) {
  const [q, setQ] = useState('');
  const [url, setUrl] = useState('https://');
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setQ('');
    setUrl('https://');
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shown = useMemo(() => {
    const n = norm(q.trim());
    return n ? options.filter((o) => norm(`${o.name} ${o.path} ${o.label.en} ${o.label.el}`).includes(n)) : options;
  }, [q, options]);
  const groups = [...new Set(shown.map((o) => o.group))];
  const urlOk = /^https:\/\/[^\s/]+\.[^\s]+$/.test(url.trim());

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card relative w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-b-none sm:rounded-b-[var(--radius-stage-lg)]"
      >
        <div className="flex items-center gap-2 p-4 pb-3 border-b border-stage-line">
          <h2 id={titleId} className="t-h3 text-stage-text flex-1">{title}</h2>
          <IconButton label="Κλείσιμο" onClick={onClose}><X size={18} aria-hidden /></IconButton>
        </div>
        <div className="p-4 pb-2">
          <div className="relative">
            <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-stage-text-3" />
            <TextInput
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση σελίδας"
              aria-label="Αναζήτηση σελίδας"
              className="pl-9"
            />
          </div>
        </div>
        <div className="overflow-y-auto px-2 pb-3 min-h-0">
          {groups.map((g) => (
            <section key={g} className="mt-2">
              <h3 className="t-eyebrow text-[11px] px-2 pb-1">{g}</h3>
              <ul>
                {shown.filter((o) => o.group === g).map((o) => {
                  const used = taken.has(o.key);
                  return (
                    <li key={o.key}>
                      <button
                        type="button"
                        disabled={used}
                        onClick={() => onPick({ target: o.target, label: o.label })}
                        className={clsx(
                          'w-full flex items-center gap-3 rounded-stage-sm px-2 min-h-11 text-left',
                          used ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stage-surface-2 cursor-pointer',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-stage-text truncate">{o.name}</span>
                          <span className="block t-meta truncate">{o.path}</span>
                        </span>
                        {used && <span className="t-meta flex items-center gap-1 shrink-0"><Check size={14} aria-hidden />Ήδη στη λίστα</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {shown.length === 0 && <p className="t-small px-2 py-4">Καμία σελίδα δεν ταιριάζει με «{q}».</p>}
        </div>
        {allowExternal && (
          <form
            className="border-t border-stage-line p-4 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!urlOk) return;
              const href = url.trim();
              onPick({ target: { kind: 'external', href }, label: { en: '', el: '' } });
            }}
          >
            <label className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-stage-text-2 mb-1">
                <ExternalLink size={14} aria-hidden />Άλλο site
              </span>
              <TextInput value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" aria-label="Διεύθυνση άλλου site" />
            </label>
            <button type="submit" disabled={!urlOk} className="btn btn-secondary btn-sm">Προσθήκη διεύθυνσης</button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
