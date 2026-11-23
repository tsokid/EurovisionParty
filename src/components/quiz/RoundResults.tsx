import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowRight, Check, Clock, Sparkles, TrendingUp, X } from 'lucide-react';
import { MAX_ROUNDS, QUESTIONS_PER_ROUND, SCORING, TIMER_SECONDS } from '../../lib/constants';
import { quizAnswerChip } from '../../lib/answerPoints';
import { standingsMove, standingsWindow, type Standing } from '../../lib/roundStandings';
import { useGameStore } from '../../stores/gameStore';
import { StageVfx, type StageVfxHandle } from '../stage/vfx';
import { PlayerAvatar, useCountUp, useTimeline } from '../stage';
import { quizChipView } from './chipText';
import { markPlayed, quizEndKey, wasPlayed } from '../../lib/playedOnce';
import type { QuizAnswer, QuizQuestion } from '../../lib/types';

interface RoundResultsProps {
  roundNumber: number;
  answers: QuizAnswer[];
  /** Kept for API compatibility — the layout doesn't render the questions. */
  questions: QuizQuestion[];
  onContinue: () => void;
  isLastRound: boolean;
  /** Room totals when this round started (QuizProgress). Without it the
   *  leaderboard shows the current order with no reorder or toast. */
  standingsBefore?: Standing[] | null;
}

// ── Timeline, copied from docs/design/stage/motion-quiz-end-m.dc.html ──
const T = {
  shown: 100,
  dot0: 500,
  dotStep: 220,
  chipUp: 60,
  chipFly: 380,
  chipLand: 780,
  summary: 3500,
  total: 3800,
  totalMs: 900,
  move: 4900,
  flash: 5550,
  toast: 5900,
} as const;
const R = { shown: 80, dots: 300, summary: 700, fadeMovers: 1000, move: 1220, toast: 1500 } as const;
const POP = [0.34, 1.56, 0.64, 1] as const;
const EASE = [0.2, 0.8, 0.2, 1] as const;

type ChipState = 0 | 1 | 2;

interface SeqState {
  shown: boolean;
  dots: number;
  chips: ChipState[];
  landed: number;
  roundPts: number;
  summary: boolean;
  countTotal: boolean;
  moved: boolean;
  lift: boolean;
  fadeMovers: boolean;
  flash: boolean;
  toast: boolean;
  done: boolean;
}

function initial(n: number): SeqState {
  return {
    shown: false, dots: 0, chips: Array<ChipState>(n).fill(0), landed: 0, roundPts: 0, summary: false,
    countTotal: false, moved: false, lift: false, fadeMovers: false, flash: false, toast: false, done: false,
  };
}

/**
 * Motion map #3, end of a quiz round. The answer dots tally one by one, each
 * "+N · 2,1″" chip flies into the round total, the total counts up, then the
 * mini leaderboard reorders (FLIP) with "↑N" chips and, only if this player
 * passed someone, a toast «Πέρασες: …». No titles, no confetti (the
 * prototype has none). Reduced motion: fades only, final numbers at once.
 * Skip jumps to the end. It starts when the last answer's server result is
 * in (QuizScreen moves to 'results' then), not on a click.
 */
