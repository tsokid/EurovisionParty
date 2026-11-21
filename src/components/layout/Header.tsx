import { useEffect, useState } from 'react';
import { Bell, Share2, Copy, Check, DoorOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { PHASES, PHASE_ORDER } from '../../lib/constants';
import { useInvite } from '../../hooks/useInvite';
import { Avatar, ScoreChip } from '../stage';
import PhaseStrip from './PhaseStrip';
import NotificationPanel from './NotificationPanel';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import MuteToggle from '../ui/MuteToggle';

interface HeaderProps {
  /** When provided, renders an Exit Game row inside the profile dropdown. */
  onExitPress?: () => void;
}

/**
 * Game bar. Mobile: room code, points chip, notifications, own avatar +
 * stage name (opens the menu), then the compact phase strip. Desktop: the
 * full phase strip, notifications and the same "me" button; the room code
 * lives in the side rail.
 */
export default function Header({ onExitPress }: HeaderProps = {}) {
  const { t } = useTranslation();
  const { room, player, players, notifications, roomPassword } = useGameStore();
  const { code, shareInvite, copyInvite, copyCode, codeCopied, inviteCopied } = useInvite();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const unreadCount     = notifications.filter((n) => !n.is_read).length;
  const currentPhaseKey = room?.phase ?? 'lobby';
  const currentPhaseIdx = PHASE_ORDER.indexOf(currentPhaseKey);
  // Realtime updates land in `players`; `player` is the joined snapshot.
  const me     = players.find((p) => p.id === player?.id) ?? player;
  const points = me?.total_points ?? 0;
  const name   = me?.name ?? '';

  // Bridge: other components can open / close this menu via window events.
  useEffect(() => {
    const open = () => {
      setShowProfile(true);
      setShowPhaseMenu(false);
      setShowNotifications(false);
    };
    const close = () => setShowProfile(false);
    window.addEventListener('menu:open', open);
    window.addEventListener('menu:close', close);
    return () => {
      window.removeEventListener('menu:open', open);
      window.removeEventListener('menu:close', close);
    };
  }, []);

  const toggleProfile = () => {
    setShowProfile((v) => !v);
    setShowPhaseMenu(false);
    setShowNotifications(false);
  };
  const openNotifications = () => {
    setShowNotifications(true);
    setShowProfile(false);
    setShowPhaseMenu(false);
  };

  const pointsLabel = t('game.points', { count: points });
  const badge = unreadCount > 9 ? '9+' : String(unreadCount);
  const bellLabel = unreadCount > 0
    ? `${t('header.notifications')} · ${badge}`
    : t('header.notifications');

  const bell = (
    <button type="button" className="gs-bell" onClick={openNotifications} aria-label={bellLabel}>
      <Bell aria-hidden="true" strokeWidth={2} />
      {unreadCount > 0 && (
        <motion.b key={unreadCount} initial={{ scale: 0 }} animate={{ scale: 1 }} aria-hidden="true">
          {badge}
        </motion.b>
      )}
    </button>
  );

  const meButton = (withPoints: boolean) => (
    <button
      type="button"
      className="gs-me"
      onClick={toggleProfile}
      aria-expanded={showProfile}
      aria-haspopup="dialog"
      aria-label={`${t('header.openMenu')}: ${name}`}
    >
      <Avatar name={name || '?'} avatarId={me?.avatar_id} size="sm" className="gs-me-av" />
      <span className="gs-me-name">{name}</span>
      {withPoints && <ScoreChip points={points} srLabel={pointsLabel} />}
    </button>
  );

  return (
    <>
      {/* ── Mobile / tablet game bar ── */}
      <header className="gs-bar">
        <div className="gs-code">
          <small>{t('game.room')}</small>
          <span className="num">{code || '------'}</span>
        </div>
        <span className="spacer" />
        <ScoreChip points={points} srLabel={pointsLabel} />
        {bell}
        {meButton(false)}
      </header>
      <PhaseStrip
        phase={currentPhaseKey}
        variant="compact"
        className="gs-only-m"
        expanded={showPhaseMenu}
        onToggle={() => {
          setShowPhaseMenu((v) => !v);
          setShowProfile(false);
          setShowNotifications(false);
        }}
      />

      {/* ── Desktop top bar (room code is in the rail) ── */}
      <div className="gs-top">
        <PhaseStrip phase={currentPhaseKey} variant="full" className="gs-top-strip" />
        {bell}
        {meButton(true)}
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          PROFILE MENU — room block (code, password, share, copy invite)
          plus settings and exit.
         ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showProfile && (
          // Full-screen click-catcher. Clicking anywhere outside the
          // panel closes the menu; the inner panel stops propagation so
          // its own clicks don't dismiss it. Backdrop dim is mobile-only.
          <motion.div
            key="menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 max-lg:bg-black/45"
            onClick={() => setShowProfile(false)}
          >
            <motion.div
              role="dialog"
              aria-label={t('header.openMenu')}
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                'gs-menu absolute',
                'max-h-[calc(100svh-120px)] overflow-y-auto',
                // Desktop: dropdown under the top bar, anchored top-right.
                'lg:top-[calc(var(--top-bar-height-lg,52px)+8px)] lg:right-4 lg:w-[360px]',
                // Mobile: bottom sheet above the tab bar + safe area.
                'max-lg:bottom-[calc(var(--tab-bar-height,86px)+env(safe-area-inset-bottom))] max-lg:left-4 max-lg:right-4',
              )}
            >
              {/* Player row */}
              <div className="player me gs-menu-me">
                <Avatar name={name || '?'} avatarId={me?.avatar_id} />
                <div className="min-w-0 flex-1">
                  <p className="gs-menu-name">{name}</p>
                  <p className="t-meta">{pointsLabel}</p>
                </div>
              </div>

              {/* ROOM block */}
              <div className="gs-menu-sec">
                <p className="t-eyebrow">{t('header.room', { defaultValue: 'Room' })}</p>
                <div className="flex items-center justify-between gap-3 mt-2 mb-3">
                  <div className="min-w-0">
                    <p className="num gs-menu-code">{code || '------'}</p>
                    {roomPassword && (
                      <p className="t-meta mt-1">{t('header.password', { password: roomPassword })}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="iconbtn"
                    aria-label={t('header.copyCode', { defaultValue: 'Copy code' })}
                  >
                    {codeCopied
                      ? <Check className="w-4 h-4 text-stage-ok" strokeWidth={2.4} aria-hidden="true" />
                      : <Copy  className="w-4 h-4"               strokeWidth={2}   aria-hidden="true" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={shareInvite} className="btn btn-secondary btn-sm">
                    <Share2 className="w-3.5 h-3.5" strokeWidth={2.4} aria-hidden="true" />
                    {t('header.share')}
                  </button>
                  <button type="button" onClick={copyInvite} className="btn btn-secondary btn-sm">
                    {inviteCopied
                      ? <Check className="w-3.5 h-3.5 text-stage-ok" strokeWidth={2.4} aria-hidden="true" />
                      : <Copy  className="w-3.5 h-3.5"               strokeWidth={2.4} aria-hidden="true" />}
                    {inviteCopied ? t('header.copiedInvite') : t('header.copy')}
                  </button>
                </div>
              </div>

              {/* Settings */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => { setShowProfile(false); setShowNotifications(true); }}
                  className="menu-item"
                >
                  <span className="flex-1 text-left">
                    {t('header.notifications', { defaultValue: 'Notifications' })}
                  </span>
                  {unreadCount > 0 && <span className="gs-count">{badge}</span>}
                </button>

                <div className="gs-menu-row">
                  <span className="flex-1">{t('header.sound', { defaultValue: 'Sound' })}</span>
                  <MuteToggle />
                </div>

                <div className="gs-menu-row">
                  <span className="flex-1">{t('header.language', { defaultValue: 'Language' })}</span>
                  {/* placement="top" so the listbox opens UPWARD inside
                      the menu — on mobile the menu is bottom-anchored
                      and the listbox would otherwise fall off-screen. */}
                  <LanguageSwitcher placement="top" />
                </div>

                {/* Exit game — only when AppShell wires up an onExitPress. */}
                {onExitPress && (
                  <button
                    type="button"
                    onClick={() => { setShowProfile(false); onExitPress(); }}
                    className="menu-item gs-menu-exit"
                  >
                    <DoorOpen className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} aria-hidden="true" />
                    <span className="flex-1 text-left font-semibold">
                      {t('header.exit', { defaultValue: 'Exit game' })}
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── All phases (mobile strip tap-target) ── */}
      <AnimatePresence>
        {showPhaseMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 z-50 px-4 pt-2"
            style={{ top: 'var(--top-bar-height, 94px)' }}
          >
            <div className="gs-menu p-4 max-w-md mx-auto" role="dialog" aria-label={t('header.gamePhases')}>
              <p className="t-eyebrow mb-3">{t('header.gamePhases')}</p>
              <ol className="gs-phase-list">
                {PHASES.map((p, idx) => {
                  const isCurrent = p.key === room?.phase;
                  const isPast    = idx < currentPhaseIdx;
                  return (
                    <li
                      key={p.key}
                      className={clsx(isCurrent ? 'now' : isPast ? 'past' : 'next')}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      <span className="b" aria-hidden="true">{isPast ? '✓' : idx + 1}</span>
                      <span className="flex-1">{t(`phases.${p.key}.label`)}</span>
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                onClick={() => setShowPhaseMenu(false)}
                className="btn btn-ghost btn-sm btn-block mt-2"
              >
                {t('header.close')}
              </button>
            </div>
            <div className="fixed inset-0 -z-10" onClick={() => setShowPhaseMenu(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <NotificationPanel
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}
