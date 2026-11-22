// Tier-1 "Winners of the night" sequence (motion map #1).
//
// Triggered by the room phase `final` (server state, so every phone in the
// room plays it together), ~12 s, skippable. The stage dims and a spotlight
// sweeps; the titles flip in one by one (Γκουρού → Μάντης → Μονομάχος →
// Κλέφτης), each with the avatar scaling in and a one-line reason; then
// Πρωταθλητής with the full `winner` stage VFX and the total counting up;
// then the podium grows 2-1-3 and the rest of the ranking slides up.
//
// Who holds a title is today's compute_winners result, untouched. A title
// nobody earned (metric 0) is simply not shown. No confetti (owner decision).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Star, SkipForward, Crown } from 'lucide-react';
import { Avatar, useCountUp, useTimeline } from '../stage';
import { StageVfx, type StageVfxHandle } from '../stage/vfx';
import { buzz } from '../../lib/haptics';
import { rankOrder } from '../../lib/rankMoves';
import { groupByCategory, hasTie, type WinnerCategory, type WinnerRow } from '../../lib/winners';
import { TITLE_REVEAL_ORDER } from '../../lib/titles';
import type { Player } from '../../lib/types';

export const FINALE_T = { kicker: 300, spot: 200, first: 1400, step: 1700, champIn: 300, champName: 550, champCount: 800, countMs: 1600, podium: 3100, rest: 3800, done: 4400 } as const;

export function finaleSeenKey(roomId: string) { return `eurovision-games-finale-seen-${roomId}`; }

export interface FinalSequenceProps {
  players: readonly Player[];
  winners: readonly WinnerRow[];
  meId?: string | null;
  /** Champion tie-vote state: unresolved ties hide the crown. */
  championVote?: 'active' | 'accept' | 'sudden_death' | null;
  tv?: boolean;
  onClose: () => void;
}

type Scene = 'titles' | 'champion' | 'podium';

export function TitleIcon({ cat }: { cat: WinnerCategory }) {
  return cat === 'champion' ? <Crown aria-hidden="true" strokeWidth={2} /> : <Star aria-hidden="true" strokeWidth={2} />;
}

