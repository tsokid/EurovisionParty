import type { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/gameStore';
import Header from './Header';
import BottomNav from './BottomNav';
import GameRail from './GameRail';

interface AppShellProps {
  children: ReactNode;
  showHeader?: boolean;
  /** Game sections: desktop side rail + mobile bottom tab bar. */
  showNav?: boolean;
  /** Mobile bottom tab bar (defaults to showNav). The lobby keeps the
   *  desktop rail, with every section locked, but no mobile tab bar. */
  showTabs?: boolean;
  /** When provided, the menu and the rail get an Exit row. */
  onExitPress?: () => void;
  /** Current room phase — passed to the nav so lock state is authoritative */
  phase?: string;
}

/**
 * Game shell. Mobile: sticky game bar + phase strip, content, sticky tab
 * bar. Desktop (≥ 1024px): 240px side rail + a wide column with the phase
 * strip on top.
 */
export default function AppShell({
  children,
  showHeader = true,
  showNav = true,
  showTabs,
  onExitPress,
  phase,
}: AppShellProps) {
  const { t } = useTranslation();
  const isReconnecting = useGameStore((s) => s.isReconnecting);
  const tabs = showTabs ?? showNav;

  return (
    <div className={clsx('gs', showNav ? 'has-rail' : 'no-rail', tabs && 'has-tabs')}>
      {showNav && <GameRail phase={phase} onExitPress={onExitPress} />}

      <div className="gs-col">
        {/* Sticky top block: reconnect banner + game bar + phase strip.
            --top-bar-height(-lg) anchor the Header dropdowns below it. */}
        <div
          className="gs-head"
          style={{
            // Mobile/tablet: bar 60 + strip 34 (+ 36 reconnect banner)
            '--top-bar-height':    isReconnecting ? '130px' : '94px',
            // Desktop: top bar 52 (+ 36 reconnect banner)
            '--top-bar-height-lg': isReconnecting ? '88px' : '52px',
          } as CSSProperties}
        >
          {isReconnecting && (
            <div className="gs-reconnect" role="status">
              <span className="gs-reconnect-dot" aria-hidden="true" />
              <span>{t('reconnect.banner')}</span>
            </div>
          )}
          {showHeader && <Header onExitPress={onExitPress} />}
        </div>

        {/* scrollbar-gutter: stable keeps the layout from jumping
            horizontally when the content height changes. */}
        <main className="gs-main" style={{ scrollbarGutter: 'stable' }}>
          {children}
        </main>

        {tabs && <BottomNav variant="bar" phase={phase} />}
      </div>
    </div>
  );
}
