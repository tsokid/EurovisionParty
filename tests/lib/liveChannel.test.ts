// The game's live updates: one private Broadcast channel per topic, shared by
// every listener, with a catch-up when the channel joins again (105).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Bind = (msg: { event: string; payload: unknown }) => void;
const channels: Array<{ topic: string; opts: unknown; bind: Bind | null; status: ((s: string) => void) | null; removed: boolean }> = [];

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: (topic: string, opts: unknown) => {
      const rec = { topic, opts, bind: null as Bind | null, status: null as ((s: string) => void) | null, removed: false };
      channels.push(rec);
      const ch = {
        on: (_t: string, _f: unknown, cb: Bind) => { rec.bind = cb; return ch; },
        subscribe: (cb: (s: string) => void) => { rec.status = cb; return ch; },
        __rec: rec,
      };
      return ch;
    },
    removeChannel: (ch: { __rec: { removed: boolean } }) => { ch.__rec.removed = true; return Promise.resolve('ok'); },
  },
}));

import { onLive, onLiveStatus, __resetLive } from '../../src/lib/liveChannel';
import { onResync, __resetResync } from '../../src/lib/resync';

describe('liveChannel', () => {
  beforeEach(() => { vi.useFakeTimers(); channels.length = 0; __resetLive(); __resetResync(); });
  afterEach(() => { vi.useRealTimers(); });

  it('opens one private channel per topic and routes each table to its listeners', () => {
    const players = vi.fn();
    const duels = vi.fn();
    const off1 = onLive('room:r1', 'players', players);
    const off2 = onLive('room:r1', 'duels', duels);
    expect(channels).toHaveLength(1);
    expect(channels[0].topic).toBe('room:r1');
    expect(channels[0].opts).toEqual({ config: { private: true } });

    channels[0].bind!({ event: 'players', payload: { table: 'players', op: 'UPDATE', new: { id: 'p1', quiz_points: 3 }, old: { id: 'p1' } } });
    expect(players).toHaveBeenCalledWith({ eventType: 'UPDATE', new: { id: 'p1', quiz_points: 3 }, old: { id: 'p1' } });
    expect(duels).not.toHaveBeenCalled();
    off1(); off2();
  });

  it('closes the channel only after the last listener left and a grace period', () => {
    const off1 = onLive('room:r2', 'players', vi.fn());
    const off2 = onLive('room:r2', 'rooms', vi.fn());
    off1();
    vi.advanceTimersByTime(5_000);
    expect(channels[0].removed).toBe(false);
    off2();
    vi.advanceTimersByTime(1_000);
    expect(channels[0].removed).toBe(false);
    vi.advanceTimersByTime(1_500);
    expect(channels[0].removed).toBe(true);
  });

  it('a screen that remounts within the grace period reuses the channel', () => {
    const off = onLive('room:r3', 'players', vi.fn());
    off();
    const off2 = onLive('room:r3', 'players', vi.fn());
    vi.advanceTimersByTime(5_000);
    expect(channels).toHaveLength(1);
    expect(channels[0].removed).toBe(false);
    off2();
  });

  it('a rejoin after a drop runs one catch-up; the first join does not', () => {
    const resync = vi.fn();
    const offR = onResync(resync);
    const status = vi.fn();
    const off = onLiveStatus('room:r4', status);
    channels[0].status!('SUBSCRIBED');
    vi.runAllTimers();
    expect(resync).not.toHaveBeenCalled();
    channels[0].status!('CHANNEL_ERROR');
    channels[0].status!('SUBSCRIBED');
    vi.runAllTimers();
    expect(resync).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith('CHANNEL_ERROR');
    off(); offR();
  });
});

describe('resync', () => {
  beforeEach(() => { vi.useFakeTimers(); __resetResync(); });
  afterEach(() => { vi.useRealTimers(); });

  const setVisibility = (v: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('a tab hidden for 3 s or more catches up once on return; a quick switch does not', () => {
    const fn = vi.fn();
    const off = onResync(fn);
    setVisibility('hidden');
    vi.advanceTimersByTime(1_000);
    setVisibility('visible');
    vi.runAllTimers();
    expect(fn).not.toHaveBeenCalled();

    setVisibility('hidden');
    vi.advanceTimersByTime(10_000);
    setVisibility('visible');
    window.dispatchEvent(new Event('online')); // merged with the return
    vi.runAllTimers();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });
});
