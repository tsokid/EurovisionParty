// src/components/predictions/PredictionsScreen.tsx
//
// In-game Top 5 + Worst 5 picker (boards gpredictions-after-{m,d};
// pick mode A "tap-to-assign" from proto-predictions-{m,d}).
//
// Data and rules are unchanged: the same `predictions` load, the same
// upsert on submit (only with all 10 slots filled), editable only while
// room.phase === 'predictions_open'. The pick mode lives in
// src/lib/predictionSlots.ts, so another mode only swaps handlers here.

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { useParticipants } from '../../hooks/useParticipants';
import { getLocalizedCountryName } from '../../lib/countryLocale';
import { compareText } from '../../lib/seo/textSort';
import { supabase } from '../../lib/supabase';
import {
  TOP_N, WORST_N, clearSlot, filledCount, findSlot, indexForRow, isComplete, moveRow, nextEmpty,
  placeOf, placesFor, savedFromSlots, slotsFromSaved, tapCountry, worstRange,
  type ListId, type SlotRef, type Slots,
} from '../../lib/predictionSlots';
import { Flag } from '../stage';
import type { Country } from '../../lib/types';
import ProgressRing from './ProgressRing';
import { launchFlag, useLandingFlag } from './flagFlight';
import { PicksLists, SealedHeader, useSealMoment } from './PicksSummary';

const TOTAL = TOP_N + WORST_N;

interface ScoredPrediction {
  top5: string[];
  worst5: string[];
  top5_points: number | null;
  worst5_points: number | null;
  scored_at: string | null;
}

type Sort = 'az' | 'za' | 'order';

// ── Slot row ─────────────────────────────────────────────────────────
interface SlotRowProps {
  list: ListId;
  row: number;
  place: number | null;
  country: Country | undefined;
  iso: string | null;
  next: boolean;
  onClear: () => void;
  onActivate: () => void;
  onMove: (dir: -1 | 1) => void;
}

