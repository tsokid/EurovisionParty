// ⌘K / Ctrl+K: the admin's command palette (CMS P6, spec §4 "⌘K").
//
// Opens on ⌘K or Ctrl+K anywhere in the admin (also from the header's
// search button), closes on Escape or a click outside. Type, then Enter
// opens the first result; ↑ ↓ move, Home / End jump. A doc or field opens in
// at most two keystrokes after typing its name (Enter, or ↓ Enter).
//
// The index: the screens, every doc, the open doc's actions, and every
// field of the site pages with its text. The fields load once, the first
// time the palette opens (the published pages, cached by cmsApi).
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { CornerDownLeft, FileText, Rocket, Search, SquareMenu, TextCursorInput } from 'lucide-react';
import clsx from 'clsx';
import { fetchPublishedPages } from '../modules/pages/cmsApi';
import { SITE_PAGES } from '../modules/pages/sitePages';
import { actionItems, docItems, fieldItems, screenItems, search, type PaletteItem, type PaletteKind } from './paletteIndex';
import { t } from '../i18n';

const ICON: Record<PaletteKind, typeof FileText> = { action: Rocket, screen: SquareMenu, doc: FileText, field: TextCursorInput };

let fieldsCache: Promise<PaletteItem[]> | null = null;

/** The fields of every site page (published version), loaded once. */
function loadFields(): Promise<PaletteItem[]> {
  if (!fieldsCache) {
    fieldsCache = fetchPublishedPages(SITE_PAGES.map((p) => p.docId))
      .then((docs) => Object.entries(docs).flatMap(([id, doc]) => fieldItems(id, doc)));
    fieldsCache.catch(() => { fieldsCache = null; });
  }
  return fieldsCache;
}

/** Test hook. */
export function __resetPaletteForTests(): void {
  fieldsCache = null;
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The shortcut's label: ⌘K on a Mac, Ctrl+K elsewhere. */
export const shortcutLabel = () => (isMac() ? '⌘K' : 'Ctrl+K');

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [fields, setFields] = useState<PaletteItem[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // ⌘K / Ctrl+K toggles, anywhere in the admin.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => input.current?.focus());
    let live = true;
    loadFields().then((f) => { if (live) setFields(f); }, () => {});
    return () => {
      live = false;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  const items = useMemo(() => [...actionItems(pathname), ...screenItems(), ...docItems(), ...fields], [pathname, fields]);
  const results = useMemo(() => search(items, query, query ? 40 : 12), [items, query]);
  useEffect(() => setActive(0), [query]);

  // Keep the active option in view.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const go = useCallback((it: PaletteItem | undefined) => {
    if (!it) return;
    onOpenChange(false);
    if (/^https?:\/\//.test(it.to)) window.open(it.to, '_blank', 'noopener');
    else navigate(it.to);
  }, [navigate, onOpenChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = results.length;
    if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (n) setActive((a) => (a + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) setActive((a) => (a - 1 + n) % n); }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setActive(Math.max(0, n - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Tab') e.preventDefault(); // focus stays in the palette
  };

  if (!open) return null;
  const optionId = (i: number) => `cmdk-opt-${i}`;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onOpenChange(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.palette.title}
        onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-stage border border-stage-line-2 bg-stage-bg-2 shadow-stage"
        data-testid="command-palette"
      >
        <div className="flex items-center gap-2 border-b border-stage-line px-3">
          <Search size={16} aria-hidden className="shrink-0 text-stage-text-3" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={results.length ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-label={t.palette.input}
            placeholder={t.palette.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full bg-transparent text-[15px] text-stage-text placeholder:text-stage-text-3 outline-none"
          />
          <kbd className="hidden sm:inline rounded border border-stage-line px-1.5 text-[11px] text-stage-text-3">Esc</kbd>
        </div>
        <ul id="cmdk-list" ref={list} role="listbox" aria-label={t.palette.results} className="max-h-[55vh] overflow-y-auto p-1.5 m-0 list-none">
          {results.length === 0 && <li className="px-3 py-6 text-center t-small">{t.palette.none(query)}</li>}
          {results.map((it, i) => {
            const Icon = ICON[it.kind];
            const on = i === active;
            return (
              <li
                key={it.id}
                id={optionId(i)}
                role="option"
                aria-selected={on}
                data-index={i}
                onMouseMove={() => setActive(i)}
                onClick={() => go(it)}
                className={clsx('flex cursor-pointer items-center gap-3 rounded-stage-sm px-2.5 py-2', on ? 'bg-stage-surface-2' : 'hover:bg-stage-surface')}
              >
                <Icon size={16} aria-hidden className={clsx('shrink-0', it.kind === 'action' ? 'text-stage-pink' : 'text-stage-text-3')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-stage-text">{it.title}</span>
                  {it.subtitle && <span className="block truncate text-[12px] text-stage-text-3">{it.subtitle}</span>}
                </span>
                <span className="shrink-0 text-[11px] text-stage-text-3">{t.palette.kind[it.kind]}</span>
                {on && <CornerDownLeft size={14} aria-hidden className="shrink-0 text-stage-text-3" />}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stage-line px-3 py-2 text-[11px] text-stage-text-3">
          <span>{t.palette.hintMove}</span>
          <span>{t.palette.hintOpen}</span>
          <span>{t.palette.hintClose(shortcutLabel())}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The header's search button: opens the palette and shows the shortcut. */
export function PaletteButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t.palette.open(shortcutLabel())}
      className="inline-flex items-center gap-2 rounded-stage-pill border border-stage-line px-2.5 h-9 text-sm text-stage-text-3 hover:text-stage-text hover:border-stage-line-2 cursor-pointer"
      data-testid="palette-button"
    >
      <Search size={15} aria-hidden />
      <span className="hidden md:inline">{t.palette.search}</span>
      <kbd className="hidden md:inline rounded border border-stage-line px-1 text-[11px]">{shortcutLabel()}</kbd>
    </button>
  );
}
