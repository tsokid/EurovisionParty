import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useNotifications } from '../../hooks/useNotifications';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

function useFormatNotification() {
  const { t } = useTranslation();

  return (type: string, payload: Record<string, unknown>): { icon: string; text: string } => {
    switch (type) {
      case 'duel_challenge':
        return {
          icon: '\u2694\uFE0F',
          text: t('notifications.duelChallenge', { name: payload.challengerName ?? 'Someone' }),
        };
      case 'duel_won':
        return {
          icon: '\uD83C\uDFC6',
          text: t('notifications.duelWon', { points: payload.points ?? 0 }),
        };
      case 'duel_lost':
        return {
          icon: '\uD83D\uDE14',
          text: t('notifications.duelLost'),
        };
      case 'duel_accepted':
        return {
          icon: '\u26A1',
          text: t('notifications.duelAccepted'),
        };
      case 'duel_declined':
        return {
          icon: '\u274C',
          text: t('notifications.duelDeclined'),
        };
      case 'duel_rematch':
        return {
          icon: '\uD83D\uDD01',
          text: t('notifications.duelRematch', { name: payload.challengerName ?? 'Someone' }),
        };
      case 'duel_decision':
        return {
          icon: '\uD83D\uDCA1',
          text: payload.decision === 'steal'
            ? t('notifications.duelSteal')
            : t('notifications.duelDouble'),
        };
      default:
        return {
          icon: '\uD83D\uDD14',
          text: (payload.message as string) ?? t('notifications.newNotification'),
        };
    }
  };
}

/** Which tab a notification type should navigate to */
function getNotificationTab(type: string): 'duels' | 'quiz' | 'leaderboard' | null {
  if (type.startsWith('duel')) return 'duels';
  if (type.startsWith('quiz')) return 'quiz';
  return null;
}

function useTimeAgo() {
  const { t } = useTranslation();

  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('common.justNow');
    if (minutes < 60) return t('common.agoMinutes', { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('common.agoHours', { hours });
    return t('common.agoDays', { days: Math.floor(hours / 24) });
  };
}

export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { t } = useTranslation();
  const { notifications, player, setActiveTab } = useGameStore();
  const { markAsRead, markAllRead } = useNotifications(player?.id);
  const formatNotification = useFormatNotification();
  const timeAgo = useTimeAgo();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    if (!notif.is_read) markAsRead(notif.id);

    // Navigate to the relevant tab
    const tab = getNotificationTab(notif.type);
    if (tab) {
      setActiveTab(tab);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />

          {/* Panel — solid background so notifications don't bleed into
              underlying content (the previous glass-strong was too
              translucent and overlapped buttons/text below). */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-14 right-2 left-2 sm:left-auto sm:w-80 z-50 max-h-[70vh] flex flex-col rounded-2xl overflow-hidden border border-white/12 shadow-2xl bg-[#1a0a2e]"
          >
            <div className="flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white">
                  {t('notifications.title', { defaultValue: 'Notifications' })} {unreadCount > 0 && (
                    <span className="text-euro-gold">({unreadCount})</span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="text-xs text-euro-purple-light hover:text-white transition-colors"
                  >
                    {t('notifications.markAllRead', { defaultValue: 'Mark all read' })}
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="flex-1 overflow-y-auto max-h-[50vh]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-3xl mb-2">{'\uD83D\uDD14'}</p>
                    <p className="text-white/55 text-sm">{t('notifications.empty', { defaultValue: 'No notifications yet' })}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.slice(0, 20).map((notif) => {
                      const { icon, text } = formatNotification(notif.type, notif.payload);
                      const tab = getNotificationTab(notif.type);
                      return (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`w-full text-left px-3 py-3 flex items-start gap-3 transition-colors hover:bg-white/5 ${
                            notif.is_read
                              ? 'opacity-60'
                              : 'bg-euro-purple/10'
                          }`}
                        >
                          <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white leading-snug">{text}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-white/45">
                                {timeAgo(notif.created_at)}
                              </p>
                              {tab && !notif.is_read && (
                                <span className="text-xs text-euro-purple-light">
                                  {t('notifications.tapToView', { defaultValue: 'Tap to view →' })}
                                </span>
                              )}
                            </div>
                          </div>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-euro-gold flex-shrink-0 mt-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
