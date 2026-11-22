// gallery/fakeSupabase.ts
// Drop-in stand-in for src/lib/supabase.ts, wired in by vite.gallery.config.ts.
// It never opens a socket or sends a request: every query resolves from the
// in-memory fixture tables set by gallery/main.tsx (setFakeDb). Unknown
// tables / RPCs / client members resolve to empty results and log a warning
// so gaps in the fixtures are visible in the console.
//
// Timing: every query and RPC resolves on the next microtask, with no
// artificial latency, and the fake shares the page's clock. So gallery
// timings show the app's own delays only (no network, no clock skew). RPC
// fixtures such as submit_quiz_answer (honours p_response_ms, migration 083)
// live in gallery/main.tsx (setFakeDb).

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
export type FakeTables = Record<string, Row[]>;
export type FakeRpcs = Record<string, (args: Record<string, unknown>) => unknown>;

let tables: FakeTables = {};
let rpcs: FakeRpcs = {};

export function setFakeDb(nextTables: FakeTables, nextRpcs: FakeRpcs = {}) {
  tables = nextTables;
  rpcs = nextRpcs;
}

/** Edge functions the gallery models (CMS P5: publish-content, publish-status). */
export type FakeFunctions = Record<string, (body: Record<string, unknown>) => unknown>;
let functions: FakeFunctions = {};
export function setFakeFunctions(next: FakeFunctions) {
  functions = next;
}

