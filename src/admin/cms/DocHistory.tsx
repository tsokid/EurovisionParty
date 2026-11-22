// The history of one CMS document (spec §3 …/history and …/history/:revId,
// §4 "History and restore"): a timeline of editing sessions, publishes,
// restores and the seed, plus the version the site shows now. Selecting an
// entry shows it against the current version, field by field; «Επαναφορά»
// writes it into the draft as a NEW revision (cms_restore), so nothing in
// the history is ever lost.
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { ArrowLeft, Globe2, History, RotateCcw, Rocket, Sprout, PencilLine } from 'lucide-react';
import { t } from '../i18n';
import { AdminLink, ConfirmDialog, StatusChip, useToast } from '../ui/kit';
import { formatError } from '../lib/formatError';
import { changedPaths, getAt, pathKey } from './fieldDiff';
import { cmsHistory, cmsRestore, cmsRevision, isMissingRpc, labelForPath, type RevisionRow } from './historyApi';
import { personName } from './docChannel';
import { ValuePair } from './CmsDocUi';
import type { RemoteDoc } from './docSession';

export const LIVE = 'live';

const when = (iso: string) =>
  new Date(iso).toLocaleString('el-GR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const KIND_ICON = { checkpoint: PencilLine, published: Rocket, restored: RotateCcw, seed: Sprout } as const;
const KIND_TONE = { checkpoint: 'muted', published: 'ok', restored: 'gold', seed: 'muted' } as const;

type Props = {
  docId: string;
  label: string;
  schema?: z.ZodType;
  /** The draft as saved now (or the published base, updatedAt null). */
  loadCurrent: () => Promise<RemoteDoc>;
  /** What the site shows now. */
  loadLive: () => Promise<unknown>;
  /** Saves a value as the draft (restoring the live version). */
  saveDraft: (value: unknown, expectedUpdatedAt: string | null) => Promise<string>;
  /** The selected entry: a revision id, LIVE, or null. */
  selected: string | null;
  onSelect: (sel: string | null) => void;
  editorPath: string;
  onRestored: () => void;
};

export function DocHistory({ docId, label, schema, loadCurrent, loadLive, saveDraft, selected, onSelect, editorPath, onRestored }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<RevisionRow[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [current, setCurrent] = useState<RemoteDoc | null>(null);
  const [live, setLive] = useState<unknown>(undefined);
  const [picked, setPicked] = useState<{ key: string; data: unknown } | null>(null);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const [cur, lv] = await Promise.all([loadCurrent(), loadLive().catch(() => undefined)]);
      setCurrent(cur);
      setLive(lv);
    } catch (e) {
      setErr(formatError(e));
    }
    try {
      setRows(await cmsHistory(docId));
      setUnavailable(false);
    } catch (e) {
      if (isMissingRpc(e)) { setUnavailable(true); setRows([]); }
      else setErr(formatError(e));
    }
  }, [docId, loadCurrent, loadLive]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let off = false;
    setPickErr(null);
    if (!selected) { setPicked(null); return; }
    if (selected === LIVE) {
      if (live !== undefined) setPicked({ key: LIVE, data: live });
      return;
    }
    const id = Number(selected);
    if (!Number.isInteger(id)) { setPicked(null); return; }
    setPicked(null);
    cmsRevision(id)
      .then((r) => {
        if (off) return;
        if (!r || r.doc_id !== docId) setPickErr(t.notFound.title);
        else setPicked({ key: selected, data: r.data });
      })
      .catch((e) => { if (!off) setPickErr(formatError(e)); });
    return () => { off = true; };
  }, [selected, docId, live]);

  useEffect(() => {
    if (picked && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches) {
      detailRef.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [picked]);

  const diff = useMemo(() => {
    if (!picked || !current) return null;
    return changedPaths(picked.data, current.value);
  }, [picked, current]);

  const restore = async () => {
    if (!picked || !current) return;
    setConfirming(false);
    setBusy(true);
    try {
      if (picked.key === LIVE) await saveDraft(picked.data, current.updatedAt);
      else await cmsRestore(docId, Number(picked.key), current.updatedAt);
      toast.show(t.history.restored);
      onRestored();
    } catch (e) {
      setPickErr(formatError(e));
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const row = (key: string, active: boolean, content: ReactNode) => (
    <li key={key}>
      <button
        type="button"
        onClick={() => onSelect(active ? null : key)}
        aria-current={active || undefined}
        className={clsx(
          'w-full text-left rounded-stage-sm px-3 py-2.5 border transition-colors cursor-pointer',
          active ? 'border-stage-pink-2/60 bg-stage-surface-2' : 'border-transparent hover:bg-stage-surface',
        )}
      >
        {content}
      </button>
    </li>
  );

  const pickedRow = picked && picked.key !== LIVE ? rows?.find((r) => String(r.id) === picked.key) : null;

  return (
    <div className="max-w-6xl">
      <header className="mb-5">
        <AdminLink to={editorPath} className="inline-flex items-center gap-1.5 t-small text-stage-pink-2 hover:underline mb-2">
          <ArrowLeft size={14} aria-hidden />{t.history.back}
        </AdminLink>
        <h1 className="text-2xl font-bold text-stage-text m-0 flex items-center gap-2">
          <History size={22} aria-hidden className="text-stage-text-3" />{t.history.title} · {label}
        </h1>
        <p className="t-small mt-1.5 max-w-2xl">{t.history.lede}</p>
      </header>

      {err && <p role="alert" className="card card-pad mb-4 text-sm text-stage-bad">{t.history.loadError}: {err}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <section aria-label={t.history.title} className="card p-2 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
          <ol className="space-y-0.5" data-testid="timeline">
            {row(LIVE, selected === LIVE, (
              <span className="flex items-start gap-2.5">
                <Globe2 size={16} aria-hidden className="mt-0.5 shrink-0 text-stage-live" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stage-text">{t.history.live}</span>
                  <span className="block t-meta">{t.history.liveText}</span>
                </span>
              </span>
            ))}
            {(rows ?? []).map((r) => {
              const Icon = KIND_ICON[r.kind] ?? PencilLine;
              return row(String(r.id), selected === String(r.id), (
                <span className="flex items-start gap-2.5">
                  <Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-stage-text-3" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusChip tone={KIND_TONE[r.kind] ?? 'muted'}>{t.history.kind[r.kind] ?? r.kind}</StatusChip>
                      <span className="text-sm text-stage-text">{when(r.updated_at)}</span>
                    </span>
                    <span className="block t-meta mt-0.5 truncate">
                      {[
                        r.author_email ? t.history.by(personName(r.author_email)) : null,
                        r.restored_from ? t.history.restoredFrom(r.restored_from) : null,
                        r.commit_sha ? t.history.commit(r.commit_sha) : null,
                        `#${r.id}`,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </span>
              ));
            })}
          </ol>
          {rows === null && <p className="t-small p-3">{t.common.loading}</p>}
          {rows !== null && rows.length === 0 && (
            <p className="t-meta p-3">{unavailable ? t.history.unavailable : t.history.empty}</p>
          )}
        </section>

        <section ref={detailRef} aria-live="polite" className="card p-4 sm:p-5 min-w-0 scroll-mt-20" data-testid="revision-detail">
          {pickErr && <p role="alert" className="text-sm text-stage-bad mb-3">{pickErr}</p>}
          {!selected && <p className="t-small">{t.history.pick}</p>}
          {selected && !picked && !pickErr && <p className="t-small">{t.common.loading}</p>}
          {picked && current && diff && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
                <h2 className="t-h3 text-stage-text m-0">
                  {picked.key === LIVE ? t.history.live : `${t.history.kind[pickedRow?.kind ?? 'checkpoint']} · ${pickedRow ? when(pickedRow.updated_at) : `#${picked.key}`}`}
                </h2>
                <span className="t-meta">{diff.length ? t.history.changes(diff.length) : t.history.noDiff}</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOnlyChanged((v) => !v)}>
                    {onlyChanged ? t.history.showAll : t.history.showChanged}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy || diff.length === 0} onClick={() => setConfirming(true)}>
                    <RotateCcw size={15} aria-hidden />{t.history.restore}
                  </button>
                </div>
              </div>
              <h3 className="t-eyebrow text-[11px] mb-3">{t.history.diffTitle}</h3>
              <ul className="space-y-4" data-testid="diff">
                {(onlyChanged ? diff : allLeaves(picked.data, current.value)).map((p) => {
                  const changed = diff.some((d) => pathKey(d) === pathKey(p));
                  return (
                    <li key={pathKey(p)} className={clsx('space-y-1.5', !changed && 'opacity-60')}>
                      <p className="text-sm font-semibold text-stage-text">{labelForPath(schema, current.value, p)}</p>
                      <ValuePair leftTitle={t.history.thatVersion} left={getAt(picked.data, p)} rightTitle={t.history.now} right={getAt(current.value, p)} tone="gold" />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t.history.restoreTitle}
        confirmLabel={t.history.restore}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { void restore(); }}
      >
        <p>{t.history.restoreText}</p>
        <p>{t.history.restoreLive}</p>
      </ConfirmDialog>
    </div>
  );
}

/** Every leaf of both values (for «Όλα τα πεδία»), capped for very large docs. */
function allLeaves(a: unknown, b: unknown): ReturnType<typeof changedPaths> {
  const out: ReturnType<typeof changedPaths> = [];
  const walk = (x: unknown, y: unknown, p: (string | number)[]) => {
    if (out.length > 400) return;
    const obj = (v: unknown) => typeof v === 'object' && v !== null;
    if (obj(x) || obj(y)) {
      const keys = new Set([...Object.keys((x ?? {}) as object), ...Object.keys((y ?? {}) as object)]);
      for (const k of keys) {
        const seg = Array.isArray(x) || Array.isArray(y) ? Number(k) : k;
        walk((x as Record<string, unknown> | undefined)?.[k], (y as Record<string, unknown> | undefined)?.[k], [...p, seg]);
      }
      return;
    }
    out.push(p);
  };
  walk(a, b, []);
  return out;
}
