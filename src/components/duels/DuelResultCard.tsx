import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { useGameStore } from '../../stores/gameStore';
import type { Duel, Player, DuelDecision } from '../../lib/types';

interface DuelResultCardProps {
  duel: Duel;
  onDecision?: (duelId: string, decision: DuelDecision) => void;
  onRematch?: (duelId: string) => void;
  hasRematch?: boolean;
}

function getPlayerInfo(playerId: string, players: Player[]): { name: string; emoji: string; totalPoints: number } {
  const p = players.find((pl) => pl.id === playerId);
  return { name: p?.name ?? 'Player', emoji: p?.avatar_emoji ?? '🎤', totalPoints: p?.total_points ?? 0 };
}

export default function DuelResultCard({ duel, onDecision, onRematch, hasRematch }: DuelResultCardProps) {
  const { t } = useTranslation();
  const { player, players } = useGameStore();
  const [deciding, setDeciding] = useState(false);

  const isTie = duel.status === 'tie';
  const isWinner = !isTie && duel.winner_id === player?.id;
  const isLoser = !isTie && duel.loser_id === player?.id;
  const isDraw = duel.status === 'completed' && !duel.winner_id;
  const needsDecision = isWinner && !duel.winner_decision;

  const challenger = getPlayerInfo(duel.challenger_id, players);
  const challenged = getPlayerInfo(duel.challenged_id, players);

  const challengerWon = duel.winner_id === duel.challenger_id;
  const challengedWon = duel.winner_id === duel.challenged_id;

  const isChallenger = player?.id === duel.challenger_id;
  const myScore = isChallenger ? duel.challenger_score : duel.challenged_score;

  // Get opponent info for steal check
  const opponentId = isChallenger ? duel.challenged_id : duel.challenger_id;
  const opponent = getPlayerInfo(opponentId, players);
  const canSteal = opponent.totalPoints > 0;
  const stealAmount = Math.min(myScore, opponent.totalPoints);

  const handleDecision = async (decision: DuelDecision) => {
    if (!onDecision) return;
    setDeciding(true);
    try {
      await onDecision(duel.id, decision);
    } finally {
      setDeciding(false);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={
        isTie ? 'border border-white/15' :
        isWinner ? 'border border-euro-green/30' :
        isLoser ? 'border border-euro-red/30' :
        ''
      }>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/40 font-medium">
            {duel.is_rematch ? t('duelResult.rematchLabel') : t('duelResult.duelLabel')}
          </span>
          <Badge variant={isTie ? 'gold' : isWinner ? 'green' : isLoser ? 'red' : 'gold'}>
            {isTie ? t('duelResult.tie')
              : isWinner ? t('duelResult.won')
              : isLoser ? t('duelResult.lost')
              : isDraw ? t('duelResult.draw')
              : t('duelResult.completed')}
          </Badge>
        </div>

        {/* Score comparison - winner highlighted */}
        <div className="flex items-center justify-between mb-3">
          {/* Challenger side */}
          <div className={`flex flex-col items-center gap-1 flex-1 rounded-xl py-2 ${challengerWon ? 'bg-euro-green/10 ring-1 ring-euro-green/30' : ''}`}>
            {challengerWon && <span className="text-lg">🏆</span>}
            <span className={`text-sm font-medium truncate max-w-[80px] ${challengerWon ? 'text-euro-green' : 'text-white'}`}>
              {challenger.name}
            </span>
            <span className={`text-xl font-bold ${challengerWon ? 'text-euro-green' : 'text-white/60'}`}>
              {duel.challenger_score}
            </span>
          </div>

          {/* Center divider */}
          <div className="flex-shrink-0 px-2 text-center">
            <span className="text-xs font-extrabold text-white/20">VS</span>
            <p className="text-[10px] text-white/15">/ 36</p>
          </div>

          {/* Challenged side */}
          <div className={`flex flex-col items-center gap-1 flex-1 rounded-xl py-2 ${challengedWon ? 'bg-euro-green/10 ring-1 ring-euro-green/30' : ''}`}>
            {challengedWon && <span className="text-lg">🏆</span>}
            <span className={`text-sm font-medium truncate max-w-[80px] ${challengedWon ? 'text-euro-green' : 'text-white'}`}>
              {challenged.name}
            </span>
            <span className={`text-xl font-bold ${challengedWon ? 'text-euro-green' : 'text-white/60'}`}>
              {duel.challenged_score}
            </span>
          </div>
        </div>

        {/* Tie — no winner, no reward */}
        {isTie && (
          <div className="text-center py-2 rounded-lg bg-white/5">
            <p className="text-sm font-semibold text-white/70">{t('duelResult.tie')}</p>
            <p className="text-xs text-white/45 mt-0.5">{t('duelResult.tieDesc')}</p>
          </div>
        )}

        {/* Decision already made */}
        {!isTie && duel.winner_decision && (
          <div className="text-center py-2 rounded-lg bg-white/5 mb-2">
            <p className="text-xs text-white/40">{t('duelResult.decisionMade')}</p>
            <p className="text-sm font-bold text-euro-gold">
              {duel.winner_decision === 'steal'
                ? t('duelResult.stolePoints', { amount: duel.points_transferred })
                : t('duelResult.doubledPoints', { amount: duel.points_transferred })}
            </p>
          </div>
        )}

        {/* Pending decision (winner only) */}
        {needsDecision && onDecision && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-euro-gold text-center font-medium animate-pulse">
              {t('duelResult.chooseReward')}
            </p>
            <div className="flex gap-2">
              {canSteal ? (
                <Button
                  size="sm"
                  fullWidth
                  onClick={() => handleDecision('steal')}
                  loading={deciding}
                >
                  {t('duelResult.stealBtn', { amount: stealAmount })}
                </Button>
              ) : (
                <div className="flex-1 text-center py-2.5 rounded-xl bg-white/5 border border-white/10 opacity-40">
                  <p className="text-xs text-white/40">{t('duelResult.stealDisabled')}</p>
                  <p className="text-[10px] text-white/25">{t('duelResult.opponentZero')}</p>
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                fullWidth
                onClick={() => handleDecision('double')}
                loading={deciding}
              >
                {t('duelResult.doubleBtn', { amount: myScore * 2 })}
              </Button>
            </div>
            <p className="text-[10px] text-white/30 text-center">
              {canSteal
                ? t('duelResult.stealHint', { amount: stealAmount })
                : t('duelResult.noPointsHint')}
            </p>
          </div>
        )}

        {/* Rematch button — prominent CTA for loser, hidden if already requested */}
        {isLoser && !hasRematch && onRematch && duel.winner_decision && (
          <div className="mt-3">
            <Button
              size="sm"
              fullWidth
              onClick={() => onRematch(duel.id)}
            >
              {t('duelResult.rematchBtn')}
            </Button>
          </div>
        )}
        {isLoser && hasRematch && (
          <p className="text-[10px] text-white/25 text-center mt-2">{t('duelResult.rematchRequested')}</p>
        )}
      </Card>
    </motion.div>
  );
}
