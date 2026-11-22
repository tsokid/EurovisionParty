import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserRooms, getBadge } from '../../hooks/useUserRooms';
import MuteToggle from '../ui/MuteToggle';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import LocaleLink from './LocaleLink';
import Wordmark from './Wordmark';
import { useLocale } from '../../lib/seo/LocaleContext';
import { localizePath, stripLocaleFromPath } from '../../lib/seo/locale';
import { useGameStore } from '../../stores/gameStore';
import LockedBadge from '../ui/LockedBadge';
import type { SiteSnapshot } from '../../content/contests/types';
import { useContent } from '../../lib/seo/useContent';
import { buttonClass } from '../stage';
import { linkText, resolveLinks, useSiteDoc, type ResolvedLink } from '../../lib/cms/siteChrome';
import type { LinkTarget, NavLink as NavLinkDoc } from '../../../supabase/functions/_shared/cms/siteLinks';

/**
 * The live contest year for the header's {year} labels and its hub link. It
 * comes from site.json, which every prerendered page inlines because the
 * header reads it; null while it is unknown or the live contest is archived
 * (the hub then redirects to the archive, so the hub link is left out).
 */
function useHubYear(): number | null {
  const site = useContent<SiteSnapshot>('site.json');
  return site.status === 'ready' && site.data.live_stage !== 'archived' ? site.data.current_year : null;
}

/** The "How to play" guide page: a menu also reads as active there. */
const MENU_LANDING_PATH = '/how-to-play';

/** Trivia cannot be opened while a room is broadcasting (voting or final). */
const isTrivia = (l: ResolvedLink) => l.target.kind === 'page' && l.target.pageId === 'eurovision-trivia';

interface HeaderEntry {
  label: string;
  /** A link (`link`) or a menu (`links`). */
  link: ResolvedLink | null;
  links: ResolvedLink[];
}

/**
 * The header doc's (content/pages/site-header.json) visible items, resolved.
 * Links with nowhere to go (the hub while no year is live) and menus left
 * without links are skipped.
 */
