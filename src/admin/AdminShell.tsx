import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { MODULES } from './modules';
import type { AdminAuth } from './useAdminAuth';

interface Props {
  auth: AdminAuth;
}

export default function AdminShell({ auth }: Props) {
  const { email, logout } = auth;
  const [activeId, setActiveId] = useState<string | null>(MODULES[0]?.id ?? null);
  const Active = MODULES.find((m) => m.id === activeId)?.Component;

  return (
    <div className="min-h-dvh flex bg-[rgb(10,5,25)] text-white">
      <AdminSidebar activeId={activeId} onSelect={setActiveId} onLogout={logout} email={email} />
      <main className="flex-1 p-6 overflow-auto">
        {Active ? <Active /> : <p className="text-white/40">Select a module.</p>}
      </main>
    </div>
  );
}
