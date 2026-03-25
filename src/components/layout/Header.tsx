import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { PHASES } from '../../lib/constants';
import { useThemeStore } from '../../stores/themeStore';
import { useRoom } from '../../hooks/useRoom';
import { useNavigate } from 'react-router-dom';
import { PHASE_ORDER } from '../../lib/constants';
import NotificationPanel from './NotificationPanel';

export default function Header() {
  const { room, player, notifications } = useGameStore();
  const isHost = player?.is_host === true;
  const { theme, toggleTheme } = useThemeStore();
  const { advancePhase, leaveRoom } = useRoom();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const currentPhaseIdx = PHASE_ORDER.indexOf(room?.phase ?? 'lobby');
  const phaseLabel = PHASES.find((p) => p.key === room?.phase)?.label ?? 'Lobby';
  const nextPhase = currentPhaseIdx < PHASE_ORDER.length - 1 ? PHASES[currentPhaseIdx + 1] : null;

  const copyRoomCode = async () => {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const handleAdvancePhase = async () => {
    if (!room || !nextPhase || advancing) return;
    if (!window.confirm(`Advance to "${nextPhase.label}"? This affects all players.`)) return;
    setAdvancing(true);
    try {
      await advancePhase(room.id);
      setShowPhaseMenu(false);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <>
      <header className="glass safe-top sticky top-0 z-40 h-14 flex items-center justify-between px-4 shrink-0">
        {/* Left: Room code badge */}
        <button
          onClick={copyRoomCode}
          className="flex items-center gap-1.5 rounded-full bg-euro-purple/30 px-3 py-1 text-sm font-semibold text-euro-purple-light active:scale-95 transition-transform min-h-[36px]"
          aria-label="Copy room code"
        >
          <span className="text-xs opacity-60">🔗</span>
          <span className="tracking-widest">{room?.code ?? '----'}</span>
          <AnimatePresence mode="wait">
            {copied && (
              <motion.span key="check" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-euro-green text-xs">✓</motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Center: Phase indicator (clickable to show phase menu) */}
        <button
          onClick={() => setShowPhaseMenu(!showPhaseMenu)}
          className="text-sm font-medium text-white/70 truncate max-w-[160px] flex items-center gap-1 active:scale-95 transition-transform"
        >
          {phaseLabel}
          {nextPhase && <span className="text-[10px] text-white/30">▼</span>}
        </button>

        {/* Right: theme toggle + notification bell */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full active:scale-95 transition-transform"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full active:scale-95 transition-transform"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <span className="text-lg">🔔</span>
            {unreadCount > 0 && (
              <motion.span key={unreadCount} initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 bg-euro-red text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </button>
        </div>
      </header>

      {/* Phase progression dropdown */}
      <AnimatePresence>
        {showPhaseMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-14 z-50 px-4 pt-2"
          >
            <div className="glass rounded-2xl p-4 border border-white/10 shadow-xl max-w-md mx-auto">
              <p className="text-xs text-white/40 mb-3 font-medium">Game Phases</p>
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
                      <span className="flex-1">{p.label}</span>
                      {isNext && isHost && (
                        <button
                          onClick={handleAdvancePhase}
                          disabled={advancing}
                          className="text-[10px] bg-euro-purple/50 hover:bg-euro-purple/70 text-white px-2 py-1 rounded-md font-medium transition-colors"
                        >
                          {advancing ? '...' : 'Advance →'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Leave room */}
              <button
                onClick={async () => {
                  if (window.confirm('Leave this room? Your progress will be saved if you rejoin.')) {
                    await leaveRoom();
                    navigate('/', { replace: true });
                  }
                }}
                className="w-full mt-3 text-xs text-euro-red/60 hover:text-euro-red text-center py-2 rounded-lg hover:bg-euro-red/10 transition-colors"
              >
                🚪 Leave Room
              </button>
              <button
                onClick={() => setShowPhaseMenu(false)}
                className="w-full mt-1 text-xs text-white/30 hover:text-white/50 text-center py-1"
              >
                Close
              </button>
            </div>
            {/* Backdrop */}
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
