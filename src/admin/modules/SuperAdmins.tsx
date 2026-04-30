import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface AllowlistRow {
  email: string;
  created_at: string;
  // joined via super_admins lookup
  linked_user_id: string | null;
  linked_at: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SuperAdmins() {
  const [rows, setRows] = useState<AllowlistRow[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: emails, error: e1 } = await supabase
      .from('super_admin_emails')
      .select('email, created_at')
      .order('created_at', { ascending: true });
    if (e1) { setMsg({ kind: 'err', text: e1.message }); return; }
    const { data: linked } = await supabase
      .from('super_admins')
      .select('user_id, email, created_at');
    const linkMap = new Map<string, { id: string; at: string }>();
    (linked ?? []).forEach((l) => linkMap.set(l.email, { id: l.user_id, at: l.created_at }));
    setRows(((emails ?? []) as { email: string; created_at: string }[]).map((e) => ({
      email: e.email,
      created_at: e.created_at,
      linked_user_id: linkMap.get(e.email)?.id ?? null,
      linked_at: linkMap.get(e.email)?.at ?? null,
    })));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function add() {
    setMsg(null);
    const e = newEmail.toLowerCase().trim();
    if (!EMAIL_RE.test(e)) { setMsg({ kind: 'err', text: 'Enter a valid email.' }); return; }
    setBusy(true);
    const { error } = await supabase
      .from('super_admin_emails')
      .insert({ email: e });
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message.includes('duplicate') ? 'Already on the allowlist.' : error.message });
      return;
    }
    setMsg({ kind: 'ok', text: `Added ${e}. They can now request an OTP.` });
    setNewEmail('');
    await refresh();
  }

  async function remove(email: string) {
    setBusy(true);
    const { error } = await supabase
      .from('super_admin_emails')
      .delete()
      .eq('email', email);
    setBusy(false);
    setConfirmDelete(null);
    if (error) { setMsg({ kind: 'err', text: error.message }); return; }
    setMsg({ kind: 'ok', text: `Removed ${email} from the allowlist.` });
    await refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h2 className="text-xl font-bold text-white">🛡️ Super admins</h2>
        <p className="text-sm text-white/60 mt-1">
          Allowlist for the <code className="text-euro-pink-light">/admin</code> route. Only emails on this list can request a one-time
          code. New entries take effect immediately — the edge function reads the list on every request.
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="font-bold text-white mb-3 text-sm">Add allowlisted email</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && add()}
            placeholder="name@example.com"
            className="flex-1 min-w-[240px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/30"
            autoComplete="off"
          />
          <button
            onClick={add}
            disabled={busy || !newEmail}
            className="px-4 py-2 bg-gradient-to-r from-euro-purple-light to-euro-pink text-white font-bold rounded-lg disabled:opacity-40 transition"
          >
            Add
          </button>
        </div>
        {msg && (
          <p className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>
        )}
      </section>

      <section>
        <h3 className="font-bold text-white mb-3 text-sm">Allowlisted emails ({rows.length})</h3>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Added</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-white/40">No admins yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.email} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white font-medium">{r.email}</td>
                  <td className="px-4 py-3">
                    {r.linked_user_id ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-white/50 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40" /> Awaiting first sign-in
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {confirmDelete === r.email ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => remove(r.email)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-md bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-40"
                        >
                          Confirm remove
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2.5 py-1 rounded-md bg-white/5 text-white/70 text-xs hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(r.email)}
                        className="text-red-400 hover:text-red-300 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/40 mt-3">
          Removing an email revokes future OTP requests but does NOT log out an active session — they keep access until the JWT
          expires (default 1 hour) or they sign out manually.
        </p>
      </section>
    </div>
  );
}
