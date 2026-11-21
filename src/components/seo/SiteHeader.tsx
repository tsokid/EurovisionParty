import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserRooms, getBadge } from '../../hooks/useUserRooms';
import MuteToggle from '../ui/MuteToggle';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import LocaleLink from './LocaleLink';
import { useLocale } from '../../lib/seo/LocaleContext';
import { localizePath, stripLocaleFromPath } from '../../lib/seo/locale';
import { useGameStore } from '../../stores/gameStore';
import LockedBadge from '../ui/LockedBadge';
import type { SiteSnapshot } from '../../content/contests/types';
import { useContent } from '../../lib/seo/useContent';
import { hubPath } from '../../lib/seo/dynamicPages';
import { buttonClass } from '../stage';

interface NavLink {
  href: string;
  key: 'trivia' | 'predictions' | 'hub' | 'rules' | 'scoring' | 'otherFaq';
}

const HOW_TO_PLAY_LINKS: NavLink[] = [
  { href: '/eurovision-trivia', key: 'trivia' },
  { href: '/eurovision-predictions', key: 'predictions' },
  { href: '/rules', key: 'rules' },
  { href: '/scoring', key: 'scoring' },
  { href: '/faq', key: 'otherFaq' },
];

/**
 * The "How to play" links, plus the live contest hub ("Eurovision {year}").
 * The year comes from site.json, which every prerendered page inlines because
 * the header reads it; no hub link while it is unknown or the live contest is
 * archived (the hub then redirects to the archive).
 */