export default function FinalSequence({ players, winners, meId, championVote = null, tv = false, onClose }: FinalSequenceProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const { at, clear } = useTimeline();
  const vfx = useRef<StageVfxHandle>(null);
  const champAvRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const groups = groupByCategory([...winners]);
  const reveal = TITLE_REVEAL_ORDER.filter((c) => c !== 'champion' && groups[c].length > 0);
  const champs = groups.champion.map((r) => byId.get(r.player_id)).filter((p): p is Player => !!p);
  const champTied = hasTie(groups.champion);
  const champHidden = champTied && championVote !== 'accept';
  const champTotal = champs[0]?.total_points ?? Number(groups.champion[0]?.metric_value ?? 0);
  const ranked = useMemo(() => rankOrder(players), [players]);

  const [scene, setScene] = useState<Scene>('titles');
  const [shown, setShown] = useState(0);
  const [kicker, setKicker] = useState(false);
  const [champStep, setChampStep] = useState(0); // 1 avatar, 2 name, 3 count
  const [podium, setPodium] = useState(0); // 1 podium, 2 rest
  const [done, setDone] = useState(false);

  const k = reduce ? 0.6 : 1;
  const tChamp = FINALE_T.first + reveal.length * FINALE_T.step;

  const finish = useCallback(() => {
    clear();
    vfx.current?.clear();
    setKicker(true); setShown(reveal.length); setChampStep(3); setScene('podium'); setPodium(2); setDone(true);
  }, [clear, reveal.length]);

  useEffect(() => {
    const T = (ms: number) => Math.round(ms * k);
    at(T(FINALE_T.kicker), () => setKicker(true));
    at(T(FINALE_T.spot), () => vfx.current?.fire('finaleSpot', { target: stageRef.current }));
    reveal.forEach((_, i) => {
      const t0 = T(FINALE_T.first + i * FINALE_T.step);
      at(t0, () => setShown(i + 1));
      at(t0 + 250, () => vfx.current?.fire('titleHit'));
    });
    at(T(tChamp), () => setScene('champion'));
    at(T(tChamp + FINALE_T.champIn), () => setChampStep(1));
    at(T(tChamp + FINALE_T.champName), () => setChampStep(2));
    at(T(tChamp + FINALE_T.champCount), () => {
      setChampStep(3);
      if (!champHidden) {
        vfx.current?.fire('winner', { target: champAvRef.current });
        if (!reduce) buzz([60, 80, 60]);
      }
    });
    at(T(tChamp + FINALE_T.podium), () => { vfx.current?.clear(); setScene('podium'); setPodium(1); });
    at(T(tChamp + FINALE_T.rest), () => setPodium(2));
    at(T(tChamp + FINALE_T.done), () => setDone(true));
    return clear;
  // Plays once per mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (done) closeRef.current?.focus(); }, [done]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (done) onClose(); else finish(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [done, finish, onClose]);

  const total = useCountUp(champStep >= 3 ? champTotal : 0, reduce ? 0 : FINALE_T.countMs);

  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.25 } };
  const flip = reduce ? fade : {
    initial: { opacity: 0, rotateX: -90 },
    animate: { opacity: 1, rotateX: 0 },
    transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const },
  };
  const scaleIn = (on: boolean, delay = 0) => reduce
    ? { initial: false as const, animate: { opacity: on ? 1 : 0 }, transition: { duration: 0.2 } }
    : { initial: false as const, animate: { opacity: on ? 1 : 0, scale: on ? 1 : 0.3 }, transition: { type: 'spring' as const, stiffness: 260, damping: 18, delay } };

  const namesOf = (cat: WinnerCategory) => groups[cat].map((r) => byId.get(r.player_id)?.name ?? '—');
  const podiumOrder = [ranked[1], ranked[0], ranked[2]].filter(Boolean) as Player[];
  const rest = ranked.slice(3);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <motion.div
      className={clsx('fs-layer', tv && 'fs-tv')}
      role="dialog"
      aria-modal="true"
      aria-label={t('finale.aria')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="fs-dim" aria-hidden="true" />
      <StageVfx ref={vfx} layers="both" />
      <div className="fs-top">
        <motion.span className="t-eyebrow fs-kicker" initial={false} animate={{ opacity: kicker ? 1 : 0, y: kicker || reduce ? 0 : 8 }}>{t('finale.kicker')}</motion.span>
        {!done ? (
          <button type="button" className="btn btn-ghost btn-sm fs-skip" onClick={finish}>
            {t('motion.skip')}<SkipForward aria-hidden="true" strokeWidth={2} />
          </button>
        ) : (
          <button ref={closeRef} type="button" className="btn btn-primary btn-sm" onClick={onClose}>{t('finale.continue')}</button>
        )}
      </div>

      <div className="fs-stage" ref={stageRef} aria-live="polite">
        <AnimatePresence mode="wait">
          {scene === 'titles' && (
            <motion.ol key="titles" className="fs-titles" {...fade}>
              {reveal.slice(0, shown).map((cat, i) => {
                const names = namesOf(cat);
                const first = byId.get(groups[cat][0].player_id);
                const latest = i === shown - 1;
                return (
                  <motion.li key={cat} className={clsx('fs-title', latest && 'now', `c-${cat}`)} {...flip}>
                    <span className="fs-ti"><TitleIcon cat={cat} /></span>
                    <span className="fs-tt">
                      <span className="fs-tname">{t(`winners.cat.${cat}.name`)}</span>
                      <motion.span className="fs-twhy" {...scaleIn(true, reduce ? 0 : 0.35)} style={{ transformOrigin: 'left center' }}>
                        {t(`titles.reason.${cat}`)} · {t(`titles.metric.${cat}`, { count: Number(groups[cat][0].metric_value) })}
                      </motion.span>
                    </span>
                    <span className="fs-twho">
                      <span className="fs-tnames">{names.join(' & ')}</span>
                      <motion.span {...scaleIn(true, reduce ? 0 : 0.2)}>
                        <Avatar name={first?.name ?? '?'} avatarId={first?.avatar_id} size="lg" />
                      </motion.span>
                    </span>
                  </motion.li>
                );
              })}
            </motion.ol>
          )}

          {scene === 'champion' && (
            <motion.section key="champ" className="fs-champ" {...fade}>
              <motion.span className="fs-champ-k" {...flip}>{champHidden ? t('finale.tieTop') : t('winners.cat.champion.name')}</motion.span>
              <motion.div ref={champAvRef} className="fs-champ-av" {...scaleIn(champStep >= 1)}>
                {champHidden
                  ? <span className="fs-champ-q" aria-hidden="true">?</span>
                  : champs.slice(0, 3).map((p) => <Avatar key={p.id} name={p.name} avatarId={p.avatar_id} size="xl" />)}
              </motion.div>
              <motion.h2 className="fs-champ-name" initial={false} animate={{ opacity: champStep >= 2 ? 1 : 0, y: champStep >= 2 || reduce ? 0 : 14 }}>
                {champs.map((p) => p.name).join(' & ') || '—'}
              </motion.h2>
              <motion.div className="fs-champ-pts" initial={false} animate={{ opacity: champStep >= 3 ? 1 : 0 }}>
                <span className="num">{total}</span> <span className="t-meta">{t('board.points')}</span>
              </motion.div>
              {champStep >= 2 && (
                <p className="t-meta fs-champ-why">
                  {champHidden ? t('finale.tieVote') : champTied ? t('finale.coChampions') : t('titles.reason.champion')}
                </p>
              )}
            </motion.section>
          )}

          {scene === 'podium' && (
            <motion.section key="podium" className="fs-podium-wrap" {...fade}>
              <div className="fs-podium" aria-label={t('finale.podium')}>
                {podiumOrder.map((p) => {
                  const place = ranked.indexOf(p) + 1;
                  const delay = place === 2 ? 0 : place === 1 ? 0.18 : 0.36;
                  return (
                    <div key={p.id} className={clsx('fs-pod', `p${place}`, p.id === meId && 'me')}>
                      <motion.div className="fs-pod-who" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: podium >= 1 ? 1 : 0, y: 0 }} transition={{ delay: reduce ? 0 : delay + 0.35, duration: 0.3 }}>
                        <Avatar name={p.name} avatarId={p.avatar_id} size={place === 1 ? 'xl' : 'lg'} />
                        <span className="fs-pod-name">{p.name}</span>
                      </motion.div>
                      <motion.div
                        className="fs-pod-block"
                        initial={reduce ? false : { scaleY: 0 }}
                        animate={{ scaleY: podium >= 1 ? 1 : 0, opacity: podium >= 1 ? 1 : 0 }}
                        transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 170, damping: 20, delay }}
                      >
                        <span className="num fs-pod-pts">{p.total_points}</span>
                        <span className="fs-pod-place">{t('finale.place', { n: place })}</span>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
              {rest.length > 0 && (
                <ol className="fs-rest" start={4}>
                  {rest.map((p, i) => (
                    <motion.li
                      key={p.id}
                      className={clsx('fs-rest-row', p.id === meId && 'me')}
                      initial={reduce ? false : { opacity: 0, y: 40 }}
                      animate={{ opacity: podium >= 2 ? 1 : 0, y: podium >= 2 || reduce ? 0 : 40 }}
                      transition={{ duration: reduce ? 0.2 : 0.4, ease: [0.2, 0.8, 0.2, 1], delay: reduce ? 0 : i * 0.06 }}
                    >
                      <span className="num fs-rest-n">{i + 4}</span>
                      <Avatar name={p.name} avatarId={p.avatar_id} size="sm" />
                      <span className="fs-rest-name">{p.name}</span>
                      <span className="num fs-rest-pts">{p.total_points}</span>
                    </motion.li>
                  ))}
                </ol>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </motion.div>,
    document.fullscreenElement ?? document.body,
  );
}
