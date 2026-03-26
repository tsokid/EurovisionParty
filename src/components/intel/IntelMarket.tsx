import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { INTEL_COSTS } from '../../lib/constants';
import { COUNTRY_MAP } from '../../lib/countries2026';
import { getLocalizedCountryName } from '../../lib/countryLocale';
import { supabase } from '../../lib/supabase';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import type { IntelRevealType } from '../../lib/types';

interface IntelCard {
  type: IntelRevealType;
  titleKey: string;
  descKey: string;
  icon: string;
  cost: number;
}

const INTEL_CARDS: IntelCard[] = [
  {
    type: 'top3',
    titleKey: 'intel.top3Title',
    descKey: 'intel.top3Desc',
    icon: '\uD83E\uDD47',
    cost: INTEL_COSTS.top3,
  },
  {
    type: 'top10',
    titleKey: 'intel.top10Title',
    descKey: 'intel.top10Desc',
    icon: '\uD83D\uDD1F',
    cost: INTEL_COSTS.top10,
  },
  {
    type: 'worst3',
    titleKey: 'intel.worst3Title',
    descKey: 'intel.worst3Desc',
    icon: '\uD83D\uDCA3',
    cost: INTEL_COSTS.worst3,
  },
];

export default function IntelMarket() {
  const { t } = useTranslation();
  const { room, player } = useGameStore();
  const [purchased, setPurchased] = useState<Set<IntelRevealType>>(new Set());
  const [revealedData, setRevealedData] = useState<
    Record<IntelRevealType, string[] | null>
  >({ top3: null, top10: null, worst3: null });
  const [flipped, setFlipped] = useState<Set<IntelRevealType>>(new Set());
  const [purchasing, setPurchasing] = useState<IntelRevealType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadedRef = useRef(false);

  // Load existing purchases on mount
  useEffect(() => {
    if (!room || !player || loadedRef.current) return;
    loadedRef.current = true;

    supabase.from('intel_reveals')
      .select('reveal_type')
      .eq('room_id', room.id)
      .eq('player_id', player.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const types = new Set(data.map(d => d.reveal_type as IntelRevealType));
          setPurchased(types);
          setFlipped(types);
          // Load reveal data for each purchased type
          for (const type of types) {
            supabase.rpc('get_intel_reveal', { p_room_id: room.id, p_reveal_type: type })
              .then(({ data: revealResult }) => {
                if (revealResult?.available) {
                  const countryCodes = revealResult.data as string[];
                  const revealed = countryCodes.map((code: string, i: number) => {
                    const c = COUNTRY_MAP.get(code);
                    return c ? `${i + 1}. ${c.flag} ${getLocalizedCountryName(c)}` : `${i + 1}. ${code}`;
                  });
                  setRevealedData(prev => ({ ...prev, [type]: revealed }));
                } else {
                  setRevealedData(prev => ({ ...prev, [type]: [t('intel.notEntered')] }));
                }
              });
          }
        }
      });
  }, [room, player]);

  // total_points is already GENERATED AS (quiz + pred + duel - points_spent), so use it directly
  const availablePoints = player?.total_points ?? 0;

  const handleBuy = useCallback(
    async (card: IntelCard) => {
      if (!room || !player) return;
      if (purchased.has(card.type)) return;
      if (availablePoints < card.cost) return;

      setPurchasing(card.type);
      setError(null);

      try {
        // Atomic purchase: insert reveal + deduct points in one RPC
        const { data: revealResult, error: rpcErr } = await supabase.rpc('purchase_intel', {
          p_room_id: room.id,
          p_player_id: player.id,
          p_reveal_type: card.type,
          p_cost: card.cost,
        });

        if (rpcErr) throw rpcErr;

        setPurchased((prev) => new Set(prev).add(card.type));

        // Update local player state (#26 fix)
        useGameStore.getState().updatePlayer({ points_spent: (player.points_spent ?? 0) + card.cost });

        // Animate flip after a short delay
        setTimeout(() => {
          setFlipped((prev) => new Set(prev).add(card.type));
        }, 300);

        // Parse reveal data
        if (revealResult?.available) {
          const countryCodes = revealResult.data as string[];
          const revealed = countryCodes.map((code: string, i: number) => {
            const c = COUNTRY_MAP.get(code);
            return c ? `${i + 1}. ${c.flag} ${getLocalizedCountryName(c)}` : `${i + 1}. ${code}`;
          });
          setRevealedData((prev) => ({ ...prev, [card.type]: revealed }));
        } else {
          setRevealedData((prev) => ({
            ...prev,
            [card.type]: [t('intel.notEntered')],
          }));
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Purchase failed';
        setError(message);
      } finally {
        setPurchasing(null);
      }
    },
    [room, player, purchased, availablePoints],
  );

  if (!room || !player) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/50">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 py-2">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="glow-text text-xl font-bold mb-1">
          {t('intel.title')}
        </h2>
        <p className="text-white/50 text-sm">
          {t('intel.subtitle')}
        </p>
      </div>

      {/* Available points */}
      <div className="glass rounded-xl px-4 py-2 mb-4 flex items-center justify-between">
        <span className="text-white/60 text-sm">{t('intel.availablePoints')}</span>
        <span className="text-euro-gold font-bold text-lg tabular-nums">
          {availablePoints}
        </span>
      </div>

      {/* Intel cards */}
      <div className="flex-1 space-y-4">
        {INTEL_CARDS.map((card) => {
          const isPurchased = purchased.has(card.type);
          const isFlipped = flipped.has(card.type);
          const canAfford = availablePoints >= card.cost;
          const isBuying = purchasing === card.type;

          return (
            <motion.div
              key={card.type}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AnimatePresence mode="wait">
                {!isFlipped ? (
                  /* Front of card */
                  <motion.div
                    key={`front-${card.type}`}
                    exit={{ rotateY: 90, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      variant="strong"
                      className={clsx(
                        'relative overflow-hidden',
                        isPurchased && 'ring-2 ring-euro-gold/50',
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="text-4xl flex-shrink-0">{card.icon}</div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-bold text-base">
                              {t(card.titleKey)}
                            </h3>
                            <Badge variant="gold">{card.cost} {t('common.pts')}</Badge>
                          </div>
                          <p className="text-white/50 text-sm mb-3">
                            {t(card.descKey)}
                          </p>
                          <Button
                            size="sm"
                            disabled={!canAfford || isPurchased}
                            loading={isBuying}
                            onClick={() => handleBuy(card)}
                          >
                            {isPurchased
                              ? t('intel.purchasedBtn')
                              : canAfford
                                ? t('intel.buyBtn')
                                : t('intel.notEnough')}
                          </Button>
                        </div>
                      </div>

                      {/* Decorative corner */}
                      {isPurchased && (
                        <div className="absolute top-2 right-2 text-euro-gold text-sm">
                          {'\u2713'}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                ) : (
                  /* Back of card (revealed data) */
                  <motion.div
                    key={`back-${card.type}`}
                    initial={{ rotateY: -90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      variant="strong"
                      glow
                      className="border border-euro-gold/30"
                    >
                      <div className="text-center">
                        <span className="text-3xl">{card.icon}</span>
                        <h3 className="text-white font-bold mt-2 mb-3">
                          {t(card.titleKey)}
                        </h3>

                        {revealedData[card.type] ? (
                          <div className="space-y-1">
                            {revealedData[card.type]!.map((item, idx) => (
                              <div
                                key={idx}
                                className="glass rounded-lg px-3 py-1.5 text-white text-sm"
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/50 text-sm">
                            {t('intel.loadingReveal')}
                          </p>
                        )}

                        <p className="text-euro-gold/60 text-xs mt-3">
                          {t('intel.purchasedFor', { cost: card.cost })}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-euro-red text-sm text-center mt-4"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
