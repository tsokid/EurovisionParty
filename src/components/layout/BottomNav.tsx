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
  { id: 'duels', labelKey: 'nav.duels', emoji: '⚔️' },
  { id: 'predictions', labelKey: 'nav.predict', emoji: '🔮' },
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
    <nav className="safe-bottom sticky bottom-0 z-40 shrink-0 border-t border-white/10" style={{ background: 'rgb(10, 5, 25)' }}>
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
                'flex-1 flex flex-col items-center justify-center gap-0.5 sm:gap-1 lg:gap-1.5',
                'py-2 sm:py-3 lg:py-4 min-h-[56px] sm:min-h-[68px] lg:min-h-[80px]',
                'transition-colors relative cursor-pointer',
                isActive ? 'text-euro-gold' : 'text-white/55 hover:text-white/80',
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-2 right-2 h-0.5 sm:h-[3px] bg-euro-gold rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="text-xl sm:text-2xl lg:text-3xl leading-none relative">
                {tab.id === 'predictions' && isVotingOrLater ? '📋' : tab.emoji}
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-euro-red text-white text-[10px] sm:text-[11px] lg:text-xs font-bold rounded-full min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] flex items-center justify-center px-0.5">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] sm:text-xs lg:text-sm font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}

        {/* 5th exit tab — only rendered in-game */}
        {onExitPress && (
          <button
            onClick={onExitPress}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-0.5 sm:gap-1 lg:gap-1.5',
              'py-2 sm:py-3 lg:py-4 min-h-[56px] sm:min-h-[68px] lg:min-h-[80px]',
              'transition-colors relative cursor-pointer text-red-400/60 hover:text-red-400 border-l border-white/8',
            )}
            aria-label={t('nav.exit', { defaultValue: 'Leave' })}
          >
            <span className="text-xl sm:text-2xl lg:text-3xl leading-none">🚪</span>
            <span className="text-[10px] sm:text-xs lg:text-sm font-semibold tracking-wide">
              {t('nav.exit', { defaultValue: 'Leave' })}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
