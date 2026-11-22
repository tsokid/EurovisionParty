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
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Avatar } from '../stage';

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
  const { t } = useTranslation();
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
  const names = tiedPlayerNames.join(' & ');
  if (!vote) {
    return (
      <div className="tv-panel">
        <span className="chip chip-gold tv-chip">{t('tie.tag')}</span>
        <p className="tv-panel-t">{t('tie.tiedNames', { names })}</p>
        <p className="t-small">{t('tie.explain')}</p>
        {isHost ? (
          <button type="button" onClick={openVote} disabled={busy} className="btn btn-primary btn-block">
            {t('tie.open')}
          </button>
        ) : (
          <p className="t-meta">{t('tie.waitHost')}</p>
        )}
        {err && <p className="pk-error" role="alert">{err}</p>}
      </div>
    );
  }

  // ── Tie accepted ──────────────────────────────────────────────────────
  if (vote.status === 'accept') {
    return (
      <div className="tv-panel c">
        <span className="chip chip-gold tv-chip">{t('tie.acceptedTag')}</span>
        <p className="tv-panel-t">{t('tie.acceptedTitle')}</p>
        <p className="t-small">{t('tie.acceptedBody')}</p>
        <div className="tv-names">
          {tiedPlayerNames.map((name) => (
            <span key={name} className="tv-name"><Avatar name={name} size="sm" />{name}<Crown aria-hidden="true" strokeWidth={2} /></span>
          ))}
        </div>
      </div>
    );
  }

  // ── Sudden death chosen ──────────────────────────────────────────────
  if (vote.status === 'sudden_death') {
    return (
      <div className="tv-panel c">
        <span className="chip tv-chip pink">{t('tie.sdTag')}</span>
        <p className="tv-panel-t">{t('tie.sdTitle')}</p>
        <p className="t-small">{isHost ? t('tie.sdHost') : t('tie.sdGuest')}</p>
      </div>
    );
  }

  // ── Active vote ──────────────────────────────────────────────────────
  const suddenPct = Math.round((suddens / total) * 100);
  const acceptPct = Math.round((accepts / total) * 100);

  return (
    <AnimatePresence mode="wait">
      <motion.div key="active-vote" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="tv-panel">
        <div className="tv-head">
          <div>
            <span className="chip chip-gold tv-chip">{t('tie.tag')}</span>
            <p className="tv-panel-t">{t('tie.question')}</p>
            <p className="t-small">{t('tie.voteIn', { names, s: remaining })}</p>
          </div>
          <span className="num tv-count" aria-label={t('tie.secondsLeft', { s: remaining })}>{remaining}</span>
        </div>
        <div className="tv-opts">
          {(['sudden_death', 'accept'] as const).map((opt) => {
            const isMine = myChoice === opt;
            const count = opt === 'accept' ? accepts : suddens;
            const pct = opt === 'accept' ? acceptPct : suddenPct;
            return (
              <button key={opt} type="button" onClick={() => castVote(opt)} disabled={busy} aria-pressed={isMine} className={clsx('tv-opt', isMine && 'on', opt === 'accept' ? 'acc' : 'sd')}>
                <span className="tv-opt-h"><b>{t(opt === 'accept' ? 'tie.accept' : 'tie.sudden')}</b><span className="t-meta num">{count} · {pct}%</span></span>
                <span className="t-meta">{t(opt === 'accept' ? 'tie.acceptDesc' : 'tie.suddenDesc')}</span>
                <span className="tv-bar"><motion.span animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} /></span>
              </button>
            );
          })}
        </div>
        <p className="t-meta tv-foot">{t('tie.rule')}</p>
        {err && <p className="pk-error" role="alert">{err}</p>}
      </motion.div>
    </AnimatePresence>
  );
}