export default function RoundResults({
  roundNumber,
  answers,
  onContinue,
  isLastRound,
  standingsBefore,
}: RoundResultsProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'el';
  const reduce = useReducedMotion() ?? false;
  const { player, players, room } = useGameStore();
  const meId = player?.id ?? '';
  const { at, clear } = useTimeline();

  // ── Server numbers, as they are ──
  const chips = useMemo(() => answers.map((a) => quizAnswerChip(a)), [answers]);
  const roundTotal = chips.reduce((s, c) => s + c.points, 0);
  const correct = chips.filter((c) => c.kind === 'correct').length;
  const byPoints = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of chips) if (c.points > 0) m.set(c.points, (m.get(c.points) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [chips]);
  const formula = byPoints.length
    ? `${byPoints.map(([p, n]) => `${n}×${p}`).join(' + ')} = ${roundTotal}`
    : `0 = ${roundTotal}`;

  // ── Standings (store totals) ──
  const active = players.filter((p) => p.is_active || p.id === meId);
  const after: Standing[] = active.map((p) => ({ id: p.id, total: p.total_points ?? 0 }));
  const move = standingsMove(standingsBefore ?? after, after, meId);
  const meBefore = (standingsBefore ?? after).find((s) => s.id === meId)?.total ?? (player?.total_points ?? 0);
  const meAfter = after.find((s) => s.id === meId)?.total ?? meBefore;
  const windowIds = standingsWindow(move.after, meId);
  const overtakenNames = move.overtaken
    .map((id) => players.find((p) => p.id === id)?.name)
    .filter((n): n is string => !!n);

  // ── Sequence ──
  const [s, setS] = useState<SeqState>(() => initial(answers.length));
  const set = useCallback((patch: Partial<SeqState>) => setS((prev) => ({ ...prev, ...patch })), []);
  const setChip = useCallback((i: number, v: ChipState) => setS((prev) => {
    const next = prev.chips.slice();
    next[i] = v;
    return { ...prev, chips: next };
  }), []);

  const vfx = useRef<StageVfxHandle>(null);
  const meRowRef = useRef<HTMLLIElement | null>(null);

  const finish = useCallback(() => {
    clear();
    vfx.current?.clear();
    setS({
      ...initial(chips.length),
      shown: true, dots: chips.length, chips: chips.map((c) => (c.points > 0 ? 2 : 0)) as ChipState[],
      landed: chips.filter((c) => c.points > 0).length, roundPts: roundTotal, summary: true, countTotal: true,
      moved: true, flash: true, toast: true, done: true,
    });
  }, [clear, chips, roundTotal]);

  // Played once per browser: from the moment it starts, a return to the quiz
  // (tab switch, refresh) shows the end state, never the animation again.
  const playedKey = room?.id && meId ? quizEndKey(room.id, meId, roundNumber) : null;
  const [playedBefore] = useState(() => (playedKey ? wasPlayed(playedKey) : false));

  useEffect(() => {
    clear();
    if (playedBefore) {
      finish();
      return clear;
    }
    if (playedKey) markPlayed(playedKey);
    setS(initial(chips.length));
    if (reduce) {
      at(R.shown, () => set({ shown: true }));
      at(R.dots, () => set({ dots: chips.length, roundPts: roundTotal, landed: chips.filter((c) => c.points > 0).length }));
      at(R.summary, () => set({ summary: true, countTotal: true }));
      at(R.fadeMovers, () => set({ fadeMovers: true }));
      at(R.move, () => set({ moved: true, fadeMovers: false, flash: true }));
      at(R.toast, () => set({ toast: true, done: true }));
      return clear;
    }
    at(T.shown, () => set({ shown: true }));
    let sum = 0;
    let landed = 0;
    chips.forEach((c, i) => {
      const t0 = T.dot0 + i * T.dotStep;
      at(t0, () => set({ dots: i + 1 }));
      if (c.points > 0) {
        sum += c.points;
        landed += 1;
        const cum = sum;
        const ln = landed;
        at(t0 + T.chipUp, () => setChip(i, 1));
        at(t0 + T.chipFly, () => setChip(i, 2));
        at(t0 + T.chipLand, () => set({ roundPts: cum, landed: ln }));
      }
    });
    at(T.summary, () => set({ summary: true }));
    at(T.total, () => set({ countTotal: true }));
    at(T.move, () => { set({ moved: true, lift: true }); if (roundTotal > 0) vfx.current?.fire('roundEnd', { target: meRowRef.current }); });
    at(T.flash, () => set({ lift: false, flash: true }));
    at(T.toast, () => set({ toast: true, done: true }));
    return clear;
  // Replays only when the round's answers change (a new round).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, reduce]);

  const shownTotal = useCountUp(s.countTotal ? meAfter : meBefore, reduce ? 0 : T.totalMs);

  // Chip flight target: the round total.
  const totalRef = useRef<HTMLSpanElement>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const flyOffset = (i: number) => {
    const d = dotRefs.current[i]?.getBoundingClientRect();
    const tt = totalRef.current?.getBoundingClientRect();
    if (!d || !tt) return { x: 0, y: -63 };
    return { x: tt.left + tt.width / 2 - (d.left + d.width / 2), y: tt.top + tt.height / 2 - d.top };
  };

  const fade = (on: boolean, delay = 0) => reduce
    ? { initial: false as const, animate: { opacity: on ? 1 : 0 }, transition: { duration: 0.2 } }
    : { initial: false as const, animate: { opacity: on ? 1 : 0, y: on ? 0 : 8 }, transition: { duration: 0.28, ease: EASE, delay } };

  const order = s.moved ? move.after : move.before;
  const rows = order.filter((id) => windowIds.includes(id));
  const toastOn = s.toast && overtakenNames.length > 0;

  return (
    <div className="qz-end">
      <StageVfx ref={vfx} layers="front" />
      <motion.section
        className="card-hero qz-end-card"
        aria-label={t('roundEnd.aria', { num: roundNumber })}
        initial={false}
        animate={reduce ? { opacity: s.shown ? 1 : 0 } : { opacity: s.shown ? 1 : 0, y: s.shown ? 0 : 16, scale: s.shown ? 1 : 0.97 }}
        transition={{ duration: reduce ? 0.2 : 0.32, ease: EASE }}
      >
        <div className="qz-end-top">
          <span className="t-eyebrow">{t('roundEnd.eyebrow', { num: roundNumber, max: MAX_ROUNDS, count: answers.length || QUESTIONS_PER_ROUND })}</span>
          {!s.done ? (
            <button type="button" className="btn btn-ghost btn-sm qz-skip" onClick={finish}>
              {t('motion.skip')}
            </button>
          ) : (
            <span className="t-meta">{t('roundEnd.roundPoints')}</span>
          )}
        </div>

        <div className="qz-end-total">
          <motion.span
            key={s.landed}
            ref={totalRef}
            className="num"
            animate={!reduce && s.landed > 0 ? { scale: [1, 1.14, 1] } : undefined}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            aria-live="off"
          >
            +{s.roundPts}
          </motion.span>
          <span className="sr-only">{t('roundEnd.srTotal', { points: roundTotal, correct, total: answers.length })}</span>
        </div>

        <ol className="qz-dots" aria-label={t('roundEnd.dotsAria')}>
          {chips.map((c, i) => {
            const on = s.dots > i;
            const label = c.kind === 'correct'
              ? t('roundEnd.dotOk', { n: i + 1, time: quizChipView(c, t, lang).reason, points: c.points })
              : t(c.kind === 'timeout' ? 'roundEnd.dotTime' : 'roundEnd.dotBad', { n: i + 1 });
            const view = quizChipView(c, t, lang);
            const st = s.chips[i];
            const off = st === 2 ? flyOffset(i) : null;
            return (
              <li key={i} className="qz-dot-slot">
                <motion.span
                  ref={(el) => { dotRefs.current[i] = el; }}
                  className={clsx('qz-dot', c.kind === 'correct' ? 'ok' : 'bad')}
                  aria-label={label}
                  role="img"
                  initial={false}
                  animate={reduce ? { opacity: on ? 1 : 0 } : { opacity: on ? 1 : 0, scale: on ? 1 : 0 }}
                  transition={reduce ? { duration: 0.2 } : { duration: 0.18, ease: POP }}
                >
                  {c.kind === 'correct' ? <Check strokeWidth={3.2} aria-hidden="true" /> : c.kind === 'timeout' ? <Clock strokeWidth={2.8} aria-hidden="true" /> : <X strokeWidth={3.2} aria-hidden="true" />}
                </motion.span>
                {!reduce && c.points > 0 && (
                  <motion.span
                    className="qz-fchip"
                    aria-hidden="true"
                    initial={false}
                    animate={
                      st === 0 ? { opacity: 0, x: 0, y: -4, scale: 0.6 }
                        : st === 1 ? { opacity: 1, x: 0, y: -34, scale: 1 }
                          : { opacity: 0, x: off!.x, y: off!.y, scale: 0.7 }
                    }
                    transition={
                      st === 1 ? { duration: 0.2, ease: POP }
                        : st === 2 ? { duration: 0.42, ease: [0.5, 0, 0.3, 1], opacity: { duration: 0.14, delay: 0.3 } }
                          : { duration: 0 }
                    }
                  >
                    <b className="num">+{view.points}</b> · {view.reason}
                  </motion.span>
                )}
              </li>
            );
          })}
        </ol>

        <motion.div className="qz-end-sum" {...fade(s.summary)}>
          <span className="num">{formula}</span>
          <span className="t-meta">
            {t('roundEnd.tiers', {
              t1: SCORING.quiz.tier1.maxSeconds, p1: SCORING.quiz.tier1.points,
              t2: SCORING.quiz.tier2.maxSeconds, p2: SCORING.quiz.tier2.points, p3: SCORING.quiz.tier3.points,
            })}
          </span>
        </motion.div>

        <div className="qz-end-run">
          <span className="t-small">{t('roundEnd.totalPoints')}</span>
          <span className="num qz-end-before">{meBefore}</span>
          <ArrowRight aria-hidden="true" strokeWidth={2.4} />
          <span className={clsx('num qz-end-after', shownTotal > meBefore && 'up')}>{shownTotal}</span>
        </div>
      </motion.section>

      <div className="qz-lb-head">
        <h2 className="t-h3">{t('roundEnd.roomBoard')}</h2>
        <span className="chip chip-live"><span className="dot" />{t('roundEnd.live')}</span>
      </div>
      <ol className="qz-lb" aria-label={t('roundEnd.roomBoard')}>
        {rows.map((id) => {
          const p = players.find((x) => x.id === id);
          if (!p) return null;
          const me = id === meId;
          const rank = s.moved ? move.rankAfter(id) : move.rankBefore(id);
          const d = move.delta(id);
          const mover = d !== 0;
          const total = me ? shownTotal : p.total_points ?? 0;
          return (
            <motion.li
              key={id}
              ref={me ? meRowRef : undefined}
              layout={!reduce}
              className={clsx('qz-lb-row', me && 'me', s.lift && me && 'lift')}
              animate={reduce ? { opacity: s.fadeMovers && mover ? 0 : 1 } : { scale: s.lift && me ? 1.04 : 1 }}
              transition={reduce ? { duration: 0.2 } : { layout: { duration: 0.62, ease: [0.3, 1.15, 0.4, 1] }, scale: { duration: 0.3 } }}
            >
              <span className={clsx('num qz-lb-pos', rank <= 3 && `p${rank}`)}>{rank}</span>
              <PlayerAvatar name={p.name} avatarId={p.avatar_id} size="sm" />
              <span className="qz-lb-name">
                {p.name}
                {me && <span className="t-meta"> · {t('lobby.you')}</span>}
              </span>
              <motion.span
                className={clsx('qz-mv', d > 0 ? 'up' : 'down')}
                initial={false}
                animate={!s.flash || !mover ? { opacity: 0, scale: 0.4 } : reduce ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 0.55, 1, 1], scale: [0.4, 1.35, 0.95, 0.95, 1.05, 1] }}
                transition={reduce || !s.flash ? { duration: 0.2 } : { duration: 0.9, ease: 'easeOut' }}
                aria-label={mover ? t(d > 0 ? 'roundEnd.up' : 'roundEnd.down', { n: Math.abs(d) }) : undefined}
                aria-hidden={mover ? undefined : true}
              >
                {d > 0 ? `↑${d}` : d < 0 ? `↓${-d}` : ''}
              </motion.span>
              <span className="num qz-lb-pts">{total}</span>
            </motion.li>
          );
        })}
      </ol>

      <motion.div
        className="qz-toast"
        role="status"
        initial={false}
        animate={reduce ? { opacity: toastOn ? 1 : 0 } : { opacity: toastOn ? 1 : 0, y: toastOn ? 0 : 40 }}
        transition={reduce ? { duration: 0.2 } : { duration: 0.34, ease: POP }}
        aria-hidden={!toastOn}
      >
        <span className="qz-toast-ico"><TrendingUp aria-hidden="true" strokeWidth={2.6} /></span>
        {toastOn ? t('roundEnd.passed', { names: overtakenNames.join(', ') }) : ''}
      </motion.div>

      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onContinue}>
        <Sparkles aria-hidden="true" strokeWidth={2.2} />
        {isLastRound ? t('roundResults.finalResults') : t('quiz.startRound', { num: roundNumber + 1 })}
      </button>
      <p className="t-meta qz-end-foot">
        {isLastRound
          ? t('quiz.lastRoundFooter', { questions: QUESTIONS_PER_ROUND, timer: TIMER_SECONDS })
          : t('quiz.roundsLeftFooter', { remaining: MAX_ROUNDS - roundNumber, questions: QUESTIONS_PER_ROUND, timer: TIMER_SECONDS })}
      </p>
    </div>
  );
}
