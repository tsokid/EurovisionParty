import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
    const ch = supabase
      .channel(`tie_votes_status:${roomId}:champion:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tie_votes', filter: `room_id=eq.${roomId}` },
        (payload: { eventType: string; new: { category?: string; status?: string } }) => {
          if (payload.eventType === 'DELETE') { setStatus(null); return; }
          const row = payload.new;
          if (row.category === 'champion' && row.status) setStatus(row.status as ChampionVoteStatus);
        }).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [roomId]);
  return status;
}
