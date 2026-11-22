import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { AvatarPop, randomFrom, useAvatarEntry, usePickerAvatars, type AvatarEntry } from '../stage/avatars';

interface AvatarPickerProps {
  value: string;
  onChange: (id: string) => void;
}

/** Avatars per page: a 3 × 3 grid. */
const AVATARS_PER_PAGE = 9;

function pagesOf(avatars: readonly AvatarEntry[]): AvatarEntry[][] {
  return Array.from({ length: Math.max(1, Math.ceil(avatars.length / AVATARS_PER_PAGE)) }, (_, p) =>
    avatars.slice(p * AVATARS_PER_PAGE, (p + 1) * AVATARS_PER_PAGE),
  );
}

function avatarPageOf(avatars: readonly AvatarEntry[], id: string): number {
  const i = avatars.findIndex((a) => a.id === id);
  return i < 0 ? 0 : Math.floor(i / AVATARS_PER_PAGE);
}

/**
 * Avatar choice from the Stage set: big pop-out avatars in a 3 × 3 grid,
 * paged horizontally. The pages are a native CSS scroll-snap strip (finger
 * swipe with the platform's own momentum and snap on iOS and Android);
 * arrow buttons (mouse devices) and ←/→ page it too. The chosen avatar is
 * previewed large with its title; «Τυχαίο» shuffles and jumps to its page.
 */
