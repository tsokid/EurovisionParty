// src/components/leaderboard/WinnerCrown.tsx
// Full-screen crowning overlay shown the moment the room enters the
// `final` phase. Two modes:
//   • Single winner — confetti, gold spotlight, count-up score
//   • Tied         — amber palette, no name reveal, prompt to vote
//
// No emoji icons — the visual weight comes from typography, the avatar,
// the gold/amber accent rules, and choreographed motion.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import ConfettiOverlay from '../ui/ConfettiOverlay';
import { avatarGradient, avatarInitial } from '../../lib/avatarUtils';
import type { Player } from '../../lib/types';

interface WinnerCrownProps {
  winner: Player | null;
  visible: boolean;
  onDismiss?: () => void;
  /** When true, render a tie/tiebreak overlay instead of crowning a winner. */
  isTied?: boolean;
  /** Names of all tied players (used in tied mode). */
  tiedNames?: string[];
  /** Tied score (used in tied mode). */
  tiedScore?: number;
}

/**
 * Smoothly counts an integer from 0 → target with an ease-out cubic curve.
 * Pure rAF — no framer-motion sub-component needed for plain text.
 */
function useCountUp(target: number, opts: { duration?: number; delay?: number; play: boolean }) {
  const { duration = 1500, delay = 0, play } = opts;
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!play) { setValue(0); return; }
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, delay, play]);

  return value;
}

/** Letter-by-letter reveal — preserves spacing, adds spring per char. */
function AnimatedName({ name, delay = 0, gradient = false }: { name: string; delay?: number; gradient?: boolean }) {
  const chars = useMemo(() => Array.from(name), [name]);
  return (
    <span className={clsx(
      'inline-flex flex-wrap justify-center',
      gradient && 'bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-transparent',
    )}>
      {chars.map((c, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
          transition={{
            type: 'spring',
            damping: 16,
            stiffness: 220,
            delay: delay + i * 0.04,
          }}
          style={{ display: 'inline-block' }}
        >
          {c === ' ' ? ' ' : c}
        </motion.span>
      ))}
    </span>
  );
}

