// src/admin/modules/contests/EntriesEditor.tsx
// Entries of one contest year. Rows are edited inline and saved through
// upsert_contest_entry (only the changed fields are sent); countries are
// added and removed through upsert_contest_entry / delete_contest_entry.
// Archived years are read-only: the RPCs refuse them, and corrections
// go through Edit + Republish (sub-project 2b).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatError } from '../../lib/formatError';

interface Entry {
  year: number;
  iso: string;
  artist: string | null;
  song: string | null;
  semi: number | null;
  semi_place: number | null;
  qualified: boolean | null;
  in_final: boolean;
  final_running_order: number | null;
  final_place: number | null;
  total_points: number | null;
}

interface Country {
  iso: string;
  name_en: string;
}

type EditableKey = Exclude<keyof Entry, 'year' | 'iso'>;
type Draft = Partial<Pick<Entry, EditableKey>>;

const FINAL_COLS: Array<{ key: 'final_running_order' | 'final_place' | 'total_points'; label: string }> = [
  { key: 'final_running_order', label: 'Final RO' },
  { key: 'final_place', label: 'Final place' },
  { key: 'total_points', label: 'Points' },
];

const INPUT = 'bg-[#1a0a2e] border border-white/15 text-white rounded px-1.5 py-1 text-sm';

interface Props {
  year: number;
  readOnly: boolean;
  /** Called after any write, so the parent can refresh its counts. */
  onChanged?: () => void;
  /** Slot for the "Parse semifinals" button (Task 9). Rendered in the toolbar when given. */
  parseSemisSlot?: ReactNode;
}

const toNum = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const toText = (v: string): string | null => (v.trim() === '' ? null : v);
const triState = (v: boolean | null) => (v === null ? '' : v ? 'yes' : 'no');
const fromTriState = (v: string): boolean | null => (v === '' ? null : v === 'yes');

