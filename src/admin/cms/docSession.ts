// The autosave engine of one CMS document in one editor (spec §4, owner
// Q1 = A). Framework-free, so the two-editor behaviour is unit-tested
// without a browser (tests/admin/cmsDocSession.test.ts).
//
// - edit(): the new value goes to the unsent-draft buffer at once and is
//   saved ~1.5 s after the last edit (flush() saves now: blur, route change).
// - Saves use cms_save's optimistic concurrency (the updated_at the edits
//   started from). A refusal means someone else saved: the engine fetches
//   their version and merges (below), then saves again.
// - remoteChanged(): the other editor saved (presence broadcast or
//   postgres_changes). With nothing unsaved here, their version is adopted.
//   With unsaved edits, a three-way merge: fields only one side changed
//   merge silently (a "rebased" notice); a field both changed opens a
//   conflict that the user resolves per field (keep mine / take theirs).
// - Offline or failing saves keep the edits (buffer + state) and retry.
// - start() restores a buffer left by a crash or reload.
import type { DraftStore } from './draftBuffer';
import {
  changedPaths, getAt, merge3, resolveConflicts, sameValue,
  type Choice, type FieldConflict,
} from './fieldDiff';

export const AUTOSAVE_DELAY_MS = 1500;
export const OFFLINE_RETRY_MS = 5000;

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'error' | 'invalid' | 'conflict';

/** The server's current version: the saved draft, or (updatedAt null) the published document. */
export type RemoteDoc = { value: unknown; updatedAt: string | null };

export type Notice =
  | { kind: 'restored' }
  | { kind: 'rebased'; by: string | null; fields: number }
  | { kind: 'remote'; by: string | null };

export type ConflictState = {
  fields: FieldConflict[];
  /** Their version with my non-conflicting edits merged in. */
  merged: unknown;
  theirs: RemoteDoc;
  by: string | null;
};

export type SessionState = {
  value: unknown;
  /** The server version the edits are based on. */
  base: unknown;
  baseUpdatedAt: string | null;
  status: SaveStatus;
  /** When this editor last saved (ms), for «Αποθηκεύτηκε 12:04». */
  lastSavedAt: number | null;
  error: string | null;
  conflict: ConflictState | null;
  /** Where the current value came from: the load, a local edit, or the server (merge, restore, reset). */
  origin: 'load' | 'local' | 'remote';
};

export interface DocSessionDeps {
  docId: string;
  save: (value: unknown, expectedUpdatedAt: string | null) => Promise<string>;
  fetch: () => Promise<RemoteDoc>;
  isConflictError: (e: unknown) => boolean;
  /** Network failures (retry quietly); default: the browser is offline or fetch failed. */
  isOfflineError?: (e: unknown) => boolean;
  /** False keeps the edits local (buffer only) until they validate. */
  validate?: (value: unknown) => boolean;
  store: DraftStore;
  errorText?: (e: unknown) => string;
  onNotice?: (n: Notice) => void;
  /** After every successful save (announce it to the other editor). */
  onSaved?: (updatedAt: string) => void;
  delayMs?: number;
  retryMs?: number;
  now?: () => number;
}

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|timeout/i;

export function defaultIsOffline(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  return NETWORK.test(msg);
}

export class DocSession {
  private state: SessionState;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> | null = null;
  private again = false;
  private remoteHint: { by: string | null } | null = null;
  private disposed = false;
  private readonly d: Required<Pick<DocSessionDeps, 'delayMs' | 'retryMs' | 'now'>> & DocSessionDeps;

  constructor(deps: DocSessionDeps, initial: RemoteDoc) {
    this.d = { delayMs: AUTOSAVE_DELAY_MS, retryMs: OFFLINE_RETRY_MS, now: () => Date.now(), ...deps };
    this.state = {
      value: initial.value, base: initial.value, baseUpdatedAt: initial.updatedAt,
      status: 'saved', lastSavedAt: null, error: null, conflict: null, origin: 'load',
    };
  }

