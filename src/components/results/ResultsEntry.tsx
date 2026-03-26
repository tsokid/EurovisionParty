import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { COUNTRIES_2026, COUNTRY_MAP } from '../../lib/countries2026';
import { getLocalizedCountryName } from '../../lib/countryLocale';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import type { Country } from '../../lib/types';

type ResultsPhase = 'entry' | 'confirm' | 'scoring' | 'done';

export default function ResultsEntry() {
  const { t } = useTranslation();
  const { room, player } = useGameStore();
  const [ranking, setRanking] = useState<Country[]>([]);
  const [phase, setPhase] = useState<ResultsPhase>('entry');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoringResults, setScoringResults] = useState<Array<{ player_id: string; total: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [existingResults, setExistingResults] = useState<string[] | null>(null);

  // Check if results already exist
  useEffect(() => {
    if (!room) return;
    supabase.from('results').select('final_ranking').eq('room_id', room.id).maybeSingle()
      .then(({ data }) => {
        if (data?.final_ranking) {
          const codes = data.final_ranking as string[];
          setExistingResults(codes);
          setRanking(codes.map(c => COUNTRY_MAP.get(c)).filter(Boolean) as Country[]);
          setPhase('done');
        }
      });
  }, [room]);

  const selectedIds = new Set(ranking.map(c => c.id));
  const remaining = COUNTRIES_2026.filter(c => !selectedIds.has(c.id));

  const handleAddCountry = useCallback((country: Country) => {
    setRanking(prev => [...prev, country]);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setRanking(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setRanking(prev => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setRanking(prev => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  }, []);

  const handleConfirm = () => setPhase('confirm');

  const handleSubmitResults = useCallback(async () => {
    if (!room || !player) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const rankingCodes = ranking.map(c => c.id);

      // Save results
      const { error: saveErr } = await supabase.rpc('save_results', {
        p_room_id: room.id,
        p_player_id: player.id,
        p_final_ranking: rankingCodes,
      });
      if (saveErr) throw saveErr;

      // Score all predictions
      setPhase('scoring');
      const { data: scores, error: scoreErr } = await supabase.rpc('score_all_predictions', {
        p_room_id: room.id,
      });
      if (scoreErr) throw scoreErr;

      setScoringResults(scores ?? []);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save results');
      setPhase('confirm');
    } finally {
      setIsSubmitting(false);
    }
  }, [room, player, ranking]);

  if (!room || !player) return null;

  // Already scored
  if (phase === 'done' && existingResults) {
    return (
      <div className="flex flex-col h-full px-4 py-2">
        <div className="text-center mb-4">
          <h2 className="glow-text text-xl font-bold mb-1">{t('resultsEntry.officialResults')}</h2>
          <p className="text-white/50 text-sm">{t('resultsEntry.rankingsConfirmed')}</p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {ranking.map((country, idx) => (
            <div key={country.id} className={clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2',
              idx < 3 ? 'glass border border-euro-gold/20' : 'glass',
            )}>
              <span className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                idx === 0 ? 'bg-euro-gold/20 text-euro-gold' :
                idx === 1 ? 'bg-white/10 text-white/70' :
                idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                'bg-white/5 text-white/40'
              )}>
                {idx + 1}
              </span>
              <span className="text-lg">{country.flag}</span>
              <span className="text-sm text-white font-medium">{getLocalizedCountryName(country)}</span>
              {idx === 0 && <Badge variant="gold">{t('resultsEntry.winner')}</Badge>}
            </div>
          ))}
        </div>
        {scoringResults.length > 0 && (
          <Card className="mt-3">
            <p className="text-xs text-euro-gold text-center font-medium">
              {t('resultsEntry.playersScored', { count: scoringResults.length })}
            </p>
          </Card>
        )}
      </div>
    );
  }

  // Scoring in progress
  if (phase === 'scoring') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
        <motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
          ⚡
        </motion.div>
        <h2 className="glow-text text-xl font-bold">{t('resultsEntry.scoring')}</h2>
        <p className="text-white/50 text-sm text-center">{t('resultsEntry.scoringDesc')}</p>
      </div>
    );
  }

  // Confirmation screen
  if (phase === 'confirm') {
    return (
      <div className="flex flex-col h-full px-4 py-2">
        <div className="text-center mb-4">
          <h2 className="glow-text text-xl font-bold mb-1">{t('resultsEntry.confirmTitle')}</h2>
          <p className="text-white/50 text-sm">{t('resultsEntry.confirmSubtitle')}</p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 mb-4">
          {ranking.map((country, idx) => (
            <div key={country.id} className="flex items-center gap-3 glass rounded-xl px-3 py-2">
              <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold text-white/60">
                {idx + 1}
              </span>
              <span className="text-lg">{country.flag}</span>
              <span className="text-sm text-white font-medium">{getLocalizedCountryName(country)}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pb-2">
          <Button variant="ghost" fullWidth onClick={() => setPhase('entry')}>
            {t('resultsEntry.editBtn')}
          </Button>
          <Button fullWidth loading={isSubmitting} onClick={handleSubmitResults}>
            {t('resultsEntry.confirmBtn')}
          </Button>
        </div>
        {error && <p className="text-euro-red text-sm text-center mt-2">{error}</p>}
      </div>
    );
  }

  // Entry screen
  return (
    <div className="flex flex-col h-full px-4 py-2">
      <div className="text-center mb-3">
        <h2 className="glow-text text-xl font-bold mb-1">{t('resultsEntry.title')}</h2>
        <p className="text-white/50 text-sm">
          {t('resultsEntry.subtitle', { current: ranking.length, total: COUNTRIES_2026.length })}
        </p>
      </div>

      {/* Current ranking */}
      {ranking.length > 0 && (
        <div className="max-h-[35vh] overflow-y-auto space-y-1 mb-3">
          {ranking.map((country, idx) => (
            <motion.div
              key={country.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <span className={clsx(
                'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0',
                idx < 3 ? 'bg-euro-gold/20 text-euro-gold' : 'bg-white/10 text-white/40'
              )}>
                {idx + 1}
              </span>
              <div className="flex-1 glass rounded-lg px-2 py-1.5 flex items-center gap-2">
                <span className="text-base">{country.flag}</span>
                <span className="text-xs text-white font-medium flex-1">{getLocalizedCountryName(country)}</span>
                <button onClick={() => handleMoveUp(idx)} disabled={idx === 0}
                  className="text-white/30 hover:text-white disabled:opacity-20 text-xs px-0.5">▲</button>
                <button onClick={() => handleMoveDown(idx)} disabled={idx === ranking.length - 1}
                  className="text-white/30 hover:text-white disabled:opacity-20 text-xs px-0.5">▼</button>
                <button onClick={() => handleRemove(idx)}
                  className="text-euro-red/60 hover:text-euro-red text-xs px-0.5">✕</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Remaining countries to add */}
      {remaining.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <p className="text-xs text-white/40 mb-2">
            {t('resultsEntry.addPosition', { num: ranking.length + 1 })}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {remaining.map(country => (
              <motion.button
                key={country.id}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAddCountry(country)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl glass hover:bg-white/10 active:bg-white/15 cursor-pointer"
              >
                <span className="text-xl">{country.flag}</span>
                <span className="text-[10px] text-white/70 leading-tight truncate w-full text-center">
                  {getLocalizedCountryName(country)}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="pt-3 pb-2">
        <Button
          fullWidth
          disabled={ranking.length < COUNTRIES_2026.length}
          onClick={handleConfirm}
        >
          {ranking.length < COUNTRIES_2026.length
            ? `Add ${COUNTRIES_2026.length - ranking.length} more countries`
            : t('resultsEntry.reviewBtn')}
        </Button>
      </div>
    </div>
  );
}
