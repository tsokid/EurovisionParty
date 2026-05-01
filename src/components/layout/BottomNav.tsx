import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Brain, Swords, Target, Trophy, ListChecks, DoorOpen, Lock, type LucideIcon } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import type { TabId } from '../../lib/types';

interface NavTab {
  id: TabId;
  labelKey: string;
  Icon: LucideIcon;
}

const TABS: NavTab[] = [
  { id: 'quiz', labelKey: 'nav.quiz', Icon: Brain },
  { id: 'duels', labelKey: 'nav.duels', Icon: Swords },
  { id: 'predictions', labelKey: 'nav.predict', Icon: Target },
  { id: 'leaderboard', labelKey: 'nav.board', Icon: Trophy },
];

interface BottomNavProps {
  /** When provided, renders a 5th exit tab that calls this on tap */
  onExitPress?: () => void;
}

/** Which tabs are interactable in each phase. The Board (leaderboard)
 *  and Predictions-as-Results view are always available. */
function isTabLocked(tabId: TabId, phase: string | undefined): boolean {
  if (phase === 'voting_live' || phase === 'final') {
    // During voting and after, only the leaderboard is meaningful.
    // Predictions tab swaps to "Results" (still navigable to view scoring).
    return tabId === 'quiz' || tabId === 'duels';
  }
  if (phase === 'lobby' || phase === 'pre_night') {
    // Predictions don't open until participants parser publishes the GF lineup.
    return tabId === 'predictions';
  }
  return false;
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
          const locked = isTabLocked(tab.id, room?.phase);
          const badgeCount = tab.id === 'duels' && !locked ? duelNotifCount : 0;
          const label = tab.id === 'predictions' && isVotingOrLater ? t('nav.results') : t(tab.labelKey);

          return (
            <button
              key={tab.id}
              onClick={() => { if (!locked) setActiveTab(tab.id); }}
              disabled={locked}
              title={locked ? t('nav.lockedHint', { defaultValue: 'Locked in this phase' }) : undefined}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 sm:gap-1 lg:gap-1.5',
                'py-2 sm:py-3 lg:py-4 min-h-[56px] sm:min-h-[68px] lg:min-h-[80px]',
                'transition-colors relative',
                locked
                  ? 'text-white/25 cursor-not-allowed'
                  : isActive
                    ? 'text-euro-gold cursor-pointer'
                    : 'text-white/55 hover:text-white/80 cursor-pointer',
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && !locked && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-2 right-2 h-0.5 sm:h-[3px] bg-euro-gold rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative inline-flex items-center justify-center">
                {(() => {
                  const Icon = tab.id === 'predictions' && isVotingOrLater ? ListChecks : tab.Icon;
                  return <Icon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" strokeWidth={2} />;
                })()}
                {locked && (
                  <span className="absolute -top-1 -right-2.5 bg-white/8 rounded-full p-0.5">
                    <Lock className="w-2.5 h-2.5 text-white/55" strokeWidth={2.4} />
                  </span>
                )}
                {!locked && badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-euro-red text-white text-xs lg:text-sm font-bold rounded-full min-w-[18px] h-[18px] lg:min-w-[20px] lg:h-[20px] flex items-center justify-center px-1">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </span>
              <span className="text-xs sm:text-sm lg:text-base font-semibold tracking-wide">{label}</span>
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
              'transition-colors relative cursor-pointer text-red-400/70 hover:text-red-400 border-l border-white/8',
            )}
            aria-label={t('nav.exit', { defaultValue: 'Leave' })}
          >
            <DoorOpen className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" strokeWidth={2} />
            <span className="text-xs sm:text-sm lg:text-base font-semibold tracking-wide">
              {t('nav.exit', { defaultValue: 'Leave' })}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
