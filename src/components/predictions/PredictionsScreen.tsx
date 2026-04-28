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
  DragOverlay,
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
import type { Country } from '../../lib/types';

const TOP_N = 5;
const WORST_N = 5;

type Zone = 'top' | 'middle' | 'worst';

interface ScoredPrediction {
  top5: string[];
  worst5: string[];
  top5_points: number | null;
  worst5_points: number | null;
  scored_at: string | null;
}

// ── Drag handle icon ─────────────────────────────────────────────────────────
function GripIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
      <circle cx="3" cy="3" r="1.5" /><circle cx="9" cy="3" r="1.5" />
      <circle cx="3" cy="8" r="1.5" /><circle cx="9" cy="8" r="1.5" />
      <circle cx="3" cy="13" r="1.5" /><circle cx="9" cy="13" r="1.5" />
    </svg>
  );
}

// ── Single sortable country row ──────────────────────────────────────────────
interface RowProps { country: Country; position: number; zone: Zone; ghost?: boolean }

function CountryRow({ country, position, zone, ghost }: RowProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 rounded-xl px-3 py-2 select-none',
        zone === 'top'    && 'bg-euro-gold/12 ring-1 ring-euro-gold/35',
        zone === 'worst'  && 'bg-euro-red/12 ring-1 ring-euro-red/35',
        zone === 'middle' && 'bg-white/5 ring-1 ring-white/8',
        ghost             && 'opacity-40',
      )}
    >
      <GripIcon className="text-white/30 flex-shrink-0 w-3 h-4" />

      {/* Position */}
      <span className={clsx(
        'font-mono text-xs font-bold w-6 tabular-nums text-center flex-shrink-0',
        zone === 'top'   && 'text-euro-gold',
        zone === 'worst' && 'text-euro-red',
        zone === 'middle' && 'text-white/40',
      )}>
        {position.toString().padStart(2, '0')}
      </span>

      {/* Flag */}
      <span className="text-xl leading-none flex-shrink-0">{country.flag}</span>

      {/* Name + artist/song */}
      <div className="flex-1 min-w-0">
        <div className={clsx(
          'text-sm font-semibold leading-tight truncate',
          zone === 'top'    && 'text-white',
          zone === 'worst'  && 'text-white',
          zone === 'middle' && 'text-white/80',
        )}>
          {getLocalizedCountryName(country)}
        </div>
        {(country.artist || country.song) && (
          <div className="text-[11px] text-white/45 truncate leading-tight mt-0.5">
            {country.artist}{country.artist && country.song && ' — '}<em>{country.song}</em>
          </div>
        )}
      </div>

      {/* Zone badge */}
      {zone === 'top'   && <span className="text-sm flex-shrink-0">🏆</span>}
      {zone === 'worst' && <span className="text-sm flex-shrink-0">💩</span>}
    </div>
  );
}

function SortableRow({ country, position, zone }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: country.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined }}
      {...attributes}
      {...listeners}
      className={clsx('touch-none', isDragging && 'opacity-0')}
    >
      <CountryRow country={country} position={position} zone={zone} />
    </div>
  );
}

