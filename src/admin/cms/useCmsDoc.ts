// React binding of the autosave engine (docSession.ts) plus presence
// (docChannel.ts) for one open CMS document. Used by the page editor and the
// site-wide editors (header, footer, settings).
//
// - Loads through `loadRemote` (the saved draft, else the published or empty
//   base) and restores an unsent buffer from an earlier visit.
// - edit() autosaves ~1.5 s after the last change; leaving a field (blur) or
//   the screen (unmount) saves at once.
// - The unsaved-edits guard is armed only when edits cannot reach the
//   server right now (offline, an error, invalid, a conflict); pending edits
//   are flushed on route change and kept in the buffer on tab close.
// - Presence: who else has this doc open and the field they are in; their
//   saves merge in (or open the conflict dialog).
import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FocusEvent } from 'react';
import { formatError } from '../lib/formatError';
import { useToast } from '../ui/kit';
import { useUnsavedGuard } from '../unsavedGuard';
import { t } from '../i18n';
import { localDraftStore, type DraftStore } from './draftBuffer';
import { DocSession, type RemoteDoc, type SessionState } from './docSession';
import { AdminUserContext, CmsRealtimeContext, personName, TAB_ID, type DocChannel, type Peer } from './docChannel';
import type { Choice } from './fieldDiff';

export type CmsDocOptions = {
  docId: string;
  /** The server's version: the saved draft, else the base (updatedAt null). */
  loadRemote: () => Promise<RemoteDoc>;
  save: (value: unknown, expectedUpdatedAt: string | null) => Promise<string>;
  isConflictError: (e: unknown) => boolean;
  /** False keeps edits local (buffered) until they validate. */
  validate?: (value: unknown) => boolean;
  /** After each successful save (refresh lists, publish counts). */
  onSaved?: () => void;
  store?: DraftStore;
  /** Test hook: the debounce. */
  delayMs?: number;
};

const NO_STATE: SessionState = {
  value: null, base: null, baseUpdatedAt: null, status: 'saved', lastSavedAt: null, error: null, conflict: null, origin: 'load',
};
const noSub = () => () => {};
const noState = () => NO_STATE;

/** The label of a focused control, as the person sees it. */
function fieldOf(target: EventTarget | null): { field: string | null; label: string | null } {
  if (!(target instanceof HTMLElement)) return { field: null, label: null };
  const holder = target.closest<HTMLElement>('[data-cms-field]');
  const field = holder?.dataset.cmsField ?? null;
  const input = target as HTMLInputElement;
  const label =
    target.getAttribute('aria-label') ??
    (input.labels && input.labels[0]?.textContent?.trim()) ??
    holder?.getAttribute('aria-label') ??
    null;
  return { field, label: label || null };
}

export function useCmsDoc(opts: CmsDocOptions) {
  const { docId } = opts;
  const latest = useRef(opts);
  latest.current = opts;
  const toast = useToast();
  const me = useContext(AdminUserContext);
  const channelFactory = useContext(CmsRealtimeContext);

  const [session, setSession] = useState<DocSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadSeq, setLoadSeq] = useState(0);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [live, setLive] = useState(false);
  const channel = useRef<DocChannel | null>(null);
  const peersRef = useRef<Peer[]>([]);
  peersRef.current = peers;

  const nameOf = useCallback((by: string | null) => {
    if (!by) return peersRef.current[0] ? personName(peersRef.current[0].email) : t.autosave.someone;
    return by.includes('@') ? personName(by) : by;
  }, []);

  // ── load + session ──
  useEffect(() => {
    let off = false;
    let s: DocSession | null = null;
    setSession(null);
    setLoadError(null);
    (async () => {
      try {
        const remote = await latest.current.loadRemote();
        if (off) return;
        const o = latest.current;
        s = new DocSession({
          docId,
          save: (v, exp) => latest.current.save(v, exp),
          fetch: () => latest.current.loadRemote(),
          isConflictError: (e) => latest.current.isConflictError(e),
          validate: (v) => (latest.current.validate ? latest.current.validate(v) : true),
          store: o.store ?? localDraftStore,
          delayMs: o.delayMs,
          errorText: formatError,
          onSaved: (at) => {
            channel.current?.announceSaved(at);
            latest.current.onSaved?.();
          },
          onNotice: (n) => {
            if (n.kind === 'restored') toast.show(t.autosave.restored);
            else if (n.kind === 'rebased') toast.show(t.autosave.rebased(nameOf(n.by)));
            else toast.show(t.autosave.remote(nameOf(n.by)));
          },
        }, remote);
        s.restoreBuffer();
        setSession(s);
      } catch (e) {
        if (!off) setLoadError(formatError(e));
      }
    })();
    return () => {
      off = true;
      s?.dispose();
    };
  }, [docId, loadSeq, toast, nameOf]);

  const state = useSyncExternalStore(session?.subscribe ?? noSub, session?.getState ?? noState, session?.getState ?? noState);

  // ── presence ──
  const sessionRef = useRef<DocSession | null>(null);
  sessionRef.current = session;
  useEffect(() => {
    if (!me) return;
    const ch = channelFactory(docId, { ...me, tab: TAB_ID }, {
      onPeers: setPeers,
      onRemoteSave: (e) => { void sessionRef.current?.remoteChanged({ updatedAt: e.updatedAt, by: e.by }); },
      onStatus: setLive,
    });
    channel.current = ch;
    return () => {
      ch.close();
      channel.current = null;
      setPeers([]);
      setLive(false);
    };
  }, [docId, me, channelFactory]);

  // ── back online ──
  useEffect(() => {
    if (!session) return;
    const on = () => session.online();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [session]);

  // ── the guard: only edits that cannot be saved right now ──
  const stuck = !!session && state.status !== 'saved' && state.status !== 'pending' && state.status !== 'saving';
  useUnsavedGuard(stuck);

  // ── focus: presence hint + save on blur ──
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFocus = useCallback((e: FocusEvent) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    const { field, label } = fieldOf(e.target);
    channel.current?.focus(field, label);
  }, []);
  const onBlur = useCallback(() => {
    void sessionRef.current?.flush();
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => channel.current?.focus(null, null), 200);
  }, []);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  const edit = useCallback((v: unknown) => sessionRef.current?.edit(v), []);
  const flush = useCallback(() => sessionRef.current?.flush() ?? Promise.resolve(), []);
  const resolve = useCallback((c: Choice | readonly Choice[]) => sessionRef.current?.resolve(c) ?? Promise.resolve(), []);
  const reset = useCallback((remote: RemoteDoc) => sessionRef.current?.reset(remote), []);
  const reload = useCallback(() => setLoadSeq((n) => n + 1), []);

  return useMemo(() => ({
    ready: !!session,
    loadError,
    reload,
    value: state.value,
    origin: state.origin,
    base: state.base,
    baseUpdatedAt: state.baseUpdatedAt,
    status: state.status,
    lastSavedAt: state.lastSavedAt,
    error: state.error,
    conflict: state.conflict,
    dirty: !!session && session.dirty,
    edit, flush, resolve, reset,
    peers,
    live,
    rootProps: { onFocus, onBlur },
    conflictName: nameOf(state.conflict?.by ?? null),
  }), [session, loadError, reload, state, edit, flush, resolve, reset, peers, live, onFocus, onBlur, nameOf]);
}

export type CmsDoc = ReturnType<typeof useCmsDoc>;