function SlotRow({ list, row, place, country, iso, next, onClear, onActivate, onMove }: SlotRowProps) {
  const { t } = useTranslation();
  const flagRef = useLandingFlag<HTMLSpanElement>(iso);
  const listName = t(list === 'top' ? 'pick.top5' : 'pick.worst5');
  const name = country ? getLocalizedCountryName(country) : iso ?? '';
  const count = list === 'top' ? TOP_N : WORST_N;

  if (!iso) {
    return (
      <li className={clsx('pk-slot empty', list === 'top' ? 't' : 'w', next && 'next')}>
        <button
          type="button"
          className="pk-slot-main"
          onClick={onActivate}
          aria-label={t('pick.slotEmptyAria', { list: listName, place: place ?? '' })}
        >
          <span className="num pk-slot-n">{place ?? ''}</span>
          <span className="pk-slot-empty">{t(next ? 'pick.nextSlot' : 'pick.emptySlot')}</span>
        </button>
      </li>
    );
  }
  return (
    <li className={clsx('pk-slot filled', list === 'top' ? 't' : 'w')}>
      <button
        type="button"
        className="pk-slot-main"
        onClick={onClear}
        aria-label={t('pick.slotFilledAria', { list: listName, place: place ?? '', country: name })}
      >
        <span className="num pk-slot-n">{place ?? ''}</span>
        <span ref={flagRef} className="pk-flag"><Flag iso={iso} /></span>
        <span className="pk-slot-name" title={name}>{name}</span>
        <X className="pk-slot-x" aria-hidden="true" strokeWidth={2} />
      </button>
      <span className="pk-slot-ctl">
        <button
          type="button"
          className="pk-ctl"
          onClick={() => onMove(-1)}
          disabled={row === 0}
          aria-label={t('pick.moveUp', { country: name })}
        >
          <ArrowUp aria-hidden="true" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="pk-ctl"
          onClick={() => onMove(1)}
          disabled={row === count - 1}
          aria-label={t('pick.moveDown', { country: name })}
        >
          <ArrowDown aria-hidden="true" strokeWidth={2.2} />
        </button>
      </span>
    </li>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function PredictionsScreen() {
  const { t } = useTranslation();
  const { room, player } = useGameStore();
  const { participants, byId, loading: loadingParticipants } = useParticipants(room?.year);
  const N = participants.length;

  const [slots, setSlots] = useState<Slots>(() => slotsFromSaved([], []));
  const [active, setActive] = useState<ListId>('top');
  const [sort, setSort] = useState<Sort>('az');
  const [live, setLive] = useState('');
  const [editing, setEditing] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPrediction, setExistingPrediction] = useState<ScoredPrediction | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const poolRef = useRef<HTMLUListElement>(null);

  // Load existing prediction (unchanged query and submitted rule)
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
            const loaded = slotsFromSaved(data.top5 as string[], data.worst5 as string[]);
            setSlots(loaded);
            if (!nextEmpty(loaded, 'top') && nextEmpty(loaded, 'worst')) setActive('worst');
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
  const sealPlay = useSealMoment(!isPredictionsOpen && submitted && room ? room.id : null);

  const pool = useMemo(() => {
    const list = [...participants];
    if (sort === 'az') list.sort((a, b) => compareText(getLocalizedCountryName(a), getLocalizedCountryName(b)));
    if (sort === 'za') list.sort((a, b) => compareText(getLocalizedCountryName(b), getLocalizedCountryName(a)));
    if (sort === 'order') {
      list.sort((a, b) => (a.runningOrder ?? 999) - (b.runningOrder ?? 999)
        || compareText(getLocalizedCountryName(a), getLocalizedCountryName(b)));
    }
    return list;
  }, [participants, sort]);

  const tagFor = useCallback((ref: SlotRef) => {
    const place = placeOf(ref, N) ?? '';
    return t(ref.list === 'top' ? 'pick.tagTop' : 'pick.tagWorst', { place });
  }, [N, t]);

  const nameOf = useCallback((id: string) => {
    const c = byId.get(id);
    return c ? getLocalizedCountryName(c) : id;
  }, [byId]);

  const handleTap = useCallback((id: string, flagEl: Element | null) => {
    const r = tapCountry(slots, active, id);
    if (r.kind === 'full') { setLive(t('pick.allFull')); return; }
    if (r.kind === 'placed') {
      launchFlag(id, flagEl);
      setLive(t('pick.placedLive', { country: nameOf(id), tag: tagFor(r.at) }));
    } else {
      setLive(t('pick.removedLive', { country: nameOf(id) }));
    }
    setSlots(r.slots);
    setActive(r.active);
    setError(null);
  }, [slots, active, t, nameOf, tagFor]);

  const handleClear = useCallback((ref: SlotRef) => {
    const id = slots[ref.list][ref.index];
    if (!id) return;
    setSlots(clearSlot(slots, ref));
    setActive(ref.list);
    setLive(t('pick.removedLive', { country: nameOf(id) }));
  }, [slots, t, nameOf]);

  const handleMove = useCallback((list: ListId, row: number, dir: -1 | 1) => {
    const id = slots[list][indexForRow(list, row)];
    const next = moveRow(slots, list, row, dir);
    if (next === slots || !id) return;
    setSlots(next);
    const at = findSlot(next, id);
    if (at) setLive(t('pick.placedLive', { country: nameOf(id), tag: tagFor(at) }));
  }, [slots, t, nameOf, tagFor]);

  const handleSubmit = useCallback(async () => {
    if (!room || !player || isSubmitting) return;
    const { top5, worst5 } = savedFromSlots(slots);
    setIsSubmitting(true); setError(null);
    try {
      const { error: err } = await supabase.from('predictions').upsert(
        { room_id: room.id, player_id: player.id, top5, worst5, submitted_at: new Date().toISOString(), is_locked: false },
        { onConflict: 'room_id,player_id' },
      );
      if (err) throw err;
      setSubmitted(true);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.failedPredictions'));
    } finally { setIsSubmitting(false); }
  }, [room, player, slots, isSubmitting, t]);

  // ── Guards ─────────────────────────────────────────────────────────
  if (!room || !player || isLoadingExisting || loadingParticipants) {
    return (
      <div className="pk-loading" role="status" aria-label={t('pick.loading')}>
        <span className="lb-spinner" aria-hidden="true" />
      </div>
    );
  }

  const saved = savedFromSlots(slots);
  const range = worstRange(N);

  if (existingPrediction?.scored_at) {
    const pts = (existingPrediction.top5_points ?? 0) + (existingPrediction.worst5_points ?? 0);
    return (
      <div className="pk pk-done">
        <SealedHeader as="h1" title={t('pick.sealedTitle')} body={t('pick.scoredTotal', { points: pts })} play={false} />
        <PicksLists top5={existingPrediction.top5} worst5={existingPrediction.worst5} n={N} byId={byId} locked />
      </div>
    );
  }
  if (submitted && !isPredictionsOpen) {
    return (
      <div className="pk pk-done">
        <SealedHeader as="h1" title={t('pick.sealedTitle')} body={t('pick.sealedBody')} play={sealPlay} />
        <PicksLists top5={saved.top5} worst5={saved.worst5} n={N} byId={byId} locked />
        <p className="t-meta">{t('pick.scoring')}</p>
      </div>
    );
  }
  if (!isPredictionsOpen && !submitted) {
    return (
      <div className="pk pk-done">
        <section className="card pk-closed">
          <h1 className="t-h3">{t('pick.closedTitle')}</h1>
          <p className="t-meta">{t('pick.closedBody')}</p>
        </section>
      </div>
    );
  }
  if (submitted && !editing) {
    return (
      <div className="pk pk-done">
        <section className="card-hero pk-seal ok">
          <span className="pk-seal-ico" aria-hidden="true"><Check strokeWidth={2.4} /></span>
          <div className="pk-seal-text">
            <h1 className="t-h3">{t('pick.submittedTitle')}</h1>
            <p className="t-meta">{t('pick.submittedBody')}</p>
          </div>
        </section>
        <PicksLists top5={saved.top5} worst5={saved.worst5} n={N} byId={byId} />
        <p className="t-meta">{t('pick.scoring')}</p>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => setEditing(true)}>
          {t('pick.edit')}
        </button>
      </div>
    );
  }

  // ── Editor ─────────────────────────────────────────────────────────
  const filled = filledCount(slots);
  const ready = isComplete(slots);
  const nextRef = nextEmpty(slots, active);
  const count = (list: ListId) => slots[list].filter(Boolean).length;

  const panel = (list: ListId) => {
    const places = placesFor(list, N);
    const size = list === 'top' ? TOP_N : WORST_N;
    return (
      <section
        className={clsx('card pk-panel', list === 'top' ? 't' : 'w', active === list && 'on')}
        aria-labelledby={`pk-h-${list}`}
        data-list={list}
      >
        <div className="pk-panel-h">
          <h2 id={`pk-h-${list}`} className="pk-panel-title">
            {list === 'top' ? <ArrowUp aria-hidden="true" strokeWidth={2.4} /> : <ArrowDown aria-hidden="true" strokeWidth={2.4} />}
            {t(list === 'top' ? 'pick.top5' : 'pick.worst5')}
            <span className="t-meta">
              {list === 'top'
                ? t('pick.places', { from: 1, to: 5 })
                : range ? t('pick.places', { from: range[0], to: range[1] }) : ''}
            </span>
          </h2>
          <span className="num pk-panel-count">{count(list)}/{size}</span>
        </div>
        {list === 'worst' && range && (
          <p className="t-meta pk-panel-note">{t('pick.worstNote', { count: N, from: range[0], to: range[1] })}</p>
        )}
        <ol className="pk-slots">
          {Array.from({ length: size }, (_, row) => {
            const index = indexForRow(list, row);
            const iso = slots[list][index];
            return (
              <SlotRow
                key={`${list}-${row}-${iso ?? 'empty'}`}
                list={list}
                row={row}
                place={places[row]}
                iso={iso}
                country={iso ? byId.get(iso) : undefined}
                next={!!nextRef && nextRef.list === list && nextRef.index === index}
                onClear={() => handleClear({ list, index })}
                onActivate={() => setActive(list)}
                onMove={(dir) => handleMove(list, row, dir)}
              />
            );
          })}
        </ol>
      </section>
    );
  };

  const submitLabel = isSubmitting ? t('pick.saving') : submitted ? t('pick.update') : t('pick.submit');

  return (
    <div className="pk">
      <header className="pk-head">
        <h1 className="pk-title">{t('pick.title')}</h1>
        <p className="t-meta pk-lead">{t('pick.scoring')}</p>
        <p className="t-meta pk-how">{t('pick.howTo')}</p>
      </header>

      <div className="pk-cols">
        <div className="pk-side">
          <div className="pk-seg" role="group" aria-label={t('pick.nextInAria')}>
            <span className="t-meta pk-seg-k">{t('pick.nextIn')}</span>
            {(['top', 'worst'] as const).map((list) => (
              <button
                key={list}
                type="button"
                className={clsx('pk-seg-b', list === 'top' ? 't' : 'w', active === list && 'on')}
                aria-pressed={active === list}
                onClick={() => setActive(list)}
              >
                {t(list === 'top' ? 'pick.top5' : 'pick.worst5')}
                <span className="num">{count(list)}/{list === 'top' ? TOP_N : WORST_N}</span>
              </button>
            ))}
          </div>
          <div className="pk-panels" data-active={active}>
            {panel('top')}
            {panel('worst')}
          </div>

          <div className="pk-bar">
            <ProgressRing filled={filled} total={TOTAL} />
            <div className="pk-bar-text">
              <span className="num pk-bar-n">{filled}/{TOTAL}</span>
              <span className="t-meta">{ready ? t('pick.ready') : t('pick.remaining', { count: TOTAL - filled })}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary pk-submit"
              onClick={handleSubmit}
              disabled={!ready || isSubmitting}
              aria-describedby={!ready ? 'pk-fill-hint' : undefined}
            >
              {submitLabel}
            </button>
          </div>
          {!ready && <p id="pk-fill-hint" className="t-meta pk-fill">{t('pick.fillAll')}</p>}
          {error && <p className="pk-error" role="alert">{error}</p>}
        </div>

        <section className="pk-pool-wrap" aria-labelledby="pk-pool-h">
          <div className="pk-pool-head">
            <h2 id="pk-pool-h" className="t-eyebrow">{t('pick.participants', { count: N })}</h2>
            <div className="pk-sort" role="group" aria-label={t('pick.sortAria')}>
              {([['az', 'pick.sortAz'], ['za', 'pick.sortZa'], ['order', 'pick.sortOrder']] as const).map(([k, label]) => (
                <button key={k} type="button" className={clsx('pk-sort-b', sort === k && 'on')} aria-pressed={sort === k} onClick={() => setSort(k)}>
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
          <ul className="pk-pool" ref={poolRef}>
            {pool.map((c) => {
              const at = findSlot(slots, c.id);
              const name = getLocalizedCountryName(c);
              const tag = at ? tagFor(at) : null;
              const sub = [c.artist, c.song].filter(Boolean).join(' · ');
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={clsx('pk-country', at && 'picked', at?.list === 'worst' && 'w')}
                    aria-label={at
                      ? t('pick.countryPickedAria', { country: name, tag })
                      : t('pick.countryFreeAria', { country: name })}
                    onClick={(e) => handleTap(c.id, e.currentTarget.querySelector('.flag'))}
                  >
                    <Flag iso={c.id} />
                    <span className="pk-country-who">
                      <span className="pk-country-name">{name}</span>
                      {sub && <span className="pk-country-sub">{sub}</span>}
                    </span>
                    {tag && <span className={clsx('pk-tag', at?.list === 'worst' ? 'w' : 't')}>{tag}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{live}</p>
    </div>
  );
}
