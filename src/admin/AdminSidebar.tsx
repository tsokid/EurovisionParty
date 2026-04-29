import clsx from 'clsx';
import { MODULES } from './modules';

interface Props { activeId: string | null; onSelect: (id: string) => void; onLogout: () => void; email: string | null; }

export default function AdminSidebar({ activeId, onSelect, onLogout, email }: Props) {
  return (
    <aside className="w-56 border-r border-white/10 bg-black/40 flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="text-xs text-white/40">Logged in</div>
        <div className="truncate text-sm">{email}</div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {MODULES.length === 0 && (
          <p className="text-white/30 text-xs p-2">No modules registered yet.</p>
        )}
        {MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={clsx(
              'w-full text-left px-3 py-2 rounded flex gap-2 items-center',
              activeId === m.id ? 'bg-white/10' : 'hover:bg-white/5',
            )}
          >
            <span>{m.emoji}</span><span>{m.label}</span>
          </button>
        ))}
      </nav>
      <button onClick={onLogout} className="m-2 text-sm text-white/60 hover:text-white py-2">
        Sign out
      </button>
    </aside>
  );
}
