// The autosave engine (src/admin/cms/docSession.ts) and the field merge
// (fieldDiff.ts), including two editors on one document over a fake server
// with cms_save's optimistic concurrency and a fake realtime hub (owner
// Q1 = A: disjoint fields auto-rebase, the same field opens a conflict).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocSession, type Notice, type RemoteDoc } from '../../src/admin/cms/docSession';
import { memoryDraftStore } from '../../src/admin/cms/draftBuffer';
import { changedPaths, merge3, sameValue, setAt } from '../../src/admin/cms/fieldDiff';

type Doc = { en: Record<string, unknown>; el: Record<string, unknown> };
const PUBLISHED: Doc = { en: { title: 'Rules', body: 'Play fair', items: ['a', 'b'] }, el: { title: 'Κανόνες', body: 'Παίξτε τίμια', items: ['α', 'β'] } };
const clone = <T,>(v: T): T => structuredClone(v);
const CONFLICT = 'document changed by someone else; reload';

/** cms_save / cms_get semantics in memory. */
function fakeServer(start: RemoteDoc | null = null) {
  let row = start ? clone(start) : null;
  let n = 0;
  return {
    get row() { return row; },
    saves: 0,
    offline: false,
    failNext: null as Error | null,
    async save(value: unknown, expected: string | null): Promise<string> {
      if (this.offline) throw new TypeError('Failed to fetch');
      if (this.failNext) { const e = this.failNext; this.failNext = null; throw e; }
      if ((row?.updatedAt ?? null) !== expected) throw { message: CONFLICT };
      this.saves++;
      row = { value: clone(value), updatedAt: `2026-11-22T10:00:00.${String(++n).padStart(3, '0')}Z` };
      return row.updatedAt!;
    },
    async fetch(): Promise<RemoteDoc> {
      if (this.offline) throw new TypeError('Failed to fetch');
      return row ? clone(row) : { value: clone(PUBLISHED), updatedAt: null };
    },
  };
}

type Server = ReturnType<typeof fakeServer>;

function editor(server: Server, opts: { store?: ReturnType<typeof memoryDraftStore>; validate?: (v: unknown) => boolean; onSaved?: (at: string) => void; initial?: RemoteDoc } = {}) {
  const notices: Notice[] = [];
  const store = opts.store ?? memoryDraftStore();
  const s = new DocSession({
    docId: 'rules',
    save: (v, e) => server.save(v, e),
    fetch: () => server.fetch(),
    isConflictError: (e) => String((e as { message?: string }).message ?? e).includes('changed by someone else'),
    validate: opts.validate,
    store,
    onNotice: (n) => notices.push(n),
    onSaved: opts.onSaved,
  }, opts.initial ?? (server.row ? clone(server.row) : { value: clone(PUBLISHED), updatedAt: null }));
  return { s, notices, store, value: () => s.getState().value as Doc };
}

const typed = (doc: Doc, locale: 'en' | 'el', key: string, v: unknown): Doc => setAt(doc, [locale, key], v);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('fieldDiff', () => {
  it('finds changed fields; a list whose length changed is one field', () => {
    const next = typed(typed(PUBLISHED, 'el', 'title', 'Νέοι κανόνες'), 'en', 'items', ['a', 'b', 'c']);
    expect(changedPaths(PUBLISHED, next)).toEqual([['en', 'items'], ['el', 'title']]);
    expect(changedPaths(PUBLISHED, clone(PUBLISHED))).toEqual([]);
  });

  it('merge3: disjoint fields merge, the same field conflicts, the same change does not', () => {
    const mine = typed(PUBLISHED, 'en', 'title', 'Mine');
    const theirs = typed(PUBLISHED, 'el', 'title', 'Δική τους');
    const r = merge3(PUBLISHED, mine, theirs);
    expect(r.conflicts).toEqual([]);
    expect(r.merged).toEqual(typed(theirs, 'en', 'title', 'Mine'));

    const clash = merge3(PUBLISHED, mine, typed(PUBLISHED, 'en', 'title', 'Theirs'));
    expect(clash.conflicts).toEqual([{ path: ['en', 'title'], base: 'Rules', mine: 'Mine', theirs: 'Theirs' }]);
    expect(merge3(PUBLISHED, mine, mine).conflicts).toEqual([]);
  });

  it('merge3: an edit inside a list the other side resized is a conflict at the list', () => {
    const mine = setAt(PUBLISHED, ['en', 'items', 1], 'B!');
    const theirs = setAt(PUBLISHED, ['en', 'items'], ['a', 'b', 'c']);
    const r = merge3(PUBLISHED, mine, theirs);
    expect(r.conflicts.map((c) => c.path)).toEqual([['en', 'items']]);
  });
});