export default function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('el') ? 'el' : 'en';
  const reduce = useReducedMotion() ?? false;
  // The published library (live, cached), or the shipped set until it loads.
  const avatars = usePickerAvatars();
  const PAGES = useMemo(() => pagesOf(avatars), [avatars]);
  const current = useAvatarEntry(value);
  const chosen = current ?? avatars[0];
  const chosenPage = avatarPageOf(avatars, chosen.id);
  const last = PAGES.length - 1;

  const [page, setPage] = useState(chosenPage);
  const stripRef = useRef<HTMLDivElement>(null);
  // Page a programmatic scroll is heading to; scroll events are ignored
  // until it gets there, so a long jump doesn't step the dots through.
  const targetRef = useRef<number | null>(null);
  const targetTimer = useRef<number | undefined>(undefined);

  const scrollToPage = useCallback((p: number, smooth: boolean) => {
    const el = stripRef.current;
    if (!el) return;
    const left = p * el.clientWidth;
    if (Math.abs(el.scrollLeft - left) < 2) return;
    targetRef.current = p;
    window.clearTimeout(targetTimer.current);
    targetTimer.current = window.setTimeout(() => { targetRef.current = null; }, 1000);
    if (typeof el.scrollTo === 'function') el.scrollTo({ left, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    else el.scrollLeft = left;
  }, [reduce]);

  const goTo = useCallback((p: number, smooth = true) => {
    const next = Math.max(0, Math.min(last, p));
    setPage(next);
    scrollToPage(next, smooth);
    return next;
  }, [last, scrollToPage]);

  // Opening the picker shows the page with the current choice.
  useLayoutEffect(() => {
    scrollToPage(chosenPage, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new choice made elsewhere (shuffle) jumps to its page.
  const prevChosen = useRef(chosen.id);
  useEffect(() => {
    if (prevChosen.current === chosen.id) return;
    prevChosen.current = chosen.id;
    goTo(chosenPage);
  }, [chosen.id, chosenPage, goTo]);

  useEffect(() => () => window.clearTimeout(targetTimer.current), []);

  // A width change (rotation, window resize) keeps the same page in view.
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (!el.clientWidth || el.clientWidth === width) return;
      width = el.clientWidth;
      const p = targetRef.current ?? pageRef.current;
      targetRef.current = p;
      el.scrollLeft = p * width;
      requestAnimationFrame(() => { if (targetRef.current === p) targetRef.current = null; });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = stripRef.current;
    if (!el || !el.clientWidth) return;
    const p = Math.round(el.scrollLeft / el.clientWidth);
    if (targetRef.current !== null) {
      if (p === targetRef.current && Math.abs(el.scrollLeft - p * el.clientWidth) < 2) targetRef.current = null;
      return;
    }
    if (p !== page) setPage(Math.max(0, Math.min(last, p)));
  };
  // The user takes over: follow their swipe.
  const release = () => { targetRef.current = null; };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = goTo(page + (e.key === 'ArrowRight' ? 1 : -1));
    if (next === page) return;
    // Keep keyboard focus in the grid: same slot on the new page.
    const active = document.activeElement as HTMLElement | null;
    const fromTile = active?.dataset.id ? avatars.findIndex((a) => a.id === active.dataset.id) : -1;
    const fromDisabledArrow = active?.classList.contains('avp-arrow') && (next === 0 || next === last);
    if (fromTile < 0 && !fromDisabledArrow) return;
    const slot = fromTile < 0 ? 0 : fromTile % AVATARS_PER_PAGE;
    const target = PAGES[next][Math.min(slot, PAGES[next].length - 1)];
    stripRef.current?.querySelector<HTMLElement>(`[data-id="${target.id}"]`)?.focus({ preventScroll: true });
  };

  // One tab stop in the grid: the choice if it's on this page, else the page's first.
  const tabbableId = chosenPage === page ? chosen.id : (PAGES[page] ?? PAGES[last])[0].id;

  return (
    <div className="avp" onKeyDown={onKeyDown}>
      <div className="avp-head">
        <div className="avp-preview">
          <AvatarPop entry={chosen} sizes="(min-width: 1024px) 280px, 245px" loading="eager" className="avp-hero" />
        </div>
        <div className="avp-meta">
          <span className="field-label" id="avatar-label">{t('nameEntry.avatarLabel')}</span>
          <span className="avp-title" aria-live="polite">{chosen.title[lang]}</span>
          <button type="button" className="btn btn-secondary btn-sm avp-shuffle" onClick={() => onChange(randomFrom(avatars, chosen.id))}>
            <Shuffle size={16} aria-hidden />
            {t('nameEntry.shuffle')}
          </button>
        </div>
      </div>

      <div
        className="avp-strip"
        ref={stripRef}
        role="radiogroup"
        aria-labelledby="avatar-label"
        onScroll={onScroll}
        onPointerDown={release}
        onTouchStart={release}
        onWheel={release}
      >
        {PAGES.map((items, p) => (
          <div className="avp-page" key={p} data-page={p}>
            {items.map((a) => {
              const on = a.id === chosen.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={a.title[lang]}
                  data-id={a.id}
                  tabIndex={a.id === tabbableId ? 0 : -1}
                  className="avp-item"
                  onClick={() => onChange(a.id)}
                >
                  <AvatarPop
                    entry={a}
                    sizes="(min-width: 1024px) 210px, 175px"
                    loading={p === page ? 'eager' : 'lazy'}
                  />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="avp-nav">
        <button
          type="button"
          className="iconbtn avp-arrow"
          aria-label={t('nameEntry.avatarPrev')}
          disabled={page === 0}
          onClick={() => goTo(page - 1)}
        >
          <ChevronLeft aria-hidden strokeWidth={2.2} />
        </button>
        <div className="avp-dots">
          {PAGES.map((_, p) => (
            <button
              key={p}
              type="button"
              tabIndex={-1}
              className={clsx('avp-dot', p === page && 'on')}
              aria-label={t('nameEntry.avatarPage', { n: p + 1, total: PAGES.length })}
              aria-current={p === page ? 'true' : undefined}
              onClick={() => goTo(p)}
            />
          ))}
        </div>
        <button
          type="button"
          className="iconbtn avp-arrow"
          aria-label={t('nameEntry.avatarNext')}
          disabled={page === last}
          onClick={() => goTo(page + 1)}
        >
          <ChevronRight aria-hidden strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
