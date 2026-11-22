// Dense admin variants of the Stage primitives (spec §3: no separate
// palette): inputs, icon buttons, a switch, a status chip, a confirm dialog
// and the undo toast. Stage tokens only; fonts unchanged.
import clsx from 'clsx';
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type ComponentPropsWithRef, type DragEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Link, useInRouterContext } from 'react-router-dom';

export const INPUT =
  'w-full min-w-0 h-10 rounded-stage-sm px-3 text-[15px] bg-stage-bg text-stage-text border border-stage-line-2 ' +
  'placeholder:text-stage-text-3 focus-visible:outline-2 focus-visible:outline-stage-pink-2 focus-visible:outline-offset-1 ' +
  'aria-[invalid=true]:border-stage-bad disabled:opacity-60';

export function TextInput({ invalid, className, ...rest }: ComponentPropsWithRef<'input'> & { invalid?: boolean }) {
  return <input {...rest} aria-invalid={invalid || undefined} className={clsx(INPUT, className)} />;
}

/** A labelled input with its inline error. */
export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[13px] font-semibold text-stage-text-2 mb-1">{label}</span>
      {children}
      {error ? <span className="block text-[12px] text-stage-bad mt-1">{error}</span> : hint ? <span className="block t-meta mt-1">{hint}</span> : null}
    </label>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={clsx(
        'inline-grid place-items-center size-9 shrink-0 rounded-stage-sm text-stage-text-2 hover:text-stage-text hover:bg-stage-surface-2 cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-stage-pink-2 disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** An on/off switch with a visible label. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors cursor-pointer disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-stage-pink-2 focus-visible:outline-offset-2',
        checked ? 'bg-stage-ok/80 border-stage-ok' : 'bg-stage-surface-3 border-stage-line-2',
      )}
    >
      <span className={clsx('absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export type ChipTone = 'ok' | 'gold' | 'muted' | 'pink' | 'bad';

export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={clsx('chip !text-[12px] !py-0.5', tone !== 'muted' && `chip-${tone}`)}>{children}</span>;
}

/** A modal confirm: title, body, a cancel and a confirm button. Esc and the backdrop cancel. */
export function ConfirmDialog({
  open, title, children, confirmLabel, cancelLabel = 'Ακύρωση', danger, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="card relative w-full max-w-md p-5 sm:p-6">
        <h2 id={titleId} className="t-h3 text-stage-text">{title}</h2>
        {children && <div className="t-small mt-2 space-y-2">{children}</div>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn btn-ghost btn-sm">{cancelLabel}</button>
          <button
            type="button"
            onClick={onConfirm}
            className={clsx('btn btn-sm', danger ? 'bg-stage-bad text-white border-transparent' : 'btn-primary')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Toasts ─────────────────────────────────────────────────────────────
type Toast = { id: number; text: string; undo?: () => void };

type ToastApi = { show: (text: string, undo?: () => void) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

export const useToast = (): ToastApi => useContext(ToastContext);

/** How long an undo toast stays (ms). */
export const TOAST_MS = 7000;

/** Bottom-centre toasts; one with `undo` shows an «Αναίρεση» button until it times out. */
export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((text: string, undo?: () => void) => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, text, undo }]);
    setTimeout(() => dismiss(id), TOAST_MS);
  }, [dismiss]);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-x-0 bottom-4 z-[95] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} role="status" className="pointer-events-auto flex items-center gap-3 rounded-stage bg-stage-surface-3 border border-stage-line-2 shadow-stage pl-4 pr-1.5 py-1.5 max-w-md w-full sm:w-auto">
              <span className="text-sm text-stage-text flex-1 min-w-0">{t.text}</span>
              {t.undo && (
                <button
                  type="button"
                  onClick={() => { t.undo!(); dismiss(t.id); }}
                  className="h-9 px-3 rounded-stage-sm text-sm font-semibold text-stage-pink-2 hover:bg-stage-surface-2 cursor-pointer"
                >
                  Αναίρεση
                </button>
              )}
              <IconButton label="Κλείσιμο" onClick={() => dismiss(t.id)}><X size={16} aria-hidden /></IconButton>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// ── Drag to reorder ────────────────────────────────────────────────────
/** Moves the item at `from` to `to` (a new array). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list];
  const out = [...list];
  const [it] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, it);
  return out;
}

/**
 * HTML5 drag-and-drop reordering for a list: spread `itemProps(i)` on each
 * item and `handleProps(i)` on its grip. Touch screens and keyboards use the
 * up/down buttons instead.
 */
export function useDragReorder(onMove: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const itemProps = (i: number) => ({
    onDragOver: (e: DragEvent) => {
      if (dragging === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over !== i) setOver(i);
    },
    onDrop: (e: DragEvent) => {
      if (dragging === null) return;
      e.preventDefault();
      onMove(dragging, i);
      setDragging(null);
      setOver(null);
    },
    'data-drop-target': over === i && dragging !== null && dragging !== i ? 'true' : undefined,
    'data-dragging': dragging === i ? 'true' : undefined,
  });
  const handleProps = (i: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragging(i);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
    },
    onDragEnd: () => { setDragging(null); setOver(null); },
  });
  return { itemProps, handleProps, dragging };
}

/** A router link, or a plain anchor where no router is mounted (a module rendered alone in a test). */
export function AdminLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const routed = useInRouterContext();
  return routed ? <Link to={to} className={className}>{children}</Link> : <a href={to} className={className}>{children}</a>;
}
