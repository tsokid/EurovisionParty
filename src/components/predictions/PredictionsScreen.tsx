import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

type PredictionTab = 'top5' | 'worst5';

interface ScoredPrediction {
  top5: string[];
  worst5: string[];
  top5_points: number | null;
  worst5_points: number | null;
  scored_at: string | null;
}

export default function PredictionsScreen() {
  const { t } = useTranslation();
  const { room, player } = useGameStore();

  const [activeTab, setActiveTab] = useState<PredictionTab>('top5');
  const [top5, setTop5] = useState<(Country | null)[]>([null, null, null, null, null]);
  const [worst5, setWorst5] = useState<(Country | null)[]>([null, null, null, null, null]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPrediction, setExistingPrediction] = useState<ScoredPrediction | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // Load existing predictions on mount
  useEffect(() => {
    if (!room || !player) return;
    supabase.from('predictions')
      .select('top5, worst5, top5_points, worst5_points, scored_at')
      .eq('room_id', room.id)
      .eq('player_id', player.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingPrediction(data as ScoredPrediction);
          const t5 = (data.top5 as string[]).map(id => COUNTRY_MAP.get(id) ?? null);
          const w5 = (data.worst5 as string[]).map(id => COUNTRY_MAP.get(id) ?? null);
          setTop5(t5);
          setWorst5(w5);
          if (data.scored_at) {
            setSubmitted(true);
          } else if (t5.every(Boolean) && w5.every(Boolean)) {
            setSubmitted(true);
          }
        }
      })
      .then(() => setIsLoadingExisting(false), () => setIsLoadingExisting(false));
  }, [room, player]);

  const currentList = activeTab === 'top5' ? top5 : worst5;
  const setCurrentList = activeTab === 'top5' ? setTop5 : setWorst5;

  // All selected country IDs across both lists
  const selectedIds = new Set([
    ...top5.filter(Boolean).map((c) => c!.id),
    ...worst5.filter(Boolean).map((c) => c!.id),
  ]);

  const isPredictionsOpen = room?.phase === 'predictions_open';
  const isComplete =
    top5.every((c) => c !== null) && worst5.every((c) => c !== null);

  // Add a country to the next empty slot
  const handleAddCountry = useCallback(
    (country: Country) => {
      if (selectedIds.has(country.id)) return;

      setCurrentList((prev) => {
        const nextEmpty = prev.findIndex((c) => c === null);
        if (nextEmpty === -1) return prev;
        const updated = [...prev];
        updated[nextEmpty] = country;
        return updated;
      });
    },
    [selectedIds, setCurrentList],
  );

  // Remove a country from a slot
  const handleRemoveSlot = useCallback(
    (index: number) => {
      setCurrentList((prev) => {
        const updated = [...prev];
        updated[index] = null;
        return updated;
      });
    },
    [setCurrentList],
  );

  // Move a country up in the list
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      setCurrentList((prev) => {
        const updated = [...prev];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        return updated;
      });
    },
    [setCurrentList],
  );

  // Move a country down in the list
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= 4) return;
      setCurrentList((prev) => {
        const updated = [...prev];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        return updated;
      });
    },
    [setCurrentList],
  );

  // Submit predictions
  const handleSubmit = useCallback(async () => {
    if (!room || !player || !isComplete) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertErr } = await supabase.from('predictions').upsert(
        {
          room_id: room.id,
          player_id: player.id,
          top5: top5.map((c) => c!.id),
          worst5: worst5.map((c) => c!.id),
          submitted_at: new Date().toISOString(),
          is_locked: false,
        },
        { onConflict: 'room_id,player_id' },
      );

      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit predictions';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [room, player, top5, worst5, isComplete]);

  if (!room || !player) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/50">{t('common.loading')}</p>
      </div>
    );
  }

  // Show scored results if predictions have been scored
  if (existingPrediction?.scored_at) {
    const t5Countries = existingPrediction.top5.map(id => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
    const w5Countries = existingPrediction.worst5.map(id => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
    const totalPts = (existingPrediction.top5_points ?? 0) + (existingPrediction.worst5_points ?? 0);

    return (
      <div className="flex flex-col h-full px-4 py-2">
        <div className="text-center mb-4">
          <h2 className="glow-text text-xl font-bold mb-1">{t('predictions.title')}</h2>
          <Card className="inline-block">
            <span className="text-sm text-white/50">{t('predictions.totalScore', { points: totalPts })}</span>
          </Card>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-euro-gold mb-2 flex items-center gap-2">
              {t('predictions.top5Tab')} <Badge variant="gold">{existingPrediction.top5_points ?? 0}{t('common.pts')}</Badge>
            </h3>
            <div className="space-y-1">
              {t5Countries.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
                  <span className="w-5 text-xs font-bold text-white/40">{i + 1}</span>
                  <span>{c.flag}</span>
                  <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-euro-pink mb-2 flex items-center gap-2">
              {t('predictions.worst5Tab')} <Badge variant="purple">{existingPrediction.worst5_points ?? 0}{t('common.pts')}</Badge>
            </h3>
            <div className="space-y-1">
              {w5Countries.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
                  <span className="w-5 text-xs font-bold text-white/40">{i + 1}</span>
                  <span>{c.flag}</span>
                  <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Locked state — show what you predicted if available
  if (!isPredictionsOpen && submitted) {
    const t5Countries = top5.filter(Boolean) as Country[];
    const w5Countries = worst5.filter(Boolean) as Country[];

    return (
      <div className="flex flex-col h-full px-4 py-2">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="glow-text text-xl font-bold">{t('predictions.submitted')}</h2>
          <p className="text-white/50 text-sm">{t('predictions.waitingResults')}</p>
        </div>

        {t5Countries.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-euro-gold mb-2">{t('predictions.yourTop5')}</h3>
              <div className="space-y-1">
                {t5Countries.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
                    <span className="w-5 text-xs font-bold text-white/40">{i + 1}</span>
                    <span>{c.flag}</span>
                    <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-euro-pink mb-2">{t('predictions.yourWorst5')}</h3>
              <div className="space-y-1">
                {w5Countries.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
                    <span className="w-5 text-xs font-bold text-white/40">{i + 1}</span>
                    <span>{c.flag}</span>
                    <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isPredictionsOpen) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-bold text-white">{t('predictions.locked')}</h2>
        <p className="text-white/50 text-center text-sm">
          {t('predictions.lockedDesc')}
        </p>
      </div>
    );
  }

  // Loading existing predictions
  if (isLoadingExisting) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-euro-purple border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 text-sm">Loading predictions...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 py-2">
      {/* Title */}
      <h2 className="glow-text text-xl font-bold mb-4 text-center">
        {t('predictions.makePredictions')}
      </h2>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        {(['top5', 'worst5'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer',
              activeTab === tab
                ? 'bg-gradient-to-r from-euro-purple to-euro-pink text-white'
                : 'glass text-white/60',
            )}
          >
            {tab === 'top5' ? t('predictions.top5Tab') : t('predictions.worst5Tab')}
          </button>
        ))}
      </div>

      {/* Prediction slots */}
      <div className="space-y-2 mb-4">
        <AnimatePresence mode="popLayout">
          {currentList.map((country, idx) => (
            <motion.div
              key={`${activeTab}-slot-${idx}`}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              {/* Rank number */}
              <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold text-white/60 flex-shrink-0">
                {idx + 1}
              </span>

              {/* Slot content */}
              {country ? (
                <div className="flex-1 glass rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-lg">{country.flag}</span>
                  <span className="text-white text-sm font-medium flex-1">
                    {getLocalizedCountryName(country)}
                  </span>

                  {/* Reorder buttons */}
                  <button
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    className="text-white/40 hover:text-white disabled:opacity-20 cursor-pointer text-xs px-1"
                  >
                    {'\u25B2'}
                  </button>
                  <button
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === 4}
                    className="text-white/40 hover:text-white disabled:opacity-20 cursor-pointer text-xs px-1"
                  >
                    {'\u25BC'}
                  </button>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemoveSlot(idx)}
                    className="text-euro-red/70 hover:text-euro-red cursor-pointer text-sm px-1"
                  >
                    {'\u2717'}
                  </button>
                </div>
              ) : (
                <div className="flex-1 border-2 border-dashed border-white/10 rounded-xl px-3 py-2 text-white/30 text-sm">
                  {t('predictions.selectCountry')}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Country picker grid */}
      <div className="flex-1 overflow-y-auto">
        <p className="text-xs text-white/40 mb-2 font-medium">
          {t('predictions.selectCountries')}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {COUNTRIES_2026.map((country) => {
            const isSelected = selectedIds.has(country.id);
            return (
              <motion.button
                key={country.id}
                whileTap={isSelected ? {} : { scale: 0.9 }}
                onClick={() => handleAddCountry(country)}
                disabled={isSelected}
                className={clsx(
                  'flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all cursor-pointer',
                  isSelected
                    ? 'opacity-30 cursor-not-allowed bg-white/5'
                    : 'glass hover:bg-white/10 active:bg-white/15',
                )}
              >
                <span className="text-xl">{country.flag}</span>
                <span className="text-[10px] text-white/70 leading-tight truncate w-full">
                  {getLocalizedCountryName(country)}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="pt-4 pb-2">
        <Button
          fullWidth
          disabled={!isComplete}
          loading={isSubmitting}
          onClick={handleSubmit}
        >
          {isComplete ? t('predictions.submitBtn') : t('predictions.fillSlots')}
        </Button>
      </div>

      {error && (
        <p className="text-euro-red text-sm text-center mt-2">{error}</p>
      )}
    </div>
  );
}