  // ── store protocol (useSyncExternalStore) ──
  getState = (): SessionState => this.state;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  get dirty(): boolean {
    return !sameValue(this.state.value, this.state.base);
  }

  /** Restores the unsent buffer of an earlier visit, if any. Call once after load. */
  restoreBuffer(): void {
    const buf = this.d.store.read(this.d.docId);
    if (!buf) return;
    const remote = { value: this.state.base, updatedAt: this.state.baseUpdatedAt };
    if (sameValue(buf.value, remote.value)) {
      this.d.store.clear(this.d.docId);
      return;
    }
    if (buf.baseUpdatedAt === remote.updatedAt) {
      this.set({ value: buf.value, status: 'pending', origin: 'remote' });
      this.d.onNotice?.({ kind: 'restored' });
      this.schedule();
      return;
    }
    // The server moved on since the buffer was written: merge like a remote save.
    const fields: FieldConflict[] = buf.base !== undefined
      ? merge3(buf.base, buf.value, remote.value).conflicts
      : changedPaths(remote.value, buf.value).map((path) => ({ path, base: undefined, mine: getAt(buf.value, path), theirs: getAt(remote.value, path) }));
    const merged = buf.base !== undefined ? merge3(buf.base, buf.value, remote.value).merged : remote.value;
    this.d.onNotice?.({ kind: 'restored' });
    if (fields.length === 0) {
      this.set({ value: merged, status: 'pending', origin: 'remote' });
      this.writeBuffer();
      this.schedule();
    } else {
      this.set({ value: merged, status: 'conflict', origin: 'remote', conflict: { fields, merged, theirs: remote, by: null } });
    }
  }

  /** A local edit. */
  edit(value: unknown): void {
    if (this.disposed || this.state.conflict) return;
    const clean = sameValue(value, this.state.base);
    this.set({ value, status: clean && !this.inflight ? 'saved' : 'pending', error: null, origin: 'local' });
    if (clean) {
      this.cancel();
      this.d.store.clear(this.d.docId);
      return;
    }
    this.writeBuffer();
    this.schedule();
  }

  /** Saves now (blur, route change, «ξαναδοκίμασε»). Resolves when the server has the value or the save failed. */
  flush(): Promise<void> {
    this.cancel();
    if (this.inflight) {
      this.again = true;
      return this.inflight;
    }
    return this.run();
  }

