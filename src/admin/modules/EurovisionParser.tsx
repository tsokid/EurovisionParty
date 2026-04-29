import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Job {
  id: string;
  year: number;
  status: string;
  triggered_by_user: boolean;
  started_at: string;
  last_poll_at: string | null;
  poll_count: number;
}

interface Run {
  id: string;
  status: string | null;
  rows_upserted: number;
  finished_at: string | null;
  error: string | null;
  http_status: number | null;
}

export default function EurovisionParser() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const year = 2026;

  async function refresh() {
    const j = await supabase
      .from('parse_jobs')
      .select('*')
      .eq('year', year)
      .order('started_at', { ascending: false })
      .limit(5);
    const r = await supabase
      .from('parse_runs')
      .select('*')
      .eq('year', year)
      .order('started_at', { ascending: false })
      .limit(20);
    setJobs((j.data ?? []) as Job[]);
    setRuns((r.data ?? []) as Run[]);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  async function start() {
    setBusy(true);
    await supabase.rpc('start_parse_job', { p_year: year });
    await refresh();
    setBusy(false);
  }

  async function stop() {
    setBusy(true);
    await supabase.rpc('stop_parse_job', { p_year: year });
    await refresh();
    setBusy(false);
  }

  async function parseNow() {
    setBusy(true);
    await supabase.functions.invoke('eurovision-parse');
    await refresh();
    setBusy(false);
  }

  const active = jobs.find((j) => j.status === 'running');

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h2 className="text-xl font-bold text-white">🛰️ Eurovision Parser ({year})</h2>
        <p className="text-sm text-white/60">
          Manual control over the Eurovision grand-final parser. Cron will auto-start at 03:00 Athens on
          Friday 15 May 2026 if no manual job is running.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={start}
          disabled={busy || !!active}
          className="px-4 py-2 bg-emerald-500 text-black font-bold rounded disabled:opacity-40"
        >
          Start Parsing
        </button>
        <button
          onClick={stop}
          disabled={busy || !active}
          className="px-4 py-2 bg-red-500 text-white font-bold rounded disabled:opacity-40"
        >
          Stop Parsing
        </button>
        <button
          onClick={parseNow}
          disabled={busy}
          className="px-4 py-2 bg-white/10 text-white rounded disabled:opacity-40"
        >
          Parse Now
        </button>
        <span className="self-center text-sm text-white/50">
          {active ? 'Job running — polled every 2 min by cron.' : 'No active job.'}
        </span>
      </div>

      <section>
        <h3 className="font-bold mb-2 text-white">Jobs</h3>
        <table className="w-full text-sm">
          <thead className="text-white/40">
            <tr className="text-left">
              <th>id</th>
              <th>status</th>
              <th>by</th>
              <th>polls</th>
              <th>last poll</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-white/10">
                <td className="font-mono text-xs">{j.id.slice(0, 8)}</td>
                <td>{j.status}</td>
                <td>{j.triggered_by_user ? 'manual' : 'cron'}</td>
                <td>{j.poll_count}</td>
                <td>{j.last_poll_at ? new Date(j.last_poll_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="text-white/40 text-center py-3">
                  No jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="font-bold mb-2 text-white">Recent runs</h3>
        <table className="w-full text-sm">
          <thead className="text-white/40">
            <tr className="text-left">
              <th>finished</th>
              <th>status</th>
              <th>http</th>
              <th>rows</th>
              <th>error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td>{r.finished_at ? new Date(r.finished_at).toLocaleTimeString() : 'running'}</td>
                <td>{r.status ?? '—'}</td>
                <td>{r.http_status ?? '—'}</td>
                <td>{r.rows_upserted}</td>
                <td className="text-red-400 truncate max-w-xs">{r.error ?? ''}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="text-white/40 text-center py-3">
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
