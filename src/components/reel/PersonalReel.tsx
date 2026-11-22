// «Η βραδιά σου» — the personal reel (approved, "Michael Bay style"),
// following the beats of motion-reel-{m,d}.dc.html exactly:
//   0 hero intro (avatar + stage name) · 1 Trivia · 2 Μονομαχίες · 3 Προβλέψεις
//   (each slams in with an impact frame) · 4 total in slow-mo · 5 final rank
//   with the `reelPeak` VFX · 6 titles won · 7 summary · 8 «Ποιος ήταν ποιος;»
//
// Every number is a stored field (reelNumbers): quiz_points, duel_points,
// pred_points, points_spent, total_points. The unmask uses useRevealedNames,
// which returns nothing before the room phase is `final` (RLS enforces it).
// Sound cues only where the prototype marks «♪», opt-in (audioStore.cues).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { SkipForward, X, Volume2, VolumeX, RotateCcw, Star } from 'lucide-react';
import { Avatar, useTimeline } from '../stage';
import { AvatarVisual } from '../stage/avatars/AvatarVisual';
import { resolveAvatar } from '../stage/avatars/library';
import { StageVfx, type StageVfxHandle } from '../stage/vfx';
import type { VfxPreset } from '../stage/vfx';
import { useRevealedNames } from '../../hooks/useRevealedNames';
import { isTopDialog, useDialogFocus } from '../../hooks/useDialogFocus';
import { useAudioStore } from '../../stores/audioStore';
import { playCue, type Cue } from '../../lib/stageSound';
import { rankOrder } from '../../lib/rankMoves';
import { titlesOf } from '../../lib/titles';
import type { WinnerRow } from '../../lib/winners';
import type { Player } from '../../lib/types';

/** The reel's numbers, straight from the player row. Nothing is recomputed. */
export function reelNumbers(p: Pick<Player, 'quiz_points' | 'duel_points' | 'pred_points' | 'points_spent' | 'total_points'>) {
  return { trivia: p.quiz_points, duels: p.duel_points, predictions: p.pred_points, spent: p.points_spent ?? 0, total: p.total_points };
}

export function signedNum(v: number): string {
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0';
}

