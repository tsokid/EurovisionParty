import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { selectRoundQuestions } from '../lib/questionRandomizer';
import { fetchSeenQuestionIdsForDuel } from '../lib/usedQuestions';
import { useGameStore } from '../stores/gameStore';
import type { Duel, DuelAnswer, DuelDecision } from '../lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const DUEL_QUESTIONS_COUNT = 3;

/** Calculate points for a duel answer: 12pts at 0s, 11pts at 1s, ..., 1pt at 11s, 0 if wrong/timeout */
export function calcDuelPoints(responseMs: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  const seconds = Math.floor(responseMs / 1000);
  return Math.max(0, 12 - seconds);
}

interface UseDuelsReturn {
  duels: Duel[];
  pendingDuels: Duel[];
  activeDuels: Duel[];
  pendingDecisions: Duel[];
  createDuel: (challengerId: string, challengedId: string, roomId: string) => Promise<Duel>;
  acceptDuel: (duelId: string) => Promise<void>;
  declineDuel: (duelId: string) => Promise<void>;
  submitDuelAnswers: (duelId: string, playerId: string, answers: DuelAnswer[]) => Promise<void>;
  makeDecision: (duelId: string, playerId: string, decision: DuelDecision) => Promise<void>;
  requestRematch: (originalDuelId: string, loserId: string, roomId: string) => Promise<Duel>;
  fetchPlayerDuels: (playerId: string) => Promise<void>;
  refetchDuels: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useDuels(roomId: string | null | undefined): UseDuelsReturn {
  const [duels, setDuels] = useState<Duel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel('duels:' + roomId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'duels', filter: 'room_id=eq.' + roomId,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDuels((prev) => [payload.new as Duel, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setDuels((prev) => prev.map((d) => d.id === (payload.new as Duel).id ? (payload.new as Duel) : d));
        } else if (payload.eventType === 'DELETE') {
          setDuels((prev) => prev.filter((d) => d.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe((status, err) => {
        if (err) console.error('[useDuels] Realtime error:', status, err);
      });

    channelRef.current = channel;
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [roomId]);

  const refetchDuels = useCallback(async (): Promise<void> => {
    if (!roomId) return;
    const { data } = await supabase
      .from('duels')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (data) setDuels(data as Duel[]);
  }, [roomId]);

  const fetchPlayerDuels = useCallback(async (playerId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('duels')
        .select('*')
        .or('challenger_id.eq.' + playerId + ',challenged_id.eq.' + playerId)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setDuels((data ?? []) as Duel[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch duels');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create duel with 3 random questions — exclude any question either player has seen
  const createDuel = useCallback(async (
    challengerId: string, challengedId: string, duelRoomId: string
  ): Promise<Duel> => {
    setError(null);
    try {
      const seenIds = await fetchSeenQuestionIdsForDuel(challengerId, challengedId, duelRoomId);
      const questions = selectRoundQuestions(seenIds).slice(0, DUEL_QUESTIONS_COUNT);
      const questionIds = questions.map((q) => q.id);

      const { data, error: insertErr } = await supabase
        .from('duels')
        .insert({
          room_id: duelRoomId,
          challenger_id: challengerId,
          challenged_id: challengedId,
          question_ids: questionIds,
          question_id: questionIds[0], // backward compat
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      return data as Duel;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create duel';
      setError(msg);
      throw err;
    }
  }, []);

  const acceptDuel = useCallback(async (duelId: string): Promise<void> => {
    setError(null);
    try {
      const { data, error: updateErr } = await supabase
        .from('duels')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', duelId).select().single();
      if (updateErr) throw updateErr;
      if (data) setDuels((prev) => prev.map((d) => d.id === duelId ? (data as Duel) : d));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept duel');
      throw err;
    }
  }, []);

  const declineDuel = useCallback(async (duelId: string): Promise<void> => {
    setError(null);
    try {
      const { player } = useGameStore.getState();
      if (!player) throw new Error('Not in a room');

      const { data: result, error: rpcErr } = await supabase.rpc('decline_duel', {
        p_duel_id: duelId,
        p_player_id: player.id,
      });

      if (rpcErr) throw rpcErr;

      // Update duel status locally
      setDuels((prev) => prev.map((d) =>
        d.id === duelId ? { ...d, status: 'declined' } : d
      ));

      // Sync player's new decline_count into the store
      if (result?.decline_count !== undefined) {
        useGameStore.getState().updatePlayer({ decline_count: result.decline_count });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to decline duel');
      throw err;
    }
  }, []);

  // Submit all 3 answers at once — uses server-side RPC to prevent race conditions
  const submitDuelAnswers = useCallback(async (
    duelId: string, playerId: string, answers: DuelAnswer[]
  ): Promise<void> => {
    setError(null);
    try {
      const totalScore = answers.reduce((sum, a) => sum + a.points, 0);

      const { error: rpcErr } = await supabase.rpc('submit_duel_answers', {
        p_duel_id: duelId,
        p_player_id: playerId,
        p_answers: answers,
        p_total_score: totalScore,
      });

      if (rpcErr) throw rpcErr;

      // Refetch the duel to get the authoritative state
      const { data: freshDuel } = await supabase
        .from('duels').select('*').eq('id', duelId).single();
      if (freshDuel) {
        setDuels((prev) => prev.map((d) => d.id === duelId ? (freshDuel as Duel) : d));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit answers');
      throw err;
    }
  }, []);

  // Winner makes steal/double decision
  const makeDecision = useCallback(async (
    duelId: string, playerId: string, decision: DuelDecision
  ): Promise<void> => {
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('apply_duel_decision', {
        p_duel_id: duelId,
        p_decision: decision,
        p_player_id: playerId,
      });
      if (rpcErr) throw rpcErr;

      // Update local state
      setDuels((prev) => prev.map((d) =>
        d.id === duelId ? { ...d, winner_decision: decision, decision_made_at: new Date().toISOString() } : d
      ));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply decision');
      throw err;
    }
  }, []);

  // Loser requests rematch
  const requestRematch = useCallback(async (
    originalDuelId: string, loserId: string, duelRoomId: string
  ): Promise<Duel> => {
    setError(null);
    try {
      // Check no rematch already exists
      const { data: existing } = await supabase
        .from('duels')
        .select('id')
        .eq('parent_duel_id', originalDuelId)
        .maybeSingle();

      if (existing) throw new Error('Rematch already requested');

      const originalDuel = duels.find((d) => d.id === originalDuelId);
      if (!originalDuel) throw new Error('Original duel not found');

      // Get 3 new questions — exclude everything both players have seen
      const opponentIdForRematch = originalDuel.challenger_id === loserId
        ? originalDuel.challenged_id
        : originalDuel.challenger_id;
      const seenIdsRematch = await fetchSeenQuestionIdsForDuel(loserId, opponentIdForRematch, duelRoomId);
      const questions = selectRoundQuestions(seenIdsRematch).slice(0, DUEL_QUESTIONS_COUNT);
      const questionIds = questions.map((q) => q.id);

      // Loser becomes the challenger in the rematch
      const opponentId = originalDuel.challenger_id === loserId
        ? originalDuel.challenged_id
        : originalDuel.challenger_id;

      const { data, error: insertErr } = await supabase
        .from('duels')
        .insert({
          room_id: duelRoomId,
          challenger_id: loserId,
          challenged_id: opponentId,
          question_ids: questionIds,
          question_id: questionIds[0],
          is_rematch: true,
          parent_duel_id: originalDuelId,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      return data as Duel;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request rematch';
      setError(msg);
      throw err;
    }
  }, [duels]);

  const pendingDuels = duels.filter((d) => d.status === 'pending');
  const activeDuels = duels.filter((d) => d.status === 'accepted' || d.status === 'answering');
  const pendingDecisions = duels.filter((d) =>
    d.status === 'completed' && d.winner_decision === null && d.winner_id !== null
  );

  return {
    duels, pendingDuels, activeDuels, pendingDecisions,
    createDuel, acceptDuel, declineDuel, submitDuelAnswers,
    makeDecision, requestRematch, fetchPlayerDuels, refetchDuels,
    isLoading, error,
  };
}
