import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { t } from '../i18n';

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
    if (!EMAIL_RE.test(e)) { setMsg({ kind: 'err', text: t.admins.invalid }); return; }
    setBusy(true);
    const { error } = await supabase
      .from('super_admin_emails')
      .insert({ email: e });
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message.includes('duplicate') ? t.admins.duplicate : error.message });
      return;
    }
    setMsg({ kind: 'ok', text: t.admins.added(e) });
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
    setMsg({ kind: 'ok', text: t.admins.removed(email) });
    await refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h2 className="text-2xl font-bold text-stage-text m-0">{t.admins.title}</h2>
        <p className="text-sm text-white/60 mt-1">
          {t.admins.lede1}<code className="text-euro-pink-light">/admin</code>{t.admins.lede2}
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="font-bold text-white mb-3 text-sm">{t.admins.addTitle}</h3>
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
            {t.admins.add}
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
                <th className="px-4 py-2.5 text-left">{t.admins.email}</th>
                <th className="px-4 py-2.5 text-left">{t.admins.status}</th>
                <th className="px-4 py-2.5 text-left">{t.admins.addedCol}</th>
                <th className="px-4 py-2.5 text-right">{t.admins.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-white/40">{t.admins.none}</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.email} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white font-medium">{r.email}</td>
                  <td className="px-4 py-3">
                    {r.linked_user_id ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t.admins.active}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-white/50 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40" /> {t.admins.awaiting}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">{new Date(r.created_at).toLocaleDateString('el-GR')}</td>
                  <td className="px-4 py-3 text-right">
                    {confirmDelete === r.email ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => remove(r.email)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-md bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-40"
                        >
                          {t.admins.confirmRemove}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2.5 py-1 rounded-md bg-white/5 text-white/70 text-xs hover:bg-white/10"
                        >
                          {t.admins.cancel}
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(r.email)}
                        className="text-red-400 hover:text-red-300 text-xs font-semibold"
                      >
                        {t.admins.remove}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/40 mt-3">
          {t.admins.note}
        </p>
      </section>
    </div>
  );
}