// ── Zone separator label ─────────────────────────────────────────────────────
function ZoneDivider({ label, color }: { label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 py-1 px-1 text-[10px] font-bold uppercase tracking-widest ${color}`}>
      <div className="flex-1 h-px bg-current opacity-30" />
      <span>{label}</span>
      <div className="flex-1 h-px bg-current opacity-30" />
    </div>
  );
}

// ── Results / scored view ────────────────────────────────────────────────────
function ScoredView({ pred }: { pred: ScoredPrediction }) {
  const { t } = useTranslation();
  const totalPts = (pred.top5_points ?? 0) + (pred.worst5_points ?? 0);
  const t5 = pred.top5.map((id) => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
  const w5 = pred.worst5.map((id) => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];

  return (
    <div className="flex flex-col h-full px-4 py-3 gap-4">
      <div className="text-center">
        <div className="text-3xl mb-1">🎯</div>
        <h2 className="glow-text text-xl font-bold">{t('predictions.title')}</h2>
        <p className="text-white/50 text-sm mt-0.5">{t('predictions.totalScore', { points: totalPts })}</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4">
        <div>
          <p className="text-xs font-bold text-euro-gold uppercase tracking-wider mb-2">
            🏆 Top 5 — {pred.top5_points ?? 0} pts
          </p>
          {t5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-euro-gold/10 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-euro-gold w-4">{i + 1}</span>
              <span>{c.flag}</span>
              <span className="text-sm text-white truncate">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-euro-red uppercase tracking-wider mb-2">
            💩 Worst 5 — {pred.worst5_points ?? 0} pts
          </p>
          {w5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-euro-red/10 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-euro-red w-4">{22 + i}</span>
              <span>{c.flag}</span>
              <span className="text-sm text-white truncate">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Submitted (waiting for results) view ────────────────────────────────────
function SubmittedView({ top5, worst5 }: { top5: Country[]; worst5: Country[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full px-4 py-3 gap-4">
      <div className="text-center">
        <div className="text-3xl mb-1">✅</div>
        <h2 className="glow-text text-xl font-bold">{t('predictions.submitted')}</h2>
        <p className="text-white/50 text-sm mt-0.5">{t('predictions.waitingResults')}</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4">
        <div>
          <p className="text-xs font-bold text-euro-gold uppercase tracking-wider mb-2">🏆 {t('predictions.yourTop5')}</p>
          {top5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-euro-gold/10 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-euro-gold w-4">{i + 1}</span>
              <span>{c.flag}</span>
              <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-euro-red uppercase tracking-wider mb-2">💩 {t('predictions.yourWorst5')}</p>
          {worst5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-euro-red/10 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-euro-red w-4">{22 + i}</span>
              <span>{c.flag}</span>
              <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function PredictionsScreen() {
  const { t } = useTranslation();
  const { room, player } = useGameStore();

  const [order, setOrder] = useState<Country[]>(COUNTRIES_2026);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  // Load existing prediction on mount
  useEffect(() => {
    if (!room || !player) { setIsLoadingExisting(false); return; }
    supabase
      .from('predictions')
      .select('top5, worst5, top5_points, worst5_points, scored_at')
      .eq('room_id', room.id)
      .eq('player_id', player.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingPrediction(data as ScoredPrediction);
          const t5 = (data.top5 as string[]).map((id) => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
          const w5 = (data.worst5 as string[]).map((id) => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
          const used = new Set([...t5.map((c) => c.id), ...w5.map((c) => c.id)]);
          const middle = COUNTRIES_2026.filter((c) => !used.has(c.id));
          setOrder([...t5, ...middle, ...w5]);
          if (data.scored_at || (t5.length === TOP_N && w5.length === WORST_N)) setSubmitted(true);
        }
        setIsLoadingExisting(false);
      })
      .catch(() => setIsLoadingExisting(false));
  }, [room?.id, player?.id]);

  const isPredictionsOpen = room?.phase === 'predictions_open';

  // Zone helper
  const getZone = useCallback((idx: number): Zone => {
    if (idx < TOP_N) return 'top';
    if (idx >= order.length - WORST_N) return 'worst';
    return 'middle';
  }, [order.length]);

  const zones = useMemo(() => order.map((_, i) => getZone(i)), [order, getZone]);

  // Drag handlers
  const handleDragStart = useCallback(({ active }: { active: { id: string } }) => {
    setActiveId(active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((items) => {
      const from = items.findIndex((c) => c.id === active.id);
      const to = items.findIndex((c) => c.id === over.id);
      return from === -1 || to === -1 ? items : arrayMove(items, from, to);
    });
  }, []);

  // Toolbar
  const sortAZ = () => setOrder((p) => [...p].sort((a, b) =>
    getLocalizedCountryName(a).localeCompare(getLocalizedCountryName(b))));
  const sortZA = () => setOrder((p) => [...p].sort((a, b) =>
    getLocalizedCountryName(b).localeCompare(getLocalizedCountryName(a))));
  const shuffleOrder = () => setOrder((p) => {
    const a = [...p];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  });
  const reset = () => setOrder(COUNTRIES_2026);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!room || !player || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const top5 = order.slice(0, TOP_N).map((c) => c.id);
      const worst5 = order.slice(-WORST_N).map((c) => c.id);
      const { error: err } = await supabase.from('predictions').upsert(
        { room_id: room.id, player_id: player.id, top5, worst5, submitted_at: new Date().toISOString(), is_locked: false },
        { onConflict: 'room_id,player_id' },
      );
      if (err) throw err;
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }, [room, player, order, isSubmitting]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!room || !player || isLoadingExisting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-euro-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Scored ───────────────────────────────────────────────────────────────
  if (existingPrediction?.scored_at) {
    return <ScoredView pred={existingPrediction} />;
  }

  // ── Submitted, waiting ───────────────────────────────────────────────────
  if (submitted && !isPredictionsOpen) {
    return <SubmittedView top5={order.slice(0, TOP_N)} worst5={order.slice(-WORST_N)} />;
  }

  // ── Locked (phase not open yet) ──────────────────────────────────────────
  if (!isPredictionsOpen && !submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 px-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-bold text-white">{t('predictions.locked')}</h2>
        <p className="text-white/50 text-center text-sm">{t('predictions.lockedDesc')}</p>
      </div>
    );
  }

  // ── Active drag overlay country ──────────────────────────────────────────
  const dragCountry = activeId ? order.find((c) => c.id === activeId) : null;
  const dragIdx = activeId ? order.findIndex((c) => c.id === activeId) : -1;

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div>
          <h2 className="text-base font-bold text-white leading-tight">
            {t('predictions.participantsHeader', { count: order.length })}
          </h2>
          <p className="text-[10px] text-white/40 mt-0.5">
            {t('predictions.dragHint', { defaultValue: 'Long-press ⠿ handle to drag' })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[
            { fn: sortAZ,       label: 'A↓', title: 'Sort A–Z' },
            { fn: sortZA,       label: 'Z↓', title: 'Sort Z–A' },
            { fn: shuffleOrder, label: '🔀', title: 'Shuffle' },
            { fn: reset,        label: '↺',  title: 'Reset' },
          ].map(({ fn, label, title }) => (
            <button
              key={title}
              onClick={fn}
              title={title}
              aria-label={title}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-white/60 transition-colors text-xs font-bold"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable list ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {order.map((country, idx) => {
                const zone = zones[idx];
                const prevZone = idx > 0 ? zones[idx - 1] : null;
                const showDivider = prevZone !== null && prevZone !== zone;

                return (
                  <div key={country.id}>
                    {showDivider && zone === 'middle' && (
                      <ZoneDivider label="Middle · no points" color="text-white/30" />
                    )}
                    {showDivider && zone === 'worst' && (
                      <ZoneDivider label="Worst 5 · 💩" color="text-euro-red/70" />
                    )}
                    {idx === 0 && (
                      <ZoneDivider label="Top 5 · 🏆" color="text-euro-gold/70" />
                    )}
                    <SortableRow country={country} position={idx + 1} zone={zone} />
                  </div>
                );
              })}
            </div>
          </SortableContext>

          {/* Drag overlay — follows cursor/finger */}
          <DragOverlay>
            {dragCountry && dragIdx !== -1 && (
              <div className="shadow-2xl rotate-1 scale-105">
                <CountryRow
                  country={dragCountry}
                  position={dragIdx + 1}
                  zone={zones[dragIdx] ?? 'middle'}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Sticky bottom: preview strip + submit ───────────────────────── */}
      <div className="shrink-0 px-4 pt-2 pb-3 border-t border-white/8 bg-[#0f0520]/80 backdrop-blur">
        {/* Mini preview of top5 and worst5 */}
        <div className="flex items-center gap-2 mb-2.5 text-xs">
          <span className="text-euro-gold font-semibold shrink-0">🏆</span>
          <div className="flex gap-1 flex-1 min-w-0 overflow-hidden">
            {order.slice(0, TOP_N).map((c) => (
              <span key={c.id} title={c.name} className="text-base leading-none">{c.flag}</span>
            ))}
          </div>
          <span className="text-white/20 mx-1">|</span>
          <span className="text-euro-red font-semibold shrink-0">💩</span>
          <div className="flex gap-1 flex-1 min-w-0 overflow-hidden">
            {order.slice(-WORST_N).map((c) => (
              <span key={c.id} title={c.name} className="text-base leading-none">{c.flag}</span>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl font-bold text-sm text-white
            bg-gradient-to-r from-euro-purple to-euro-pink
            active:scale-[0.98] transition-transform
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? '...'
            : submitted
              ? t('predictions.updateBtn', { defaultValue: '✅ Update Predictions' })
              : t('predictions.submitBtn', { defaultValue: '🎯 Submit Predictions' })}
        </button>

        {error && <p className="text-euro-red text-xs text-center mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
