import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import clsx from 'clsx';
import { Flag } from '../stage';
import { getLocalizedCountryName } from '../../lib/countryLocale';
import { indexForRow, placesFor, worstRange, TOP_N, WORST_N, type ListId } from '../../lib/predictionSlots';
import type { Country } from '../../lib/types';

interface PicksListsProps {
  top5: readonly string[];
  worst5: readonly string[];
  /** Finalist count (dynamic Worst-5 places). */
  n: number;
  byId: Map<string, Country>;
  /** Show a lock pin on every row (voting / sealed). */
  locked?: boolean;
}

/** The player's Top 5 + Worst 5, side by side, in place order. */
export function PicksLists({ top5, worst5, n, byId, locked }: PicksListsProps) {
  const { t } = useTranslation();
  const range = worstRange(n);
  const list = (id: ListId, picks: readonly string[]) => {
    const places = placesFor(id, n);
    const count = id === 'top' ? TOP_N : WORST_N;
    return (
      <section className={clsx('card pk-sum', id === 'top' ? 't' : 'w')} aria-label={t(id === 'top' ? 'pick.top5' : 'pick.worst5')}>
        <h3 className="t-eyebrow pk-sum-h">{t(id === 'top' ? 'pick.top5' : 'pick.worst5')}</h3>
        <ol className="pk-sum-list">
          {Array.from({ length: count }, (_, row) => {
            const iso = picks[indexForRow(id, row)];
            const c = iso ? byId.get(iso) : undefined;
            const name = c ? getLocalizedCountryName(c) : iso ?? '—';
            return (
              <li key={row} className="pk-sum-row">
                <span className="num pk-sum-n">{places[row] ?? ''}</span>
                {iso ? <Flag iso={iso} /> : <span className="flag" aria-hidden="true" />}
                <span className="pk-sum-name" title={name}>{name}</span>
                {locked && <Lock className="pk-sum-lock" aria-label={t('pick.lockedAria')} strokeWidth={2} />}
              </li>
            );
          })}
        </ol>
        {id === 'worst' && range && (
          <p className="t-meta pk-sum-foot">{t('predBreakdown.worstPlaces', { from: range[0], to: range[1], count: n })}</p>
        )}
      </section>
    );
  };
  return (
    <div className="pk-sums">
      {list('top', top5)}
      {list('worst', worst5)}
    </div>
  );
}

/**
 * Plays the seal (lock snap + «σφραγίστηκε» stamp) once per room per
 * browser session; afterwards the sealed state shows still.
 */
export function useSealMoment(key: string | null): boolean {
  const [play] = useState(() => {
    if (!key) return false;
    try {
      const k = `eurovision-games-sealed-${key}`;
      if (sessionStorage.getItem(k) === '1') return false;
      return true;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!key || !play) return;
    try { sessionStorage.setItem(`eurovision-games-sealed-${key}`, '1'); } catch { /* ignore */ }
  }, [key, play]);
  return play;
}

interface SealedHeaderProps {
  title: ReactNode;
  body?: ReactNode;
  /** Run the lock snap + stamp (motion map #7). Reduced motion: CSS shows the end state. */
  play: boolean;
  as?: 'h1' | 'h2';
}

/** Hero card: a lock that snaps shut and the «σφραγίστηκε» stamp. */
export function SealedHeader({ title, body, play, as: H = 'h2' }: SealedHeaderProps) {
  const { t } = useTranslation();
  return (
    <section className={clsx('card-hero pk-seal', play && 'play')}>
      <span className="pk-seal-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <g className="pk-seal-shackle"><path d="M8 11V8a4 4 0 0 1 8 0v3" /></g>
          <rect x="5" y="11" width="14" height="10" rx="2" />
        </svg>
      </span>
      <div className="pk-seal-text">
        <H className="t-h3">{title}</H>
        {body && <p className="t-meta">{body}</p>}
      </div>
      <span className="pk-stamp" aria-hidden="true">{t('pick.stamp')}</span>
    </section>
  );
}
