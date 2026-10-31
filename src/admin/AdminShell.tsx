import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { MODULES } from './modules';
import { createUnsavedGuard, UnsavedGuardContext } from './unsavedGuard';
import type { AdminAuth } from './useAdminAuth';

interface Props {
  auth: AdminAuth;
}

export default function AdminShell({ auth }: Props) {
  const { email, logout } = auth;
  const [activeId, setActiveId] = useState<string | null>(MODULES[0]?.id ?? null);
  // One unsaved-edits guard for the whole admin (see unsavedGuard.ts).
  const [guard] = useState(createUnsavedGuard);
  const Active = MODULES.find((m) => m.id === activeId)?.Component;

  const select = (id: string) => {
    if (id === activeId || !guard.confirmLeave()) return;
    setActiveId(id);
  };
  const signOut = () => {
    if (guard.confirmLeave()) logout();
  };

  return (
    <UnsavedGuardContext.Provider value={guard}>
      <div className="min-h-dvh flex bg-[rgb(10,5,25)] text-white">
        <AdminSidebar activeId={activeId} onSelect={select} onLogout={signOut} email={email} />
        <main className="flex-1 min-w-0 p-6 overflow-auto">
          {Active ? <Active /> : <p className="text-white/40">Select a module.</p>}
        </main>
      </div>
    </UnsavedGuardContext.Provider>
  );
}
