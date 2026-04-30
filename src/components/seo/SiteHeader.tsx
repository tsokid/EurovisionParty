import { useEffect, useState } from 'react';
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

const HOW_TO_PLAY_LINKS = [
  { href: '/eurovision-trivia', key: 'trivia' as const },
  { href: '/eurovision-2026-predictions', key: 'predictions' as const },
  { href: '/rules', key: 'rules' as const },
  { href: '/scoring', key: 'scoring' as const },
  { href: '/faq', key: 'otherFaq' as const },
];

const CONTACT_EMAIL = 'hello@eurovision.games';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
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

export default function SiteHeader() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [howDropdownOpen, setHowDropdownOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const locale = useLocale();
  const { rooms } = useUserRooms();
  const room = useGameStore((s) => s.room);
  const inRoomBroadcasting = !!room && (room.phase === 'voting_live' || room.phase === 'final');
  const triviaLocked = inRoomBroadcasting;

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
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

  const handleAction = (action: 'create' | 'join') => {
    setOpen(false);
    navigate(`${localizePath(locale, '/')}?action=${action}`);
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-euro-deep/80 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <LocaleLink to="/" className="flex items-center group shrink-0" aria-label="Eurovision Games — home">
          <img
            src="/logo.png"
            alt="eurovision.games"
            width={2172}
            height={724}
            className="h-8 sm:h-10 w-auto select-none drop-shadow-[0_0_18px_rgba(236,72,153,0.25)] group-hover:drop-shadow-[0_0_24px_rgba(236,72,153,0.45)] transition"
            draggable={false}
          />
        </LocaleLink>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
          <LocaleLink
            to="/eurovision-night"
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              cleanPath === '/eurovision-night'
                ? 'text-white bg-white/10'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
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
              className={`px-3 py-1.5 rounded-full text-sm transition flex items-center gap-1 ${
                howDropdownOpen || HOW_TO_PLAY_LINKS.some((l) => l.href === cleanPath) || cleanPath === '/how-to-play'
                  ? 'text-white bg-white/10'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {t('siteNav.howToPlay')}
              <ChevronIcon open={howDropdownOpen} />
            </button>
            {howDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 min-w-[220px] rounded-xl border border-white/10 bg-euro-deep/95 backdrop-blur-md shadow-xl shadow-black/40 py-1.5 z-50" role="menu">
                {HOW_TO_PLAY_LINKS.map((l) => {
                  if (l.key === 'trivia' && triviaLocked) {
                    return (
                      <div key={l.href} className="px-4 py-2" role="menuitem">
                        <LockedBadge label={t(`siteNav.${l.key}`)} />
                      </div>
                    );
                  }
                  return (
                    <LocaleLink
                      key={l.href}
                      to={l.href}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white transition"
                      onClick={() => setHowDropdownOpen(false)}
                    >
                      {t(`siteNav.${l.key}`)}
                    </LocaleLink>
                  );
                })}
              </div>
            )}
          </div>

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="px-3 py-1.5 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
          >
            {t('siteNav.contactUs')}
          </a>

          <span className="ml-1 mr-1 h-5 w-px bg-white/10" aria-hidden />

          <MuteToggle />
          <LanguageSwitcher />

          <button
            type="button"
            onClick={() => handleAction('create')}
            className="ml-2 px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-euro-purple-light to-euro-pink text-white hover:opacity-95 transition cursor-pointer"
          >
            {t('siteNav.createRoom')}
          </button>
        </nav>

        {/* Mobile right cluster: mute + language + hamburger */}
        <div className="lg:hidden flex items-center gap-1">
          <MuteToggle />
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-drawer"
            aria-label={open ? t('siteNav.closeMenu') : t('siteNav.openMenu')}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 text-white hover:bg-white/5 transition cursor-pointer"
          >
            {open ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          id="site-drawer"
          className="lg:hidden border-t border-white/10 bg-euro-deep max-h-[calc(100svh-3.5rem)] overflow-y-auto"
        >
          <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-1.5" aria-label="Mobile">
            {/* ─── Your Rooms — collapsible ─── */}
            <div className="rounded-xl bg-white/[0.03] border border-white/8">
              <button
                type="button"
                onClick={() => setRoomsOpen((v) => !v)}
                aria-expanded={roomsOpen}
                className="w-full flex items-center justify-between px-3.5 py-3 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-white/85 font-semibold">{t('siteNav.yourRooms')}</span>
                  {roomCount > 0 && (
                    <span className="text-[0.7rem] font-bold px-2 py-0.5 rounded-full bg-euro-pink/20 text-euro-pink-light tabular-nums">
                      {roomCount}
                    </span>
                  )}
                </span>
                <ChevronIcon open={roomsOpen} />
              </button>
              {roomsOpen && (
                <div className="px-2 pb-2 flex flex-col gap-1">
                  {rooms.length === 0 ? (
                    <p className="px-2.5 py-2 text-sm text-white/40">{t('siteNav.noRooms')}</p>
                  ) : (
                    rooms.map((r) => {
                      const badge = getBadge(r);
                      const dotColor =
                        badge === 'LIVE' ? 'bg-green-400' : badge === 'AWAY' ? 'bg-yellow-400' : 'bg-white/30';
                      return (
                        <Link
                          key={r.playerId}
                          to={`/room/${r.roomCode}`}
                          className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/5 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden />
                            <code className="font-mono text-[0.8rem] text-white/80 shrink-0">{r.roomCode}</code>
                            <span className="text-white/30 shrink-0">·</span>
                            <span className="text-sm text-white/70 truncate">{r.hostName}</span>
                          </div>
                          <span className="text-[0.78rem] text-white/45 tabular-nums shrink-0">
                            {r.totalPoints} {t('common.pts')}
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* ─── CTAs ─── */}
            <button
              type="button"
              onClick={() => handleAction('create')}
              className="mt-1 px-4 py-3.5 rounded-xl text-center font-bold bg-gradient-to-r from-euro-purple-light to-euro-pink text-white shadow-[0_4px_20px_rgba(168,85,247,0.3)] hover:brightness-110 transition cursor-pointer"
            >
              {t('siteNav.createRoom')}
            </button>
            <button
              type="button"
              onClick={() => handleAction('join')}
              className="px-4 py-3 rounded-xl text-center font-semibold bg-white/[0.07] border border-white/[0.18] text-white hover:bg-white/[0.11] transition cursor-pointer"
            >
              {t('siteNav.joinRoom')}
            </button>

            {/* divider */}
            <div className="h-px bg-white/8 my-2" aria-hidden />

            {/* ─── Eurovision Night ─── */}
            <LocaleLink
              to="/eurovision-night"
              className="px-3.5 py-3 rounded-lg text-white/85 hover:bg-white/5 transition"
            >
              {t('siteNav.eurovisionNight')}
            </LocaleLink>

            {/* ─── How to play — collapsible ─── */}
            <div>
              <button
                type="button"
                onClick={() => setHowOpen((v) => !v)}
                aria-expanded={howOpen}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-white/85 hover:bg-white/5 transition cursor-pointer"
              >
                <span>{t('siteNav.howToPlay')}</span>
                <ChevronIcon open={howOpen} />
              </button>
              {howOpen && (
                <div className="ml-3 pl-3 border-l border-white/10 flex flex-col">
                  {HOW_TO_PLAY_LINKS.map((l) => {
                    if (l.key === 'trivia' && triviaLocked) {
                      return (
                        <div key={l.href} className="px-3 py-2.5">
                          <LockedBadge label={t(`siteNav.${l.key}`)} />
                        </div>
                      );
                    }
                    return (
                      <LocaleLink
                        key={l.href}
                        to={l.href}
                        className="px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
                      >
                        {t(`siteNav.${l.key}`)}
                      </LocaleLink>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Contact ─── */}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="px-3.5 py-3 rounded-lg text-white/85 hover:bg-white/5 transition"
            >
              {t('siteNav.contactUs')}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