const warned = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[fakeSupabase] ${msg}`);
}

type Filter = (row: Row) => boolean;

function parseLiteral(v: string): unknown {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** Column filter that is skipped when the fixture row has no such column. */
function colFilter(col: string, test: (v: unknown) => boolean): Filter {
  return (row) => (col in row ? test(row[col]) : true);
}

const BUILDER_METHODS = new Set([
  'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not', 'or',
  'like', 'ilike', 'contains', 'containedBy', 'filter', 'match', 'order', 'limit',
  'range', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete',
  'returns', 'abortSignal', 'throwOnError', 'then', 'catch', 'finally', 'csv',
  'textSearch', 'overlaps',
]);

class QueryBuilder implements PromiseLike<any> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: unknown = null;
  private table: string;

  constructor(table: string) {
    this.table = table;
    // Any builder method the screens call that we do not model is a no-op
    // that keeps the chain alive (and is reported once).
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && !(prop in target) && !BUILDER_METHODS.has(prop)) {
          warnOnce(`method:${prop}`, `unmodelled query method .${prop}() on "${target.table}" — ignored`);
          return () => receiver;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  select(_cols?: string, _opts?: unknown) { return this; }
  eq(col: string, v: unknown) { this.filters.push(colFilter(col, (x) => x === v)); return this; }
  neq(col: string, v: unknown) { this.filters.push(colFilter(col, (x) => x !== v)); return this; }
  gt(col: string, v: any) { this.filters.push(colFilter(col, (x: any) => x > v)); return this; }
  gte(col: string, v: any) { this.filters.push(colFilter(col, (x: any) => x >= v)); return this; }
  lt(col: string, v: any) { this.filters.push(colFilter(col, (x: any) => x < v)); return this; }
  lte(col: string, v: any) { this.filters.push(colFilter(col, (x: any) => x <= v)); return this; }
  in(col: string, vs: unknown[]) { this.filters.push(colFilter(col, (x) => vs.includes(x))); return this; }
  is(col: string, v: unknown) { this.filters.push(colFilter(col, (x) => (x ?? null) === v)); return this; }
  not(col: string, op: string, v: unknown) {
    const val = typeof v === 'string' ? parseLiteral(v) : v;
    if (op === 'is' || op === 'eq') this.filters.push(colFilter(col, (x) => (x ?? null) !== val));
    return this;
  }
  /** PostgREST `or` strings: supports `a.eq.x,b.eq.y` and `col.in.(a,b)`; anything else passes. */
  or(expr: string) {
    const parts = expr.split(/,(?![^(]*\))/);
    const tests: Filter[] = [];
    for (const p of parts) {
      const m = /^([a-z_]+)\.(eq|in)\.(.+)$/.exec(p.trim());
      if (!m) return this;
      const [, col, op, raw] = m;
      if (op === 'eq') tests.push(colFilter(col, (x) => x === parseLiteral(raw)));
      else {
        const vals = raw.replace(/^\(|\)$/g, '').split(',').map(parseLiteral);
        tests.push(colFilter(col, (x) => vals.includes(x)));
      }
    }
    this.filters.push((row) => tests.some((t) => t(row)));
    return this;
  }
  like() { return this; }
  ilike() { return this; }
  contains() { return this; }
  containedBy() { return this; }
  overlaps() { return this; }
  textSearch() { return this; }
  filter() { return this; }
  match(obj: Record<string, unknown>) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybeSingle'; return this; }
  returns() { return this; }
  abortSignal() { return this; }
  throwOnError() { return this; }
  csv() { return this; }

  insert(p: unknown) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p: unknown) { this.op = 'upsert'; this.payload = p; return this; }
  update(p: unknown) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }

  private resolve(): { data: any; error: any; count?: number | null; status: number } {
    // Writes are acknowledged but never applied: the gallery is read-only.
    if (this.op !== 'select') {
      const rows = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : [];
      const echoed = rows.map((r: Row, i: number) => ({ id: `fake-${this.table}-${Date.now()}-${i}`, ...r }));
      if (this.mode === 'many') return { data: this.op === 'delete' ? null : echoed, error: null, status: 200 };
      return { data: echoed[0] ?? null, error: null, status: 200 };
    }

    const source = tables[this.table];
    if (!source) {
      warnOnce(`table:${this.table}`, `no fixture for table "${this.table}" — returning empty`);
    }
    let rows = (source ?? []).filter((r) => this.filters.every((f) => f(r)));
    if (this.orders.length) {
      rows = [...rows].sort((a, b) => {
        for (const { col, asc } of this.orders) {
          const x = a[col], y = b[col];
          if (x === y) continue;
          if (x == null) return 1;
          if (y == null) return -1;
          return (x < y ? -1 : 1) * (asc ? 1 : -1);
        }
        return 0;
      });
    }
    if (this.rangeFrom != null && this.rangeTo != null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    // Hand out copies so components that mutate results don't touch fixtures.
    rows = rows.map((r) => structuredClone(r));

    if (this.mode === 'single') {
      if (rows.length === 1) return { data: rows[0], error: null, status: 200 };
      if (rows.length > 1) return { data: rows[0], error: null, status: 200 };
      return {
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116', details: '', hint: '' },
        status: 406,
      };
    }
    if (this.mode === 'maybeSingle') return { data: rows[0] ?? null, error: null, status: 200 };
    return { data: rows, error: null, count: rows.length, status: 200 };
  }

  then<T1 = any, T2 = never>(
    onFulfilled?: ((value: any) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return Promise.resolve().then(() => this.resolve()).then(onFulfilled, onRejected);
  }
  catch(onRejected: (reason: any) => unknown) { return this.then(undefined, onRejected); }
  finally(fn: () => void) { return this.then((v) => { fn(); return v; }); }
}

class RpcBuilder implements PromiseLike<any> {
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';
  private name: string;
  private args: Record<string, unknown>;
  constructor(name: string, args: Record<string, unknown>) {
    this.name = name;
    this.args = args;
  }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybeSingle'; return this; }
  select() { return this; }
  eq() { return this; }
  order() { return this; }
  limit() { return this; }
  private resolve() {
    const fn = rpcs[this.name];
    if (!fn) {
      warnOnce(`rpc:${this.name}`, `no fixture for rpc "${this.name}" — returning null`);
      return { data: null, error: null, status: 200 };
    }
    let raw: unknown;
    try {
      raw = fn(this.args);
    } catch (e) {
      // A fixture throws to stand in for a Postgres exception.
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, status: 400 };
    }
    let data = structuredClone(raw ?? null) as any;
    if (this.mode !== 'many' && Array.isArray(data)) data = data[0] ?? null;
    return { data, error: null, status: 200 };
  }
  then<T1 = any, T2 = never>(
    onFulfilled?: ((value: any) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return Promise.resolve().then(() => this.resolve()).then(onFulfilled, onRejected);
  }
}

class FakeChannel {
  topic: string;
  constructor(topic: string) { this.topic = topic; }
  on(..._args: unknown[]) { return this; }
  subscribe(cb?: (status: string, err?: unknown) => void) {
    if (cb) setTimeout(() => cb('SUBSCRIBED'), 0);
    return this;
  }
  unsubscribe() { return Promise.resolve('ok'); }
  send() { return Promise.resolve('ok'); }
  track() { return Promise.resolve('ok'); }
  untrack() { return Promise.resolve('ok'); }
  presenceState() { return {}; }
}

export const FAKE_USER = {
  id: 'user-me',
  aud: 'authenticated',
  role: 'authenticated',
  is_anonymous: true,
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-05-16T17:00:00.000Z',
};

export const FAKE_SESSION = {
  access_token: 'gallery-fake-token',
  refresh_token: 'gallery-fake-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  user: FAKE_USER,
};

const auth = {
  getSession: async () => ({ data: { session: FAKE_SESSION }, error: null }),
  getUser: async () => ({ data: { user: FAKE_USER }, error: null }),
  signInAnonymously: async () => ({ data: { session: FAKE_SESSION, user: FAKE_USER }, error: null }),
  signInWithOtp: async () => ({ data: null, error: null }),
  verifyOtp: async () => ({ data: { session: FAKE_SESSION, user: FAKE_USER }, error: null }),
  signOut: async () => ({ error: null }),
  onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
    setTimeout(() => cb('INITIAL_SESSION', FAKE_SESSION), 0);
    return { data: { subscription: { unsubscribe() {} } } };
  },
  refreshSession: async () => ({ data: { session: FAKE_SESSION, user: FAKE_USER }, error: null }),
};

const client = {
  from: (table: string) => new QueryBuilder(table),
  rpc: (name: string, args: Record<string, unknown> = {}) => new RpcBuilder(name, args),
  channel: (topic: string) => new FakeChannel(topic),
  removeChannel: (_ch: unknown) => Promise.resolve('ok'),
  removeAllChannels: () => Promise.resolve([]),
  getChannels: () => [],
  auth,
  functions: {
    invoke: async (name: string, opts?: { body?: Record<string, unknown> }) => {
      const fn = functions[name];
      if (fn) {
        try {
          return { data: await fn(opts?.body ?? {}), error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      }
      warnOnce(`fn:${name}`, `functions.invoke("${name}") — not modelled, returning null`);
      return { data: null, error: null };
    },
  },
  storage: {
    from: (bucket: string) => {
      warnOnce(`storage:${bucket}`, `storage.from("${bucket}") — not modelled`);
      return {
        getPublicUrl: (p: string) => ({ data: { publicUrl: `/${p}` } }),
        upload: async () => ({ data: null, error: null }),
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ data: null, error: null }),
      };
    },
  },
};

export const supabase = new Proxy(client, {
  get(target, prop, receiver) {
    if (typeof prop === 'string' && !(prop in target) && prop !== 'then') {
      warnOnce(`client:${prop}`, `supabase.${prop} — not modelled`);
      return undefined;
    }
    return Reflect.get(target, prop, receiver);
  },
}) as any;
