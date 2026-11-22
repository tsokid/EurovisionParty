// src/components/results/PredictionsResultsScreen.tsx
//
// Final-phase Predictions tab (board final-after-{m,d}, state 2): the
// player's 10 picks with where each country really finished and the points
// it earned — exact place +50, right list but wrong place +20 — as Stage
// PointsChips. The full official-ranking panel is gone (owner decision).
//
// The official places still come from entries_with_names for the room's
// own year (grand finalists with a final place); the per-pick outcome
// mirrors score_all_predictions (src/lib/predictionBreakdown.ts).
//
// Motion: a simple staggered entrance; none under reduced motion.
// Motion map #2 (Task 8): the official top 5 is revealed 5th → 1st,
// Eurovision-scoreboard style, and the player's matching Top 5 picks light
// up (+50 gold exact place, +20 pink right list) while the points tick up.
// It uses only the official places this screen already loads, once per
// room per browser, with Skip; reduced motion shows the end state.

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { supabase } from '../../lib/supabase';
import { buildBreakdown, type BreakdownRow } from '../../lib/predictionBreakdown';
import { worstRange, TOP_N, WORST_N } from '../../lib/predictionSlots';
import { getLocalizedCountryName } from '../../lib/countryLocale';
import { Flag, PointsChip, useCountUp, useTimeline } from '../stage';
import { SkipForward } from 'lucide-react';
import type { Country } from '../../lib/types';

interface ResultRow {
  iso: string;
  name_en: string | null;
  name_el?: string | null;
  artist: string | null;
  song: string | null;
  final_place: number;
  total_points: number;
  jury_points: number;
  televote_points: number;
}

interface MyPrediction {
  top5: string[];
  worst5: string[];
  top5_points: number | null;
  worst5_points: number | null;
}

const REVEAL_T = { start: 400, step: 700, chip: 320 } as const;
const revealKey = (roomId: string) => `eurovision-games-official-top5-${roomId}`;

