// src/admin/modules/parser/ScheduleEditor.tsx
// Inline form to edit when a parser starts (and for results: when it stops
// + how often it polls). All times displayed and entered in Athens
// (Europe/Athens) time; the RPC converts to UTC on save so DST is handled
// automatically.
//
// Uses <input type="datetime-local">. The browser shows it in the user's
// local time but we treat the entered string as Athens time on save.
// "Athens · {value}" hint reminds the admin that times are interpreted in
// Athens regardless of where the admin actually is.

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { JobKind, ParseJob } from "./useParserState";

interface Props {
  year: number;
  kind: JobKind;
  job: ParseJob;
  onSaved: () => void;
}

// "2026-05-15T03:00:00+03:00" → "2026-05-15T03:00" (datetime-local format,
// in Athens TZ regardless of caller). Returns "" for null.
function toAthensInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Format the date in Athens TZ via Intl, then pad to YYYY-MM-DDTHH:MM
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  // en-CA → "2026-05-15, 03:00" with parts including hour='03'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// "2026-05-15T03:00" → "2026-05-15 03:00" (the format the RPC expects)
function toRpcParam(value: string): string {
  return value.replace('T', ' ');
}

export function ScheduleEditor({ year, kind, job, onSaved }: Props) {
  const isResults = kind === 'results';

  const [start, setStart] = useState<string>(() => toAthensInputValue(job.scheduled_start_at));
  const [end, setEnd] = useState<string>(() => toAthensInputValue(job.scheduled_end_at));
  const [interval, setInterval] = useState<number>(job.poll_interval_minutes ?? 2);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Re-sync when job updates externally
  useEffect(() => { setStart(toAthensInputValue(job.scheduled_start_at)); }, [job.scheduled_start_at]);
  useEffect(() => { setEnd(toAthensInputValue(job.scheduled_end_at)); }, [job.scheduled_end_at]);
  useEffect(() => { setInterval(job.poll_interval_minutes ?? 2); }, [job.poll_interval_minutes]);

  const dirty =
    start !== toAthensInputValue(job.scheduled_start_at) ||
    end !== toAthensInputValue(job.scheduled_end_at) ||
    interval !== job.poll_interval_minutes;

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.rpc('set_parse_schedule', {
        p_year: year,
        p_kind: kind,
        p_start_at_athens: start ? toRpcParam(start) : null,
        p_end_at_athens: isResults && end ? toRpcParam(end) : null,
        p_poll_interval_min: isResults ? interval : null,
      });
      if (error) throw error;
      setMsg({ kind: 'ok', text: 'Schedule saved.' });
      onSaved();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 pb-3 border-b border-white/5">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
        Schedule · Athens (Europe/Athens) time
      </label>
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] text-white/50 mb-0.5">Start</label>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono"
          />
        </div>

        {isResults && (
          <>
            <div>
              <label className="block text-[10px] text-white/50 mb-0.5">End (poller stops after this)</label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-0.5">Poll interval (minutes)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)))}
                className="w-24 bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy}
            className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-xs disabled:opacity-40 cursor-pointer"
          >
            {busy ? 'Saving…' : 'Save schedule'}
          </button>
          {msg && (
            <span className={`text-[11px] ${msg.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
