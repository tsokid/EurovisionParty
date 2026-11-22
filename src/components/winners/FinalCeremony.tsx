// Mounted by RoomPage while the room is in phase `final`: plays the tier-1
// winners sequence once per room per browser, the moment the phase arrives
// (realtime), so the whole room watches it together. «Δες ξανά την τελετή»
// on the final screen replays it through REPLAY_FINALE_EVENT.
import { useEffect, useState } from 'react';
import FinalSequence, { finaleSeenKey } from './FinalSequence';
import { useWinners } from '../../hooks/useWinners';
import { useChampionVote } from '../../hooks/useChampionVote';
import type { Player } from '../../lib/types';

export const REPLAY_FINALE_EVENT = 'eg:replay-finale';

function seen(roomId: string): boolean {
  try { return localStorage.getItem(finaleSeenKey(roomId)) === '1'; } catch { return false; }
}

export default function FinalCeremony({ roomId, isHost, players, meId }: { roomId: string; isHost: boolean; players: readonly Player[]; meId?: string | null }) {
  const { rows, loading } = useWinners(roomId, isHost);
  const vote = useChampionVote(roomId);
  const [open, setOpen] = useState(() => !seen(roomId));

  useEffect(() => {
    const onReplay = () => setOpen(true);
    window.addEventListener(REPLAY_FINALE_EVENT, onReplay);
    return () => window.removeEventListener(REPLAY_FINALE_EVENT, onReplay);
  }, []);

  const ready = open && !loading && players.length > 0;
  // Seen as soon as it starts: a refresh mid-sequence does not replay it.
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(finaleSeenKey(roomId), '1'); } catch { /* ignore */ }
  }, [ready, roomId]);

  if (!ready) return null;
  return (
    <FinalSequence
      players={players}
      winners={rows}
      meId={meId}
      championVote={vote}
      onClose={() => setOpen(false)}
    />
  );
}
