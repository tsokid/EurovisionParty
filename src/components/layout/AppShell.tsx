import type { ReactNode } from 'react';
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
  return (
    <div className="min-h-svh bg-euro-gradient flex flex-col">
      {showHeader && <Header />}

      <main className="flex-1 overflow-y-auto">{children}</main>

      {showNav && <BottomNav />}
    </div>
  );
}
