import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { MODULES } from './modules';
import { useAdminAuth } from './useAdminAuth';

export default function AdminShell() {
  const { email, logout } = useAdminAuth();
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