export default function WinnerCrown({
  winner,
  visible,
  onDismiss,
  isTied = false,
  tiedNames = [],
  tiedScore = 0,
}: WinnerCrownProps) {
  const { t } = useTranslation();

  // Render nothing when there's no winner AND no tie
  if (!winner && !isTied) return null;

  const score = isTied ? tiedScore : (winner?.total_points ?? 0);
  const liveScore = useCountUp(score, { play: visible, delay: 1100, duration: 1600 });

  const accent = isTied ? 'amber' : 'gold';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={onDismiss}
        >
          {/* ── Background — deep, layered ── */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center top, #2b1158 0%, #0d061d 55%, #06030f 100%)',
            }}
          />

          {/* Spotlight cone, growing in */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: isTied
                ? 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(251,191,36,0.28), transparent 70%)'
                : 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(252,211,77,0.32), transparent 70%)',
            }}
          />

          {/* Confetti only when an undisputed winner exists */}
          {!isTied && <ConfettiOverlay trigger={visible} variant="champion" />}

          {/* ── Foreground content ── */}
          <div className="relative w-full max-w-md flex flex-col items-center text-center" onClick={(e) => e.stopPropagation()}>

            {/* Top label */}
            <motion.p
              initial={{ opacity: 0, y: -16, letterSpacing: '0.5em' }}
              animate={{ opacity: 1, y: 0,   letterSpacing: '0.4em' }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={clsx(
                'text-[11px] sm:text-xs font-bold uppercase mb-5',
                accent === 'gold' ? 'text-amber-300/80' : 'text-amber-400/85',
              )}
            >
              {isTied ? t('winnerCrown.tiebreak') : t('winnerCrown.champion')}
            </motion.p>

            {/* ── Avatar(s) ── */}
            {isTied ? (
              <div className="flex items-center -space-x-3 mb-6">
                {tiedNames.slice(0, 4).map((name, i) => (
                  <motion.div
                    key={name + i}
                    initial={{ opacity: 0, scale: 0, y: -40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      damping: 14,
                      stiffness: 160,
                      delay: 0.55 + i * 0.12,
                    }}
                    className={clsx(
                      'w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br flex items-center justify-center text-3xl sm:text-4xl font-black text-white border-4 border-[#06030f] shadow-[0_0_40px_rgba(251,191,36,0.45)]',
                      avatarGradient(i),
                    )}
                  >
                    {avatarInitial(name)}
                  </motion.div>
                ))}
              </div>
            ) : winner && (
              <div className="relative mb-6">
                {/* Outer concentric rings — slowly rotating */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0%, rgba(252,211,77,0.55) 50%, transparent 100%)',
                    filter: 'blur(2px)',
                    margin: '-14px',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 180, delay: 0.55 }}
                  className={clsx(
                    'relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br flex items-center justify-center text-5xl sm:text-6xl font-black text-white shadow-[0_0_60px_rgba(252,211,77,0.55)]',
                    avatarGradient(0),
                  )}
                >
                  {avatarInitial(winner.name)}
                </motion.div>
              </div>
            )}

            {/* ── Name(s) ── */}
            <motion.h1
              className="text-3xl sm:text-5xl font-black leading-[1.05] mb-3 px-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.95 }}
            >
              {isTied ? (
                <span className="text-white/85">
                  <AnimatedName name={tiedNames.join(' & ') || ''} delay={0.95} />
                </span>
              ) : winner && (
                <AnimatedName name={winner.name} delay={0.95} gradient />
              )}
            </motion.h1>

            {/* Subtitle when tied */}
            {isTied && (
              <motion.p
                className="text-sm sm:text-base text-white/65 mb-6 max-w-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
              >
                {t('winnerCrown.tieMatchOn')}
              </motion.p>
            )}

            {/* ── Gold rule ── */}
            <motion.div
              className="relative h-px w-full max-w-[260px] mb-5 origin-center"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: isTied
                  ? 'linear-gradient(90deg, transparent, rgba(251,191,36,0.7), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(252,211,77,0.85), transparent)',
              }}
            />

            {/* ── Score block ── */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.05 }}
            >
              <p className={clsx(
                'text-[10px] sm:text-xs font-bold uppercase tracking-[0.32em] mb-2',
                isTied ? 'text-amber-300/70' : 'text-white/45',
              )}>
                {isTied ? t('winnerCrown.tiedAt') : t('winnerCrown.finalScore')}
              </p>
              <p
                className={clsx(
                  'text-7xl sm:text-8xl font-black tabular-nums leading-none',
                  isTied ? 'text-amber-300' : 'text-white',
                )}
                style={!isTied ? {
                  textShadow: '0 0 40px rgba(252,211,77,0.55), 0 0 80px rgba(252,211,77,0.25)',
                } : undefined}
              >
                {liveScore.toLocaleString()}
              </p>
            </motion.div>

            {/* ── Subscores or tie CTA ── */}
            {isTied ? (
              <motion.p
                className="mt-6 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-amber-300"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.2 }}
              >
                ↓  {t('winnerCrown.tieAction')}
              </motion.p>
            ) : winner && (
              <motion.div
                className="mt-6 flex items-center gap-5 text-[11px] sm:text-xs uppercase tracking-[0.18em] text-white/45"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.2 }}
              >
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-white/35">{t('winnerCrown.quizLabel')}</span>
                  <span className="text-white/85 font-bold tabular-nums text-sm">{winner.quiz_points}</span>
                </span>
                <span className="w-px h-6 bg-white/15" />
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-white/35">{t('winnerCrown.predLabel')}</span>
                  <span className="text-white/85 font-bold tabular-nums text-sm">{winner.pred_points}</span>
                </span>
                <span className="w-px h-6 bg-white/15" />
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-white/35">{t('winnerCrown.duelLabel')}</span>
                  <span className={clsx(
                    'font-bold tabular-nums text-sm',
                    winner.duel_points > 0 ? 'text-emerald-300'
                      : winner.duel_points < 0 ? 'text-red-300'
                      : 'text-white/85',
                  )}>
                    {winner.duel_points > 0 ? '+' : ''}{winner.duel_points}
                  </span>
                </span>
              </motion.div>
            )}
          </div>

          {/* ── Tap-to-close hint ── */}
          <motion.p
            className="absolute bottom-7 inset-x-0 text-center text-white/30 text-xs tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.2 }}
          >
            {t('winnerCrown.tapClose')}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
