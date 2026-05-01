// src/components/winners/TieVotePanel.tsx
// Champion tiebreak gate.
//   • Host opens vote → 20s window
//   • Every active player votes 'accept' or 'sudden_death'
//   • On window close (or host force-tally) the majority wins
//     (ties default to 'accept')
//   • Result feeds back to the WinnersScreen so it can either lock
//     in the co-champion card (accept) or reveal the host control
//     to open a 3-question sudden-death match.

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Handshake, Swords, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useGameStore } from '../../stores/gameStore';
import type { WinnerCategory } from '../../lib/winners';
import { CATEGORY_META } from '../../lib/winners';

interface ActiveVote {
  id: string;
  closes_at: string;
  status: 'active' | 'accept' | 'sudden_death' | 'cancelled';
}

interface Choice {
  vote_id: string;
  player_id: string;
  choice: 'accept' | 'sudden_death';
}

interface Props {
  roomId: string;
  isHost: boolean;
  category: WinnerCategory;
  /** Names of the tied players, for the headline. */
  tiedPlayerNames: string[];
  /** Called once the vote tallies, with the resolved status. */
  onResolved: (status: 'accept' | 'sudden_death') => void;
}

export default function TieVotePanel({ roomId, isHost, category, tiedPlayerNames, onResolved }: Props) {
  const { player } = useGameStore();
  const [vote, setVote] = useState<ActiveVote | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tallyFiredRef = useRef(false);
  const meta = CATEGORY_META[category];

  const myChoice = player ? choices.find((c) => c.player_id === player.id)?.choice ?? null : null;
  const accepts = choices.filter((c) => c.choice === 'accept').length;
  const suddens = choices.filter((c) => c.choice === 'sudden_death').length;
  const remaining = vote
    ? Math.max(0, Math.ceil((new Date(vote.closes_at).getTime() - now) / 1000))
    : 0;

  // Load any active vote for this room+category at mount + subscribe to it.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('tie_votes')
        .select('id, closes_at, status')
        .eq('room_id', roomId)
        .eq('category', category)
        .order('opened_at', { ascending: false })
        .limit(1);
      if (mounted && data?.[0]) setVote(data[0] as ActiveVote);
    })();

    const ch = supabase
      .channel(`tie_votes:${roomId}:${category}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tie_votes', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as ActiveVote | undefined;
          if (row && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
            setVote(row);
            if (row.status === 'accept' || row.status === 'sudden_death') {
              onResolved(row.status);
            }
          }
        })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [roomId, category, onResolved]);

  // Subscribe to choices for the current vote.
  useEffect(() => {
    if (!vote) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('tie_vote_choices')
        .select('vote_id, player_id, choice')
        .eq('vote_id', vote.id);
      if (mounted) setChoices((data ?? []) as Choice[]);
    })();
    const ch = supabase
      .channel(`tie_vote_choices:${vote.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tie_vote_choices', filter: `vote_id=eq.${vote.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as Choice;
          setChoices((prev) => {
            const next = prev.filter((c) => c.player_id !== row.player_id);
            next.push(row);
            return next;
          });
        })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [vote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1 Hz countdown tick + auto-tally when window expires.
  useEffect(() => {
    if (!vote || vote.status !== 'active') return;
    tickRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [vote?.id, vote?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!vote || vote.status !== 'active') return;
    if (remaining > 0 || tallyFiredRef.current) return;
    tallyFiredRef.current = true;
    void supabase.rpc('tally_tie_vote', { p_vote_id: vote.id });
  }, [remaining, vote]);

  async function openVote() {
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.rpc('open_tie_vote',
        { p_room_id: roomId, p_category: category });
      if (error) throw error;
      tallyFiredRef.current = false;
      setVote({ id: data as string, closes_at: new Date(Date.now() + 20_000).toISOString(), status: 'active' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function castVote(choice: 'accept' | 'sudden_death') {
    if (!vote) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.rpc('cast_tie_vote',
        { p_vote_id: vote.id, p_choice: choice });
      if (error) throw error;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  // ── No vote yet — show host CTA / waiting state ────────────────────
  if (!vote) {
    return (
      <div className="rounded-xl border border-euro-gold/40 bg-euro-gold/10 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">{meta.emojiFallback}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-euro-gold uppercase tracking-wide">
              {meta.label} · Co-winners
            </p>
            <p className="text-base sm:text-lg font-bold text-white mt-0.5 truncate">
              {tiedPlayerNames.join(' & ')}
            </p>
            <p className="text-xs sm:text-sm text-white/65 mt-1">
              Equal points at the top. The room can vote to share the win or settle it with a 3-question sudden death.
            </p>
          </div>
        </div>
        {isHost && (
          <button
            type="button"
            onClick={openVote}
            disabled={busy}
            className="mt-3 w-full sm:w-auto px-4 py-2 rounded-full bg-euro-gold text-black font-bold text-sm disabled:opacity-50"
          >
            🗳️ Open Tie Vote (20s)
          </button>
        )}
        {!isHost && (
          <p className="mt-3 text-xs text-white/55">Waiting for host to open the tie vote…</p>
        )}
        {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
      </div>
    );
  }

  // ── Vote resolved ───────────────────────────────────────────────────
  if (vote.status === 'accept') {
    return (
      <div className="rounded-xl border border-euro-green/40 bg-euro-green/10 p-4 sm:p-5 text-center">
        <Handshake className="w-8 h-8 mx-auto text-euro-green" strokeWidth={2.4} />
        <p className="mt-2 font-bold text-base sm:text-lg text-white">Tie accepted</p>
        <p className="text-sm text-white/70 mt-1">
          {tiedPlayerNames.join(' & ')} share the {meta.label} card.
        </p>
      </div>
    );
  }
  if (vote.status === 'sudden_death') {
    return (
      <div className="rounded-xl border border-euro-pink/40 bg-euro-pink/10 p-4 sm:p-5 text-center">
        <Swords className="w-8 h-8 mx-auto text-euro-pink" strokeWidth={2.4} />
        <p className="mt-2 font-bold text-base sm:text-lg text-white">Sudden death incoming</p>
        <p className="text-sm text-white/70 mt-1">
          The room voted to settle it. Host: open a 3-question match below.
        </p>
      </div>
    );
  }

  // ── Active vote ─────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-euro-purple/50 bg-euro-purple/10 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-euro-pink" strokeWidth={2.4} />
          <span className="text-xs sm:text-sm font-bold tracking-wide text-euro-pink uppercase">
            Tie vote · {remaining}s left
          </span>
        </div>
        <span className="text-xs text-white/55 tabular-nums">
          {choices.length} vote{choices.length === 1 ? '' : 's'}
        </span>
      </div>
      <p className="text-sm text-white/70 mt-1">
        {tiedPlayerNames.join(' & ')} are tied for {meta.label}. Pick what happens next.
      </p>

      <div className="grid grid-cols-2 gap-3 mt-4">
        {(['accept','sudden_death'] as const).map((opt) => {
          const isMine = myChoice === opt;
          const count = opt === 'accept' ? accepts : suddens;
          const Icon = opt === 'accept' ? Handshake : Swords;
          return (
            <motion.button
              key={opt}
              type="button"
              onClick={() => castVote(opt)}
              disabled={busy}
              whileTap={{ scale: 0.97 }}
              className={`relative rounded-xl border-2 p-3 sm:p-4 text-left transition-colors ${
                isMine
                  ? opt === 'accept'
                    ? 'border-euro-green bg-euro-green/15'
                    : 'border-euro-pink bg-euro-pink/15'
                  : 'border-white/15 bg-white/[0.04] hover:bg-white/[0.07]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isMine ? (opt === 'accept' ? 'text-euro-green' : 'text-euro-pink') : 'text-white/70'}`} strokeWidth={2.4} />
              <p className="font-bold text-white text-sm sm:text-base mt-1">
                {opt === 'accept' ? 'Accept tie' : 'Sudden death'}
              </p>
              <p className="text-xs text-white/55 mt-0.5">
                {opt === 'accept' ? 'Both share the card' : '3 questions decide it'}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-white/70 tabular-nums">
                {count} <AnimatePresence mode="wait">
                  {isMine && (
                    <motion.span
                      key="me"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-euro-gold" strokeWidth={2.4} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>
          );
        })}
      </div>

      {err && <p className="text-sm text-red-300 mt-3">{err}</p>}
    </div>
  );
}
