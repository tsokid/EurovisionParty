// The live avatars library (migration 089, Track 3 P2 addendum). The admin
// adds, orders, publishes and deletes avatars in the `avatars` table; the
// app reads it here, without a site rebuild:
//
// - the picker offers the published avatars in `sort` order (one query,
//   cached for CACHE_MS, shared by every caller);
// - an avatar a player already chose renders even when it is unpublished
//   later; its row comes from avatar_entries() (batched, cached);
// - a deleted avatar, or an id nobody knows, gets no art: the caller draws
//   its fallback (initials on a tint), as for any unknown id;
// - the code-built SVG recipes (av-01…) are not in the library: old rows
//   that use them keep their art;
// - with the table unreachable, and on the server (prerender, SSR), the
//   static registry (registry.ts, the avatars that ship in public/avatars/)
//   answers everything, exactly as before the library existed.
//
// Paths in a row are a static site path (/avatars/…) or an object in the
// public Storage bucket `avatars`.
import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../../../lib/supabase';
import { AVATARS, getAvatar } from './registry';
import { isImageAvatar, type AvatarEntry, type ImageAvatarSpec } from './types';

export const AVATAR_BUCKET = 'avatars';
/** How long the picker list is reused before it is asked for again. */
export const CACHE_MS = 5 * 60_000;

export interface AvatarRow {
  id: string;
  title_en: string;
  title_el: string;
  thumb_path: string;
  full_path: string;
}

type Client = typeof supabase;

// The app's client (already in the main chunk: the header reads the rooms).
// Only effects call it, so the server render never queries.
let override: Client | null = null;
const client = async (): Promise<Client> => override ?? supabase;

/** Test hook: use this client instead of src/lib/supabase (null: back to it). */
export function __setAvatarClientForTests(c: unknown): void {
  override = (c as Client) ?? null;
}

/** Public URL of a row path: a static path as is, a bucket object through Storage. */
export function avatarFileUrl(path: string, c?: Client): string {
  if (path.startsWith('/')) return path;
  if (!c) return `/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
  return c.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function rowToEntry(row: AvatarRow, c?: Client): ImageAvatarSpec {
  return {
    kind: 'image',
    id: row.id,
    title: { en: row.title_en, el: row.title_el.trim() || row.title_en },
    thumb: avatarFileUrl(row.thumb_path, c),
    full: avatarFileUrl(row.full_path, c),
  };
}

// ── Store ──────────────────────────────────────────────────────────────
type State = {
  /** The published list, or null while unknown (then the static set answers). */
  picker: readonly AvatarEntry[] | null;
  loadedAt: number;
  /** id → entry (live rows) or null (deleted / unknown). */
  byId: ReadonlyMap<string, AvatarEntry | null>;
};

let state: State = { picker: null, loadedAt: 0, byId: new Map() };
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Test hook: forget everything loaded. */
export function __resetAvatarLibraryForTests(): void {
  state = { picker: null, loadedAt: 0, byId: new Map() };
  inflight = null;
  pending.clear();
  emit();
}

let inflight: Promise<void> | null = null;

/** Loads the published list (at most once per CACHE_MS). Never rejects: a failure keeps the static set. */
export function loadAvatarLibrary(now: number = Date.now()): Promise<void> {
  if (inflight) return inflight;
  if (state.picker && now - state.loadedAt < CACHE_MS) return Promise.resolve();
  inflight = (async () => {
    try {
      const c = await client();
      const { data, error } = await c
        .from('avatars')
        .select('id, title_en, title_el, thumb_path, full_path')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('sort', { ascending: true })
        .order('id', { ascending: true });
      if (error || !Array.isArray(data)) return;
      const entries = (data as AvatarRow[]).map((r) => rowToEntry(r, c));
      const byId = new Map(state.byId);
      for (const e of entries) byId.set(e.id, e);
      // An empty table is a setup problem, not "no avatars": keep the static set.
      state = { picker: entries.length ? entries : null, loadedAt: Date.now(), byId };
      emit();
    } catch {
      /* unreachable: the static set stays */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Ids waiting for avatar_entries(), sent together on the next tick.
const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushLookups(): Promise<void> {
  flushTimer = null;
  const ids = [...pending].slice(0, 200);
  for (const id of ids) pending.delete(id);
  if (!ids.length) return;
  try {
    const c = await client();
    const { data, error } = await c.rpc('avatar_entries', { p_ids: ids });
    if (error || !Array.isArray(data)) return; // unknown: leave them to the static set
    const found = new Map((data as AvatarRow[]).map((r) => [r.id, rowToEntry(r, c)] as const));
    const byId = new Map(state.byId);
    // A row the published list brought in meanwhile wins over a miss here.
    for (const id of ids) if (found.has(id) || !byId.get(id)) byId.set(id, found.get(id) ?? null);
    state = { ...state, byId };
    emit();
  } catch {
    /* unreachable: the static set stays */
  }
}

function lookUp(id: string): void {
  if (state.byId.has(id) || pending.has(id)) return;
  pending.add(id);
  flushTimer ??= setTimeout(() => { void flushLookups(); }, 0);
}

/**
 * The art for `id`, synchronously: a live row, else (unless the library
 * says it is deleted) the static registry. Undefined: draw the fallback.
 */
export function resolveAvatar(id: string | null | undefined, s: State = state): AvatarEntry | undefined {
  if (!id) return undefined;
  const fixed = getAvatar(id);
  if (fixed && !isImageAvatar(fixed)) return fixed; // code-built SVG recipes are not in the library
  const live = s.byId.get(id);
  if (live !== undefined) return live ?? undefined;
  return getAvatar(id);
}

/** Whether `id` needs avatar_entries(): not in the published list once that is known. */
function needsLookup(id: string, s: State): boolean {
  if (s.byId.has(id)) return false;
  const fixed = getAvatar(id);
  if (fixed && !isImageAvatar(fixed)) return false;
  // Before the list is known, only ids the static set cannot draw are asked about.
  return s.picker !== null || !getAvatar(id);
}

const serverState = (): State => ({ picker: null, loadedAt: 0, byId: new Map() });
const SERVER = serverState();

/** The picker set: the published avatars, or the static set until (or unless) they load. */
export function usePickerAvatars(): readonly AvatarEntry[] {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  useEffect(() => { void loadAvatarLibrary(); }, []);
  return s.picker ?? AVATARS;
}

/** One avatar's art, kept current with the library (see resolveAvatar). */
export function useAvatarEntry(id: string | null | undefined): AvatarEntry | undefined {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  useEffect(() => {
    if (!id) return;
    void loadAvatarLibrary().then(() => { if (needsLookup(id, state)) lookUp(id); });
    if (needsLookup(id, state)) lookUp(id);
  }, [id]);
  return resolveAvatar(id, s);
}

/** A random id from `pool`, different from `except` when there is a choice. */
export function randomFrom(pool: readonly AvatarEntry[], except?: string | null, rand: () => number = Math.random): string {
  const ids = pool.map((a) => a.id);
  const from = except && ids.length > 1 ? ids.filter((id) => id !== except) : ids;
  return from[Math.floor(rand() * from.length) % from.length];
}
