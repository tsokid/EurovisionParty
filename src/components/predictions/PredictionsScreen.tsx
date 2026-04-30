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

interface ScoredPrediction {
  top5: string[];
  worst5: string[];
  top5_points: number | null;
  worst5_points: number | null;
  scored_at: string | null;
}

// ── Heart-shaped flag ────────────────────────────────────────────────────────
const HEART_PATH = 'M14 24S2 16 2 9A7 7 0 0 1 14 4.5 7 7 0 0 1 26 9C26 16 14 24 14 24z';
function HeartFlag({ id, size = 28 }: { id: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0,
        clipPath: `path("${HEART_PATH}")`,
        overflow: 'hidden',
      }}
    >
      <img
        src={`https://flagcdn.com/w40/${id.toLowerCase()}.png`}
        alt=""
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
      />
    </div>
  );
}

// ── Grip icon ────────────────────────────────────────────────────────────────
function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="flex-shrink-0 text-white/25">
      <circle cx="2.5" cy="2.5" r="1.5" /><circle cx="7.5" cy="2.5" r="1.5" />
      <circle cx="2.5" cy="7"   r="1.5" /><circle cx="7.5" cy="7"   r="1.5" />
      <circle cx="2.5" cy="11.5" r="1.5"/><circle cx="7.5" cy="11.5" r="1.5"/>
    </svg>
  );
}

