import { Fragment, useEffect, useState } from 'react';
import { Menu, Share2, Copy, Check, DoorOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import { PHASES, PHASE_ORDER } from '../../lib/constants';
import { avatarGradient, avatarInitial } from '../../lib/avatarUtils';
import NotificationPanel from './NotificationPanel';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import MuteToggle from '../ui/MuteToggle';

// Compact phase labels for the desktop linear progress bar
const SHORT_PHASE_LABEL: Record<string, string> = {
  lobby:            'Lobby',
  pre_night:        'Pre-Night',
  predictions_open: 'Predictions',
  voting_live:      'Voting',
  final:            'Final',
};

interface HeaderProps {
  /** When provided, renders an Exit Game row inside the profile dropdown. */
  onExitPress?: () => void;
}

export default function Header({ onExitPress }: HeaderProps = {}) {
  const { t } = useTranslation();
  const { room, player, notifications, roomPassword } = useGameStore();
  const [codeCopied, setCodeCopied]       = useState(false);
  const [inviteCopied, setInviteCopied]   = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [showProfile, setShowProfile]     = useState(false);

  const unreadCount      = notifications.filter((n) => !n.is_read).length;
  const currentPhaseIdx  = PHASE_ORDER.indexOf(room?.phase ?? 'lobby');
  const currentPhaseKey  = room?.phase ?? 'lobby';
  const phaseLabel       = t(`phases.${currentPhaseKey}.label`);

  // Bridge: BottomNav (mobile burger) opens this menu via a window event.
  // Desktop continues to drive showProfile from the in-header burger.
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

  // ── Invite text helpers (unchanged from previous behaviour) ─────────────
  const getInviteText = () => {
    const link = `${window.location.origin}/room/${room?.code}`;
    const passwordLine = roomPassword
      ? t('lobby.invitePasswordLine', { password: roomPassword })
      : '';
    return t('lobby.inviteText', { code: room?.code, passwordLine, link });
  };

  const shareInvite = async () => {
    const text = getInviteText();
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        const subject = encodeURIComponent(t('lobby.inviteSubject'));
        const body    = encodeURIComponent(text);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      }
    } catch { /* user cancelled */ }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(getInviteText());
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch { /* clipboard denied */ }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(room?.code ?? '');
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch { /* clipboard denied */ }
  };

  const toggleProfile = () => {
    setShowProfile((v) => !v);
    setShowPhaseMenu(false);
    setShowNotifications(false);
  };

  // Fill % for each connector segment in the desktop progress bar.
  // A segment between phase i and i+1 is full once phase i is past,
  // partially filled (25%) when phase i is current, empty otherwise.
  const segmentFill = (i: number): number => {
    if (i < currentPhaseIdx) return 100;
    if (i === currentPhaseIdx) return 25;
    return 0;
  };

  return (
    <>
      <header
        className="h-14 relative flex items-center justify-between px-4 lg:px-6 shrink-0 border-b border-white/10"
        style={{ background: 'rgb(10, 5, 25)' }}
      >
        {/* ── Logo (left) — object-contain so the full image shows ── */}
        <div
          className="flex items-center select-none"
          aria-label="Eurovision Games"
          title="Eurovision Games"
        >
          <img
            src="/logo.png"
            alt="Eurovision Games"
            className="h-9 lg:h-12 w-auto object-contain max-w-[120px] lg:max-w-[180px]"
            draggable={false}
          />
        </div>

        {/* ── Mobile/tablet: centered phase pill ── */}
        <button
          onClick={() => {
            setShowPhaseMenu((v) => !v);
            setShowProfile(false);
            setShowNotifications(false);
          }}
          className="lg:hidden absolute left-1/2 -translate-x-1/2 text-sm font-medium text-white/70 truncate max-w-[100px] sm:max-w-[140px] flex items-center gap-1 active:scale-95 transition-transform"
        >
          {phaseLabel}
          <span className="text-[10px] text-white/30">▼</span>
        </button>

        {/* ── Desktop: linear phase progress bar ── */}
        <div className="hidden lg:flex flex-1 max-w-[640px] mx-8 items-center">
          {PHASES.map((p, i) => {
            const isCurrent = i === currentPhaseIdx;
            const isPast    = i < currentPhaseIdx;
            const isLast    = i === PHASES.length - 1;
            return (
              <Fragment key={p.key}>
                {/* Node */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={clsx(
                    'flex items-center justify-center font-bold rounded-full',
                    isCurrent
                      ? 'w-7 h-7 text-[11px] text-white bg-gradient-to-br from-euro-purple to-euro-pink shadow-[0_0_18px_rgba(236,72,153,0.5)]'
                      : isPast
                        ? 'w-6 h-6 text-[10px] text-white bg-euro-purple'
                        : 'w-6 h-6 text-[10px] text-white/30 border border-white/15',
                  )}>
                    {isPast ? '✓' : i + 1}
                  </div>
                  <span className={clsx(
                    'tracking-wide whitespace-nowrap',
                    isCurrent
                      ? 'text-[12px] font-bold text-white'
                      : isPast
                        ? 'text-[11px] font-semibold text-white/40'
                        : 'text-[11px] font-semibold text-white/30',
                  )}>
                    {SHORT_PHASE_LABEL[p.key] ?? p.label}
                  </span>
                </div>
                {/* Connector */}
                {!isLast && (
                  <div className="flex-1 h-[2px] bg-white/8 rounded-full overflow-hidden mx-3 relative">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-euro-purple to-euro-pink"
                      style={{ width: `${segmentFill(i)}%` }}
                    />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        {/* ── Burger menu button (right) ──
            Desktop only — on mobile the burger lives in BottomNav so the
            menu trigger is closer to the player's thumb. The dropdown
            content is identical across both triggers. */}
        <button
          onClick={toggleProfile}
          className="hidden lg:flex relative items-center gap-2 rounded-full bg-white/8 hover:bg-white/12 pl-2.5 pr-3 py-1 min-h-[36px] active:scale-95 transition-transform"
          aria-label={t('header.openMenu', { defaultValue: 'Open menu' })}
        >
          <Menu className="w-5 h-5 text-white" strokeWidth={2.2} />
          <span className="text-sm font-semibold text-white max-w-[110px] truncate">
            {player?.name ?? ''}
          </span>
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 bg-euro-red text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </button>
      </header>

      {/* ────────────────────────────────────────────────────────────────────
          PROFILE DROPDOWN — now hosts the Room block (code, password,
          share, copy invite) plus settings.
         ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              'fixed inset-x-0 z-50 px-4 pointer-events-none',
              // Desktop: dropdown from below the header
              'lg:top-[var(--top-bar-height,56px)] lg:bottom-auto lg:pt-2',
              // Mobile: bottom sheet — appears above the BottomNav (≈72px) +
              //         safe-area inset, so the trigger and the panel sit
              //         in the same thumb zone
              'max-lg:bottom-[calc(72px+env(safe-area-inset-bottom))] max-lg:top-auto max-lg:pb-2',
            )}
          >
            <div className="bg-[#1a0a2e] rounded-2xl border border-white/12 shadow-2xl ml-auto max-w-xs lg:max-w-[340px] pointer-events-auto">
              {/* Player row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
                <div className={clsx(
                  'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white',
                  avatarGradient(0),
                )}>
                  {avatarInitial(player?.name ?? '?')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-sm truncate">{player?.name ?? ''}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {(player?.total_points ?? 0).toLocaleString()} pts
                  </p>
                </div>
              </div>

              {/* ROOM block */}
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-[10px] tracking-widest text-white/40 font-bold uppercase mb-2">
                  {t('header.room', { defaultValue: 'Room' })}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold tracking-[0.25em] text-euro-gold leading-none truncate">
                      {room?.code ?? '----'}
                    </p>
                    {roomPassword && (
                      <p className="text-[11px] text-white/45 mt-1.5">
                        {t('header.password', { password: roomPassword })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={copyRoomCode}
                    className="rounded-full bg-white/10 hover:bg-white/15 p-2.5 active:scale-95 transition-transform flex-shrink-0"
                    aria-label={t('header.copyCode', { defaultValue: 'Copy code' })}
                  >
                    {codeCopied
                      ? <Check className="w-4 h-4 text-emerald-400" strokeWidth={2.4} />
                      : <Copy  className="w-4 h-4 text-white/70"      strokeWidth={2} />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={shareInvite}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-euro-purple/30 border border-euro-purple/50 py-2.5 text-xs font-bold text-euro-purple-light active:scale-95 transition-transform"
                  >
                    <Share2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                    {t('header.share')}
                  </button>
                  <button
                    onClick={copyInvite}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-white/8 border border-white/15 py-2.5 text-xs font-bold text-white active:scale-95 transition-transform"
                  >
                    {inviteCopied
                      ? <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.4} />
                      : <Copy  className="w-3.5 h-3.5"                  strokeWidth={2.4} />}
                    {inviteCopied ? t('header.copiedInvite') : t('header.copy')}
                  </button>
                </div>
              </div>

              {/* Settings */}
              <div className="py-1">
                <button
                  onClick={() => { setShowProfile(false); setShowNotifications(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                  <span className="flex-1 text-left">
                    {t('header.notifications', { defaultValue: 'Notifications' })}
                  </span>
                  {unreadCount > 0 && (
                    <span className="bg-euro-red text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="flex-1 text-sm text-white/80">
                    {t('header.sound', { defaultValue: 'Sound' })}
                  </span>
                  <MuteToggle />
                </div>

                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="flex-1 text-sm text-white/80">
                    {t('header.language', { defaultValue: 'Language' })}
                  </span>
                  <LanguageSwitcher />
                </div>

                {/* Exit game — only when AppShell wires up an onExitPress.
                    Surfaced here so the player can leave even in phases
                    where the bottom nav is hidden (e.g. final). */}
                {onExitPress && (
                  <button
                    onClick={() => { setShowProfile(false); onExitPress(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/8 mt-1"
                  >
                    <DoorOpen className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
                    <span className="flex-1 text-left font-semibold">
                      {t('header.exit', { defaultValue: 'Exit game' })}
                    </span>
                  </button>
                )}
              </div>
            </div>
            {/* Click-outside catcher — pointer-events-auto so it still
                receives clicks even though the parent wrapper is set to
                pointer-events-none for the surrounding empty space. The
                semi-transparent black is mobile-only; desktop keeps a
                clean dropdown without a backdrop dim. */}
            <div
              className="fixed inset-0 -z-10 pointer-events-auto bg-black/45 lg:bg-transparent"
              onClick={() => setShowProfile(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Phase progression dropdown (mobile pill tap-target) ── */}
      <AnimatePresence>
        {showPhaseMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 z-50 px-4 pt-2"
            style={{ top: 'var(--top-bar-height, 56px)' }}
          >
            <div className="bg-[#1a0a2e] rounded-2xl p-4 border border-white/12 shadow-2xl max-w-md mx-auto">
              <p className="text-xs text-white/40 mb-3 font-medium">{t('header.gamePhases')}</p>
              <div className="space-y-1.5">
                {PHASES.map((p, idx) => {
                  const isCurrent = p.key === room?.phase;
                  const isPast    = idx < currentPhaseIdx;
                  const isNext    = idx === currentPhaseIdx + 1;
                  return (
                    <div
                      key={p.key}
                      className={clsx(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                        isCurrent ? 'bg-euro-purple/30 text-white font-semibold'
                          : isPast ? 'text-white/30'
                          : 'text-white/50',
                      )}
                    >
                      <span className="w-5 text-center text-xs">
                        {isPast ? '✓' : isCurrent ? '●' : isNext ? '→' : '○'}
                      </span>
                      <span className="flex-1">{t(`phases.${p.key}.label`)}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setShowPhaseMenu(false)}
                className="w-full mt-1 text-xs text-white/30 hover:text-white/50 text-center py-1"
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
