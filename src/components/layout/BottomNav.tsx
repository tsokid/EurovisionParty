import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../stores/gameStore';
import type { TabId } from '../../lib/types';

interface NavTab {
  id: TabId;
  label: string;
  emoji: string;
}

const TABS: NavTab[] = [
  { id: 'quiz', label: 'Quiz', emoji: '🧠' },
  { id: 'predictions', label: 'Predict', emoji: '🔮' },
  { id: 'duels', label: 'Duels', emoji: '⚔️' },
  { id: 'leaderboard', label: 'Board', emoji: '🏆' },
];

export default function BottomNav() {
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

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors relative',
                isActive ? 'text-euro-gold' : 'text-white/50',
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator bar */}
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
              <span className="text-[10px] font-medium">
                {tab.id === 'predictions' && isVotingOrLater ? 'Results' : tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
