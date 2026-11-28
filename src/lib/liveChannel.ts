/**
 * The game's live updates (28 Nov 2026, migration 105).
 *
 * The server pushes every change once, from a trigger, to a private Realtime
 * Broadcast channel:
 *   room:{roomId}     rooms, players, duels, tie_votes, tie_vote_choices,
 *                     sudden_death_rounds, sudden_death_answers
 *   player:{playerId} notifications
 * Nothing reads the database's change log and nothing polls.
 *
 * One channel per topic, shared by every hook that listens to it (counted:
 * the last listener to leave closes it). Each message arrives as
 * { eventType, new, old }, the shape the hooks already used.
 *
 * When a channel joins again after a drop, a catch-up runs (resync.ts), so
 * anything pushed while the phone was offline is fetched once.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { rejoinWatcher } from './resync';

export type LiveTable =
  | 'rooms' | 'players' | 'duels' | 'notifications'
  | 'tie_votes' | 'tie_vote_choices' | 'sudden_death_rounds' | 'sudden_death_answers';

export interface LiveChange<T = Record<string, unknown>> {
  /** REFRESH: a bulk job (Finalize, 108) changed many rows; reread them. */
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | 'REFRESH';
  new: T;
  old: Partial<T>;
}

type Handler = (change: LiveChange) => void;
type StatusHandler = (status: string) => void;

interface Entry {
  channel: RealtimeChannel | null;
  handlers: Map<LiveTable, Set<Handler>>;
  statusHandlers: Set<StatusHandler>;
  refs: number;
  closing: ReturnType<typeof setTimeout> | null;
}

/**
 * A channel with no listeners stays open this long, so a screen that
 * remounts (tab switch, React strict mode) reuses it instead of racing a
 * close against a reopen of the same topic.
 */
const CLOSE_GRACE_MS = 2_000;

const entries = new Map<string, Entry>();

function open(topic: string): Entry {
  let entry = entries.get(topic);
  if (entry) {
    if (entry.closing !== null) { clearTimeout(entry.closing); entry.closing = null; }
    return entry;
  }
  entry = { channel: null, handlers: new Map(), statusHandlers: new Set(), refs: 0, closing: null };
  entries.set(topic, entry);
  const e = entry;

  // Older test mocks of the client have no realtime.
  if (typeof (supabase as { channel?: unknown }).channel !== 'function') return e;

  const onRejoin = rejoinWatcher();
  const ch = supabase.channel(topic, { config: { private: true } });
  ch.on('broadcast', { event: '*' }, (msg: { event?: string; payload?: { table?: LiveTable; op?: string; new?: unknown; old?: unknown } }) => {
    const p = msg.payload;
    const table = (p?.table ?? msg.event) as LiveTable | undefined;
    if (!table) return;
    const set = e.handlers.get(table);
    if (!set || set.size === 0) return;
    const change: LiveChange = {
      eventType: (p?.op ?? 'UPDATE') as LiveChange['eventType'],
      new: (p?.new ?? {}) as Record<string, unknown>,
      old: (p?.old ?? {}) as Record<string, unknown>,
    };
    for (const h of [...set]) {
      try { h(change); } catch (err) { console.error('[live]', topic, table, err); }
    }
  });
  ch.subscribe((status, err) => {
    if (err) console.error('[live] channel', topic, status, err);
    onRejoin(status);
    for (const h of [...e.statusHandlers]) h(status);
  });
  e.channel = ch;
  return e;
}

function release(topic: string, entry: Entry): void {
  entry.refs -= 1;
  if (entry.refs > 0 || entry.closing !== null) return;
  entry.closing = setTimeout(() => {
    entry.closing = null;
    if (entry.refs > 0) return;
    entries.delete(topic);
    if (entry.channel) void supabase.removeChannel(entry.channel);
  }, CLOSE_GRACE_MS);
}

/** Listens to one table's changes on a topic. Returns the cleanup for a useEffect. */
export function onLive<T = Record<string, unknown>>(
  topic: string,
  table: LiveTable,
  handler: (change: LiveChange<T>) => void,
): () => void {
  const entry = open(topic);
  entry.refs += 1;
  let set = entry.handlers.get(table);
  if (!set) { set = new Set(); entry.handlers.set(table, set); }
  const h = handler as Handler;
  set.add(h);
  return () => {
    set!.delete(h);
    release(topic, entry);
  };
}

/** Follows a topic's channel status (SUBSCRIBED, CHANNEL_ERROR, …). */
export function onLiveStatus(topic: string, handler: StatusHandler): () => void {
  const entry = open(topic);
  entry.refs += 1;
  entry.statusHandlers.add(handler);
  return () => {
    entry.statusHandlers.delete(handler);
    release(topic, entry);
  };
}

export const roomTopic = (roomId: string) => `room:${roomId}`;
export const playerTopic = (playerId: string) => `player:${playerId}`;

/** Tests only. */
export function __resetLive(): void {
  for (const e of entries.values()) if (e.closing !== null) clearTimeout(e.closing);
  entries.clear();
}