// ── Slot row (inside zone panel) ─────────────────────────────────────────────
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
  return (
    <div className={clsx(
      'flex items-center gap-2 px-2 py-1.5 rounded-lg select-none',
      zone === 'top'   ? 'bg-yellow-400/8' : 'bg-red-400/8',
      ghost && 'opacity-0',
    )}>
      <GripIcon />
      <span className={clsx('w-4 text-center text-[11px] font-bold shrink-0',
        zone === 'top' ? 'text-yellow-400' : 'text-red-400',
      )}>{pos}</span>
      <HeartFlag id={id} size={22} />
      <span className="text-[12px] font-semibold text-white flex-1 truncate">{getLocalizedCountryName(c)}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="w-4 h-4 rounded-full bg-white/10 hover:bg-red-400/40 flex items-center justify-center text-white/40 hover:text-white transition-colors text-[10px] shrink-0"
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

// ── Zone panel ────────────────────────────────────────────────────────────────
interface ZonePanelProps {
  zone: 'top' | 'worst';
  picks: string[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (id: string) => void;
  activeId: string | null;
}
function ZonePanel({ zone, picks, onReorder, onRemove, activeId }: ZonePanelProps) {
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

  return (
    <div className={clsx(
      'rounded-xl border overflow-hidden flex flex-col',
      isTop ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-red-400/5 border-red-400/20',
    )}>
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center justify-between',
        isTop ? 'bg-yellow-400/10 border-b border-yellow-400/15' : 'bg-red-400/10 border-b border-red-400/15',
      )}>
        <span className={clsx('text-[11px] font-black uppercase tracking-widest',
          isTop ? 'text-yellow-300' : 'text-red-300',
        )}>
          {isTop ? '🏆 Top 5' : '💩 Worst 5'}
        </span>
        <span className={clsx('text-[10px] opacity-50', isTop ? 'text-yellow-300' : 'text-red-300')}>
          {isTop ? 'best finish' : 'last place'}
        </span>
      </div>

      {/* Slots */}
      <div className="flex-1 p-1.5 space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={picks} strategy={verticalListSortingStrategy}>
            {picks.map((id, i) => (
              <SortableSlot
                key={id} id={id} pos={i + 1} zone={zone}
                onRemove={() => onRemove(id)}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeId && picks.includes(activeId) && (
              <div className="shadow-xl rotate-1 scale-105 opacity-95">
                <SlotRow
                  id={activeId} pos={picks.indexOf(activeId) + 1}
                  zone={zone} onRemove={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Empty slots */}
        {Array.from({ length: TOP_N - picks.length }).map((_, i) => (
          <div key={`empty-${i}`} className={clsx(
            'flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed',
            isTop ? 'border-yellow-400/20' : 'border-red-400/20',
          )}>
            <span className={clsx('w-4 text-center text-[11px] font-bold shrink-0 opacity-30',
              isTop ? 'text-yellow-400' : 'text-red-400',
            )}>{picks.length + i + 1}</span>
            <span className="text-[11px] text-white/20">tap a country →</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Country card (pool) ──────────────────────────────────────────────────────
function CountryCard({
  country, inTop, inWorst, onClick,
}: { country: Country; inTop: boolean; inWorst: boolean; onClick: () => void }) {
  const used = inTop || inWorst;
  return (
    <button
      onClick={onClick}
      disabled={false}
      className={clsx(
        'flex items-stretch rounded-lg border overflow-hidden text-left transition-all',
        'min-h-[44px] w-full',
        !used && 'bg-white/5 border-white/10 hover:bg-purple-500/20 hover:border-purple-400/50 hover:-translate-y-px',
        inTop  && 'bg-yellow-400/8 border-yellow-400/40 opacity-40 cursor-default',
        inWorst && 'bg-red-400/8 border-red-400/40 opacity-40 cursor-default',
      )}
    >
      {/* Country */}
      <div className="flex items-center gap-2 px-2.5 py-2 shrink-0 border-r border-white/7" style={{ minWidth: 130 }}>
        <HeartFlag id={country.id} size={26} />
        <span className="text-[12px] font-bold text-white/90 truncate">{getLocalizedCountryName(country)}</span>
      </div>
      {/* Artist */}
      <div className="flex items-center gap-1.5 px-2.5 flex-1 min-w-0 border-r border-white/7">
        <span className="text-[10px] opacity-40">🎤</span>
        <span className="text-[11px] text-white/60 truncate">{country.artist}</span>
      </div>
      {/* Song */}
      <div className="flex items-center gap-1.5 px-2.5 flex-1 min-w-0">
        <span className="text-[10px] opacity-40">🎵</span>
        <span className="text-[11px] text-white/60 truncate italic">{country.song}</span>
      </div>
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
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">🏆 Top 5 — {pred.top5_points ?? 0} pts</p>
          {t5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-yellow-400/10 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-yellow-400 w-4">{i + 1}</span>
              <HeartFlag id={c.id} size={20} />
              <span className="text-sm text-white truncate">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">💩 Worst 5 — {pred.worst5_points ?? 0} pts</p>
          {w5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-red-400/10 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-red-400 w-4">{22 + i}</span>
              <HeartFlag id={c.id} size={20} />
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
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">🏆 {t('predictions.yourTop5')}</p>
          {top5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-yellow-400/10 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-yellow-400 w-4">{i + 1}</span>
              <HeartFlag id={c.id} size={20} />
              <span className="text-sm text-white">{getLocalizedCountryName(c)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">💩 {t('predictions.yourWorst5')}</p>
          {worst5.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 bg-red-400/10 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-xs font-bold text-red-400 w-4">{22 + i}</span>
              <HeartFlag id={c.id} size={20} />
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

  const [top5, setTop5]   = useState<string[]>([]);
  const [worst5, setWorst5] = useState<string[]>([]);
  const [activeId] = useState<string | null>(null);
  const [mobileZone] = useState<'top' | 'worst'>('top');
  const [poolSort, setPoolSort] = useState<'az' | 'za' | 'default'>('az');
  const [poolFilter, setPoolFilter] = useState<'all' | 'top' | 'worst'>('all');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPrediction, setExistingPrediction] = useState<ScoredPrediction | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

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

  // Pool — sorted + filtered
  const pool = (() => {
    let list = [...COUNTRIES_2026];
    if (poolSort === 'az') list.sort((a, b) => getLocalizedCountryName(a).localeCompare(getLocalizedCountryName(b)));
    if (poolSort === 'za') list.sort((a, b) => getLocalizedCountryName(b).localeCompare(getLocalizedCountryName(a)));
    if (poolFilter === 'top')   list = list.filter((c) => top5.includes(c.id));
    if (poolFilter === 'worst') list = list.filter((c) => worst5.includes(c.id));
    return list;
  })();

  const handleCardClick = useCallback((id: string) => {
    if (top5.includes(id)) { setTop5((p) => p.filter((x) => x !== id)); return; }
    if (worst5.includes(id)) { setWorst5((p) => p.filter((x) => x !== id)); return; }
    const isMobile = window.innerWidth < 860;
    const zone = isMobile ? mobileZone : (top5.length < TOP_N ? 'top' : 'worst');
    if (zone === 'top' && top5.length < TOP_N)     { setTop5((p) => [...p, id]); return; }
    if (zone === 'worst' && worst5.length < WORST_N){ setWorst5((p) => [...p, id]); return; }
    // Try the other zone
    if (top5.length < TOP_N)   { setTop5((p) => [...p, id]); return; }
    if (worst5.length < WORST_N){ setWorst5((p) => [...p, id]); }
  }, [top5, worst5, mobileZone]);

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

  // ── Guards ───────────────────────────────────────────────────────────────
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

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── 3-col desktop / stack mobile ──────────────────────────────────── */}
      <div className="flex-1 overflow-hidden grid gap-2 p-2"
        style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)' }}
      >
        {/* LEFT: Top 5 */}
        <div className="overflow-y-auto">
          <ZonePanel
            zone="top" picks={top5}
            onReorder={setTop5}
            onRemove={(id) => setTop5((p) => p.filter((x) => x !== id))}
            activeId={activeId}
          />
        </div>

        {/* CENTER: Pool */}
        <div className="flex flex-col overflow-hidden bg-white/3 rounded-xl border border-white/8">
          {/* Pool header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 shrink-0">
            <span className="text-[11px] font-black uppercase tracking-widest text-white/40">
              {t('predictions.participantsHeader', { count: COUNTRIES_2026.length })}
            </span>
            <span className="text-[11px] text-purple-400">{filled}/10 picked</span>
          </div>

          {/* Toolbar */}
          <div className="flex gap-1 px-2 py-1.5 border-b border-white/8 shrink-0 flex-wrap">
            {([
              { label: 'A↓', action: () => setPoolSort('az') },
              { label: 'Z↓', action: () => setPoolSort('za') },
              { label: '🔀', action: () => setPoolSort('default') },
            ] as const).map(({ label, action }) => (
              <button key={label} onClick={action}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-[11px] border border-white/10 transition-colors">
                {label}
              </button>
            ))}
            <button onClick={() => setPoolFilter('top')}
              className={clsx('px-2.5 py-1 rounded-lg text-[11px] border transition-colors',
                poolFilter === 'top' ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-300' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10')}>
              🏆 Only
            </button>
            <button onClick={() => setPoolFilter('worst')}
              className={clsx('px-2.5 py-1 rounded-lg text-[11px] border transition-colors',
                poolFilter === 'worst' ? 'bg-red-400/20 border-red-400/50 text-red-300' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10')}>
              💩 Only
            </button>
            <button onClick={() => setPoolFilter('all')}
              className={clsx('px-2.5 py-1 rounded-lg text-[11px] border transition-colors',
                poolFilter === 'all' ? 'bg-purple-500/25 border-purple-400/50 text-purple-300' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10')}>
              All
            </button>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {pool.map((c) => (
              <CountryCard
                key={c.id} country={c}
                inTop={top5.includes(c.id)}
                inWorst={worst5.includes(c.id)}
                onClick={() => handleCardClick(c.id)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: Worst 5 */}
        <div className="overflow-y-auto">
          <ZonePanel
            zone="worst" picks={worst5}
            onReorder={setWorst5}
            onRemove={(id) => setWorst5((p) => p.filter((x) => x !== id))}
            activeId={activeId}
          />
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-2 pb-3 border-t border-white/8 bg-[#0f0520]/80 backdrop-blur">
        {/* Flag previews */}
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span className="text-yellow-400 font-semibold shrink-0">🏆</span>
          <div className="flex gap-1">
            {Array.from({ length: TOP_N }).map((_, i) => {
              const id = top5[i];
              return id
                ? <HeartFlag key={id} id={id} size={22} />
                : <div key={i} className="w-[22px] h-[22px] rounded bg-white/8 border border-dashed border-white/15" />;
            })}
          </div>
          <span className="text-white/20 mx-0.5">|</span>
          <span className="text-red-400 font-semibold shrink-0">💩</span>
          <div className="flex gap-1">
            {Array.from({ length: WORST_N }).map((_, i) => {
              const id = worst5[i];
              return id
                ? <HeartFlag key={id} id={id} size={22} />
                : <div key={i} className="w-[22px] h-[22px] rounded bg-white/8 border border-dashed border-white/15" />;
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
              : t('predictions.fillSlots', { defaultValue: `Fill all 10 slots to submit` })}
        </button>
        {error && <p className="text-red-400 text-xs text-center mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
