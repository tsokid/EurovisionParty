import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Check, Clock, Coins, X } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import { QUESTIONS_BY_ID } from '../../lib/questions';
import {
  duelAnswerChip, duelOutcome, duelRewardPreview, formatSeconds, needsRewardChoice, type DuelChip,
} from '../../lib/answerPoints';
import { buzz } from '../../lib/haptics';
import { PlayerAvatar, useCountUp, useTimeline } from '../stage';
import { StageVfx, type StageVfxHandle } from '../stage/vfx';
import { duelChipView } from '../quiz/chipText';
import type { Duel, DuelAnswer, DuelDecision, Player } from '../../lib/types';

// ── Timeline, copied from docs/design/stage/motion-duel-m.dc.html ──
const T = { intro: 80, vs: 440, qhead: 1000, row0: 1200, rowStep: 650, side: 180, chipUp: 80, chipFly: 420, chipLand: 820, win: 3700, cards: 4200, ready: 4800 } as const;
/** Reduced motion runs the same beats 0.4× as fast, fades only. */
const REDUCED_K = 0.4;
const POP = [0.34, 1.56, 0.64, 1] as const;
const EASE = [0.2, 0.8, 0.2, 1] as const;
const COINS = 6;

type ChipState = 0 | 1 | 2;

interface Seq {
  intro: boolean; vs: boolean; qhead: boolean; cells: number; chips: ChipState[];
  scoreL: number; scoreR: number; win: boolean; cards: boolean; ready: boolean;
}
const START: Seq = { intro: false, vs: false, qhead: false, cells: 0, chips: [0, 0, 0, 0, 0, 0], scoreL: 0, scoreR: 0, win: false, cards: false, ready: false };

interface Side {
  player: Player | undefined;
  id: string;
  answers: DuelAnswer[];
  score: number;
}

function sides(duel: Duel, meId: string | undefined): [Side, Side] {
  const ch: Side = { player: undefined, id: duel.challenger_id, answers: duel.challenger_answers ?? [], score: duel.challenger_score ?? 0 };
  const cd: Side = { player: undefined, id: duel.challenged_id, answers: duel.challenged_answers ?? [], score: duel.challenged_score ?? 0 };
  return meId === duel.challenged_id ? [cd, ch] : [ch, cd];
}

function chipFor(a: DuelAnswer | undefined): DuelChip | null {
  if (!a) return null;
  return duelAnswerChip(a, QUESTIONS_BY_ID.get(a.questionId)?.correct_index === a.answerIndex);
}

