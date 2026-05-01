import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/gameStore';
import Header from './Header';
import BottomNav from './BottomNav';

interface AppShellProps {
  children: ReactNode;
  showHeader?: boolean;
  showNav?: boolean;
  /** When provided, renders a 5th exit tab in BottomNav */
  onExitPress?: () => void;
}

export default function AppShell({
  children,
  showHeader = true,
  showNav = true,
  onExitPress,
}: AppShellProps) {
  const { t } = useTranslation();
  const isReconnecting = useGameStore((s) => s.isReconnecting);

  return (
    <div className="min-h-svh bg-euro-gradient flex flex-col">
      {/* Sticky top block: banner (when reconnecting) + header, stacked vertically.
          Header no longer has sticky/top-0 of its own — this wrapper handles it.
          --top-bar-height is read by Header dropdowns to position themselves. */}
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

      {/* Consistent breathing room between the sticky header and screen
          content — applied here so every tabbed screen inherits it
          instead of each one having to remember its own top padding.
          scrollbar-gutter: stable reserves space for the scrollbar even
          when content fits, so the layout doesn't shift horizontally
          (and visibly "jump") when content height changes. */}
      <main
        className="flex-1 overflow-y-auto pt-4 sm:pt-6"
        style={{ scrollbarGutter: 'stable' }}
      >
        {children}
      </main>

      {showNav && <BottomNav onExitPress={onExitPress} />}
    </div>
  );
}
