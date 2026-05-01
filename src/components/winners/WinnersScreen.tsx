import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import WinnerGrid from './WinnerGrid';
import SuddenDeathPanel from './SuddenDeathPanel';
import TieVotePanel from './TieVotePanel';
import LeaderboardScreen from '../leaderboard/LeaderboardScreen';
import { computeWinners, fetchWinners, groupByCategory, hasTie, CATEGORY_META } from '../../lib/winners';
import type { WinnerRow, WinnerCategory } from '../../lib/winners';
import { useGameStore } from '../../stores/gameStore';

interface Props { roomId: string; isHost: boolean; playerNameById: Record<string, string>; }

export default function WinnersScreen({ roomId, isHost, playerNameById }: Props) {
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { player } = useGameStore();

  const refresh = useCallback(async () => {
    setLoading(true);
    if (isHost) await computeWinners(roomId).catch(() => {});
    setWinners(await fetchWinners(roomId));
    setLoading(false);
  }, [roomId, isHost]);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return <p className="p-6 text-center text-white/60">Crowning the winners…</p>;
  }

  const groups = groupByCategory(winners);
  const ties: WinnerCategory[] = (Object.keys(groups) as WinnerCategory[]).filter((c) => hasTie(groups[c]));
  const champions = groups.champion;
  const championNames = champions.map((r) => playerNameById[r.player_id] ?? '?');
  const isShared = champions.length > 1;
  const meIsChampion = !!player && champions.some((r) => r.player_id === player.id);

  return (
    <div className="flex flex-col gap-6 max-w-3xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">

      {/* 1. WINNER REVEAL — full-width hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 18 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-euro-gold/15 border border-euro-gold/40 px-4 py-1.5 text-xs sm:text-sm font-bold tracking-[0.18em] text-euro-gold mb-4">
          <Trophy className="w-4 h-4" strokeWidth={2.4} />
          {isShared ? 'CO-CHAMPIONS' : 'CHAMPION'}
        </div>
        <motion.h2
          className="text-3xl sm:text-5xl font-extrabold leading-tight bg-gradient-to-r from-euro-gold via-euro-pink to-euro-purple-light bg-clip-text text-transparent"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 15 }}
        >
          {championNames.join(' & ') || '—'}
        </motion.h2>
        <p className="text-white/65 text-sm sm:text-base mt-2">
          {isShared
            ? 'Share the throne — equal points at the top.'
            : meIsChampion
            ? 'You did it. Take a bow.'
            : `Top score on the night: ${champions[0] ? Number(champions[0].metric_value) : 0} ${CATEGORY_META.champion.metricLabel.toLowerCase()}.`}
        </p>
      </motion.section>

      {/* 2/3. WINNER CARDS — current player's card first if they won
              anything (else champion-first by default). */}
      <WinnerGrid
        winners={winners}
        playerNameById={playerNameById}
        currentPlayerId={player?.id}
      />

      {/* 4. STANDINGS — full leaderboard with the player's row highlighted
            (LeaderboardScreen already does the highlight). */}
      <div className="border-t border-white/10 pt-2">
        <LeaderboardScreen />
      </div>

      {/* CHAMPION TIE → TIE VOTE → SUDDEN DEATH.
          Tie vote only applies to the champion category per spec.
          Other category co-winners go straight to the legacy
          single-question sudden-death panel below. */}
      {ties.includes('champion') && (
        <TieVotePanel
          roomId={roomId}
          isHost={isHost}
          category="champion"
          tiedPlayerNames={champions.map((r) => playerNameById[r.player_id] ?? '?')}
          onResolved={refresh}
        />
      )}

      {/* Legacy single-question sudden death for non-champion ties
          (Thief, Duelist, Oracle, Guru). Champion ties are handled
          by the TieVotePanel above; the 3-question match RPC is
          available server-side for the next iteration. */}
      <SuddenDeathPanel
        roomId={roomId}
        isHost={isHost}
        tiedCategories={ties.filter((c) => c !== 'champion')}
        onResolved={refresh}
      />
    </div>
  );
}