/** Coins from one pill to another (steal) or from the top into the winner (double). */
function flyCoins(from: DOMRect, to: DOMRect) {
  if (typeof document === 'undefined') return;
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  const dx = to.left + to.width / 2 - fx;
  const dy = to.top + to.height / 2 - fy;
  for (let i = 0; i < COINS; i++) {
    const c = document.createElement('span');
    c.className = 'du-coin';
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, { left: `${fx}px`, top: `${fy}px` });
    document.body.appendChild(c);
    if (typeof c.animate !== 'function') { c.remove(); continue; }
    const a = c.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(.5)' },
        { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.1}px), calc(-50% + ${dy * 0.1 - 40}px)) scale(1.1)`, offset: 0.15 },
        { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 70}px)) scale(1)`, offset: 0.55 },
        { opacity: 1, offset: 0.9 },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.6)` },
      ],
      { duration: 700, delay: 100 + i * 70, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' },
    );
    a.onfinish = () => c.remove();
  }
}

export interface DuelResultMomentProps {
  /** The live duel row (realtime): a decision arriving here plays the transfer. */
  duel: Duel;
  onClose: () => void;
  /** Winner only: apply «Κλέψε» or «Διπλασίασε» (useDuels.makeDecision). */
  onDecision?: (duelId: string, decision: DuelDecision) => void | Promise<void>;
}

/**
 * Motion map #4, the duel result. VS intro (avatars slide in from both sides
 * and clash), the 3 answers reveal side by side with their "+N · 12−s"
 * chips, the winner glows, then the Κλέψε / Διπλασίασε cards flip in. When
 * the decision lands in the duel row (server state), the points fly from
 * the loser's total to the winner's (steal) or into the winner's (double),
 * and the totals count to the store's values. A tie shows no chooser. Skip
 * jumps to the end; reduced motion fades only, no count-ups or flights.
 */
export default function DuelResultMoment({ duel, onClose, onDecision }: DuelResultMomentProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'el';
  const reduce = useReducedMotion() ?? false;
  const { player, players } = useGameStore();
  const meId = player?.id;
  const { at, clear } = useTimeline();

  const [L, Rt] = sides(duel, meId);
  L.player = players.find((p) => p.id === L.id);
  Rt.player = players.find((p) => p.id === Rt.id);
  const outcome = duelOutcome(duel, meId);
  const winnerIsL = duel.winner_id === L.id;
  const winnerIsR = duel.winner_id === Rt.id;
  const loser = winnerIsL ? Rt : winnerIsR ? L : null;
  const winner = winnerIsL ? L : winnerIsR ? Rt : null;
  const preview = duelRewardPreview(winner?.score ?? 0, loser?.player?.total_points ?? 0);
  const chooser = needsRewardChoice(duel, meId) && !!onDecision;
  const rows = useMemo(() => [0, 1, 2].map((i) => [chipFor(L.answers[i]), chipFor(Rt.answers[i])] as const), [L.answers, Rt.answers]);

  const [s, setS] = useState<Seq>(START);
  const set = useCallback((p: Partial<Seq>) => setS((prev) => ({ ...prev, ...p })), []);
  const setChip = useCallback((i: number, v: ChipState) => setS((prev) => {
    const chips = prev.chips.slice();
    chips[i] = v;
    return { ...prev, chips };
  }), []);

  const end = useCallback(() => {
    clear();
    setS({ intro: true, vs: true, qhead: true, cells: 6, chips: [2, 2, 2, 2, 2, 2], scoreL: L.score, scoreR: Rt.score, win: true, cards: true, ready: true });
  }, [clear, L.score, Rt.score]);

  const vfx = useRef<StageVfxHandle>(null);
  const winAvRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    clear();
    setS(START);
    const k = reduce ? REDUCED_K : 1;
    const go = (ms: number, p: Partial<Seq>) => at(Math.round(ms * k), () => set(p));
    go(T.intro, { intro: true });
    go(T.vs, { vs: true });
    go(T.qhead, { qhead: true });
    let sl = 0;
    let sr = 0;
    rows.forEach(([l, r], i) => {
      const t0 = T.row0 + i * T.rowStep;
      sl += l?.points ?? 0;
      sr += r?.points ?? 0;
      const a = sl;
      const b = sr;
      go(t0, { cells: i * 2 + 1 });
      go(t0 + T.side, { cells: i * 2 + 2 });
      if (reduce) { go(t0 + 200, { scoreL: a, scoreR: b }); return; }
      [0, 1].forEach((side) => {
        const ci = i * 2 + side;
        const d = side ? T.side : 0;
        at(t0 + d + T.chipUp, () => setChip(ci, 1));
        at(t0 + d + T.chipFly, () => setChip(ci, 2));
        at(t0 + d + T.chipLand, () => set(side ? { scoreR: b } : { scoreL: a }));
      });
    });
    go(T.win, { win: true });
    if (!reduce && outcome === 'win') at(T.win, () => buzz());
    if (winner) at(Math.round(T.win * k), () => vfx.current?.fire('duelWin', { target: winAvRef.current }));
    go(T.cards, { cards: true });
    go(T.ready, { ready: true, scoreL: L.score, scoreR: Rt.score });
    return clear;
  // The sequence plays once per duel opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.id, reduce]);

  // ── Decision: played when the duel row says so (server state) ──
  const pillL = useRef<HTMLDivElement>(null);
  const pillR = useRef<HTMLDivElement>(null);
  const vsRef = useRef<HTMLDivElement>(null);
  const prevDecision = useRef(duel.winner_decision);
  const [flash, setFlash] = useState<{ l: boolean; r: boolean }>({ l: false, r: false });
  const [choosing, setChoosing] = useState<DuelDecision | null>(null);
  useEffect(() => {
    const before = prevDecision.current;
    prevDecision.current = duel.winner_decision;
    if (before || !duel.winner_decision || !winner) return;
    const winPill = winnerIsL ? pillL.current : pillR.current;
    const losePill = winnerIsL ? pillR.current : pillL.current;
    const steal = duel.winner_decision === 'steal';
    setFlash({ l: steal || winnerIsL, r: steal || !winnerIsL });
    if (!reduce && winPill) {
      const from = steal ? losePill?.getBoundingClientRect() : vsRef.current?.getBoundingClientRect();
      if (from) flyCoins(from, winPill.getBoundingClientRect());
    }
    const id = setTimeout(() => setFlash({ l: false, r: false }), 900);
    return () => clearTimeout(id);
  }, [duel.winner_decision, winner, winnerIsL, reduce]);

  const choose = async (d: DuelDecision) => {
    if (!onDecision || choosing || !s.ready) return;
    setChoosing(d);
    try { await onDecision(duel.id, d); } finally { setChoosing(null); }
  };

  // Totals: always the store's numbers; they count when realtime updates them.
  const totalL = useCountUp(L.player?.total_points ?? 0, reduce ? 0 : 700);
  const totalR = useCountUp(Rt.player?.total_points ?? 0, reduce ? 0 : 700);

  // Esc closes; focus starts on the first control.
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nameL = L.player?.name ?? '—';
  const nameR = Rt.player?.name ?? '—';
  const loserName = loser?.player?.name ?? '—';
  const winnerName = winner?.player?.name ?? '—';
  const transferred = duel.points_transferred ?? 0;
  const decided = !!duel.winner_decision;
  const done = s.ready;

  let toast = '';
  if (decided && transferred > 0) {
    if (outcome === 'win') {
      toast = duel.winner_decision === 'steal'
        ? t('duelMoment.toastStole', { points: transferred, name: loserName })
        : t('duelMoment.toastDoubled', { points: transferred, name: loserName });
    } else if (outcome === 'lose') {
      toast = duel.winner_decision === 'steal'
        ? t('duelMoment.toastStolenFrom', { points: transferred, name: winnerName })
        : t('duelMoment.toastDoubledBy', { name: winnerName });
    } else {
      toast = t(duel.winner_decision === 'steal' ? 'duelMoment.toastOtherSteal' : 'duelMoment.toastOtherDouble', { points: transferred, name: winnerName });
    }
  }

  const mv = (on: boolean, off: Record<string, number>, delay = 0) => reduce
    ? { initial: false as const, animate: { opacity: on ? 1 : 0 }, transition: { duration: 0.2 } }
    : { initial: false as const, animate: on ? { opacity: 1, x: 0, y: 0, rotateX: 0 } : { opacity: 0, ...off }, transition: { duration: 0.3, ease: EASE, delay } };
  const clash = (dir: 1 | -1) => (reduce
    ? { initial: false as const, animate: { opacity: s.intro ? 1 : 0 }, transition: { duration: 0.2 } }
    : {
        initial: false as const,
        animate: s.intro ? { opacity: [0, 1, 1, 1, 1], x: [dir * -200, dir * -120, dir * 30, dir * -10, 0] } : { opacity: 0, x: dir * -200 },
        transition: { duration: 0.65, ease: [0.3, 0.9, 0.4, 1] as const, times: [0, 0.2, 0.55, 0.72, 1] },
      });

  const scoreRefs = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flyTo = (ci: number) => {
    const from = cellRefs.current[ci]?.getBoundingClientRect();
    const to = scoreRefs.current[ci % 2]?.getBoundingClientRect();
    if (!from || !to) return { x: 0, y: -150 };
    return { x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - from.top };
  };

  const cell = (c: DuelChip | null, side: 'l' | 'r', on: boolean, ci: number) => {
    const st = s.chips[ci];
    const off = st === 2 ? flyTo(ci) : null;
    const v = c ? duelChipView(c, t) : null;
    const time = !c ? '—' : c.kind === 'correct' ? formatSeconds(c.seconds, lang, 'floor') : c.kind === 'timeout' ? t('questionCard.reasonTimeout') : t('questionCard.reasonWrong');
    const ok = c?.kind === 'correct';
    return (
      <motion.div
        ref={(el) => { cellRefs.current[ci] = el; }}
        className={clsx('du-cell', side, ok && 'ok')}
        style={{ transformOrigin: '50% 0', transformPerspective: 600 }}
        initial={false}
        animate={reduce ? { opacity: on ? 1 : 0 } : on ? { opacity: 1, rotateX: 0 } : { opacity: 0, rotateX: -90 }}
        transition={reduce ? { duration: 0.2 } : { duration: 0.32, ease: POP }}
      >
        <span className={clsx('du-mark', ok ? 'ok' : 'bad')} aria-hidden="true">
          {ok ? <Check strokeWidth={3.2} /> : c?.kind === 'timeout' ? <Clock strokeWidth={2.8} /> : <X strokeWidth={3.2} />}
        </span>
        <span className="num du-cell-pts">{c ? (c.points > 0 ? `+${c.points}` : '0') : '—'}</span>
        <span className="t-meta du-cell-t">{time}</span>
        <span className="sr-only">{v ? `${v.points} · ${v.reason}` : ''}</span>
        {!reduce && v && (
          <motion.span
            className={clsx('du-fchip', v.points > 0 ? 'gain' : 'zero')}
            aria-hidden="true"
            initial={false}
            animate={st === 0 ? { opacity: 0, x: 0, y: 0, scale: 0.6 } : st === 1 ? { opacity: 1, x: 0, y: -30, scale: 1 } : { opacity: 0, x: off!.x, y: off!.y, scale: 0.7 }}
            transition={st === 1 ? { duration: 0.2, ease: POP } : st === 2 ? { duration: 0.4, ease: [0.5, 0, 0.3, 1], opacity: { duration: 0.14, delay: 0.28 } } : { duration: 0 }}
          >
            <b className="num">{v.points > 0 ? `+${v.points}` : '0'}</b> · {v.reason}
          </motion.span>
        )}
      </motion.div>
    );
  };

  const winGlow = (isWinner: boolean) => (s.win && isWinner
    ? (reduce ? { opacity: 0.8 } : { opacity: [0, 1, 0.85], scale: [0.6, 1.25, 1.1] })
    : { opacity: 0 });

  const card = (kind: DuelDecision) => {
    const steal = kind === 'steal';
    const picked = duel.winner_decision === kind || choosing === kind;
    const other = (!!duel.winner_decision && duel.winner_decision !== kind) || (!!choosing && choosing !== kind);
    const disabled = !chooser || !s.ready || !!choosing || (steal && !preview.canSteal);
    const flipFrom = steal ? -100 : 100;
    return (
      <motion.button
        type="button"
        className={clsx('du-choice', steal ? 'steal' : 'double', picked && 'picked')}
        onClick={() => void choose(kind)}
        disabled={disabled}
        aria-pressed={picked || undefined}
        style={{ transformPerspective: 900 }}
        initial={false}
        animate={reduce
          ? { opacity: s.cards ? (other ? 0.4 : 1) : 0 }
          : s.cards ? { opacity: other ? 0.4 : 1, rotateY: 0, scale: picked ? 1.04 : other ? 0.96 : 1 } : { opacity: 0, rotateY: flipFrom, scale: 1 }}
        transition={reduce ? { duration: 0.2 } : picked || other ? { duration: 0.25 } : { duration: 0.65, ease: [0.3, 1.25, 0.5, 1], delay: steal ? 0 : 0.15 }}
      >
        <span className="t-eyebrow">{steal ? t('duelMoment.steal') : t('duelMoment.double')}</span>
        <span className="num du-choice-n">{steal ? preview.steal : preview.double}</span>
        <span className="t-meta du-choice-m">
          {steal && !preview.canSteal
            ? t('duelMoment.stealNone')
            : outcome === 'win'
              ? (steal
                ? <>{t('duelMoment.youPlus', { points: preview.steal })}<br />{t('duelMoment.nameMinus', { name: loserName, points: preview.steal })}</>
                : <>{t('duelMoment.youPlusDouble', { points: preview.double, score: winner?.score ?? 0 })}<br />{t('duelMoment.nameZero', { name: loserName })}</>)
              : (steal
                ? <>{t('duelMoment.namePlus', { name: winnerName, points: preview.steal })}<br />{outcome === 'lose' ? t('duelMoment.youMinus', { points: preview.steal }) : t('duelMoment.nameMinus', { name: loserName, points: preview.steal })}</>
                : <>{t('duelMoment.namePlusDouble', { name: winnerName, points: preview.double, score: winner?.score ?? 0 })}<br />{outcome === 'lose' ? t('duelMoment.youZero') : t('duelMoment.nameZero', { name: loserName })}</>)}
        </span>
      </motion.button>
    );
  };

  let heading = t('duelMoment.tie');
  if (outcome === 'win') heading = decided ? t('duelMoment.decided') : t('duelMoment.choose');
  else if (outcome === 'lose') heading = t('duelMoment.winnerIs', { name: winnerName });
  else if (outcome === 'open' && winner) heading = t('duelMoment.winnerIs', { name: winnerName });
  let sub = '';
  if (outcome === 'tie') sub = t('duelMoment.tieSub');
  else if (!decided && outcome !== 'win') sub = t('duelMoment.waitChoice', { name: winnerName });
  else if (outcome === 'win' && !decided) sub = t('duelMoment.stealCap');

  const showCards = outcome === 'win' || (decided && outcome !== 'tie');

  if (typeof document === 'undefined') return null;
  return createPortal(
    <motion.div className="du-moment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div
        ref={boxRef}
        className="du-m-box"
        role="dialog"
        aria-modal="true"
        aria-label={t('duelMoment.aria', { a: nameL, b: nameR })}
      >
        <StageVfx ref={vfx} layers="front" />
        <div className="du-m-top">
          <span className="t-eyebrow">{duel.is_rematch ? t('duelMoment.rematch') : t('duelMoment.eyebrow')}</span>
          {!done
            ? <button type="button" className="btn btn-ghost btn-sm" onClick={end}>{t('motion.skip')}</button>
            : <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>{t('duelMoment.close')}</button>}
        </div>

        <section className="du-vs">
          {[L, Rt].map((side, idx) => {
            const isL = idx === 0;
            const isWinner = isL ? winnerIsL : winnerIsR;
            const dim = s.win && !!winner && !isWinner;
            return (
              <motion.div key={side.id} className={clsx('du-col', isL ? 'l' : 'r')} {...clash(isL ? 1 : -1)}>
                <div className="du-av-wrap">
                  <motion.span className="du-glow" aria-hidden="true" initial={false} animate={winGlow(isWinner)} transition={{ duration: 0.7, ease: 'easeOut' }} />
                  <motion.span ref={isWinner ? winAvRef : undefined} animate={{ opacity: dim && !reduce ? 0.5 : 1 }} transition={{ duration: 0.3 }} className={clsx('du-av', isWinner && s.win && 'win')}>
                    <PlayerAvatar name={side.player?.name ?? '—'} avatarId={side.player?.avatar_id} size="xl" />
                  </motion.span>
                </div>
                <span className="du-name" title={side.player?.name}>
                  {side.player?.name ?? '—'}
                  {side.id === meId && <span className="t-meta"> · {t('lobby.you')}</span>}
                </span>
                <span ref={(el) => { scoreRefs.current[idx] = el; }} className={clsx('num du-score', isWinner && s.win && 'win')}>{isL ? s.scoreL : s.scoreR}</span>
                <div ref={isL ? pillL : pillR} className="du-pill">
                  <motion.span className={clsx('du-flash', isWinner ? 'gain' : 'loss')} initial={false} animate={{ opacity: (isL ? flash.l : flash.r) && !reduce ? [0, 1, 0] : 0 }} transition={{ duration: 0.9 }} aria-hidden="true" />
                  <span>{t('duelMoment.total')}</span>
                  <span className="num">{isL ? totalL : totalR}</span>
                </div>
              </motion.div>
            );
          })}
          <div className="du-badge" ref={vsRef} aria-hidden="true">
            {!reduce && <motion.span className="du-ring" initial={false} animate={s.vs ? { opacity: [1, 0], scale: [0.6, 2.6] } : { opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} />}
            <motion.span
              className="num du-vs-t"
              initial={false}
              animate={reduce ? { opacity: s.vs ? 1 : 0 } : s.vs ? { opacity: [0, 1, 1], scale: [2.4, 0.9, 1], rotate: [-12, 3, 0] } : { opacity: 0 }}
              transition={{ duration: reduce ? 0.2 : 0.42, ease: [0.3, 1.3, 0.5, 1] }}
            >
              VS
            </motion.span>
          </div>
        </section>

        <motion.div className="du-qhead" {...mv(s.qhead, { y: 6 })}>
          <span className="t-eyebrow">{t('duelMoment.sameQuestions')}</span>
          <span className="t-meta">{t('duelMoment.rule')}</span>
        </motion.div>

        <ol className="du-rows">
          {rows.map(([l, r], i) => (
            <li key={i} className="du-row">
              {cell(l, 'l', s.cells >= i * 2 + 1, i * 2)}
              <span className="t-meta du-row-n">{t('duelMoment.q', { n: i + 1 })}</span>
              {cell(r, 'r', s.cells >= i * 2 + 2, i * 2 + 1)}
            </li>
          ))}
        </ol>

        <motion.div className="du-result" {...mv(s.win, { y: 8 }, reduce ? 0 : 0.2)}>
          <h2 className="t-h3">{heading}</h2>
          {sub && <p className="t-meta">{sub}</p>}
        </motion.div>

        {showCards && (
          <div className="du-choices">
            {card('steal')}
            {card('double')}
          </div>
        )}

        <motion.div
          className="du-toast"
          role="status"
          initial={false}
          animate={reduce ? { opacity: toast ? 1 : 0 } : { opacity: toast ? 1 : 0, y: toast ? 0 : 40 }}
          transition={reduce ? { duration: 0.2 } : { duration: 0.34, ease: POP, delay: toast ? 0.9 : 0 }}
          aria-hidden={!toast}
        >
          <span className="du-toast-ico"><Coins aria-hidden="true" strokeWidth={2.4} /></span>
          {toast}
        </motion.div>
      </div>
    </motion.div>,
    document.body,
  );
}
