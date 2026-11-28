import { useCallback, useEffect, useState } from 'react';
import { computeWinners, fetchWinners, type WinnerRow } from '../lib/winners';

// One load per room for the session, shared by the final sequence, the final
// screen and the reel (the host computes only when there are none yet;
// compute_winners deletes and rewrites the rows).
const cache = new Map<string, Promise<WinnerRow[]>>();

function load(roomId: string, isHost: boolean, force = false): Promise<WinnerRow[]> {
  const hit = cache.get(roomId);
  if (hit && !force) return hit;
  const p = (async () => {
    // Finalize already writes every room's winners (108), so the host
    // computes them only when none exist yet (F9): recomputing would rewrite
    // rows a tie vote or a sudden death has already settled.
    const rows = await fetchWinners(roomId);
    if (rows.length > 0 || !isHost) return rows;
    await computeWinners(roomId).catch(() => {});
    return fetchWinners(roomId);
  })();
  cache.set(roomId, p);
  p.catch(() => cache.delete(roomId));
  return p;
}

/** Test hook. */
export function resetWinnersCache() { cache.clear(); }

export function useWinners(roomId: string | null | undefined, isHost: boolean, enabled = true) {
  const [rows, setRows] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId || !enabled) return;
    let alive = true;
    setLoading(true);
    load(roomId, isHost).then((r) => { if (alive) { setRows(r); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [roomId, isHost, enabled]);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    const r = await load(roomId, isHost, true).catch(() => [] as WinnerRow[]);
    setRows(r);
    setLoading(false);
  }, [roomId, isHost]);

  return { rows, loading, refresh };
}
