// src/components/results/PredictionsResultsScreen.tsx
//
// Final-phase Predictions tab.
// Shows the official Eurovision Grand Final ranking (1..N) with each
// country's artist/song and Total / Jury / Televote points, and overlays
// the current player's predictions:
//
//   • exact top-5 hit  → +50  (gold border + badge)
//   • in top 5 only    → +20  (yellow border + badge)
//   • exact worst-5    → +50  (red border + badge)
//   • in worst 5 only  → +20  (pink border + badge)
//
// A header card summarises the player's total prediction points and the
// breakdown (Top-5 vs Worst-5). Footer legend explains the scoring.
//
// Only meaningful in `final` phase — assumes the official results have
// been imported into eurovision_${year}_results.

import { useEffect, useMemo, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { supabase } from '../../lib/supabase';

interface ResultRow {
  iso: string;
  ranking: number;
  total_points: number;
  jury_points: number;
  televote_points: number;
}

interface ParticipantRow {
  iso: string;
  name: string;
  artist: string | null;
  song: string | null;
}

interface MyPrediction {
  top5: string[];
  worst5: string[];
  top5_points: number | null;
  worst5_points: number | null;
}

type PickKind = 'top-exact' | 'top-in' | 'worst-exact' | 'worst-in';

interface Pick {
  kind: PickKind;
  /** Player's slot number (1..5) within their top-5 / worst-5. */
  slot: number;
  /** Points earned for this row. */
  points: number;
  /** Localised label, e.g. "T2 exact" / "W3 in worst 5". */
  label: string;
}

const PICK_STYLE: Record<PickKind, { border: string; pill: string }> = {
  'top-exact':   { border: 'border-l-amber-300',  pill: 'bg-amber-300/20  border-amber-300/50  text-amber-300'  },
  'top-in':      { border: 'border-l-yellow-500', pill: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' },
  'worst-exact': { border: 'border-l-rose-400',   pill: 'bg-rose-500/15   border-rose-400/40   text-rose-300'   },
  'worst-in':    { border: 'border-l-pink-500',   pill: 'bg-pink-500/12   border-pink-400/40   text-pink-300'   },
};

function FlagImg({ iso }: { iso: string }) {
  return (
    <img
      src={`https://flagcdn.com/w80/${iso.toLowerCase()}.png`}
      alt=""
      loading="lazy"
      width={32}
      height={24}
      className="rounded-[3px] object-cover flex-shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
      style={{ width: 32, height: 24 }}
      onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
    />
  );
}

export default function PredictionsResultsScreen() {
  const { t } = useTranslation();
  const { player, room } = useGameStore();

  const [results, setResults]           = useState<ResultRow[]>([]);
  const [participants, setParticipants] = useState<Map<string, ParticipantRow>>(new Map());
  const [myPred, setMyPred]             = useState<MyPrediction | null>(null);
  const [loading, setLoading]           = useState(true);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  useEffect(() => {
    if (!room || !player) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    Promise.all([
      // Year-agnostic via the table name pattern. The 2026 table is the
      // active one — if/when 2027 ships we add a `year` column to rooms
      // and resolve dynamically; for now this matches the rest of the app.
      supabase
        .from('eurovision_2026_results')
        .select('iso, ranking, total_points, jury_points, televote_points')
        .order('ranking', { ascending: true }),
      supabase
        .from('eurovision_2026_participants')
        .select('iso, name, artist, song'),
      supabase
        .from('predictions')
        .select('top5, worst5, top5_points, worst5_points')
        .eq('room_id', room.id)
        .eq('player_id', player.id)
        .maybeSingle(),
    ]).then(([resR, partR, predR]) => {
      if (cancelled) return;
      if (resR.error)  { setErrorMsg(resR.error.message);  setLoading(false); return; }
      if (partR.error) { setErrorMsg(partR.error.message); setLoading(false); return; }

      setResults((resR.data ?? []) as ResultRow[]);
      const m = new Map<string, ParticipantRow>();
      for (const row of (partR.data ?? []) as ParticipantRow[]) m.set(row.iso, row);
      setParticipants(m);
      setMyPred((predR.data ?? null) as MyPrediction | null);
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [room?.id, player?.id]);

  // Map iso → pick for fast lookup during render.
  // Worst-5 mapping mirrors the score_predictions SQL: worst5[0] = "I think
  // this comes last" → matches official rank N; worst5[4] → rank N-4.
  const picksByIso = useMemo(() => {
    const map = new Map<string, Pick>();
    if (!myPred || results.length === 0) return map;

    const total = results.length;
    const officialWorstRanks = [total, total - 1, total - 2, total - 3, total - 4];
    const officialTop5Isos   = new Set(results.filter(r => r.ranking <= 5).map(r => r.iso));
    const officialWorst5Isos = new Set(results.filter(r => officialWorstRanks.includes(r.ranking)).map(r => r.iso));

    for (let i = 0; i < (myPred.top5 ?? []).length; i++) {
      const iso = myPred.top5[i];
      const slot = i + 1;
      const result = results.find(r => r.iso === iso);
      if (!result) continue;
      if (result.ranking === slot) {
        map.set(iso, { kind: 'top-exact', slot, points: 50, label: t('predResults.tagTopExact', { slot }) });
      } else if (officialTop5Isos.has(iso)) {
        map.set(iso, { kind: 'top-in', slot, points: 20, label: t('predResults.tagTopIn',   { slot }) });
      }
    }
    for (let i = 0; i < (myPred.worst5 ?? []).length; i++) {
      const iso = myPred.worst5[i];
      const slot = i + 1;
      const result = results.find(r => r.iso === iso);
      if (!result) continue;
      const isExact = result.ranking === officialWorstRanks[i];
      // Don't overwrite a top-5 hit with a worst-5 entry — shouldn't happen
      // in practice (player can't pick the same country in both lists), but
      // this guards anyway.
      if (map.has(iso)) continue;
      if (isExact) {
        map.set(iso, { kind: 'worst-exact', slot, points: 50, label: t('predResults.tagWorstExact', { slot }) });
      } else if (officialWorst5Isos.has(iso)) {
        map.set(iso, { kind: 'worst-in', slot, points: 20, label: t('predResults.tagWorstIn',   { slot }) });
      }
    }
    return map;
  }, [myPred, results, t]);

  // ── Loading / error states ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="w-8 h-8 border-[3px] border-white/20 border-t-euro-gold rounded-full"
        />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="px-4 pt-6">
        <p className="text-sm text-red-300">{errorMsg}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="px-4 pt-10 text-center">
        <p className="text-base font-semibold text-white">{t('predResults.notReadyTitle')}</p>
        <p className="text-sm text-white/55 mt-2 max-w-md mx-auto">{t('predResults.notReadyBody')}</p>
      </div>
    );
  }

  const top5Pts   = myPred?.top5_points   ?? 0;
  const worst5Pts = myPred?.worst5_points ?? 0;
  const totalPts  = top5Pts + worst5Pts;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-3xl mx-auto w-full">

      {/* ── Title ── */}
      <div>
        <p className="text-xs font-bold text-white/40 tracking-[0.2em] uppercase">
          {t('predResults.label')}
        </p>
        <h2 className="text-[1.6rem] sm:text-2xl font-extrabold text-white mt-0.5 leading-tight">
          {t('predResults.title')}
        </h2>
      </div>

      {/* ── Your score card ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 p-4 sm:p-5"
        style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.18),rgba(236,72,153,0.12))' }}
      >
        <div className="flex items-end justify-between gap-4 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-white/45 tracking-widest uppercase">
              {t('predResults.yourPredScore')}
            </p>
            <p className="text-4xl sm:text-5xl font-extrabold text-white tabular-nums leading-none mt-1">
              {totalPts.toLocaleString()}
              <span className="ml-1 text-xs font-semibold text-white/40 uppercase tracking-widest">{t('predResults.pts')}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right">
            <div>
              <p className="text-[10px] text-amber-300/70 font-bold tracking-widest uppercase">{t('predResults.top5')}</p>
              <p className="text-lg font-extrabold text-amber-300 tabular-nums leading-none mt-0.5">+{top5Pts}</p>
            </div>
            <div>
              <p className="text-[10px] text-pink-300/70 font-bold tracking-widest uppercase">{t('predResults.worst5')}</p>
              <p className="text-lg font-extrabold text-pink-300 tabular-nums leading-none mt-0.5">+{worst5Pts}</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-white/45">
          <Trans
            i18nKey="predResults.scoreFormulaHint"
            components={{ b: <span className="text-white/75 font-semibold" /> }}
          />
        </p>
      </motion.div>

      {/* ── Country list ── */}
      <div className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#130826 0%,#0d051a 100%)' }}>

        {/* Column header */}
        <div className="hidden sm:grid grid-cols-[44px_1fr_72px_60px_72px] items-center gap-3 px-4 sm:px-5 py-2.5 border-b border-white/8 text-[10px] font-bold text-white/40 tracking-widest uppercase">
          <span>#</span>
          <span>{t('predResults.col.country')}</span>
          <span className="text-right">{t('predResults.col.total')}</span>
          <span className="text-right">{t('predResults.col.jury')}</span>
          <span className="text-right">{t('predResults.col.tele')}</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.04]">
          {results.map((r, i) => {
            const part = participants.get(r.iso);
            const pick = picksByIso.get(r.iso);
            const style = pick ? PICK_STYLE[pick.kind] : null;

            return (
              <motion.div
                key={r.iso}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.4) }}
                className={clsx(
                  'px-4 sm:px-5 py-3 border-l-[3px]',
                  style ? style.border : 'border-l-transparent',
                )}
              >
                <div className="grid grid-cols-[44px_1fr_72px] sm:grid-cols-[44px_1fr_72px_60px_72px] items-center gap-3">
                  {/* Rank */}
                  <span className="text-base font-extrabold text-white/85 tabular-nums">
                    {r.ranking}
                  </span>

                  {/* Country / artist / song */}
                  <div className="min-w-0 flex items-center gap-2.5">
                    <FlagImg iso={r.iso} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {part?.name ?? r.iso}
                      </p>
                      <p className="text-[11px] text-white/45 truncate">
                        {part?.artist || '—'}{part?.song ? ` · ${part.song}` : ''}
                      </p>
                      {/* Mobile-only inline jury/tele since columns collapse */}
                      <p className="sm:hidden text-[10px] text-white/35 mt-0.5 tabular-nums">
                        {t('predResults.col.jury')} {r.jury_points} · {t('predResults.col.tele')} {r.televote_points}
                      </p>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="text-right">
                    <p className="text-base font-extrabold text-white tabular-nums leading-none">
                      {r.total_points}
                    </p>
                    {pick && (
                      <span className={clsx(
                        'inline-block mt-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        style!.pill,
                      )}>
                        +{pick.points} · {pick.label}
                      </span>
                    )}
                  </div>

                  {/* Jury / Televote — desktop columns */}
                  <p className="hidden sm:block text-right text-sm font-semibold text-white/65 tabular-nums">
                    {r.jury_points}
                  </p>
                  <p className="hidden sm:block text-right text-sm font-semibold text-white/65 tabular-nums">
                    {r.televote_points}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 sm:px-5 py-3 border-t border-white/8 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-amber-300" />
            {t('predResults.legend.topExact')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-yellow-500" />
            {t('predResults.legend.topIn')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-rose-400" />
            {t('predResults.legend.worstExact')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-pink-500" />
            {t('predResults.legend.worstIn')}
          </span>
        </div>
      </div>
    </div>
  );
}
