import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { COUNTRIES_2026, COUNTRY_MAP } from '../../lib/countries2026';
import { getLocalizedCountryName } from '../../lib/countryLocale';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import type { Country } from '../../lib/types';

const TOP_5 = 5;
const WORST_5 = 5;

interface ScoredPrediction {
  top5: string[];
  worst5: string[];
  top5_points: number | null;
  worst5_points: number | null;
  scored_at: string | null;
}

// ──────────────────────────────────────────────────────────────────────────
// SortableRow — one country card in the rankable list
// ──────────────────────────────────────────────────────────────────────────

interface SortableRowProps {
  country: Country;
  position: number; // 1-based
  zone: 'top' | 'middle' | 'worst';
}

function SortableRow({ country, position, zone }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: country.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const zoneClasses = clsx(
    'flex items-center gap-3 rounded-xl px-3 py-2.5 select-none',
    zone === 'top' && 'bg-euro-gold/15 ring-1 ring-euro-gold/40',
    zone === 'worst' && 'bg-euro-red/15 ring-1 ring-euro-red/40',
    zone === 'middle' && 'bg-white/5 ring-1 ring-white/10',
    isDragging && 'shadow-2xl scale-[1.02] ring-2 ring-euro-purple-light',
  );

  return (
    <div ref={setNodeRef} style={style} className={zoneClasses}>
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-white/40 hover:text-white/80 select-none px-1"
        aria-label={`Reorder ${country.name}`}
      >
        ⋮⋮
      </button>

      {/* Position number */}
      <span className="font-mono text-sm font-bold text-white/60 w-7 tabular-nums">
        {position.toString().padStart(2, '0')}
      </span>

      {/* Flag */}
      <span className="text-2xl leading-none flex-shrink-0">{country.flag}</span>

      {/* Country + artist + song */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">
          {getLocalizedCountryName(country)}
        </div>
        {(country.artist || country.song) && (
          <div className="text-xs text-white/50 truncate">
            {country.artist}
            {country.artist && country.song && ' — '}
            <span className="italic">{country.song}</span>
          </div>
        )}
      </div>

      {/* Zone badge */}
      {zone === 'top' && (
        <span className="text-xs font-bold text-euro-gold flex-shrink-0">🏆</span>
      )}
      {zone === 'worst' && (
        <span className="text-xs font-bold text-euro-red flex-shrink-0">💩</span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────────────────

export default function PredictionsScreen() {
  const { t } = useTranslation();
  const { room, player } = useGameStore();

  const [order, setOrder] = useState<Country[]>(COUNTRIES_2026);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPrediction, setExistingPrediction] = useState<ScoredPrediction | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load existing predictions on mount — restore previous top5/worst5 to their positions
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
          // Reconstruct ranked order: top5 first, then unranked middle, then worst5
          const t5 = (data.top5 as string[])
            .map((id) => COUNTRY_MAP.get(id))
            .filter(Boolean) as Country[];
          const w5 = (data.worst5 as string[])
            .map((id) => COUNTRY_MAP.get(id))
            .filter(Boolean) as Country[];
          const usedIds = new Set([...t5.map((c) => c.id), ...w5.map((c) => c.id)]);
          const middle = COUNTRIES_2026.filter((c) => !usedIds.has(c.id));
          setOrder([...t5, ...middle, ...w5]);
          if (data.scored_at || (t5.length === TOP_5 && w5.length === WORST_5)) {
            setSubmitted(true);
          }
        }
      })
      .then(() => setIsLoadingExisting(false), () => setIsLoadingExisting(false));
  }, [room, player]);

  const isPredictionsOpen = room?.phase === 'predictions_open';

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((items) => {
      const oldIndex = items.findIndex((c) => c.id === active.id);
      const newIndex = items.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  // Toolbar: A-Z, Z-A, shuffle, reset
  const sortAZ = () => setOrder((prev) => [...prev].sort((a, b) =>
    getLocalizedCountryName(a).localeCompare(getLocalizedCountryName(b)),
  ));
  const sortZA = () => setOrder((prev) => [...prev].sort((a, b) =>
    getLocalizedCountryName(b).localeCompare(getLocalizedCountryName(a)),
  ));
  const shuffle = () => setOrder((prev) => {
    const arr = [...prev];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const reset = () => setOrder(COUNTRIES_2026);

  const handleSubmit = useCallback(async () => {
    if (!room || !player) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const top5 = order.slice(0, TOP_5).map((c) => c.id);
      const worst5 = order.slice(-WORST_5).map((c) => c.id);
      const { error: upsertErr } = await supabase.from('predictions').upsert(
        {
          room_id: room.id,
          player_id: player.id,
          top5,
          worst5,
          submitted_at: new Date().toISOString(),
          is_locked: false,
        },
        { onConflict: 'room_id,player_id' },
      );
      if (upsertErr) throw upsertErr;
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit predictions');
    } finally {
      setIsSubmitting(false);
    }
  }, [room, player, order]);

  // Memoise zone for each item so SortableRow re-renders cheaply
  const itemZones = useMemo(() => {
    const total = order.length;
    return order.map<SortableRowProps['zone']>((_, idx) => {
      if (idx < TOP_5) return 'top';
      if (idx >= total - WORST_5) return 'worst';
      return 'middle';
    });
  }, [order]);

  // ── Loading / locked / scored states ────────────────────────────────────

  if (!room || !player) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/50">{t('common.loading')}</p>
      </div>
    );
  }

  if (existingPrediction?.scored_at) {
    const t5 = existingPrediction.top5.map((id) => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
    const w5 = existingPrediction.worst5.map((id) => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
    const totalPts = (existingPrediction.top5_points ?? 0) + (existingPrediction.worst5_points ?? 0);
    return (
      <div className="flex flex-col h-full px-4 py-2">
        <div className="text-center mb-4">
          <h2 className="glow-text text-xl font-bold mb-1">{t('predictions.title')}</h2>
          <Card className="inline-block">
            <span className="text-sm text-white/60">{t('predictions.totalScore', { points: totalPts })}</span>
          </Card>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-euro-gold mb-2 flex items-center gap-2">
              {t('predictions.top5Tab')} <Badge variant="gold">{existingPrediction.top5_points ?? 0}{t('common.pts')}</Badge>
            </h3>
            <div className="space-y-1">
              {t5.map((c, i) => (
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
              {w5.map((c, i) => (
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

  if (!isPredictionsOpen && submitted) {
    const t5 = order.slice(0, TOP_5);
    const w5 = order.slice(-WORST_5);
    return (
      <div className="flex flex-col h-full px-4 py-2">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="glow-text text-xl font-bold">{t('predictions.submitted')}</h2>
          <p className="text-white/50 text-sm">{t('predictions.waitingResults')}</p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-euro-gold mb-2">{t('predictions.yourTop5')}</h3>
            <div className="space-y-1">
              {t5.map((c, i) => (
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
              {w5.map((c, i) => (
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

  if (!isPredictionsOpen) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-bold text-white">{t('predictions.locked')}</h2>
        <p className="text-white/50 text-center text-sm">{t('predictions.lockedDesc')}</p>
      </div>
    );
  }

  if (isLoadingExisting) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-euro-purple border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  // ── Main draggable list ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-4 py-2">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-white">
            {t('predictions.participantsHeader', { count: order.length })}
          </h2>
          <p className="text-xs text-white/50">
            {t('predictions.dragHint', { defaultValue: 'Drag and drop to reorder' })}
          </p>
        </div>
        {/* Toolbar */}
        <div className="flex items-center gap-1">
          <button
            onClick={sortAZ}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition-colors"
            aria-label="Sort A-Z"
            title="A-Z"
          >
            <span className="text-xs font-bold">A↓</span>
          </button>
          <button
            onClick={sortZA}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition-colors"
            aria-label="Sort Z-A"
            title="Z-A"
          >
            <span className="text-xs font-bold">Z↓</span>
          </button>
          <button
            onClick={shuffle}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition-colors"
            aria-label="Shuffle"
            title="Shuffle"
          >
            🔀
          </button>
          <button
            onClick={reset}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition-colors"
            aria-label="Reset"
            title="Reset to original"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Zone legend */}
      <div className="flex items-center gap-3 text-[10px] text-white/50 mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-euro-gold" /> 1-5 Top 5</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/40" /> Middle</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-euro-red" /> Worst 5</span>
      </div>

      {/* Draggable list */}
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 pb-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {order.map((country, idx) => (
                <SortableRow
                  key={country.id}
                  country={country}
                  position={idx + 1}
                  zone={itemZones[idx]}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Submit */}
      <div className="pt-3 pb-2">
        <Button fullWidth loading={isSubmitting} onClick={handleSubmit}>
          {t('predictions.submitBtn')}
        </Button>
      </div>

      {error && <p className="text-euro-red text-sm text-center mt-2">{error}</p>}
    </div>
  );
}
