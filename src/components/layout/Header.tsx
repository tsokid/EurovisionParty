import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { PHASES } from '../../lib/constants';
import { useThemeStore } from '../../stores/themeStore';
import { useRoom } from '../../hooks/useRoom';
import { PHASE_ORDER } from '../../lib/constants';
import NotificationPanel from './NotificationPanel';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import MuteToggle from '../ui/MuteToggle';

export default function Header() {
  const { t } = useTranslation();
  const { room, player, notifications, roomPassword } = useGameStore();
  const isHost = player?.is_host === true;
  const { theme, toggleTheme } = useThemeStore();
  const { advancePhase } = useRoom();
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const currentPhaseIdx = PHASE_ORDER.indexOf(room?.phase ?? 'lobby');
  const currentPhaseKey = room?.phase ?? 'lobby';
  const phaseLabel = t(`phases.${currentPhaseKey}.label`);
  const nextPhase = currentPhaseIdx < PHASE_ORDER.length - 1 ? PHASES[currentPhaseIdx + 1] : null;

  const getInviteText = () => {
    const link = `${window.location.origin}/room/${room?.code}`;
    const passwordLine = roomPassword
      ? t('lobby.invitePasswordLine', { password: roomPassword })
      : '';
    return t('lobby.inviteText', { code: room?.code, passwordLine, link });
  };

  const copyRoomCode = () => {
    setShowInvite((v) => !v);
    setShowPhaseMenu(false);
    setShowNotifications(false);
    setShowProfile(false);
  };

  const shareInvite = async () => {
    const text = getInviteText();
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        const subject = encodeURIComponent(t('lobby.inviteSubject'));
        const body = encodeURIComponent(text);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      }
    } catch { /* cancelled */ }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(getInviteText());
      setInviteCopied(true);
      setCopied(true);
      setTimeout(() => { setInviteCopied(false); setCopied(false); }, 2000);
    } catch { /* noop */ }
  };

  const handleAdvancePhase = async () => {
    if (!room || !nextPhase || advancing) return;
    if (!window.confirm(t('header.advanceConfirm', { phase: t(`phases.${nextPhase.key}.label`) }))) return;
    setAdvancing(true);
    try {
      await advancePhase(room.id);
      setShowPhaseMenu(false);
    } finally {
      setAdvancing(false);
    }
  };

  const toggleProfile = () => {
    setShowProfile((v) => !v);
    setShowPhaseMenu(false);
    setShowInvite(false);
    setShowNotifications(false);
  };

  return (
    <>
      <header className="glass h-14 flex items-center justify-between px-4 shrink-0">
        {/* Left: Room code badge */}
        <button
          onClick={copyRoomCode}
          className="flex items-center gap-1.5 rounded-full bg-euro-purple/30 px-3 py-1 text-sm font-semibold text-euro-purple-light active:scale-95 transition-transform min-h-[36px]"
          aria-label={t('header.shareAria')}
        >
          <span className="text-xs opacity-60">📤</span>
          <span className="tracking-widest">{room?.code ?? '----'}</span>
          <AnimatePresence mode="wait">
            {copied && (
              <motion.span key="check" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-euro-green text-xs">✓</motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Center: Phase indicator */}
        <button
          onClick={() => { setShowPhaseMenu(!showPhaseMenu); setShowInvite(false); setShowProfile(false); setShowNotifications(false); }}
          className="text-sm font-medium text-white/70 truncate max-w-[160px] flex items-center gap-1 active:scale-95 transition-transform"
        >
          {phaseLabel}
          {nextPhase && <span className="text-[10px] text-white/30">▼</span>}
        </button>

        {/* Right: Profile button (contains all settings + notifications) */}
        <button
          onClick={toggleProfile}
          className="relative flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 min-h-[36px] active:scale-95 transition-transform"
          aria-label="Profile & Settings"
        >
          <span className="text-xl leading-none">{player?.avatar_emoji ?? '🎤'}</span>
          <span className="text-xs font-semibold text-white/80 max-w-[72px] truncate hidden sm:block">
            {player?.name ?? ''}
          </span>
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 bg-euro-red text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </button>
      </header>

      {/* Profile dropdown */}
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 z-50 px-4 pt-2" style={{ top: 'var(--top-bar-height, 56px)' }}
          >
            <div className="bg-[#1a0a2e] rounded-2xl border border-white/12 shadow-2xl max-w-xs ml-auto overflow-hidden">
              {/* Profile name row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
                <span className="text-3xl">{player?.avatar_emoji ?? '🎤'}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm leading-tight truncate">{player?.name ?? ''}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{room?.code} · {player?.total_points ?? 0} pts</p>
                </div>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-euro-red text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 shrink-0">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>

              {/* Settings rows */}
              <div className="py-1">
                {/* Notifications */}
                <button
                  onClick={() => { setShowProfile(false); setShowNotifications(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                  <span className="text-xl w-7 text-center">🔔</span>
                  <span className="flex-1 text-left">
                    {t('header.notifications', { defaultValue: 'Notifications' })}
                  </span>
                  {unreadCount > 0 && (
                    <span className="bg-euro-red text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Sound toggle */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="text-xl w-7 text-center">🔊</span>
                  <span className="flex-1 text-sm text-white/80">
                    {t('header.sound', { defaultValue: 'Sound' })}
                  </span>
                  <MuteToggle />
                </div>

                {/* Dark/Light mode */}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                  <span className="text-xl w-7 text-center">{theme === 'dark' ? '☀️' : '🌙'}</span>
                  <span className="flex-1 text-left">
                    {theme === 'dark'
                      ? t('header.lightMode', { defaultValue: 'Light Mode' })
                      : t('header.darkMode', { defaultValue: 'Dark Mode' })}
                  </span>
                </button>

                {/* Language */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="text-xl w-7 text-center">🌐</span>
                  <span className="flex-1 text-sm text-white/80">
                    {t('header.language', { defaultValue: 'Language' })}
                  </span>
                  <LanguageSwitcher />
                </div>
              </div>
            </div>
            <div className="fixed inset-0 -z-10" onClick={() => setShowProfile(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase progression dropdown */}
      <AnimatePresence>
        {showPhaseMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 z-50 px-4 pt-2" style={{ top: 'var(--top-bar-height, 56px)' }}
          >
            <div className="bg-[#1a0a2e] rounded-2xl p-4 border border-white/12 shadow-2xl max-w-md mx-auto">
              <p className="text-xs text-white/40 mb-3 font-medium">{t('header.gamePhases')}</p>
              <div className="space-y-1.5">
                {PHASES.map((p, idx) => {
                  const isCurrent = p.key === room?.phase;
                  const isPast = idx < currentPhaseIdx;
                  const isNext = idx === currentPhaseIdx + 1;
                  return (
                    <div key={p.key} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      isCurrent ? 'bg-euro-purple/30 text-white font-semibold' :
                      isPast ? 'text-white/30' :
                      'text-white/50'
                    }`}>
                      <span className="w-5 text-center text-xs">
                        {isPast ? '✓' : isCurrent ? '●' : isNext ? '→' : '○'}
                      </span>
                      <span className="flex-1">{t(`phases.${p.key}.label`)}</span>
                      {isNext && isHost && (
                        <button
                          onClick={handleAdvancePhase}
                          disabled={advancing}
                          className="text-[10px] bg-euro-purple/50 hover:bg-euro-purple/70 text-white px-2 py-1 rounded-md font-medium transition-colors"
                        >
                          {advancing ? '...' : t('header.advance')}
                        </button>
                      )}
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

      {/* Invite panel */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 z-50 px-4 pt-2" style={{ top: 'var(--top-bar-height, 56px)' }}
          >
            <div className="bg-[#1a0a2e] rounded-2xl p-4 border border-white/12 shadow-2xl max-w-md mx-auto">
              <p className="text-xs text-white/40 mb-2 font-medium">{t('header.inviteFriends')}</p>
              <div className="text-center mb-3">
                <p className="text-3xl font-extrabold tracking-[0.25em] glow-text-gold text-euro-gold">
                  {room?.code}
                </p>
                {roomPassword && (
                  <p className="text-xs text-white/50 mt-1">{t('header.password', { password: roomPassword })}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={shareInvite}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-euro-purple/40 py-2.5 text-sm font-medium text-euro-purple-light active:scale-95 transition-transform"
                >
                  {t('header.share')}
                </button>
                <button
                  onClick={copyInvite}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-euro-purple/40 py-2.5 text-sm font-medium text-euro-purple-light active:scale-95 transition-transform"
                >
                  {inviteCopied ? t('header.copiedInvite') : t('header.copy')}
                </button>
              </div>
            </div>
            <div className="fixed inset-0 -z-10" onClick={() => setShowInvite(false)} />
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
