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
// Motion: a simple staggered entrance; none under reduced motion. The
// scoreboard-style reveal (motion map #2) belongs to the winners sequence.

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { supabase } from '../../lib/supabase';
import { buildBreakdown, type BreakdownRow } from '../../lib/predictionBreakdown';
import { worstRange, TOP_N, WORST_N } from '../../lib/predictionSlots';
import { getLocalizedCountryName } from '../../lib/countryLocale';
import { Flag, PointsChip } from '../stage';
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

export default function PredictionsResultsScreen() {
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

  return (
    <div className="bd">
      <header className="bd-head">
        <p className="t-eyebrow">{t('predResults.label')}</p>
        <h1 className="bd-title">{t('predBreakdown.headline', { hits: breakdown.hits, total: TOP_N + WORST_N })}</h1>
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