function useHeaderEntries(year: number | null): HeaderEntry[] {
  const locale = useLocale();
  const doc = useSiteDoc('site-header');
  const out: HeaderEntry[] = [];
  for (const item of doc.items) {
    if (item.hidden) continue;
    if (item.target) {
      const [link] = resolveLinks([{ label: item.label, target: item.target as LinkTarget }], locale, year);
      if (link) out.push({ label: link.label, link, links: [] });
      continue;
    }
    const links = resolveLinks((item.children ?? []) as NavLinkDoc[], locale, year);
    if (links.length) out.push({ label: linkText(item.label, year), link: null, links });
  }
  return out;
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
  return <Wordmark />;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function SiteHeader() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  /** The desktop menu whose popover is open (its index in `entries`). */
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const locale = useLocale();
  const { rooms } = useUserRooms();
  const room = useGameStore((s) => s.room);
  const inRoomBroadcasting = !!room && (room.phase === 'voting_live' || room.phase === 'final');
  const triviaLocked = inRoomBroadcasting;
  const year = useHubYear();
  const entries = useHeaderEntries(year);
  const { cta, ui } = useSiteDoc('site-header');
  const leaves = entries.filter((e) => e.link !== null);
  const menus = entries.filter((e) => e.link === null);
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

  // Close the desktop menu popover on outside click / esc
  useEffect(() => {
    if (openMenu === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-how-popover]')) setOpenMenu(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [openMenu]);

  const liveRooms = rooms.filter((r) => getBadge(r) !== 'ENDED');
  const roomCount = liveRooms.length;
  const cleanPath = stripLocaleFromPath(pathname);
  const menuActive = (e: HeaderEntry, i: number) =>
    openMenu === i || e.links.some((l) => l.to === cleanPath) || cleanPath === MENU_LANDING_PATH;

  const handleAction = (action: 'create' | 'join') => {
    setOpen(false);
    navigate(`${localizePath(locale, '/')}?action=${action}`);
  };

  /** A link of the drawer, or its locked badge (trivia while broadcasting). */
  const drawerLink = (l: ResolvedLink, sub: boolean) =>
    isTrivia(l) && triviaLocked ? (
      <div className={`drawer-link${sub ? ' sub' : ''}`}><LockedBadge label={l.label} /></div>
    ) : (
      <LocaleLink to={l.to} className={`drawer-link${sub ? ' sub' : ''}${cleanPath === l.to ? ' on' : ''}`}>{l.label}</LocaleLink>
    );

  const drawer = open ? (
    <div
      ref={dialogRef}
      id="site-drawer"
      className="drawer lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={ui.menu}
    >
      <div className="drawer-head">
        <div className="wrap topbar-row">
          <Logo />
          <span className="spacer" />
          <button
            type="button"
            data-autofocus
            onClick={() => setOpen(false)}
            aria-label={ui.closeMenu}
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
            {cta.createRoom}
          </button>
          <button type="button" onClick={() => handleAction('join')} className={buttonClass({ variant: 'secondary', size: 'lg', block: true })}>
            {cta.joinRoom}
          </button>
        </div>

        {/* ─── Pages ─── */}
        {leaves.length > 0 && (
          <ul className="drawer-links">
            {leaves.map((e) => (
              <li key={e.link!.to}>{drawerLink(e.link!, false)}</li>
            ))}
          </ul>
        )}

        {/* ─── Menus (How to play) ─── */}
        {menus.map((m, i) => (
          <div key={i}>
            <span className="t-eyebrow">{m.label}</span>
            <ul className="drawer-links">
              {m.links.map((l) => (
                <li key={l.to}>{drawerLink(l, true)}</li>
              ))}
            </ul>
          </div>
        ))}

        {/* ─── Your Rooms — collapsible ─── */}
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setRoomsOpen((v) => !v)}
            aria-expanded={roomsOpen}
            className="w-full flex items-center justify-between gap-3 min-h-[56px] px-4 text-left cursor-pointer text-stage-text"
          >
            <span className="flex items-center gap-2.5">
              <span className="font-semibold">{ui.yourRooms}</span>
              {roomCount > 0 && (
                <span className="chip chip-pink num">{roomCount}</span>
              )}
            </span>
            <ChevronIcon open={roomsOpen} />
          </button>
          {roomsOpen && (
            <div className="px-2 pb-2 flex flex-col gap-1">
              {rooms.length === 0 ? (
                <p className="t-meta px-2.5 py-2 m-0">{ui.noRooms}</p>
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
          {entries.map((e, i) => {
            if (e.link) {
              const l = e.link;
              if (isTrivia(l) && triviaLocked) {
                return <span key={l.to} className="nav-item"><LockedBadge label={l.label} /></span>;
              }
              return (
                <LocaleLink key={l.to} to={l.to} className={`nav-item${cleanPath === l.to ? ' on' : ''}`}>
                  {l.label}
                </LocaleLink>
              );
            }
            const isOpen = openMenu === i;
            return (
              /* A menu (How to play): popover */
              <div key={`menu-${i}`} className="relative" data-how-popover>
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); setOpenMenu((v) => (v === i ? null : i)); }}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  className={`nav-item${menuActive(e, i) ? ' on' : ''}`}
                >
                  {e.label}
                  <ChevronIcon open={isOpen} />
                </button>
                {isOpen && (
                  <div className="menu-pop" style={{ left: 0, right: 'auto' }} role="menu">
                    {e.links.map((l) => {
                      if (isTrivia(l) && triviaLocked) {
                        return (
                          <div key={l.to} className="px-2 py-1" role="menuitem">
                            <LockedBadge label={l.label} />
                          </div>
                        );
                      }
                      return (
                        <LocaleLink
                          key={l.to}
                          to={l.to}
                          role="menuitem"
                          className="menu-item"
                          onClick={() => setOpenMenu(null)}
                        >
                          {l.label}
                        </LocaleLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <span className="spacer" />

        <MuteToggle variant="stage" />
        <LanguageSwitcher variant="stage" />

        <button
          type="button"
          onClick={() => handleAction('join')}
          className={buttonClass({ variant: 'secondary', size: 'sm', className: 'hidden xl:inline-flex' })}
        >
          {cta.joinRoom}
        </button>
        <button
          type="button"
          onClick={() => handleAction('create')}
          className={buttonClass({ size: 'sm', className: 'hidden lg:inline-flex' })}
        >
          {cta.createRoom}
        </button>

        {/* Mobile menu button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-drawer"
          aria-label={open ? ui.closeMenu : ui.openMenu}
          className="iconbtn lg:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {drawer && typeof document !== 'undefined' ? createPortal(drawer, document.body) : null}
    </header>
  );
}
