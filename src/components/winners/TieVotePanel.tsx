// src/components/winners/TieVotePanel.tsx
// Champion tiebreak gate — visual matches the reference design.
// Logic: host opens 60s vote, players pick Sudden Death or Accept.
// Majority wins; ties default to accept.

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useGameStore } from '../../stores/gameStore';
import type { WinnerCategory } from '../../lib/winners';
import { avatarInitial, avatarGradient } from '../../lib/avatarUtils';

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
  tiedPlayerNames: string[];
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

  const myChoice = player ? choices.find((c) => c.player_id === player.id)?.choice ?? null : null;
  const accepts = choices.filter((c) => c.choice === 'accept').length;
  const suddens = choices.filter((c) => c.choice === 'sudden_death').length;
  const total = choices.length || 1;
  const remaining = vote ? Math.max(0, Math.ceil((new Date(vote.closes_at).getTime() - now) / 1000)) : 0;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('tie_votes').select('id, closes_at, status')
        .eq('room_id', roomId).eq('category', category)
        .order('opened_at', { ascending: false }).limit(1);
      if (mounted && data?.[0]) setVote(data[0] as ActiveVote);
    })();
    const ch = supabase.channel(`tie_votes:${roomId}:${category}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tie_votes', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as ActiveVote | undefined;
          if (row && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
            setVote(row);
            if (row.status === 'accept' || row.status === 'sudden_death') onResolved(row.status);
          }
        }).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [roomId, category, onResolved]);

  useEffect(() => {
    if (!vote) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('tie_vote_choices')
        .select('vote_id, player_id, choice').eq('vote_id', vote.id);
      if (mounted) setChoices((data ?? []) as Choice[]);
    })();
    const ch = supabase.channel(`tie_vote_choices:${vote.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tie_vote_choices', filter: `vote_id=eq.${vote.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as Choice;
          setChoices((prev) => { const next = prev.filter((c) => c.player_id !== row.player_id); next.push(row); return next; });
        }).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [vote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!vote || vote.status !== 'active') return;
    tickRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [vote?.id, vote?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!vote || vote.status !== 'active' || remaining > 0 || tallyFiredRef.current) return;
    tallyFiredRef.current = true;
    void supabase.rpc('tally_tie_vote', { p_vote_id: vote.id });
  }, [remaining, vote]);

  // Robust error → string. Supabase RPC errors are PostgrestError objects
  // (plain objects, NOT Error instances) so the previous
  // `e instanceof Error ? e.message : String(e)` produced "[object Object]".
  function errMsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e) {
      return String((e as { message: unknown }).message);
    }
    return String(e);
  }

  async function openVote() {
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.rpc('open_tie_vote', { p_room_id: roomId, p_category: category });
      if (error) throw error;
      tallyFiredRef.current = false;
      // 60 s window — matches the server-side `now() + interval '60 seconds'`
      // in migration 048. Keeps host UI in sync with the actual closes_at
      // before the realtime subscription confirms it.
      setVote({ id: data as string, closes_at: new Date(Date.now() + 60_000).toISOString(), status: 'active' });
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  }

  async function castVote(choice: 'accept' | 'sudden_death') {
    if (!vote) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.rpc('cast_tie_vote', { p_vote_id: vote.id, p_choice: choice });
      if (error) throw error;
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  }

  // ── No vote yet ──────────────────────────────────────────────────────
  if (!vote) {
    return (
      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/8 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-amber-400">⚠</span>
          <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">Tie at the top</span>
        </div>
        <p className="text-base font-bold text-white">{tiedPlayerNames.join(' & ')} are tied.</p>
        <p className="text-sm text-white/55 mt-1">
          The room can vote to share the win or settle it with a sudden-death match.
        </p>
        {isHost ? (
          <button
            type="button" onClick={openVote} disabled={busy}
            className="mt-4 px-5 py-2.5 rounded-full bg-euro-gold text-black font-bold text-sm disabled:opacity-50"
          >
            🗳️ Open Tie Vote (60s)
          </button>
        ) : (
          <p className="mt-3 text-xs text-white/40">Waiting for the host to open the vote…</p>
        )}
        {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
      </div>
    );
  }

  // ── Tie accepted ──────────────────────────────────────────────────────
  if (vote.status === 'accept') {
    return (
      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/8 p-6 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 px-3 py-1 text-xs font-bold text-amber-400 tracking-widest uppercase mb-4">
          💛 Tie Accepted
        </div>
        <p className="text-xl font-extrabold text-white">Two Champions</p>
        <p className="text-sm text-white/55 mt-1 max-w-xs mx-auto">
          The room voted to share the crown. Both players take the Champion card.
        </p>
        <div className="flex items-center justify-center gap-4 mt-5">
          {tiedPlayerNames.map((name, i) => (
            <div key={name} className="flex items-center gap-2 bg-white/[0.06] rounded-full pl-1 pr-3 py-1">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(i)} flex items-center justify-center text-white font-bold text-sm`}>
                {avatarInitial(name)}
              </div>
              <span className="text-sm font-semibold text-white">{name}</span>
              <Crown className="w-3.5 h-3.5 text-euro-gold" strokeWidth={2} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Sudden death chosen ──────────────────────────────────────────────
  if (vote.status === 'sudden_death') {
    return (
      <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/8 p-5 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-euro-pink/20 border border-euro-pink/40 px-3 py-1 text-xs font-bold text-euro-pink tracking-widest uppercase mb-3">
          ⚔ Sudden Death
        </div>
        <p className="text-base font-bold text-white">The room voted to settle it.</p>
        <p className="text-sm text-white/55 mt-1">
          {isHost ? 'Open the sudden-death match below.' : 'Sudden-death match incoming…'}
        </p>
      </div>
    );
  }

  // ── Active vote ──────────────────────────────────────────────────────
  const suddenPct = Math.round((suddens / total) * 100);
  const acceptPct = Math.round((accepts / total) * 100);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="active-vote"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-amber-400/25 bg-[#1a0a2e]/80 p-4 sm:p-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-400 tracking-widest uppercase mb-2">
              ⚠ Tie at the top
            </div>
            <p className="text-base sm:text-lg font-bold text-white">How do we crown the Champion?</p>
            <p className="text-sm text-white/55 mt-0.5">
              {tiedPlayerNames.join(' & ')} are tied. Vote in the next {remaining}s.
            </p>
          </div>
          {/* Countdown circle */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#0d0620] border border-white/15 flex items-center justify-center font-extrabold text-xl text-white tabular-nums">
            {remaining}
          </div>
        </div>

        {/* Vote options */}
        <div className="grid grid-cols-2 gap-3">
          {(['sudden_death', 'accept'] as const).map((opt) => {
            const isMine = myChoice === opt;
            const count = opt === 'accept' ? accepts : suddens;
            const pct = opt === 'accept' ? acceptPct : suddenPct;
            const label = opt === 'sudden_death' ? 'Sudden Death' : 'Accept the Tie';
            const icon = opt === 'sudden_death' ? '⚔' : '💛';
            const desc = opt === 'sudden_death'
              ? '3 quick questions decide the winner.'
              : 'Both players share the Champion crown.';

            return (
              <button
                key={opt}
                type="button"
                onClick={() => castVote(opt)}
                disabled={busy}
                className={`rounded-xl border p-3 text-left transition-all disabled:opacity-60 ${
                  isMine
                    ? 'border-euro-purple/60 bg-euro-purple/20'
                    : 'border-white/15 bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-bold text-white">{icon} {label}</p>
                  <span className="text-xs font-semibold text-white/60 tabular-nums">{count} · {pct}%</span>
                </div>
                <p className="text-xs text-white/45 mb-2">{desc}</p>
                {/* Vote bar */}
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${opt === 'sudden_death' ? 'bg-gradient-to-r from-euro-pink to-euro-purple' : 'bg-gradient-to-r from-emerald-400 to-cyan-400'}`}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-white/30 mt-3">
          Pick one — option with most votes wins when the timer ends. If no votes are cast (or it's a tie), the room defaults to <span className="text-amber-300/80 font-semibold">Accept the Tie</span>.
        </p>
        {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
      </motion.div>
    </AnimatePresence>
  );
}