/** «Ποιος ήταν ποιος;» rows. Renders nothing unless the names were revealed (phase `final`). */
export function Unmask({ players, names, revealed, play, reduce }: {
  players: readonly Player[]; names: Record<string, string>; revealed: boolean; play: boolean; reduce: boolean;
}) {
  const { t } = useTranslation();
  if (!revealed) return null;
  return (
    <ol className="rl-unmask" aria-label={t('reel.unmaskTitle')}>
      {players.map((p, i) => {
        const real = names[p.id];
        return (
          <li key={p.id} className="rl-un" style={!reduce && play ? { animation: `rl-rise 300ms cubic-bezier(.2,.8,.2,1) ${i * 80}ms both` } : undefined}>
            <Avatar name={p.name} avatarId={p.avatar_id} size="md" />
            <div className="rl-flip">
              <span style={play ? (reduce ? { opacity: 0 } : { animation: `rl-un-out 200ms ease-in ${900 + i * 300}ms both` }) : undefined}>
                <b>{p.name}</b><span className="t-meta">{t('reel.stageName')}</span>
              </span>
              <span style={play ? (reduce ? { opacity: 1 } : { animation: `rl-un-in 420ms cubic-bezier(.2,.8,.2,1) ${1100 + i * 300}ms both` }) : { opacity: 0 }} data-real={real ? 'yes' : 'no'}>
                <b className="rl-real">{real ?? '—'}</b><span className="t-meta">{p.name}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface PersonalReelProps {
  player: Player;
  players: readonly Player[];
  winners: readonly WinnerRow[];
  roomId: string;
  roomCode: string;
  year: number;
  /** TV / presentation layout. */
  tv?: boolean;
  onClose: () => void;
}

const SLAM = 'rl-slam 600ms cubic-bezier(.2,1.3,.4,1) both';

export default function PersonalReel({ player: p, players, winners, roomId, roomCode, year, tv = false, onClose }: PersonalReelProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const { at, clear } = useTimeline();
  const vfx = useRef<StageVfxHandle>(null);
  const heroRef = useRef<HTMLSpanElement>(null);
  const placeRef = useRef<HTMLSpanElement>(null);
  const sumRef = useRef<HTMLSpanElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  useDialogFocus(layerRef);
  const { names, revealed } = useRevealedNames(roomId);
  const cues = useAudioStore((s) => s.cues && !s.muted);
  const setCues = useAudioStore((s) => s.setCues);
  const setMuted = useAudioStore((s) => s.setMuted);

  const n = reelNumbers(p);
  const ranked = useMemo(() => rankOrder(players), [players]);
  const place = Math.max(1, ranked.findIndex((x) => x.id === p.id) + 1);
  const myTitles = titlesOf(winners, p.id);
  const metric = (cat: string) => Number(winners.find((w) => w.category === cat && w.player_id === p.id)?.metric_value ?? 0);
  const scenes = revealed ? 9 : 8;

  const [scene, setScene] = useState(0);
  const [num, setNum] = useState(0);
  const [impact, setImpact] = useState(0);
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);

  const fx = useCallback((kind: VfxPreset) => {
    const target = kind === 'reelPeak' ? placeRef.current : kind === 'reelSummary' ? sumRef.current : heroRef.current;
    vfx.current?.fire(kind, { target, place });
  }, [place]);

  // The timeline reads the latest data through a ref, so late data (the
  // reveal fetch, winners) never restarts a reel that is already playing.
  const live = useRef({ n, titles: myTitles.length, revealed, fx });
  live.current = { n, titles: myTitles.length, revealed, fx };

  const play = useCallback(() => {
    const { n, titles, fx } = live.current;
    clear();
    vfx.current?.clear();
    setScene(0); setNum(0); setImpact(0); setDone(false);
    const k = reduce ? 0.45 : 1;
    const T = (ms: number) => Math.round(ms * k);
    const cue = (ms: number, c: Cue) => at(T(ms), () => playCue(c));
    const cut = (ms: number, sc: number) => at(T(ms), () => { setScene(sc); setNum(0); });
    const effect = (ms: number, kind: VfxPreset) => { if (!reduce) at(ms, () => fx(kind)); };
    let imp = 0;
    const hit = (ms: number, kind: VfxPreset) => { if (reduce) return; at(ms, () => { imp += 1; setImpact(imp); fx(kind); }); };
    const count = (ms: number, to: number, dur: number, lin = false) => {
      if (reduce) { at(T(ms), () => setNum(to)); return; }
      const steps = Math.max(1, Math.round(dur / 40));
      for (let i = 1; i <= steps; i++) {
        const x = i / steps;
        const e = lin ? (x < 0.85 ? x * 0.9 / 0.85 : 0.9 + (x - 0.85) / 0.15 * 0.1) : 1 - Math.pow(1 - x, 3);
        at(ms + dur * x, () => setNum(Math.round(to * e)));
      }
    };
    cut(0, 0); cue(60, 'riser'); effect(40, 'reelIntro');
    hit(950, 'reelBoom0'); cue(950, 'boom');
    cut(2300, 1); cue(2300, 'whoosh'); count(2700, n.trivia, 1100); hit(3800, 'reelBoom'); cue(3800, 'boom');
    cut(4900, 2); cue(4900, 'clash'); hit(5100, 'reelClash'); count(5400, n.duels, 800); hit(6200, 'reelHit'); cue(6200, 'hit');
    cut(7200, 3); cue(7200, 'riser'); effect(7200, 'reelRig'); count(7600, n.predictions, 1100); hit(8700, 'reelBoom'); cue(8700, 'boom');
    cut(9700, 4); cue(9700, 'drone'); effect(9700, 'reelBuild'); count(10500, n.total, 2400, true);
    cut(13100, 5); hit(13100, 'reelPeak'); cue(13100, 'bigBoom');
    let tt = 14900;
    cut(tt, 6); cue(tt, titles ? 'hit' : 'sting');
    for (let i = 0; i < titles; i++) { hit(tt + 350 + i * 450, 'reelHit'); if (i > 0) cue(tt + 350 + i * 450, 'hit'); }
    tt += 900 + titles * 450;
    cut(tt, 7); cue(tt, 'outro'); effect(tt + 50, 'reelSummary');
    at(T(tt + 2600), () => {
      if (!live.current.revealed) { setDone(true); return; }
      setScene(8); playCue('drumroll');
      at(T(3200), () => setDone(true));
    });
  }, [reduce, at, clear]);

  useEffect(() => { play(); }, [play, run]);

  const skip = () => {
    clear();
    vfx.current?.clear();
    setScene(7); setNum(n.total); setDone(false);
    at(2600, () => { if (live.current.revealed) { setScene(8); at(3200, () => setDone(true)); } else setDone(true); });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isTopDialog(layerRef)) onClose(); };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const on = (i: number) => scene === i;
  const an = (i: number, anim: string): CSSProperties => (scene !== i ? { opacity: 0 } : reduce ? { opacity: 1 } : { animation: anim });
  const sc = (i: number): CSSProperties => ({ opacity: on(i) ? 1 : 0, pointerEvents: on(i) ? 'auto' : 'none', zIndex: on(i) ? 5 : 1, transition: reduce ? 'opacity 200ms ease' : 'none' });
  const numVal = (i: number, final: number) => (on(i) ? num : final);
  const entry = resolveAvatar(p.avatar_id);
  const shake = !reduce && impact > 0 ? { animation: `rl-shake-${impact % 2 ? 'a' : 'b'} 380ms ease-out` } : undefined;

  const toggleSound = () => {
    if (cues) setCues(false);
    else { setCues(true); setMuted(false); }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={layerRef} className={clsx('rl-layer', tv && 'rl-tv')} role="dialog" aria-modal="true" aria-label={t('reel.aria', { name: p.name })}>
      <header className="rl-top">
        <div className="rl-segs" aria-hidden="true">
          {Array.from({ length: scenes }, (_, g) => <i key={g} className={g < scene ? 'past' : g === scene ? 'now' : ''} />)}
        </div>
        <Avatar name={p.name} avatarId={p.avatar_id} size="sm" />
        <div className="rl-top-who">
          <span className="t-eyebrow">{tv ? t('reel.tvEyebrow') : t('reel.eyebrow')}</span>
          <span className="rl-top-name">{p.name}</span>
        </div>
        <span className="rl-sp" />
        <button type="button" className="btn btn-ghost btn-sm rl-btn" onClick={toggleSound} aria-pressed={cues}>
          {cues ? <Volume2 aria-hidden="true" strokeWidth={2} /> : <VolumeX aria-hidden="true" strokeWidth={2} />}
          <span className="rl-only-wide">{t('reel.sound')}</span>
        </button>
        {!done && scene < 7 ? (
          <button type="button" className="btn btn-secondary btn-sm rl-btn" onClick={skip}>{t('motion.skip')}<SkipForward aria-hidden="true" strokeWidth={2} /></button>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm rl-btn" onClick={() => setRun((r) => r + 1)}><RotateCcw aria-hidden="true" strokeWidth={2} /><span className="rl-only-wide">{t('reel.replay')}</span></button>
        )}
        <button ref={closeRef} type="button" className="iconbtn rl-x" onClick={onClose} aria-label={t('reel.close')}><X aria-hidden="true" strokeWidth={2} /></button>
      </header>

      <main className="rl-stage" aria-live="polite">
        <StageVfx ref={vfx} layers="both" />
        {reduce && (on(0) || on(5) || on(7)) && <div className={clsx('rl-glow', on(7) && 'hi')} aria-hidden="true" />}
        <div className="rl-shake" style={shake}>
          <section className="rl-scene" style={sc(0)}>
            <span className="rl-kick" style={an(0, 'rl-rise 300ms ease 100ms both')}>{t('reel.heroKick', { year, code: roomCode })}</span>
            <span ref={heroRef} className="rl-hero" style={an(0, 'rl-push 2300ms cubic-bezier(.2,.6,.3,1) 300ms both')}>
              {entry ? <AvatarVisual entry={entry} variant="full" className="rl-hero-art" /> : <Avatar name={p.name} size="xl" />}
            </span>
            <h1 className="rl-big rl-name" style={an(0, `rl-slam 600ms cubic-bezier(.2,1.3,.4,1) 900ms both`)}>{p.name.toLocaleUpperCase('el')}</h1>
            <span className="rl-sub" style={an(0, 'rl-rise 300ms ease 1400ms both')}>{t('reel.heroSub')}</span>
          </section>
          <section className="rl-scene" style={sc(1)}>
            <span className="rl-kick" style={an(1, SLAM)}>01 · {t('reel.trivia')}</span>
            <span className="rl-big rl-n" style={an(1, 'rl-rise 250ms ease 300ms both')}>{numVal(1, n.trivia)}</span>
            <span className="rl-sub" style={an(1, 'rl-rise 300ms ease 1500ms both')}>{t('reel.triviaSub')}</span>
          </section>
          <section className="rl-scene" style={sc(2)}>
            <span className="rl-kick" style={an(2, SLAM)}>02 · {t('reel.duels')}</span>
            <span className={clsx('rl-big rl-n', n.duels < 0 ? 'neg' : 'pos')} style={an(2, `rl-slam 600ms cubic-bezier(.2,1.3,.4,1) 300ms both`)}>{signedNum(numVal(2, n.duels))}</span>
            <span className="rl-sub" style={an(2, 'rl-rise 300ms ease 1400ms both')}>{t('reel.duelsSub')}</span>
          </section>
          <section className="rl-scene" style={sc(3)}>
            <span className="rl-kick" style={an(3, SLAM)}>03 · {t('reel.predictions')}</span>
            <span className="rl-big rl-n live" style={an(3, 'rl-rise 250ms ease 300ms both')}>{numVal(3, n.predictions)}</span>
            <span className="rl-sub" style={an(3, 'rl-rise 300ms ease 1500ms both')}>{t('reel.predictionsSub')}</span>
          </section>
          <section className="rl-scene" style={sc(4)}>
            <span className="rl-kick gold">{t('reel.total')}</span>
            <div className="rl-chips">
              <span className="rl-chip" style={on(4) && !reduce ? { animation: 'rl-merge-l 500ms cubic-bezier(.5,0,.3,1) 500ms both' } : undefined}>{n.trivia}</span>
              <span className="rl-chip" style={on(4) && !reduce ? { animation: 'rl-merge-c 500ms cubic-bezier(.5,0,.3,1) 650ms both' } : undefined}>{signedNum(n.duels)}</span>
              <span className="rl-chip" style={on(4) && !reduce ? { animation: 'rl-merge-r 500ms cubic-bezier(.5,0,.3,1) 800ms both' } : undefined}>{n.predictions}</span>
              {n.spent > 0 && <span className="rl-chip spent" style={on(4) && !reduce ? { animation: 'rl-merge-c 500ms cubic-bezier(.5,0,.3,1) 900ms both' } : undefined}>{t('reel.spent', { points: n.spent })}</span>}
            </div>
            <span className="rl-big rl-total" style={on(4) && !reduce ? { animation: 'rl-slowzoom 3200ms linear both' } : undefined}>{numVal(4, n.total)}</span>
            <span className="rl-sub">{t('board.points')}</span>
          </section>
          <section className="rl-scene" style={sc(5)}>
            <span className="rl-kick" style={an(5, 'rl-rise 250ms ease 400ms both')}>{t('reel.place')}</span>
            <span ref={placeRef} className={clsx('rl-big rl-place', place === 1 && 'win')} style={an(5, 'rl-slam 650ms cubic-bezier(.2,1.3,.4,1) both')}>#{place}</span>
            <span className="rl-sub" style={an(5, 'rl-rise 300ms ease 700ms both')}>{t('reel.placeSub', { place, count: ranked.length })}</span>
          </section>
          <section className="rl-scene" style={sc(6)}>
            <span className="rl-kick gold">{myTitles.length ? t('reel.titlesKick') : t('reel.titlesNone')}</span>
            <div className="rl-badges">
              {myTitles.map((c, i) => (
                <div key={c} className="rl-badge" style={an(6, `rl-slam 600ms cubic-bezier(.2,1.3,.4,1) ${350 + i * 450}ms both`)}>
                  <span className="rl-badge-i"><Star aria-hidden="true" strokeWidth={2} /></span>
                  <span><span className="rl-badge-k">{t(`winners.cat.${c}.name`)}</span><span className="t-meta">{t(`titles.reason.${c}`)} · {t(`titles.metric.${c}`, { count: metric(c) })}</span></span>
                </div>
              ))}
            </div>
            {myTitles.length === 0 && <span className="rl-sub">{t('reel.noTitle')}</span>}
          </section>
          <section className="rl-scene" style={sc(7)}>
            <span ref={sumRef} className="rl-sum-av" style={an(7, SLAM)}><Avatar name={p.name} avatarId={p.avatar_id} size="xl" /></span>
            <span className="rl-sum-name">{p.name}</span>
            <span className="t-meta">{t('reel.placeSub', { place, count: ranked.length })}</span>
            <div className="rl-stats">
              <div className="stat"><div className="v num">{n.trivia}</div><div className="k">{t('reel.trivia')}</div></div>
              <div className="stat"><div className="v num">{signedNum(n.duels)}</div><div className="k">{t('reel.duels')}</div></div>
              <div className="stat"><div className="v num">{n.predictions}</div><div className="k">{t('reel.predictions')}</div></div>
            </div>
            <div className="rl-sum-total"><span className="num">{n.total}</span><span className="t-small">{t('board.points')}</span></div>
            {n.spent > 0 && <span className="t-meta">{t('reel.spentNote', { points: n.spent })}</span>}
            <div className="rl-sum-titles">{myTitles.map((c) => <span key={c} className="chip chip-gold">{t(`winners.cat.${c}.name`)}</span>)}</div>
          </section>
          {revealed && (
            <section className="rl-scene" style={sc(8)}>
              <span className="rl-kick gold">{t('reel.unmaskKick')}</span>
              <h2 className="rl-unmask-h">{t('reel.unmaskTitle')}</h2>
              <Unmask players={ranked} names={names} revealed={revealed} play={on(8)} reduce={reduce} />
            </section>
          )}
        </div>
      </main>
    </div>,
    document.fullscreenElement ?? document.body,
  );
}
