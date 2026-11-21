import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Brain, Swords, Target, Trophy, Lock, type LucideIcon } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';
import type { TabId } from '../../lib/types';

interface NavTab {
  id: TabId;
  labelKey: string;
  Icon: LucideIcon;
}

/** Game sections, in the Stage order: Προβλέψεις / Κουίζ / Μονομαχίες / Βαθμολογία. */
export const GAME_TABS: NavTab[] = [
  { id: 'predictions', labelKey: 'nav.predict', Icon: Target },
  { id: 'quiz', labelKey: 'nav.quiz', Icon: Brain },
  { id: 'duels', labelKey: 'nav.duels', Icon: Swords },
  { id: 'leaderboard', labelKey: 'nav.board', Icon: Trophy },
];

/** Which tabs are interactable in each phase (unchanged rules). The Board
 *  (leaderboard) and Predictions-as-Results view are always available. */
export function isTabLocked(tabId: TabId, phase: string | undefined): boolean {
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

interface BottomNavProps {
  /** bar: mobile bottom tab bar (< 1024px); rail: desktop side-rail list. */
  variant?: 'bar' | 'rail';
  /** Authoritative room phase — overrides the store when provided */
  phase?: string;
}

/**
 * Page navigation for the game. In the lobby every section is shown locked
 * (the lobby screen replaces them until the host starts); otherwise
 * `isTabLocked` decides.
 */
export default function BottomNav({ variant = 'bar', phase: phaseProp }: BottomNavProps) {
  const { t } = useTranslation();
  const { activeTab, setActiveTab, room, notifications } = useGameStore();
  const phase = phaseProp ?? room?.phase;
  const inLobby = phase === 'lobby';
  // Count unread duel notifications for badge
  const duelNotifCount = notifications.filter(
    (n) => !n.is_read && (n.type === 'duel_challenge' || n.type === 'duel_accepted'),
  ).length;
  const lockHint = t(inLobby ? 'nav.opensAtStart' : 'nav.lockedHint');

  return (
    <nav
      className={variant === 'bar' ? 'gs-tabs safe-bottom' : 'gs-nav'}
      aria-label={t('nav.sectionsAria')}
    >
      {GAME_TABS.map((tab) => {
        const locked = inLobby || isTabLocked(tab.id, phase);
        const isActive = !inLobby && activeTab === tab.id && !locked;
        const badgeCount = tab.id === 'duels' && !locked ? duelNotifCount : 0;
        const label = t(tab.labelKey);
        const badge = badgeCount > 9 ? '9+' : String(badgeCount);

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => { if (!locked) setActiveTab(tab.id); }}
            disabled={locked}
            aria-disabled={locked || undefined}
            title={locked ? lockHint : undefined}
            className={clsx('gs-tab', isActive && 'on', locked && 'lock')}
            aria-label={locked ? `${label} · ${lockHint}` : badgeCount > 0 ? `${label} · ${badge}` : label}
            aria-current={isActive ? 'page' : undefined}
            data-tab={tab.id}
          >
            <tab.Icon className="gs-tab-ico" strokeWidth={2} aria-hidden="true" />
            <span className="gs-tab-lbl">{label}</span>
            {locked && (
              <span className="gs-pin l" aria-hidden="true">
                <Lock strokeWidth={2.4} />
              </span>
            )}
            {!locked && badgeCount > 0 && (
              <span className="gs-pin n" aria-hidden="true">{badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
