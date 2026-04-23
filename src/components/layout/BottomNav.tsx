import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/gameStore';
import type { TabId } from '../../lib/types';

interface NavTab {
  id: TabId;
  labelKey: string;
  emoji: string;
}

const TABS: NavTab[] = [
  { id: 'quiz', labelKey: 'nav.quiz', emoji: '🧠' },
  { id: 'predictions', labelKey: 'nav.predict', emoji: '🔮' },
  { id: 'duels', labelKey: 'nav.duels', emoji: '⚔️' },
  { id: 'leaderboard', labelKey: 'nav.board', emoji: '🏆' },
];

interface BottomNavProps {
  /** When provided, renders a 5th exit tab that calls this on tap */
  onExitPress?: () => void;
}

export default function BottomNav({ onExitPress }: BottomNavProps) {
  const { t } = useTranslation();
  const { activeTab, setActiveTab, room, notifications } = useGameStore();
  const isVotingOrLater = room?.phase === 'voting_live' || room?.phase === 'final';

  // Count unread duel notifications for badge
  const duelNotifCount = notifications.filter(
    (n) => !n.is_read && (n.type === 'duel_challenge' || n.type === 'duel_accepted')
  ).length;

  return (
    <nav className="glass safe-bottom sticky bottom-0 z-40 shrink-0">
      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const badgeCount = tab.id === 'duels' ? duelNotifCount : 0;
          const label = tab.id === 'predictions' && isVotingOrLater ? t('nav.results') : t(tab.labelKey);

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors relative',
                isActive ? 'text-euro-gold' : 'text-white/50',
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-2 right-2 h-0.5 bg-euro-gold rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="text-xl leading-none relative">
                {tab.id === 'predictions' && isVotingOrLater ? '📋' : tab.emoji}
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-euro-red text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}

        {/* 5th exit tab — only rendered in-game */}
        {onExitPress && (
          <button
            onClick={onExitPress}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors relative text-red-400/60 hover:text-red-400 border-l border-white/8"
            aria-label={t('nav.exit', { defaultValue: 'Leave' })}
          >
            <span className="text-xl leading-none">🚪</span>
            <span className="text-[10px] font-medium">{t('nav.exit', { defaultValue: 'Leave' })}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
