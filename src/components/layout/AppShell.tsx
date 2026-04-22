import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/gameStore';
import Header from './Header';
import BottomNav from './BottomNav';

interface AppShellProps {
  children: ReactNode;
  showHeader?: boolean;
  showNav?: boolean;
}

export default function AppShell({
  children,
  showHeader = true,
  showNav = true,
}: AppShellProps) {
  const { t } = useTranslation();
  const isReconnecting = useGameStore((s) => s.isReconnecting);

  return (
    <div className="min-h-svh bg-euro-gradient flex flex-col">
      {isReconnecting && (
        <div className="fixed top-3 left-3 right-3 z-50 flex items-center gap-2 bg-yellow-400/15 border border-yellow-400/40 rounded-xl px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 animate-pulse" />
          <span className="text-xs font-semibold text-yellow-400">
            {t('reconnect.banner')}
          </span>
        </div>
      )}

      {showHeader && <Header />}

      <main className="flex-1 overflow-y-auto">{children}</main>

      {showNav && <BottomNav />}
    </div>
  );
}