describe('autosave', () => {
  it('saves 1.5 s after the last edit, not before; the buffer holds the edit until then', async () => {
    const server = fakeServer();
    const { s, store, value } = editor(server);
    s.edit(typed(value(), 'en', 'title', 'R'));
    await vi.advanceTimersByTimeAsync(1000);
    s.edit(typed(value(), 'en', 'title', 'Ru'));
    await vi.advanceTimersByTimeAsync(1400);
    expect(server.saves).toBe(0);
    expect(s.getState().status).toBe('pending');
    expect(store.data.get('rules')?.value).toEqual(typed(PUBLISHED, 'en', 'title', 'Ru'));
    await vi.advanceTimersByTimeAsync(200);
    expect(server.saves).toBe(1);
    expect(server.row?.value).toEqual(typed(PUBLISHED, 'en', 'title', 'Ru'));
    expect(s.getState().status).toBe('saved');
    expect(s.getState().lastSavedAt).not.toBeNull();
    expect(store.data.has('rules')).toBe(false);
  });

  it('flush saves at once (blur, route change), against the right expected timestamp', async () => {
    const server = fakeServer();
    const { s, value } = editor(server);
    s.edit(typed(value(), 'en', 'title', 'One'));
    await s.flush();
    s.edit(typed(value(), 'en', 'title', 'Two'));
    await s.flush();
    expect(server.saves).toBe(2);
    expect(s.getState().baseUpdatedAt).toBe(server.row?.updatedAt);
  });

  it('undoing back to the saved value cancels the save and clears the buffer', async () => {
    const server = fakeServer();
    const { s, store, value } = editor(server);
    s.edit(typed(value(), 'en', 'title', 'X'));
    s.edit(clone(PUBLISHED));
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.saves).toBe(0);
    expect(s.getState().status).toBe('saved');
    expect(store.data.has('rules')).toBe(false);
  });

  it('offline: the pill says so, the edit stays buffered, and it is sent when the connection returns', async () => {
    const server = fakeServer();
    const { s, store, value } = editor(server);
    server.offline = true;
    s.edit(typed(value(), 'el', 'title', 'Χωρίς σύνδεση'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(s.getState().status).toBe('offline');
    expect(store.data.get('rules')?.value).toEqual(typed(PUBLISHED, 'el', 'title', 'Χωρίς σύνδεση'));
    server.offline = false;
    s.online();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.getState().status).toBe('saved');
    expect(server.row?.value).toEqual(typed(PUBLISHED, 'el', 'title', 'Χωρίς σύνδεση'));
  });

  it('offline retries on its own every few seconds', async () => {
    const server = fakeServer();
    const { s, value } = editor(server);
    server.offline = true;
    s.edit(typed(value(), 'en', 'title', 'Later'));
    await vi.advanceTimersByTimeAsync(1600);
    server.offline = false;
    await vi.advanceTimersByTimeAsync(5100);
    expect(s.getState().status).toBe('saved');
  });

  it('a server error shows «Σφάλμα»; retry (flush) saves', async () => {
    const server = fakeServer();
    const { s, value } = editor(server);
    server.failNext = new Error('document too large');
    s.edit(typed(value(), 'en', 'title', 'Big'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(s.getState()).toMatchObject({ status: 'error', error: expect.stringContaining('too large') });
    await s.flush();
    expect(s.getState().status).toBe('saved');
  });

  it('an invalid draft is never sent; it stays local until fixed', async () => {
    const server = fakeServer();
    const { s, store, value } = editor(server, { validate: (v) => (v as Doc).en.title !== '' });
    s.edit(typed(value(), 'en', 'title', ''));
    await vi.advanceTimersByTimeAsync(1600);
    expect(server.saves).toBe(0);
    expect(s.getState().status).toBe('invalid');
    expect(store.data.has('rules')).toBe(true);
    s.edit(typed(value(), 'en', 'title', 'Fixed'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(server.saves).toBe(1);
  });

  it('after a crash or reload, the unsent buffer is restored and saved', async () => {
    const server = fakeServer();
    const store = memoryDraftStore();
    const first = editor(server, { store });
    first.s.edit(typed(first.value(), 'en', 'body', 'Typed, never sent'));
    // The tab dies before the debounce fires.
    const second = editor(server, { store });
    second.s.restoreBuffer();
    expect(second.notices).toEqual([{ kind: 'restored' }]);
    expect(second.value().en.body).toBe('Typed, never sent');
    await vi.advanceTimersByTimeAsync(1600);
    expect((server.row?.value as Doc).en.body).toBe('Typed, never sent');
  });

  it('a restored buffer whose base moved on merges with the newer server version', async () => {
    const server = fakeServer();
    const store = memoryDraftStore();
    const first = editor(server, { store });
    first.s.edit(typed(first.value(), 'en', 'body', 'Mine, unsent'));
    await server.save(typed(PUBLISHED, 'el', 'body', 'Κάποιου άλλου'), null);
    const second = editor(server, { store });
    second.s.restoreBuffer();
    expect(second.value()).toEqual(typed(typed(PUBLISHED, 'el', 'body', 'Κάποιου άλλου'), 'en', 'body', 'Mine, unsent'));
  });
});

/** Two editors on one doc; each save is announced to the other through the hub. */
function twoEditors(opts: { realtime?: boolean } = {}) {
  const server = fakeServer();
  const realtime = opts.realtime ?? true;
  const peers: Array<ReturnType<typeof editor>> = [];
  const announce = (from: number) => (at: string) => {
    if (!realtime) return;
    const other = peers[1 - from];
    void other.s.remoteChanged({ updatedAt: at, by: from === 0 ? 'owner@example.com' : 'elena@example.com' });
  };
  peers.push(editor(server, { onSaved: announce(0) }));
  peers.push(editor(server, { onSaved: announce(1) }));
  return { server, a: peers[0], b: peers[1] };
}

describe('two editors (Q1 = A)', () => {
  it('B has nothing unsaved: A\'s save is adopted as is', async () => {
    const { server, a, b } = twoEditors();
    a.s.edit(typed(a.value(), 'en', 'title', 'From A'));
    await a.s.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(b.value()).toEqual(server.row?.value);
    expect(b.s.getState().baseUpdatedAt).toBe(server.row?.updatedAt);
    expect(b.notices).toEqual([{ kind: 'remote', by: 'owner@example.com' }]);
  });

  it('disjoint fields: B\'s unsaved edit is rebased on A\'s save silently (a toast), then both are saved', async () => {
    const { server, a, b } = twoEditors();
    b.s.edit(typed(b.value(), 'el', 'title', 'Από τη B'));
    a.s.edit(typed(a.value(), 'en', 'title', 'From A'));
    await a.s.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(b.s.getState().conflict).toBeNull();
    expect(b.notices).toEqual([{ kind: 'rebased', by: 'owner@example.com', fields: 1 }]);
    expect(b.value()).toEqual(typed(typed(PUBLISHED, 'en', 'title', 'From A'), 'el', 'title', 'Από τη B'));
    await vi.advanceTimersByTimeAsync(1600);
    expect(server.row?.value).toEqual(b.value());
    // A hears B's save and catches up.
    await vi.advanceTimersByTimeAsync(0);
    expect(a.value()).toEqual(server.row?.value);
  });

  it('the same field: B gets the conflict dialog; «Κράτα τη δική μου» saves B\'s value', async () => {
    const { server, a, b } = twoEditors();
    b.s.edit(typed(typed(b.value(), 'en', 'title', 'Title by B'), 'el', 'body', 'Σώμα από B'));
    a.s.edit(typed(a.value(), 'en', 'title', 'Title by A'));
    await a.s.flush();
    await vi.advanceTimersByTimeAsync(0);
    const c = b.s.getState().conflict!;
    expect(b.s.getState().status).toBe('conflict');
    expect(c.fields).toEqual([{ path: ['en', 'title'], base: 'Rules', mine: 'Title by B', theirs: 'Title by A' }]);
    expect(c.by).toBe('owner@example.com');
    // Autosave waits for the decision.
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.saves).toBe(1);
    await b.s.resolve('mine');
    expect((server.row?.value as Doc).en.title).toBe('Title by B');
    expect((server.row?.value as Doc).el.body).toBe('Σώμα από B');
    expect(b.s.getState().status).toBe('saved');
  });

  it('the same field: «Πάρε τη δική τους» keeps A\'s value and B\'s other edits', async () => {
    const { server, a, b } = twoEditors();
    b.s.edit(typed(typed(b.value(), 'en', 'title', 'Title by B'), 'el', 'body', 'Σώμα από B'));
    a.s.edit(typed(a.value(), 'en', 'title', 'Title by A'));
    await a.s.flush();
    await vi.advanceTimersByTimeAsync(0);
    await b.s.resolve('theirs');
    expect((server.row?.value as Doc).en.title).toBe('Title by A');
    expect((server.row?.value as Doc).el.body).toBe('Σώμα από B');
  });

  it('per-field choices when several fields clash', async () => {
    const { server, a, b } = twoEditors();
    b.s.edit(typed(typed(b.value(), 'en', 'title', 'B1'), 'el', 'title', 'B2'));
    a.s.edit(typed(typed(a.value(), 'en', 'title', 'A1'), 'el', 'title', 'A2'));
    await a.s.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(b.s.getState().conflict!.fields.map((f) => f.path.join('.'))).toEqual(['en.title', 'el.title']);
    await b.s.resolve(['theirs', 'mine']);
    expect(server.row?.value).toEqual(typed(typed(PUBLISHED, 'en', 'title', 'A1'), 'el', 'title', 'B2'));
  });

  it('without realtime, cms_save\'s refusal triggers the same merge and the save goes through', async () => {
    const { server, a, b } = twoEditors({ realtime: false });
    a.s.edit(typed(a.value(), 'en', 'title', 'From A'));
    await a.s.flush();
    b.s.edit(typed(b.value(), 'el', 'title', 'Από τη B'));
    await b.s.flush();
    expect(server.row?.value).toEqual(typed(typed(PUBLISHED, 'en', 'title', 'From A'), 'el', 'title', 'Από τη B'));
    expect(b.notices.map((n) => n.kind)).toEqual(['rebased']);
  });

  it('an announcement of my own save timestamp is ignored', async () => {
    const { a } = twoEditors();
    a.s.edit(typed(a.value(), 'en', 'title', 'Mine'));
    await a.s.flush();
    const before = a.s.getState();
    await a.s.remoteChanged({ updatedAt: before.baseUpdatedAt });
    expect(a.s.getState()).toBe(before);
    expect(sameValue(a.value(), before.value)).toBe(true);
  });
});