function useHowToPlayLinks(): { links: NavLink[]; hub: NavLink | null; year: number | null } {
  const site = useContent<SiteSnapshot>('site.json');
  const year = site.status === 'ready' && site.data.live_stage !== 'archived' ? site.data.current_year : null;
  if (year === null) return { links: HOW_TO_PLAY_LINKS, hub: null, year };
  return { links: HOW_TO_PLAY_LINKS, hub: { href: hubPath(year), key: 'hub' }, year };
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      style={{ transform: open ? 'rotate(180deg)' : undefined }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

function Logo() {
  return (
    <LocaleLink to="/" className="logo" aria-label="Eurovision Games — home">
      <img src="/logo.png" alt="eurovision.games" width={866} height={288} draggable={false} />
    </LocaleLink>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function SiteHeader() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [howDropdownOpen, setHowDropdownOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const locale = useLocale();
  const { rooms } = useUserRooms();
  const room = useGameStore((s) => s.room);
  const inRoomBroadcasting = !!room && (room.phase === 'voting_live' || room.phase === 'final');
  const triviaLocked = inRoomBroadcasting;
  const { links: howLinks, hub, year } = useHowToPlayLinks();
  const label = (l: NavLink) => t(`siteNav.${l.key}`, { year });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  // Mobile menu = modal dialog: scroll lock, focus moves in, Tab stays in,
  // Esc closes, focus returns to the menu button.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = dialogRef.current;
    node?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [open]);

  // Close desktop "How to play" dropdown on outside click / esc
  useEffect(() => {
    if (!howDropdownOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHowDropdownOpen(false); };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-how-popover]')) setHowDropdownOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [howDropdownOpen]);

  const liveRooms = rooms.filter((r) => getBadge(r) !== 'ENDED');
  const roomCount = liveRooms.length;
  const cleanPath = stripLocaleFromPath(pathname);
  const howActive = howDropdownOpen || howLinks.some((l) => l.href === cleanPath) || cleanPath === '/how-to-play';

  const handleAction = (action: 'create' | 'join') => {
    setOpen(false);
    navigate(`${localizePath(locale, '/')}?action=${action}`);
  };

  const drawer = open ? (
    <div
      ref={dialogRef}
      id="site-drawer"
      className="drawer lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t('siteNav.menu')}
    >
      <div className="drawer-head">
        <div className="wrap topbar-row">
          <Logo />
          <span className="spacer" />
          <button
            type="button"
            data-autofocus
            onClick={() => setOpen(false)}
            aria-label={t('siteNav.closeMenu')}
            className="iconbtn"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <nav className="wrap drawer-body" aria-label="Mobile">
        {/* ─── CTAs ─── */}
        <div className="flex flex-col gap-2.5">
          <button type="button" onClick={() => handleAction('create')} className={buttonClass({ size: 'lg', block: true })}>
            {t('siteNav.createRoom')}
          </button>
          <button type="button" onClick={() => handleAction('join')} className={buttonClass({ variant: 'secondary', size: 'lg', block: true })}>
            {t('siteNav.joinRoom')}
          </button>
        </div>

        {/* ─── Pages ─── */}
        <ul className="drawer-links">
          {hub && (
            <li>
              <LocaleLink to={hub.href} className={`drawer-link${cleanPath === hub.href ? ' on' : ''}`}>{label(hub)}</LocaleLink>
            </li>
          )}
          <li>
            <LocaleLink to="/eurovision-night" className={`drawer-link${cleanPath === '/eurovision-night' ? ' on' : ''}`}>
              {t('siteNav.eurovisionNight')}
            </LocaleLink>
          </li>
        </ul>

        {/* ─── How to play ─── */}
        <div>
          <span className="t-eyebrow">{t('siteNav.howToPlay')}</span>
          <ul className="drawer-links">
            {howLinks.map((l) => (
              <li key={l.href}>
                {l.key === 'trivia' && triviaLocked ? (
                  <div className="drawer-link sub"><LockedBadge label={label(l)} /></div>
                ) : (
                  <LocaleLink to={l.href} className={`drawer-link sub${cleanPath === l.href ? ' on' : ''}`}>{label(l)}</LocaleLink>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* ─── Your Rooms — collapsible ─── */}
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setRoomsOpen((v) => !v)}
            aria-expanded={roomsOpen}
            className="w-full flex items-center justify-between gap-3 min-h-[56px] px-4 text-left cursor-pointer text-stage-text"
          >
            <span className="flex items-center gap-2.5">
              <span className="font-semibold">{t('siteNav.yourRooms')}</span>
              {roomCount > 0 && (
                <span className="chip chip-pink num">{roomCount}</span>
              )}
            </span>
            <ChevronIcon open={roomsOpen} />
          </button>
          {roomsOpen && (
            <div className="px-2 pb-2 flex flex-col gap-1">
              {rooms.length === 0 ? (
                <p className="t-meta px-2.5 py-2 m-0">{t('siteNav.noRooms')}</p>
              ) : (
                rooms.map((r) => {
                  const badge = getBadge(r);
                  const dotColor =
                    badge === 'LIVE' ? 'text-stage-live' : badge === 'AWAY' ? 'text-stage-gold' : 'text-stage-text-3';
                  return (
                    <Link
                      key={r.playerId}
                      to={`/room/${r.roomCode}`}
                      className="flex items-center justify-between gap-3 px-2.5 min-h-[48px] rounded-xl hover:bg-stage-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`dot ${dotColor}`} aria-hidden />
                        <code className="font-mono text-[0.85rem] text-stage-text shrink-0">{r.roomCode}</code>
                        <span className="text-stage-text-3 shrink-0">·</span>
                        <span className="t-small truncate">{r.hostName}</span>
                      </div>
                      <span className="t-meta tabular-nums shrink-0">
                        {r.totalPoints} {t('common.pts')}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>
      </nav>
    </div>
  ) : null;

  return (
    <header className="topbar">
      <div className="wrap topbar-row">
        <Logo />

        {/* Desktop nav */}
        <nav className="nav" aria-label="Primary">
          {hub && (
            <LocaleLink to={hub.href} className={`nav-item${cleanPath === hub.href ? ' on' : ''}`}>
              {label(hub)}
            </LocaleLink>
          )}
          <LocaleLink
            to="/eurovision-night"
            className={`nav-item${cleanPath === '/eurovision-night' ? ' on' : ''}`}
          >
            {t('siteNav.eurovisionNight')}
          </LocaleLink>

          {/* How to play — popover */}
          <div className="relative" data-how-popover>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setHowDropdownOpen((v) => !v); }}
              aria-haspopup="menu"
              aria-expanded={howDropdownOpen}
              className={`nav-item${howActive ? ' on' : ''}`}
            >
              {t('siteNav.howToPlay')}
              <ChevronIcon open={howDropdownOpen} />
            </button>
            {howDropdownOpen && (
              <div className="menu-pop" style={{ left: 0, right: 'auto' }} role="menu">
                {howLinks.map((l) => {
                  if (l.key === 'trivia' && triviaLocked) {
                    return (
                      <div key={l.href} className="px-2 py-1" role="menuitem">
                        <LockedBadge label={label(l)} />
                      </div>
                    );
                  }
                  return (
                    <LocaleLink
                      key={l.href}
                      to={l.href}
                      role="menuitem"
                      className="menu-item"
                      onClick={() => setHowDropdownOpen(false)}
                    >
                      {label(l)}
                    </LocaleLink>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <span className="spacer" />

        <MuteToggle variant="stage" />
        <LanguageSwitcher variant="stage" />

        <button
          type="button"
          onClick={() => handleAction('join')}
          className={buttonClass({ variant: 'secondary', size: 'sm', className: 'hidden xl:inline-flex' })}
        >
          {t('siteNav.joinRoom')}
        </button>
        <button
          type="button"
          onClick={() => handleAction('create')}
          className={buttonClass({ size: 'sm', className: 'hidden lg:inline-flex' })}
        >
          {t('siteNav.createRoom')}
        </button>

        {/* Mobile menu button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-drawer"
          aria-label={open ? t('siteNav.closeMenu') : t('siteNav.openMenu')}
          className="iconbtn lg:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {drawer && typeof document !== 'undefined' ? createPortal(drawer, document.body) : null}
    </header>
  );
}