export function EntriesEditor({ year, readOnly, onChanged, parseSemisSlot }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [addIso, setAddIso] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([
        supabase.from('contest_entries').select('*').eq('year', year).order('iso'),
        supabase.from('countries').select('iso, name_en').order('name_en'),
      ]);
      if (e.error) throw e.error;
      if (c.error) throw c.error;
      setEntries((e.data ?? []) as Entry[]);
      setCountries((c.data ?? []) as Country[]);
    } catch (x) {
      setErr(formatError(x));
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const nameOf = useMemo(() => new Map(countries.map((c) => [c.iso, c.name_en])), [countries]);
  const sorted = useMemo(
    () => [...entries].sort((a, b) => (nameOf.get(a.iso) ?? a.iso).localeCompare(nameOf.get(b.iso) ?? b.iso)),
    [entries, nameOf],
  );
  const available = countries.filter((c) => !entries.some((e) => e.iso === c.iso));

  // Runs one RPC, then reloads. Unsaved drafts of other rows are kept.
  const run = async (fn: () => PromiseLike<{ error: unknown }>, onDone?: () => void) => {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await fn();
      if (error) throw error;
      onDone?.();
      await load();
      onChanged?.();
    } catch (x) {
      setErr(formatError(x));
    } finally {
      setBusy(false);
    }
  };

  const dropDraft = (iso: string) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[iso];
      return next;
    });

  const edit = (iso: string, key: EditableKey, value: Entry[EditableKey]) => {
    const original = entries.find((e) => e.iso === iso);
    setDrafts((d) => {
      const next: Draft = { ...d[iso] };
      if (original && original[key] === value) delete next[key];
      else (next as Record<string, unknown>)[key] = value;
      return { ...d, [iso]: next };
    });
  };

  const valueOf = <K extends EditableKey>(e: Entry, key: K): Entry[K] =>
    (drafts[e.iso] && key in drafts[e.iso] ? drafts[e.iso][key] : e[key]) as Entry[K];

  const save = (iso: string) =>
    run(
      () => supabase.rpc('upsert_contest_entry', { p_year: year, p_iso: iso, p_fields: drafts[iso] ?? {} }),
      () => dropDraft(iso),
    );

  const add = () => {
    if (!addIso) return;
    const iso = addIso;
    setAddIso('');
    return run(() => supabase.rpc('upsert_contest_entry', { p_year: year, p_iso: iso, p_fields: {} }));
  };

  const remove = (iso: string) => {
    if (!window.confirm(`Delete ${nameOf.get(iso) ?? iso} from ${year}? Its semi and final data are removed too.`)) {
      return;
    }
    return run(
      () => supabase.rpc('delete_contest_entry', { p_year: year, p_iso: iso }),
      () => dropDraft(iso),
    );
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-white">Entries {year}</h3>
        <span className="text-xs text-white/50">{entries.length} entries</span>
        {!readOnly && parseSemisSlot}
      </header>

      {readOnly && (
        <p className="text-sm text-amber-200/80">Edit + Republish arrives with publishing (2b)</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-white/50 uppercase tracking-wide border-b border-white/10">
              <th className="px-2 py-1.5">Country</th>
              <th className="px-2 py-1.5">Artist</th>
              <th className="px-2 py-1.5">Song</th>
              <th className="px-2 py-1.5">Semi</th>
              <th className="px-2 py-1.5">Semi place</th>
              <th className="px-2 py-1.5">Qualified</th>
              <th className="px-2 py-1.5">In final</th>
              <th className="px-2 py-1.5">Final RO</th>
              <th className="px-2 py-1.5">Final place</th>
              <th className="px-2 py-1.5">Points</th>
              {!readOnly && <th className="px-2 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              const name = nameOf.get(e.iso) ?? e.iso;
              if (readOnly) {
                return (
                  <tr key={e.iso} className="border-b border-white/5 last:border-0 text-white/80">
                    <td className="px-2 py-1.5 text-white">{name}</td>
                    <td className="px-2 py-1.5">{e.artist ?? '—'}</td>
                    <td className="px-2 py-1.5">{e.song ?? '—'}</td>
                    <td className="px-2 py-1.5">{e.semi ?? '—'}</td>
                    <td className="px-2 py-1.5">{e.semi_place ?? '—'}</td>
                    <td className="px-2 py-1.5">{e.qualified === null ? '—' : e.qualified ? 'yes' : 'no'}</td>
                    <td className="px-2 py-1.5">{e.in_final ? 'yes' : 'no'}</td>
                    <td className="px-2 py-1.5">{e.final_running_order ?? '—'}</td>
                    <td className="px-2 py-1.5">{e.final_place ?? '—'}</td>
                    <td className="px-2 py-1.5">{e.total_points ?? '—'}</td>
                  </tr>
                );
              }
              const dirty = Object.keys(drafts[e.iso] ?? {}).length > 0;
              return (
                <tr key={e.iso} className="border-b border-white/5 last:border-0">
                  <td className="px-2 py-1.5 text-white">{name}</td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Artist ${e.iso}`}
                      value={valueOf(e, 'artist') ?? ''}
                      onChange={(ev) => edit(e.iso, 'artist', toText(ev.target.value))}
                      className={`${INPUT} w-36`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`Song ${e.iso}`}
                      value={valueOf(e, 'song') ?? ''}
                      onChange={(ev) => edit(e.iso, 'song', toText(ev.target.value))}
                      className={`${INPUT} w-36`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label={`Semi ${e.iso}`}
                      value={valueOf(e, 'semi') ?? ''}
                      onChange={(ev) => edit(e.iso, 'semi', toNum(ev.target.value))}
                      className={INPUT}
                    >
                      <option value="" className="bg-[#1a0a2e]">—</option>
                      <option value="1" className="bg-[#1a0a2e]">1</option>
                      <option value="2" className="bg-[#1a0a2e]">2</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      aria-label={`Semi place ${e.iso}`}
                      value={valueOf(e, 'semi_place') ?? ''}
                      onChange={(ev) => edit(e.iso, 'semi_place', toNum(ev.target.value))}
                      className={`${INPUT} w-16`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label={`Qualified ${e.iso}`}
                      value={triState(valueOf(e, 'qualified'))}
                      onChange={(ev) => edit(e.iso, 'qualified', fromTriState(ev.target.value))}
                      className={INPUT}
                    >
                      <option value="" className="bg-[#1a0a2e]">—</option>
                      <option value="yes" className="bg-[#1a0a2e]">yes</option>
                      <option value="no" className="bg-[#1a0a2e]">no</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`In final ${e.iso}`}
                      checked={valueOf(e, 'in_final')}
                      onChange={(ev) => edit(e.iso, 'in_final', ev.target.checked)}
                    />
                  </td>
                  {FINAL_COLS.map((c) => (
                    <td key={c.key} className="px-2 py-1.5">
                      <input
                        type="number"
                        aria-label={`${c.label} ${e.iso}`}
                        value={valueOf(e, c.key) ?? ''}
                        onChange={(ev) => edit(e.iso, c.key, toNum(ev.target.value))}
                        className={`${INPUT} w-16`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !dirty}
                        onClick={() => save(e.iso)}
                        className="px-2.5 py-1 rounded bg-emerald-500 text-black font-bold text-xs disabled:opacity-40 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(e.iso)}
                        className="px-2.5 py-1 rounded bg-red-500/80 text-white font-bold text-xs disabled:opacity-40 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="text-sm text-white/50 py-2">No entries yet.</p>}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Add country"
            value={addIso}
            onChange={(ev) => setAddIso(ev.target.value)}
            className={INPUT}
          >
            <option value="" className="bg-[#1a0a2e]">Choose a country…</option>
            {available.map((c) => (
              <option key={c.iso} value={c.iso} className="bg-[#1a0a2e]">{c.name_en}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !addIso}
            onClick={add}
            className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          >
            Add
          </button>
        </div>
      )}

      {err && <p className="text-sm text-red-300">{err}</p>}
    </section>
  );
}
