import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
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
const N = COUNTRIES_2026.length;

interface ScoredPrediction {
  top5: string[];
  worst5: string[];
  top5_points: number | null;
  worst5_points: number | null;
  scored_at: string | null;
}

// ── Ordinal helper ──────────────────────────────────────────────────────────
function ord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Rectangular flag image (replaces HeartFlag — user requested) ────────────
function FlagImg({ id, size = 40, className }: { id: string; size?: number; className?: string }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${id.toLowerCase()}.png`}
      alt=""
      loading="lazy"
      width={size}
      height={Math.round(size * 0.75)}
      className={clsx('object-cover rounded-[3px] flex-shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.5)]', className)}
      style={{ width: size, height: Math.round(size * 0.75) }}
      onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
    />
  );
}

// ── Slot row (inside zone panel) ────────────────────────────────────────────
interface SlotRowProps {
  id: string;
  pos: number;
  zone: 'top' | 'worst';
  onRemove: () => void;
  ghost?: boolean;
}
function SlotRow({ id, pos, zone, onRemove, ghost }: SlotRowProps) {
  const c = COUNTRY_MAP.get(id);
  if (!c) return null;
  const label = ord(pos);
  return (
    <div className={clsx(
      'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border select-none',
      zone === 'top'
        ? 'bg-[rgba(255,209,102,0.1)] border-[rgba(255,209,102,0.4)]'
        : 'bg-[rgba(255,77,109,0.1)] border-[rgba(255,77,109,0.4)]',
      ghost && 'opacity-0',
    )}>
      <span className={clsx(
        'font-black text-[1.1rem] leading-none w-9 text-right shrink-0 tabular-nums',
        zone === 'top' ? 'text-[#FFD166]' : 'text-[#FF4D6D]',
      )}>{label}</span>
      <FlagImg id={id} size={26} />
      <span className="text-[12px] font-bold text-white flex-1 truncate">{getLocalizedCountryName(c)}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="w-5 h-5 rounded-full bg-white/10 hover:bg-red-400/40 flex items-center justify-center text-white/40 hover:text-white transition-colors text-[10px] shrink-0"
        aria-label={`Remove from ${label} place`}
      >✕</button>
    </div>
  );
}

function SortableSlot(props: SlotRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <SlotRow {...props} ghost={isDragging} />
    </div>
  );
}

// ── Zone panel (Top 5 / Worst 5) ────────────────────────────────────────────
interface ZonePanelProps {
  zone: 'top' | 'worst';
  picks: string[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (id: string) => void;
  onPlaceSelected: (slotIndex: number) => void;
  hasSelection: boolean;
  activeId: string | null;
}
function ZonePanel({ zone, picks, onReorder, onRemove, onPlaceSelected, hasSelection, activeId }: ZonePanelProps) {
  const isTop = zone === 'top';
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = picks.indexOf(active.id as string);
    const to = picks.indexOf(over.id as string);
    if (from !== -1 && to !== -1) onReorder(arrayMove(picks, from, to));
  };

  // Slot label calculator
  const labelFor = (i: number) => isTop ? ord(i + 1) : ord(N - WORST_N + 1 + i);

  return (
    <div className={clsx(
      'rounded-2xl border overflow-hidden flex flex-col h-full',
      'bg-[rgba(18,8,40,0.65)] backdrop-blur-md',
      isTop ? 'border-[rgba(255,209,102,0.25)]' : 'border-[rgba(255,77,109,0.25)]',
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3.5 pt-3 pb-2.5 border-b shrink-0',
        isTop ? 'border-[rgba(255,209,102,0.15)]' : 'border-[rgba(255,77,109,0.15)]',
      )}>
        <div className="text-lg leading-none mb-0.5">{isTop ? '🏆' : '💀'}</div>
        <h3 className={clsx(
          'font-black text-base uppercase tracking-wider leading-none',
          isTop ? 'text-[#FFD166]' : 'text-[#FF4D6D]',
        )}>
          {isTop ? 'Top 5' : 'Worst 5'}
        </h3>
        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
          {isTop ? 'Best finish' : 'Last place'}
        </p>
        <p className="text-[11px] font-semibold text-white/55 mt-1.5 tabular-nums">
          {picks.length} / {isTop ? TOP_N : WORST_N} placed
        </p>
      </div>

      {/* Slots */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={picks} strategy={verticalListSortingStrategy}>
            {picks.map((id, i) => (
              <SortableSlot
                key={id} id={id}
                pos={isTop ? i + 1 : N - WORST_N + 1 + i}
                zone={zone}
                onRemove={() => onRemove(id)}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeId && picks.includes(activeId) && (
              <div className="shadow-xl rotate-1 scale-105 opacity-95">
                <SlotRow
                  id={activeId}
                  pos={isTop ? picks.indexOf(activeId) + 1 : N - WORST_N + 1 + picks.indexOf(activeId)}
                  zone={zone} onRemove={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Empty placeholder slots — clickable when a tile is selected */}
        {Array.from({ length: (isTop ? TOP_N : WORST_N) - picks.length }).map((_, i) => {
          const slotIndex = picks.length + i;
          const label = labelFor(slotIndex);
          return (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => hasSelection && onPlaceSelected(slotIndex)}
              disabled={!hasSelection}
              aria-label={`${label} place — empty${hasSelection ? ', click to place' : ''}`}
              className={clsx(
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-[1.5px] border-dashed transition-all',
                'min-h-[40px]',
                isTop ? 'border-[rgba(255,209,102,0.25)]' : 'border-[rgba(255,77,109,0.25)]',
                hasSelection && (isTop
                  ? 'cursor-pointer hover:bg-[rgba(255,209,102,0.1)] hover:border-[#FFD166] hover:scale-[1.02]'
                  : 'cursor-pointer hover:bg-[rgba(255,77,109,0.1)] hover:border-[#FF4D6D] hover:scale-[1.02]'),
                !hasSelection && 'cursor-default',
              )}
            >
              <span className={clsx(
                'font-black text-[1.1rem] leading-none w-9 text-right shrink-0 tabular-nums opacity-60',
                isTop ? 'text-[#FFD166]' : 'text-[#FF4D6D]',
              )}>{label}</span>
              <span className="text-[10px] text-white/30 italic">tap a country →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Country tile (pool) — large vertical stack ──────────────────────────────
interface CountryTileProps {
  country: Country;
  rank: { kind: 'top' | 'worst'; label: string } | null;
  selected: boolean;
  onClick: () => void;
}
function CountryTile({ country, rank, selected, onClick }: CountryTileProps) {
  const ranked = !!rank;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group relative flex items-center gap-3 px-3.5 py-3 pr-10 rounded-xl border text-left transition-all',
        'min-h-[88px] w-full overflow-hidden',
        'cursor-pointer select-none',
        !ranked && !selected && 'bg-white/[0.048] border-white/10 hover:bg-white/[0.09] hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
        selected && 'bg-purple-500/25 border-purple-400 shadow-[0_0_0_2px_rgba(155,89,244,0.3),0_8px_24px_rgba(0,0,0,0.4)]',
        ranked && !selected && 'bg-white/[0.048] border-white/10 opacity-40 hover:opacity-75',
      )}
    >
      <FlagImg id={country.id} size={44} />
      <div className="flex-1 min-w-0">
        <div className="font-black text-[1.05rem] tracking-wide leading-tight text-white truncate">
          {getLocalizedCountryName(country)}
        </div>
        <div className="text-[0.85rem] font-medium text-white/70 truncate mt-0.5">
          {country.artist}
        </div>
        <div className="text-[0.78rem] font-light text-white/55 italic truncate mt-0.5">
          {country.song}
        </div>
      </div>
      {/* Position badge */}
      {rank && (
        <span className={clsx(
          'absolute top-1.5 right-1.5 font-black text-[0.85rem] px-1.5 py-0.5 rounded leading-tight',
          rank.kind === 'top'
            ? 'bg-[rgba(255,209,102,0.15)] text-[#FFD166] border border-[rgba(255,209,102,0.4)]'
            : 'bg-[rgba(255,77,109,0.15)] text-[#FF4D6D] border border-[rgba(255,77,109,0.4)]',
        )}>{rank.label}</span>
      )}
    </button>
  );
}

// ── Scored / submitted views ─────────────────────────────────────────────────
function ScoredView({ pred }: { pred: ScoredPrediction }) {
  const { t } = useTranslation();
  const totalPts = (pred.top5_points ?? 0) + (pred.worst5_points ?? 0);
  const t5 = pred.top5.map((id) => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
  const w5 = pred.worst5.map((id) => COUNTRY_MAP.get(id)).filter(Boolean) as Country[];
  return (
    <div className="flex flex-col h-full px-4 py-3 gap-4">
      <div className="text-center">
        <div className="text-3xl mb-1">🎯</div>
        <h2 className="text-xl font-bold text-white">{t('predictions.title')}</h2>
        <p className="text-white/50 text-sm mt-0.5">{t('predictions.totalScore', { points: totalPts })}</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4">
        <div>
          <p className="text-xs font-bold text-[#FFD166] uppercase tracking-wider mb-2">🏆 Top 5 — {pred.top5_points ?? 0} pts</p>
          {t5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-[rgba(255,209,102,0.1)] rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-[#FFD166] w-9 text-right">{ord(i + 1)}</span>
              <FlagImg id={c.id} size={22} />
              <span className="text-sm text-white truncate">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-[#FF4D6D] uppercase tracking-wider mb-2">💀 Worst 5 — {pred.worst5_points ?? 0} pts</p>
          {w5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-[rgba(255,77,109,0.1)] rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-[#FF4D6D] w-9 text-right">{ord(N - WORST_N + 1 + i)}</span>
              <FlagImg id={c.id} size={22} />
              <span className="text-sm text-white truncate">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubmittedView({ top5, worst5 }: { top5: Country[]; worst5: Country[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full px-4 py-3 gap-4">
      <div className="text-center">
        <div className="text-3xl mb-1">✅</div>
        <h2 className="text-xl font-bold text-white">{t('predictions.submitted')}</h2>
        <p className="text-white/50 text-sm mt-0.5">{t('predictions.waitingResults')}</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4">
        <div>
          <p className="text-xs font-bold text-[#FFD166] uppercase tracking-wider mb-2">🏆 {t('predictions.yourTop5')}</p>
          {top5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-[rgba(255,209,102,0.1)] rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-[#FFD166] w-9 text-right">{ord(i + 1)}</span>
              <FlagImg id={c.id} size={22} />
              <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-[#FF4D6D] uppercase tracking-wider mb-2">💀 {t('predictions.yourWorst5')}</p>
          {worst5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-[rgba(255,77,109,0.1)] rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-[#FF4D6D] w-9 text-right">{ord(N - WORST_N + 1 + i)}</span>
              <FlagImg id={c.id} size={22} />
              <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PredictionsScreen() {
  const { t } = useTranslation();
  const { room, player } = useGameStore();

  const [top5, setTop5] = useState<string[]>([]);
  const [worst5, setWorst5] = useState<string[]>([]);
  const [activeId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [poolSort, setPoolSort] = useState<'az' | 'za' | 'default'>('az');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPrediction, setExistingPrediction] = useState<ScoredPrediction | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // Escape clears selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load existing prediction
  useEffect(() => {
    if (!room || !player) { setIsLoadingExisting(false); return; }
    supabase
      .from('predictions')
      .select('top5, worst5, top5_points, worst5_points, scored_at')
      .eq('room_id', room.id)
      .eq('player_id', player.id)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (data) {
            setExistingPrediction(data as ScoredPrediction);
            setTop5(data.top5 as string[]);
            setWorst5(data.worst5 as string[]);
            if (data.scored_at || ((data.top5 as string[]).length === TOP_N && (data.worst5 as string[]).length === WORST_N)) {
              setSubmitted(true);
            }
          }
          setIsLoadingExisting(false);
        },
        () => setIsLoadingExisting(false),
      );
  }, [room?.id, player?.id]);

  const isPredictionsOpen = room?.phase === 'predictions_open';

  // Pool — sorted (filters removed per redesign)
  const pool = (() => {
    const list = [...COUNTRIES_2026];
    if (poolSort === 'az') list.sort((a, b) => getLocalizedCountryName(a).localeCompare(getLocalizedCountryName(b)));
    if (poolSort === 'za') list.sort((a, b) => getLocalizedCountryName(b).localeCompare(getLocalizedCountryName(a)));
    return list;
  })();

  const getRank = (id: string): { kind: 'top' | 'worst'; label: string } | null => {
    const ti = top5.indexOf(id);
    if (ti !== -1) return { kind: 'top', label: ord(ti + 1) };
    const wi = worst5.indexOf(id);
    if (wi !== -1) return { kind: 'worst', label: ord(N - WORST_N + 1 + wi) };
    return null;
  };

  // Tile click — toggle selection (or unrank if already ranked)
  const handleTileClick = useCallback((id: string) => {
    // If already ranked, unrank (free up the slot)
    if (top5.includes(id))   { setTop5((p) => p.filter((x) => x !== id)); setSelectedId(null); return; }
    if (worst5.includes(id)) { setWorst5((p) => p.filter((x) => x !== id)); setSelectedId(null); return; }
    // Otherwise toggle selection
    setSelectedId((prev) => prev === id ? null : id);
  }, [top5, worst5]);

  // Place selected tile into a specific slot
  const handlePlace = useCallback((zone: 'top' | 'worst', slotIndex: number) => {
    if (!selectedId) return;
    if (zone === 'top') {
      setTop5((p) => {
        const next = [...p];
        // Remove from worst5 if present (mutual exclusion)
        setWorst5((w) => w.filter((x) => x !== selectedId));
        // Insert at slotIndex (if slotIndex > current length, append)
        if (slotIndex >= next.length) next.push(selectedId);
        else next.splice(slotIndex, 0, selectedId);
        return next.slice(0, TOP_N);
      });
    } else {
      setWorst5((p) => {
        const next = [...p];
        setTop5((t) => t.filter((x) => x !== selectedId));
        if (slotIndex >= next.length) next.push(selectedId);
        else next.splice(slotIndex, 0, selectedId);
        return next.slice(0, WORST_N);
      });
    }
    setSelectedId(null);
  }, [selectedId]);

  const handleSubmit = useCallback(async () => {
    if (!room || !player || isSubmitting) return;
    setIsSubmitting(true); setError(null);
    try {
      const { error: err } = await supabase.from('predictions').upsert(
        { room_id: room.id, player_id: player.id, top5, worst5, submitted_at: new Date().toISOString(), is_locked: false },
        { onConflict: 'room_id,player_id' },
      );
      if (err) throw err;
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.failedPredictions'));
    } finally { setIsSubmitting(false); }
  }, [room, player, top5, worst5, isSubmitting, t]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!room || !player || isLoadingExisting) {
    return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (existingPrediction?.scored_at) return <ScoredView pred={existingPrediction} />;
  if (submitted && !isPredictionsOpen) {
    return <SubmittedView top5={top5.map((id) => COUNTRY_MAP.get(id)!).filter(Boolean)} worst5={worst5.map((id) => COUNTRY_MAP.get(id)!).filter(Boolean)} />;
  }
  if (!isPredictionsOpen && !submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 px-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-bold text-white">{t('predictions.locked')}</h2>
        <p className="text-white/50 text-center text-sm">{t('predictions.lockedDesc')}</p>
      </div>
    );
  }

  const filled = top5.length + worst5.length;
  const isReady = top5.length === TOP_N && worst5.length === WORST_N;
  const selectedCountry = selectedId ? COUNTRY_MAP.get(selectedId) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── 3-col desktop / stacked mobile ──────────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden grid gap-2.5 p-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,4fr)_minmax(0,1fr)] grid-cols-1 grid-rows-[auto_1fr_auto] lg:grid-rows-1"
      >
        {/* LEFT: Top 5 */}
        <div className="overflow-y-auto max-h-[230px] lg:max-h-none">
          <ZonePanel
            zone="top" picks={top5}
            onReorder={setTop5}
            onRemove={(id) => setTop5((p) => p.filter((x) => x !== id))}
            onPlaceSelected={(slotIndex) => handlePlace('top', slotIndex)}
            hasSelection={!!selectedId}
            activeId={activeId}
          />
        </div>

        {/* CENTER: Pool */}
        <div className="flex flex-col overflow-hidden">
          {/* Meta row */}
          <div className="flex items-baseline justify-between mb-2 px-1">
            <span className="text-xs font-black uppercase tracking-widest text-white/60">
              {t('predictions.participantsHeader', { count: N, defaultValue: `Participants (${N})` })}
            </span>
            <span className="text-[11px] font-bold text-purple-400 tabular-nums">
              {filled} / {TOP_N + WORST_N} picked
            </span>
          </div>

          {/* Sort row */}
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mr-1">Sort</span>
            <button onClick={() => setPoolSort('az')}
              className={clsx('px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all',
                poolSort === 'az' ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/15 text-white/60 hover:border-white/30 hover:text-white')}>
              A ↑
            </button>
            <button onClick={() => setPoolSort('za')}
              className={clsx('px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all',
                poolSort === 'za' ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/15 text-white/60 hover:border-white/30 hover:text-white')}>
              Z ↓
            </button>
            <button onClick={() => setPoolSort('default')}
              className={clsx('px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all',
                poolSort === 'default' ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/15 text-white/60 hover:border-white/30 hover:text-white')}>
              Order
            </button>
          </div>

          {/* Selection banner */}
          {selectedCountry && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-2 mx-1 rounded-lg bg-purple-500/20 border border-purple-400/55 text-purple-200 text-[12px] font-semibold">
              <FlagImg id={selectedCountry.id} size={22} />
              <span>{getLocalizedCountryName(selectedCountry)} selected — now click an empty slot</span>
              <button
                onClick={() => setSelectedId(null)}
                className="ml-auto text-purple-200/70 hover:text-white text-[10px] uppercase tracking-wider"
                aria-label="Cancel selection"
              >Esc</button>
            </div>
          )}

          {/* Hint */}
          {!selectedCountry && (
            <p className="text-[10px] text-white/40 mb-2 px-1">
              Tap a country, then tap an empty slot — or drag within a panel to reorder.
            </p>
          )}

          {/* Tile grid */}
          <div className="flex-1 overflow-y-auto pb-4 pr-0.5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 grid-cols-1">
              {pool.map((c) => (
                <CountryTile
                  key={c.id}
                  country={c}
                  rank={getRank(c.id)}
                  selected={selectedId === c.id}
                  onClick={() => handleTileClick(c.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Worst 5 */}
        <div className="overflow-y-auto max-h-[230px] lg:max-h-none">
          <ZonePanel
            zone="worst" picks={worst5}
            onReorder={setWorst5}
            onRemove={(id) => setWorst5((p) => p.filter((x) => x !== id))}
            onPlaceSelected={(slotIndex) => handlePlace('worst', slotIndex)}
            hasSelection={!!selectedId}
            activeId={activeId}
          />
        </div>
      </div>

      {/* ── Footer (submit) ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-2 pb-3 border-t border-white/8 bg-[#0f0520]/80 backdrop-blur">
        {/* Flag previews */}
        <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
          <span className="text-[#FFD166] font-semibold shrink-0">🏆</span>
          <div className="flex gap-1">
            {Array.from({ length: TOP_N }).map((_, i) => {
              const id = top5[i];
              return id
                ? <FlagImg key={id} id={id} size={26} />
                : <div key={i} className="w-[26px] h-[20px] rounded bg-white/8 border border-dashed border-white/15" />;
            })}
          </div>
          <span className="text-white/20 mx-0.5">|</span>
          <span className="text-[#FF4D6D] font-semibold shrink-0">💀</span>
          <div className="flex gap-1">
            {Array.from({ length: WORST_N }).map((_, i) => {
              const id = worst5[i];
              return id
                ? <FlagImg key={id} id={id} size={26} />
                : <div key={i} className="w-[26px] h-[20px] rounded bg-white/8 border border-dashed border-white/15" />;
            })}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isReady || isSubmitting}
          className={clsx(
            'w-full py-3 rounded-xl font-bold text-sm text-white transition-all',
            'bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500',
            isReady && !isSubmitting ? 'opacity-100 hover:brightness-110 active:scale-[0.98]' : 'opacity-35 cursor-not-allowed',
          )}
        >
          {isSubmitting ? '...' : submitted
            ? t('predictions.updateBtn', { defaultValue: '✅ Update Predictions' })
            : isReady
              ? t('predictions.submitBtn', { defaultValue: '🎯 Submit Predictions' })
              : t('predictions.fillSlots', { defaultValue: 'Fill all 10 slots to submit' })}
        </button>
        {error && <p className="text-red-400 text-xs text-center mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
