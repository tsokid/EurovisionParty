import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/gameStore';
import Header from './Header';
import BottomNav from './BottomNav';

interface AppShellProps {
  children: ReactNode;
  showHeader?: boolean;
  showNav?: boolean;
  /** Rendered between main content and BottomNav — use for in-game exit strip */
  bottomStrip?: ReactNode;
}

export default function AppShell({
  children,
  showHeader = true,
  showNav = true,
  bottomStrip,
}: AppShellProps) {
  const { t } = useTranslation();
  const isReconnecting = useGameStore((s) => s.isReconnecting);

  return (
    <div className="min-h-svh bg-euro-gradient flex flex-col">
      {/* Banner + Header wrapped in a single sticky block so dropdowns anchor correctly.
          --top-bar-height is consumed by Header dropdowns to position themselves. */}
      <div
        className="sticky top-0 z-40 flex flex-col shrink-0"
        style={{ '--top-bar-height': isReconnecting ? '92px' : '56px' } as CSSProperties}
      >
        {isReconnecting && (
          <div className="flex items-center gap-2 bg-yellow-400/15 border-b border-yellow-400/30 px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 animate-pulse" />
            <span className="text-xs font-semibold text-yellow-400">
              {t('reconnect.banner')}
            </span>
          </div>
        )}
        {showHeader && <Header />}
      </div>

      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Exit strip sits above BottomNav, not overlapping it */}
      {bottomStrip}

      {showNav && <BottomNav />}
    </div>
  );
}