/** Motion map #2: the official top 5, 5th → 1st, with the player's hits lighting up. */
export function OfficialTopReveal({ roomId, top, nameOf }: {
  roomId: string;
  /** Official places 1..5 with the player's outcome for that country (if picked in Top 5). */
  top: { iso: string; place: number; outcome: 'exact' | 'list' | null; points: number }[];
  nameOf: (iso: string) => string;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const { at, clear } = useTimeline();
  const seen = (() => { try { return localStorage.getItem(revealKey(roomId)) === '1'; } catch { return false; } })();
  const instant = reduce || seen;
  const order = [...top].sort((a, b) => b.place - a.place); // 5th first
  const [shown, setShown] = useState(instant ? order.length : 0);
  const [lit, setLit] = useState(instant ? order.length : 0);
  const pts = order.slice(0, lit).reduce((s, r) => s + r.points, 0);
  const shownPts = useCountUp(pts, instant ? 0 : 500);
  const done = shown >= order.length && lit >= order.length;

  useEffect(() => {
    if (instant) return;
    try { localStorage.setItem(revealKey(roomId), '1'); } catch { /* ignore */ }
    order.forEach((_, i) => {
      at(REVEAL_T.start + i * REVEAL_T.step, () => setShown(i + 1));
      at(REVEAL_T.start + i * REVEAL_T.step + REVEAL_T.chip, () => setLit(i + 1));
    });
    return clear;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { clear(); setShown(order.length); setLit(order.length); };

  return (
    <section className="card or" aria-labelledby="or-h">
      <div className="or-head">
        <div>
          <span className="t-eyebrow">{t('officialTop.kicker')}</span>
          <h2 id="or-h" className="or-h">{t('officialTop.title')}</h2>
        </div>
        <span className="num or-pts" aria-label={t('officialTop.pointsAria', { points: pts })}>+{shownPts}</span>
        {!done && <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>{t('motion.skip')}<SkipForward aria-hidden="true" strokeWidth={2} /></button>}
      </div>
      <ol className="or-list">
        {order.map((r, i) => (
          <motion.li
            key={r.iso}
            className={clsx('or-row', i < lit && r.outcome)}
            initial={false}
            animate={i < shown ? { opacity: 1, rotateX: 0 } : reduce ? { opacity: 0 } : { opacity: 0, rotateX: -90 }}
            transition={reduce ? { duration: 0.2 } : { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="num or-n">{r.place}</span>
            <Flag iso={r.iso} />
            <span className="or-name">{nameOf(r.iso)}</span>
            {r.outcome && i < lit && (
              <motion.span initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18 }}>
                <PointsChip points={r.points} reason={t(`predBreakdown.${r.outcome}`)} tone={r.outcome === 'exact' ? 'gold' : 'pink'} />
              </motion.span>
            )}
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

export default function PredictionsResultsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const { player, room } = useGameStore();
  const reduce = useReducedMotion() ?? false;

  const [results, setResults]   = useState<ResultRow[]>([]);
  const [myPred, setMyPred]     = useState<MyPrediction | null>(null);
  const [loading, setLoading]   = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!room || !player) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    Promise.all([
      // The room's year (not the live year): grand finalists with a final place.
      supabase
        .from('entries_with_names')
        .select('iso, name_en, name_el, artist, song, final_place, total_points, jury_points, televote_points')
        .eq('year', room.year)
        .eq('in_final', true)
        .not('final_place', 'is', null)
        .order('final_place', { ascending: true }),
      supabase
        .from('predictions')
        .select('top5, worst5, top5_points, worst5_points')
        .eq('room_id', room.id)
        .eq('player_id', player.id)
        .maybeSingle(),
    ]).then(([resR, predR]) => {
      if (cancelled) return;
      if (resR.error)  { setErrorMsg(resR.error.message);  setLoading(false); return; }

      setResults((resR.data ?? []) as ResultRow[]);
      setMyPred((predR.data ?? null) as MyPrediction | null);
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [room?.id, room?.year, player?.id]);

  const breakdown = useMemo(
    () => (myPred ? buildBreakdown(myPred, results) : null),
    [myPred, results],
  );
  const nameOf = useMemo(() => {
    const m = new Map(results.map((r) => [r.iso, r]));
    return (iso: string) => {
      const r = m.get(iso);
      if (!r) return iso;
      // Same localisation as the rest of the game (name_el in Greek).
      const c: Country = { id: r.iso, flag: '', name: r.name_en ?? r.iso, name_el: r.name_el ?? r.name_en ?? r.iso };
      return getLocalizedCountryName(c);
    };
  }, [results]);

  // ── Loading / error / not ready ────────────────────────────────────
  if (loading) {
    return (
      <div className="pk-loading" role="status" aria-label={t('pick.loading')}>
        <span className="lb-spinner" aria-hidden="true" />
      </div>
    );
  }
  if (errorMsg) {
    return <div className="bd"><p className="pk-error" role="alert">{errorMsg}</p></div>;
  }
  if (results.length === 0) {
    return (
      <div className="bd">
        <section className="card bd-empty">
          <h1 className="t-h3">{t('predResults.notReadyTitle')}</h1>
          <p className="t-small">{t('predResults.notReadyBody')}</p>
        </section>
      </div>
    );
  }
  if (!myPred || !breakdown) {
    return (
      <div className="bd">
        <header className="bd-head">
          <p className="t-eyebrow">{t('predResults.label')}</p>
          <h1 className="bd-title">{t('predResults.title')}</h1>
        </header>
        <section className="card bd-empty"><p className="t-small">{t('predBreakdown.noPrediction')}</p></section>
      </div>
    );
  }

  // Stored points are authoritative (set by the scoring RPC); the per-row
  // breakdown fills in when they are not written yet.
  const topPts   = myPred.top5_points   ?? breakdown.topPoints;
  const worstPts = myPred.worst5_points ?? breakdown.worstPoints;
  const range = worstRange(breakdown.n);

  const card = (list: 'top' | 'worst', rows: BreakdownRow[], pts: number, offset: number) => (
    <section className={clsx('card bd-card', list === 'top' ? 't' : 'w')} aria-labelledby={`bd-${list}`}>
      <h2 id={`bd-${list}`} className="bd-card-h">
        <span className="t-eyebrow">{t(list === 'top' ? 'pick.top5' : 'pick.worst5')}</span>
        <span className="t-meta">
          {list === 'top'
            ? t('predBreakdown.topPlaces')
            : range ? t('predBreakdown.worstPlaces', { from: range[0], to: range[1], count: breakdown.n }) : ''}
        </span>
        <span className="num bd-card-pts">+{pts}</span>
      </h2>
      <ol className="bd-list">
        {rows.map((r, i) => {
          const name = nameOf(r.iso);
          const reason = t(`predBreakdown.${r.outcome}`);
          return (
            <motion.li
              key={`${list}-${r.iso}`}
              className={clsx('bd-row', r.outcome)}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.28, ease: 'easeOut', delay: (offset + i) * 0.05 }}
            >
              <span className="num bd-n">{r.predicted ?? ''}</span>
              <Flag iso={r.iso} />
              <span className="bd-who">
                <span className="bd-name" title={name}>{name}</span>
                <span className="bd-fin">
                  {r.official !== null
                    ? t('predBreakdown.finished', { place: r.official })
                    : t('predBreakdown.notPlaced')}
                </span>
              </span>
              <PointsChip
                points={r.points}
                reason={reason}
                tone={r.outcome === 'exact' ? 'gold' : r.outcome === 'list' ? 'pink' : undefined}
              />
            </motion.li>
          );
        })}
      </ol>
    </section>
  );

  // Official top 5 with this player's Top 5 outcome per country (only data this screen already has).
  const officialTop = results.filter((r) => r.final_place <= TOP_N).map((r) => {
    const row = breakdown.top.find((b) => b.iso === r.iso);
    const outcome = row && row.outcome !== 'miss' ? row.outcome : null;
    return { iso: r.iso, place: r.final_place, outcome, points: row && outcome ? row.points : 0 };
  });

  return (
    <div className={clsx('bd', embedded && 'embedded')}>
      {room && officialTop.length === TOP_N && <OfficialTopReveal roomId={room.id} top={officialTop} nameOf={nameOf} />}
      <header className="bd-head">
        {!embedded && <p className="t-eyebrow">{t('predResults.label')}</p>}
        {embedded
          ? <h2 className="bd-title">{t('predBreakdown.headline', { hits: breakdown.hits, total: TOP_N + WORST_N })}</h2>
          : <h1 className="bd-title">{t('predBreakdown.headline', { hits: breakdown.hits, total: TOP_N + WORST_N })}</h1>}
        <p className="t-meta">
          {t('predBreakdown.points', { points: topPts + worstPts })} · {t('pick.scoring')}
        </p>
      </header>
      <div className="bd-cards">
        {card('top', breakdown.top, topPts, 0)}
        {card('worst', breakdown.worst, worstPts, breakdown.top.length)}
      </div>
    </div>
  );
}
