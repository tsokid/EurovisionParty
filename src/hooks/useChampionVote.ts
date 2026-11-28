import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { onLive, roomTopic } from '../lib/liveChannel';

export type ChampionVoteStatus = 'active' | 'accept' | 'sudden_death' | null;

/** Latest champion tie-vote status for the room (drives the tie banner and the crown). */
export function useChampionVote(roomId: string | null | undefined): ChampionVoteStatus {
  const [status, setStatus] = useState<ChampionVoteStatus>(null);
  useEffect(() => {
    if (!roomId) return;
    let mounted = true;
    void (async () => {
      const { data } = await supabase
        .from('tie_votes')
        .select('status')
        .eq('room_id', roomId)
        .eq('category', 'champion')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setStatus(((data as { status?: string } | null)?.status as ChampionVoteStatus) ?? null);
    })();
    const off = onLive<{ category?: string; status?: string }>(roomTopic(roomId), 'tie_votes', (change) => {
      if (change.eventType === 'DELETE') { setStatus(null); return; }
      const row = change.new;
      if (row.category === 'champion' && row.status) setStatus(row.status as ChampionVoteStatus);
    });
    return () => { mounted = false; off(); };
  }, [roomId]);
  return status;
}
