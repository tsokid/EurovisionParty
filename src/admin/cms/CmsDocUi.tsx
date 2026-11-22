// The collaborative-editing UI around a CMS document (spec §4): the
// autosave status pill, the presence chips of the other editors (plus a
// highlight on the field each one is in), and the dialog for a field both
// editors changed (owner Q1 = A).
import clsx from 'clsx';
import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, CloudOff, Loader2, RotateCw } from 'lucide-react';
import { t } from '../i18n';
import type { CmsDoc } from './useCmsDoc';
import type { SaveStatus } from './docSession';
import { describePath, pathKey, type Choice, type FieldConflict } from './fieldDiff';
import { AdminUserContext, initials, personName, type Peer } from './docChannel';

/** A value for a quoted CSS attribute selector. */
const attr = (v: string) => v.replace(/["\\]/g, (c) => `\\${c}`);

const time = (ms: number) => new Date(ms).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const PILL: Record<SaveStatus, { tone: string; icon: 'ok' | 'spin' | 'off' | 'bad' }> = {
  saved: { tone: 'chip-ok', icon: 'ok' },
  pending: { tone: '', icon: 'spin' },
  saving: { tone: '', icon: 'spin' },
  offline: { tone: 'chip-gold', icon: 'off' },
  error: { tone: 'chip-bad', icon: 'bad' },
  invalid: { tone: 'chip-gold', icon: 'bad' },
  conflict: { tone: 'chip-pink', icon: 'bad' },
};

export function pillText(status: SaveStatus, lastSavedAt: number | null): string {
  switch (status) {
    case 'saved': return lastSavedAt ? t.autosave.savedAt(time(lastSavedAt)) : t.autosave.saved;
    case 'pending':
    case 'saving': return t.autosave.saving;
    case 'offline': return t.autosave.offline;
    case 'error': return t.autosave.error;
    case 'invalid': return t.autosave.invalid;
    case 'conflict': return t.autosave.conflict;
  }
}

/** «Αποθηκεύτηκε 12:04» / «Αποθήκευση…» / «Εκτός σύνδεσης – θα αποθηκευτεί» / «Σφάλμα – ξαναδοκίμασε». */
export function AutosavePill({ doc }: { doc: Pick<CmsDoc, 'status' | 'lastSavedAt' | 'error' | 'flush'> }) {
  const { status } = doc;
  const p = PILL[status];
  const text = pillText(status, doc.lastSavedAt);
  const Icon = p.icon === 'ok' ? Check : p.icon === 'spin' ? Loader2 : p.icon === 'off' ? CloudOff : AlertTriangle;
  const body = (
    <>
      <Icon size={13} aria-hidden className={clsx('shrink-0', p.icon === 'spin' && 'animate-spin motion-reduce:animate-none')} />
      <span className="truncate">{text}</span>
      {status === 'error' && <RotateCw size={12} aria-hidden className="shrink-0" />}
    </>
  );
  const cls = clsx('chip !text-[12px] !py-0.5 max-w-full gap-1.5', p.tone);
  if (status === 'error') {
    return (
      <button type="button" onClick={() => { void doc.flush(); }} className={clsx(cls, 'cursor-pointer')} title={doc.error ?? undefined} data-testid="autosave-pill" data-status={status}>
        {body}
      </button>
    );
  }
  return (
    <span role="status" aria-live="polite" className={cls} title={status === 'offline' || status === 'invalid' ? t.autosave.keptLocally : undefined} data-testid="autosave-pill" data-status={status}>
      {body}
    </span>
  );
}

const AVATAR_TONES = ['bg-stage-pink/80', 'bg-stage-purple/80', 'bg-stage-live/70 text-stage-bg', 'bg-stage-gold/80 text-stage-bg'];
const toneOf = (key: string) => AVATAR_TONES[[...key].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];

/** The other people (tabs) on this document, with the field each one is in. */
export function PresenceChips({ peers, me }: { peers: Peer[]; me?: string | null }) {
  if (peers.length === 0) return null;
  return (
    <div role="group" aria-label={t.presence.label} className="flex flex-wrap items-center gap-1.5" data-testid="presence">
      <span className="sr-only">{t.presence.alsoHere(peers.length)}</span>
      {peers.map((p) => {
        const sameUser = !!me && p.userId === me;
        const where = p.fieldLabel ? t.presence.editing(p.fieldLabel) : t.presence.viewing;
        return (
          <span key={p.key} className="inline-flex items-center gap-1.5 max-w-full rounded-stage-pill border border-stage-line-2 bg-stage-surface-2 pl-0.5 pr-2.5 h-7 text-[12px] text-stage-text-2" title={`${p.email ?? ''} · ${where}`}>
            <span aria-hidden className={clsx('grid place-items-center size-6 rounded-full text-[10px] font-bold text-white', toneOf(p.userId))}>{initials(p.email)}</span>
            <span className="font-semibold text-stage-text truncate">{personName(p.email)}{sameUser ? ` (${t.presence.otherTab})` : ''}</span>
            <span className="truncate hidden sm:inline">· {where}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Outlines the fields other people are in (inputs carrying data-cms-field). */
export function PeerFieldHighlights({ peers }: { peers: Peer[] }) {
  const css = useMemo(() => peers
    .filter((p) => p.field)
    .map((p) => `[data-cms-field="${attr(p.field!)}"]{outline:2px dashed var(--color-stage-purple-2);outline-offset:2px}`)
    .join('\n'), [peers]);
  if (!css) return null;
  return <style data-testid="peer-highlights">{css}</style>;
}

/** The field's label as the editor shows it, else its path in words. */
export function fieldName(path: FieldConflict['path']): string {
  const key = pathKey(path);
  if (typeof document !== 'undefined') {
    const el = document.querySelector<HTMLElement>(`[data-cms-field="${attr(key)}"]`);
    const label = el?.getAttribute('aria-label') ?? (el as HTMLInputElement | null)?.labels?.[0]?.textContent;
    if (label) return label.trim();
  }
  return describePath(path);
}

export function showValue(v: unknown): string {
  if (v === undefined || v === null || v === '') return t.conflict.empty;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v, null, 2);
}

/** Two values of one field, side by side (or stacked on phones). */
export function ValuePair({ leftTitle, left, rightTitle, right, tone = 'pink' }: { leftTitle: string; left: unknown; rightTitle: string; right: unknown; tone?: 'pink' | 'gold' }) {
  const box = 'min-w-0 rounded-stage-sm border border-stage-line bg-stage-bg p-2.5 text-[13px] text-stage-text whitespace-pre-wrap break-words max-h-48 overflow-auto';
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="min-w-0">
        <p className="t-meta mb-1">{leftTitle}</p>
        <div className={box}>{showValue(left)}</div>
      </div>
      <div className="min-w-0">
        <p className={clsx('t-meta mb-1', tone === 'pink' ? 'text-stage-pink-2' : 'text-stage-gold')}>{rightTitle}</p>
        <div className={box}>{showValue(right)}</div>
      </div>
    </div>
  );
}

/** «Το ίδιο πεδίο άλλαξε και από τις δύο πλευρές»: keep mine, take theirs, or choose per field. */
export function ConflictDialog({ doc }: { doc: Pick<CmsDoc, 'conflict' | 'resolve' | 'conflictName'> }) {
  const c = doc.conflict;
  const titleId = useId();
  const firstRef = useRef<HTMLButtonElement>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const fieldsKey = c ? c.fields.map((f) => pathKey(f.path)).join('|') : '';
  useEffect(() => { setChoices({}); }, [fieldsKey]);
  useEffect(() => { if (c) firstRef.current?.focus(); }, [c]);
  if (!c || typeof document === 'undefined') return null;
  const name = doc.conflictName;
  const many = c.fields.length > 1;
  const allChosen = c.fields.every((f) => choices[pathKey(f.path)]);

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="card relative w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] flex flex-col">
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-stage-line">
          <h2 id={titleId} className="t-h3 text-stage-text flex items-start gap-2">
            <AlertTriangle size={20} aria-hidden className="shrink-0 mt-0.5 text-stage-pink-2" />
            {t.conflict.title}
          </h2>
          <p className="t-small mt-2">{t.conflict.lede(name, c.fields.length)}</p>
        </div>
        <ol className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {c.fields.map((f, i) => {
            const key = pathKey(f.path);
            const pick = choices[key];
            return (
              <li key={key} className="space-y-2" data-testid="conflict-field">
                <p className="text-sm font-semibold text-stage-text">{fieldName(f.path)}</p>
                <ValuePair leftTitle={t.conflict.mine} left={f.mine} rightTitle={t.conflict.theirs(name)} right={f.theirs} />
                {many && (
                  <div role="radiogroup" aria-label={`${t.conflict.perField}: ${fieldName(f.path)}`} className="flex flex-wrap gap-2">
                    {(['mine', 'theirs'] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        role="radio"
                        aria-checked={pick === ch}
                        onClick={() => setChoices((s) => ({ ...s, [key]: ch }))}
                        className={clsx('btn btn-sm !min-h-9 !px-3', pick === ch ? 'btn-secondary !border-stage-pink-2' : 'btn-ghost')}
                      >
                        {ch === 'mine' ? t.conflict.keepMine : t.conflict.takeTheirs}
                      </button>
                    ))}
                  </div>
                )}
                {i < c.fields.length - 1 && <hr className="border-stage-line !mt-5" />}
              </li>
            );
          })}
        </ol>
        <div className="p-4 sm:p-5 border-t border-stage-line flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {many && (
            <button type="button" disabled={!allChosen} onClick={() => { void doc.resolve(c.fields.map((f) => choices[pathKey(f.path)])); }} className="btn btn-ghost btn-sm">
              {t.conflict.apply}
            </button>
          )}
          <button type="button" onClick={() => { void doc.resolve('theirs'); }} className="btn btn-secondary btn-sm">
            {t.conflict.takeTheirs}
          </button>
          <button ref={firstRef} type="button" onClick={() => { void doc.resolve('mine'); }} className="btn btn-primary btn-sm">
            {t.conflict.keepMine}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Pill + presence in one row, for an editor's sticky header. */
export function CmsDocStatus({ doc }: { doc: CmsDoc }) {
  const me = useContext(AdminUserContext)?.userId ?? null;
  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <AutosavePill doc={doc} />
      <PresenceChips peers={doc.peers} me={me} />
      <PeerFieldHighlights peers={doc.peers} />
      <ConflictDialog doc={doc} />
    </div>
  );
}
