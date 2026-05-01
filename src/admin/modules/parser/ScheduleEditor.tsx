// src/admin/modules/parser/ScheduleEditor.tsx
// Inline form to edit when a parser starts (and for results: when it stops
// + how often it polls). All times displayed and entered in Athens
// (Europe/Athens) time; the RPC converts to UTC on save so DST is handled
// automatically.
//
// Format: dd/mm/yyyy + HH:mm (24-hour). We use two separate text inputs
// instead of <input type="datetime-local"> because the native control
// follows the browser locale (en-US ships mm/dd/yyyy + am/pm). Explicit
// inputs guarantee Greek-style formatting regardless of admin's browser.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { formatError } from "../../lib/formatError";
import type { JobKind, ParseJob } from "./useParserState";

interface Props {
  year: number;
  kind: JobKind;
  job: ParseJob;
  onSaved: () => void;
}

// ─── Format helpers ────────────────────────────────────────────────────────
// ISO timestamp (UTC) → "dd/mm/yyyy" + "HH:mm" in Athens TZ
function toAthensParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  // en-GB → "DD/MM/YYYY, HH:mm"
  const date = `${get('day')}/${get('month')}/${get('year')}`;
  // Intl returns "24" for midnight in some locales — normalise to "00"
  const hour = get('hour') === '24' ? '00' : get('hour');
  const time = `${hour}:${get('minute')}`;
  return { date, time };
}

// "dd/mm/yyyy" + "HH:mm" → "yyyy-mm-dd HH:mm" (RPC param format).
// Returns null if either input is malformed/empty.
function toRpcParam(date: string, time: string): string | null {
  const dRe = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const tRe = /^(\d{2}):(\d{2})$/;
  const dm = date.match(dRe);
  const tm = time.match(tRe);
  if (!dm || !tm) return null;
  const dd = parseInt(dm[1], 10);
  const mm = parseInt(dm[2], 10);
  const yyyy = parseInt(dm[3], 10);
  const hh = parseInt(tm[1], 10);
  const mi = parseInt(tm[2], 10);
  if (
    yyyy < 2000 || yyyy > 2100 ||
    mm < 1 || mm > 12 ||
    dd < 1 || dd > 31 ||
    hh < 0 || hh > 23 ||
    mi < 0 || mi > 59
  ) return null;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${yyyy}-${pad(mm)}-${pad(dd)} ${pad(hh)}:${pad(mi)}`;
}

// ─── Inline date + time pair ───────────────────────────────────────────────
function DateTimePair({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  label: string;
  date: string;
  time: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] text-white/50 mb-0.5">{label}</label>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          inputMode="numeric"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          placeholder="dd/mm/yyyy"
          maxLength={10}
          pattern="\d{2}/\d{2}/\d{4}"
          className="w-32 bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono placeholder-white/25 tabular-nums"
        />
        <input
          type="text"
          inputMode="numeric"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          placeholder="HH:mm"
          maxLength={5}
          pattern="\d{2}:\d{2}"
          className="w-20 bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono placeholder-white/25 tabular-nums"
        />
        <span className="self-center text-[10px] text-white/35 uppercase tracking-wider">24h</span>
      </div>
    </div>
  );
}

export function ScheduleEditor({ year, kind, job, onSaved }: Props) {
  const isResults = kind === 'results';

  const initialStart = useMemo(() => toAthensParts(job.scheduled_start_at), [job.scheduled_start_at]);
  const initialEnd = useMemo(() => toAthensParts(job.scheduled_end_at), [job.scheduled_end_at]);

  const [startDate, setStartDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endDate, setEndDate] = useState(initialEnd.date);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const [interval, setInterval] = useState<number>(job.poll_interval_minutes ?? 2);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Re-sync local fields if job updates externally (cron tick, manual save in another tab)
  useEffect(() => { setStartDate(initialStart.date); setStartTime(initialStart.time); }, [initialStart.date, initialStart.time]);
  useEffect(() => { setEndDate(initialEnd.date); setEndTime(initialEnd.time); }, [initialEnd.date, initialEnd.time]);
  useEffect(() => { setInterval(job.poll_interval_minutes ?? 2); }, [job.poll_interval_minutes]);

  const dirty =
    startDate !== initialStart.date ||
    startTime !== initialStart.time ||
    endDate !== initialEnd.date ||
    endTime !== initialEnd.time ||
    interval !== job.poll_interval_minutes;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // Validate + convert to RPC format
      const startRpc = startDate || startTime
        ? toRpcParam(startDate, startTime)
        : null;
      const endRpc = isResults && (endDate || endTime)
        ? toRpcParam(endDate, endTime)
        : null;

      // If both fields populated but parsing failed, error out
      if ((startDate || startTime) && !startRpc) {
        throw new Error('Start date/time invalid. Use dd/mm/yyyy and HH:mm (24h).');
      }
      if (isResults && (endDate || endTime) && !endRpc) {
        throw new Error('End date/time invalid. Use dd/mm/yyyy and HH:mm (24h).');
      }

      const { error } = await supabase.rpc('set_parse_schedule', {
        p_year: year,
        p_kind: kind,
        p_start_at_athens: startRpc,
        p_end_at_athens: isResults ? endRpc : null,
        p_poll_interval_min: isResults ? interval : null,
      });
      if (error) throw error;
      setMsg({ kind: 'ok', text: 'Schedule saved.' });
      onSaved();
    } catch (e) {
      setMsg({ kind: 'err', text: formatError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 pb-3 border-b border-white/5">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
        Schedule · Athens (Europe/Athens) time
      </label>
      <div className="space-y-2.5">
        <DateTimePair
          label="Start"
          date={startDate}
          time={startTime}
          onDateChange={setStartDate}
          onTimeChange={setStartTime}
        />

        {isResults && (
          <>
            <DateTimePair
              label="End (poller stops after this)"
              date={endDate}
              time={endTime}
              onDateChange={setEndDate}
              onTimeChange={setEndTime}
            />
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
