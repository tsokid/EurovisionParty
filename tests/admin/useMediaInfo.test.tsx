// useMediaInfo keeps its signed URLs fresh while the editor stays open:
// they live SIGNED_URL_TTL_S (1 h) and are re-signed 5 minutes before that.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { __resetMediaCacheForTests, SIGNED_URL_TTL_S, type MediaRow } from '../../src/admin/modules/pages/media/mediaApi';
import { useMediaInfo } from '../../src/admin/modules/pages/media/useMediaInfo';

const IMG = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const IMG2 = '1b7c1f3e-5a4d-4c2e-9f10-1234567890ab';

const row = (id: string, path: string, variant_of: string | null = null): MediaRow => ({
  id, kind: 'image', storage_path: path, variant_of, mime: 'image/webp', bytes: 10, width: 1600, height: 900,
  sha256: 'a'.repeat(64), published_path: null, created_at: '2026-10-31T10:00:00Z',
});

const h = vi.hoisted(() => ({ signed: vi.fn(), round: 0, refuse: new Set<string>() }));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string) =>
      Promise.resolve({ data: name === 'media_list' ? [row(IMG, `${IMG}.webp`), row('v', `${IMG}-800.webp`, IMG), row(IMG2, `${IMG2}.webp`)] : null, error: null }),
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[]) => {
          h.signed(paths);
          h.round++;
          return Promise.resolve({ data: paths.map((p) => (h.refuse.has(p) ? { path: p, signedUrl: '', error: 'Object not found' } : { path: p, signedUrl: `https://signed.test/${p}?r=${h.round}`, error: null })), error: null });
        },
      }),
    },
  },
}));

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  __resetMediaCacheForTests();
  h.signed.mockReset();
  h.round = 0;
  h.refuse.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMediaInfo signed URL refresh', () => {
  it('re-signs 5 minutes before the 1 h TTL, while mounted', async () => {
    const { result } = renderHook(() => useMediaInfo([IMG]));
    await flush();
    expect(result.current.ready).toBe(true);
    expect(result.current.urls[`${IMG}.webp`]).toBe(`https://signed.test/${IMG}.webp?r=1`);
    expect(h.signed).toHaveBeenCalledTimes(1);

    // Just before TTL − 5 min: nothing yet.
    await act(async () => { await vi.advanceTimersByTimeAsync((SIGNED_URL_TTL_S - 5 * 60) * 1000 - 1000); });
    expect(h.signed).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await flush();
    expect(h.signed).toHaveBeenCalledTimes(2);
    expect(h.signed.mock.calls[1][0].sort()).toEqual([`${IMG}-800.webp`, `${IMG}.webp`]);
    expect(result.current.ready).toBe(true);
    expect(result.current.urls[`${IMG}.webp`]).toBe(`https://signed.test/${IMG}.webp?r=2`);

    // And again an hour later: it keeps going while the editor is open.
    await act(async () => { await vi.advanceTimersByTimeAsync((SIGNED_URL_TTL_S - 5 * 60) * 1000); });
    await flush();
    expect(h.signed).toHaveBeenCalledTimes(3);
  });

  it('a URL reused from the cache keeps its own expiry: adding an id midway does not push the re-sign past it', async () => {
    const MIN = 60_000;
    const t0 = Date.now();
    const { result, rerender } = renderHook(({ ids }) => useMediaInfo(ids), { initialProps: { ids: [IMG] } });
    await flush();
    expect(h.signed).toHaveBeenCalledTimes(1); // A (IMG and its variant) signed at t=0, expires at t=60 min

    // t=30 min: B joins. A comes from the cache (30 min left), only B is signed.
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * MIN); });
    rerender({ ids: [IMG, IMG2] });
    await flush();
    expect(h.signed).toHaveBeenCalledTimes(2);
    expect(h.signed.mock.calls[1][0]).toEqual([`${IMG2}.webp`]);
    expect(result.current.urls[`${IMG}.webp`]).toBe(`https://signed.test/${IMG}.webp?r=1`);

    // A must be re-signed 5 min before its own expiry (t=55), not 55 min after B's load (t=85).
    await act(async () => { await vi.advanceTimersByTimeAsync(25 * MIN - 1000); });
    expect(h.signed).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await flush();
    expect(h.signed).toHaveBeenCalledTimes(3);
    expect(h.signed.mock.calls[2][0]).toEqual(expect.arrayContaining([`${IMG}.webp`, `${IMG}-800.webp`]));
    expect(result.current.urls[`${IMG}.webp`]).toBe(`https://signed.test/${IMG}.webp?r=3`);
    expect(Date.now() - t0).toBeLessThan(60 * MIN); // before A's expiry
  });

  it('a URL Storage refuses to re-sign is dropped, not refreshed in a loop', async () => {
    const { result } = renderHook(() => useMediaInfo([IMG]));
    await flush();
    h.refuse.add(`${IMG}-800.webp`);
    await act(async () => { await vi.advanceTimersByTimeAsync((SIGNED_URL_TTL_S - 5 * 60) * 1000); });
    await flush();
    expect(h.signed).toHaveBeenCalledTimes(2);
    expect(result.current.urls[`${IMG}-800.webp`]).toBeUndefined();
    expect(result.current.urls[`${IMG}.webp`]).toBe(`https://signed.test/${IMG}.webp?r=2`);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(h.signed).toHaveBeenCalledTimes(2);
  });

  it('stops refreshing once unmounted', async () => {
    const { unmount } = renderHook(() => useMediaInfo([IMG]));
    await flush();
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(2 * SIGNED_URL_TTL_S * 1000); });
    expect(h.signed).toHaveBeenCalledTimes(1);
  });
});
