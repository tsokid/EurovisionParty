import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface EmailRow {
  id: string;
  to_email: string;
  subject: string;
  template: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  provider_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

const STATUS_FILTER = ['all', 'pending', 'sending', 'sent', 'failed'] as const;
type StatusFilter = typeof STATUS_FILTER[number];

const STATUS_COLOR: Record<EmailRow['status'], string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  sending: 'bg-blue-500/20 text-blue-300',
  sent:    'bg-green-500/20 text-green-300',
  failed:  'bg-red-500/20 text-red-300',
};

export default function EmailLog() {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    let q = supabase
      .from('email_log')
      .select('id, to_email, subject, template, status, attempts, provider_id, error, created_at, sent_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setRows((data as EmailRow[]) ?? []);

    const { data: countData } = await supabase
      .from('email_log')
      .select('status', { count: 'exact', head: false })
      .limit(1000);
    const c: Record<string, number> = {};
    (countData ?? []).forEach((r: { status: string }) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    setCounts(c);
  }, [filter]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function drainNow() {
    setBusy(true);
    try { await supabase.functions.invoke('send-email'); } catch { /* ignore */ }
    await refresh();
    setBusy(false);
  }

  async function retryFailed() {
    setBusy(true);
    await supabase.from('email_log').update({ status: 'pending', attempts: 0, error: null }).eq('status', 'failed');
    await refresh();
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTER.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ' +
              (filter === s
                ? 'bg-purple-500/30 border-purple-400/50 text-purple-100'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10')
            }
          >
            {s} {s !== 'all' && counts[s] != null ? `(${counts[s]})` : ''}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={drainNow}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-500/20 border border-pink-400/40 text-pink-100 hover:bg-pink-500/30 disabled:opacity-50"
        >
          Drain now
        </button>
        <button
          onClick={retryFailed}
          disabled={busy || (counts.failed ?? 0) === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-30"
        >
          Retry all failed
        </button>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">To</th>
              <th className="px-3 py-2 text-left">Subject</th>
              <th className="px-3 py-2 text-left">Template</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Attempts</th>
              <th className="px-3 py-2 text-left">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-white/40">No emails {filter !== 'all' ? `with status "${filter}"` : 'logged yet'}.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-2 text-white/60 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-white">{r.to_email}</td>
                <td className="px-3 py-2 text-white/80 max-w-xs truncate">{r.subject}</td>
                <td className="px-3 py-2 text-white/60 text-xs">{r.template}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLOR[r.status]}`}>{r.status}</span></td>
                <td className="px-3 py-2 text-white/60 text-xs">{r.attempts}</td>
                <td className="px-3 py-2 text-red-300/80 text-xs max-w-xs truncate" title={r.error ?? ''}>{r.error ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/40">
        Drained automatically every minute by pg_cron. Configure <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> as edge function secrets.
      </p>
    </div>
  );
}