  /** The other editor saved (hint from realtime). Fetches their version and merges. */
  remoteChanged(hint: { updatedAt?: string | null; by?: string | null } = {}): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (hint.updatedAt !== undefined && hint.updatedAt === this.state.baseUpdatedAt) return Promise.resolve();
    this.remoteHint = { by: hint.by ?? null };
    if (this.inflight) {
      // The running save either lands first (their save is then refused) or is refused (sync follows).
      const after = this.inflight.then(() => this.sync());
      return after;
    }
    return this.sync();
  }

  /** Resolves the open conflict: one choice for every field, or one per field. */
  resolve(choice: Choice | readonly Choice[]): Promise<void> {
    const c = this.state.conflict;
    if (!c) return Promise.resolve();
    const value = resolveConflicts(c.merged, c.fields, (_f, i) => (typeof choice === 'string' ? choice : choice[i] ?? 'theirs'));
    this.set({ value, base: c.theirs.value, baseUpdatedAt: c.theirs.updatedAt, conflict: null, status: 'pending', origin: 'remote' });
    if (sameValue(value, c.theirs.value)) {
      this.set({ status: 'saved' });
      this.d.store.clear(this.d.docId);
      return Promise.resolve();
    }
    this.writeBuffer();
    return this.flush();
  }

  /** The server state was replaced (discard, restore): start over from it. */
  reset(remote: RemoteDoc): void {
    this.cancel();
    this.d.store.clear(this.d.docId);
    this.set({
      value: remote.value, base: remote.value, baseUpdatedAt: remote.updatedAt,
      status: 'saved', error: null, conflict: null, origin: 'remote', lastSavedAt: remote.updatedAt ? this.d.now() : this.state.lastSavedAt,
    });
  }

  /** The browser is back online: send what waits. */
  online(): void {
    if (this.state.status === 'offline') void this.flush();
  }

  /** Stops timers; a pending edit is sent once more (route change), and stays in the buffer if that fails. */
  dispose(): void {
    if (this.disposed) return;
    const pending = this.timer !== null || this.state.status === 'pending';
    this.cancel();
    if (pending && this.dirty && !this.state.conflict) void this.run();
    this.disposed = true;
  }

  // ── internals ──
  private cancel() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(ms = this.d.delayMs) {
    if (this.disposed) return;
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private writeBuffer() {
    this.d.store.write(this.d.docId, {
      value: this.state.value, base: this.state.base, baseUpdatedAt: this.state.baseUpdatedAt, at: this.d.now(),
    });
  }

  private run(): Promise<void> {
    const p = this.saveLoop().finally(() => {
      this.inflight = null;
    });
    this.inflight = p;
    return p;
  }

  private async saveLoop(): Promise<void> {
    // Up to 3 rounds: a save refused because the other editor saved first is
    // merged and sent again; more than that is a busy document, shown as an error.
    for (let round = 0; round < 3; round++) {
      this.again = false;
      if (this.state.conflict) return;
      const sending = this.state.value;
      if (sameValue(sending, this.state.base)) {
        if (!this.disposed) this.set({ status: 'saved' });
        this.d.store.clear(this.d.docId);
        return;
      }
      if (this.d.validate && !this.d.validate(sending)) {
        this.set({ status: 'invalid' });
        return;
      }
      this.set({ status: 'saving', error: null });
      try {
        const at = await this.d.save(sending, this.state.baseUpdatedAt);
        const caughtUp = sameValue(this.state.value, sending);
        this.set({ base: sending, baseUpdatedAt: at, lastSavedAt: this.d.now(), status: caughtUp ? 'saved' : 'pending' });
        this.d.onSaved?.(at);
        if (caughtUp) {
          this.d.store.clear(this.d.docId);
          if (!this.again) return;
        } else {
          this.writeBuffer();
        }
        // Edits arrived while saving: send them too.
        continue;
      } catch (e) {
        if (this.d.isConflictError(e)) {
          await this.sync();
          if (this.state.conflict) return;
          continue;
        }
        if ((this.d.isOfflineError ?? defaultIsOffline)(e)) {
          this.set({ status: 'offline', error: null });
          this.schedule(this.d.retryMs);
          return;
        }
        this.set({ status: 'error', error: this.d.errorText ? this.d.errorText(e) : String(e) });
        return;
      }
    }
    this.set({ status: 'error', error: 'Το έγγραφο αλλάζει συνεχώς από άλλο άτομο. Δοκίμασε ξανά.' });
  }

  private async sync(): Promise<void> {
    let theirs: RemoteDoc;
    try {
      theirs = await this.d.fetch();
    } catch (e) {
      if ((this.d.isOfflineError ?? defaultIsOffline)(e)) this.set({ status: 'offline' });
      return;
    }
    if (this.disposed) return;
    const by = this.remoteHint?.by ?? null;
    this.remoteHint = null;
    if (theirs.updatedAt === this.state.baseUpdatedAt && sameValue(theirs.value, this.state.base)) return;
    if (!this.dirty) {
      this.set({ value: theirs.value, base: theirs.value, baseUpdatedAt: theirs.updatedAt, status: 'saved', origin: 'remote' });
      this.d.onNotice?.({ kind: 'remote', by });
      return;
    }
    const r = merge3(this.state.base, this.state.value, theirs.value);
    if (r.conflicts.length === 0) {
      this.set({ value: r.merged, base: theirs.value, baseUpdatedAt: theirs.updatedAt, status: 'pending', origin: 'remote' });
      this.writeBuffer();
      this.d.onNotice?.({ kind: 'rebased', by, fields: r.theirChanges.length });
      if (!this.inflight) this.schedule();
      return;
    }
    this.cancel();
    this.set({ status: 'conflict', conflict: { fields: r.conflicts, merged: r.merged, theirs, by } });
  }
}
