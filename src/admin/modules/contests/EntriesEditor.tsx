// src/admin/modules/contests/EntriesEditor.tsx
// Entries of one contest year. Rows are edited inline and saved through
// upsert_contest_entry (only the changed fields are sent); countries are
// added and removed through upsert_contest_entry / delete_contest_entry.
// Archived years are edited the same way (Edit + Republish): the change
// reaches the public archive page with the next Publish, as the banner says.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useUnsavedGuard } from '../../unsavedGuard';
import { supabase } from '../../../lib/supabase';
import { compareText } from '../../../lib/seo/textSort';
import { formatError } from '../../lib/formatError';
import { t } from '../../i18n';

interface Entry {
  year: number;
  iso: string;
  artist: string | null;
  song: string | null;
  semi: number | null;
  semi_running_order: number | null;
  semi_place: number | null;
  semi_points: number | null;
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

const FINAL_COLS: Array<{ key: 'final_running_order' | 'final_place' | 'total_points'; label: string; example: string }> = [
  { key: 'final_running_order', label: t.contests.ecols.finalRo, example: '12' },
  { key: 'final_place', label: t.contests.ecols.finalPlace, example: '1' },
  { key: 'total_points', label: t.contests.ecols.points, example: '436' },
];

const INPUT = 'bg-[#1a0a2e] border border-white/15 text-white rounded px-1.5 py-1 text-sm';

interface Props {
  year: number;
  /** Archived year: shows the "go live after Publish" banner. */
  archived?: boolean;
  /** Called after any write, so the parent can refresh its counts. */
  onChanged?: () => void;
  /** Slot for the "Parse semifinals" button (Task 9). Rendered in the toolbar when given. */
  parseSemisSlot?: ReactNode;
  /** Bump to reload the entries (e.g. after a semi-final parse). Unsaved edits are kept. */
  reloadKey?: number;
  /** Bring this entry (ISO code) into view and highlight it once loaded (a deep link). */
  focusIso?: string | null;
  /** Admin link of one entry; when given, the country name links to it. */
  entryPath?: (iso: string) => string;
}

const toNum = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const toText = (v: string): string | null => (v.trim() === '' ? null : v);
const triState = (v: boolean | null) => (v === null ? '' : v ? 'yes' : 'no');
const fromTriState = (v: string): boolean | null => (v === '' ? null : v === 'yes');

export function EntriesEditor({ year, archived = false, onChanged, parseSemisSlot, reloadKey, focusIso = null, entryPath }: Props) {
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

  useEffect(() => { load(); }, [load, reloadKey]);

  const nameOf = useMemo(() => new Map(countries.map((c) => [c.iso, c.name_en])), [countries]);
  const sorted = useMemo(
    () => [...entries].sort((a, b) => compareText(nameOf.get(a.iso) ?? a.iso, nameOf.get(b.iso) ?? b.iso)),
    [entries, nameOf],
  );
  const available = countries.filter((c) => !entries.some((e) => e.iso === c.iso));
  useUnsavedGuard(Object.values(drafts).some((d) => Object.keys(d).length > 0));

  const focusRef = useRef<HTMLTableRowElement>(null);
  const hasFocusRow = !!focusIso && entries.some((e) => e.iso === focusIso);
  useEffect(() => {
    if (hasFocusRow) focusRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [hasFocusRow, focusIso]);

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
    if (!window.confirm(t.contests.deleteConfirm(nameOf.get(iso) ?? iso, year))) {
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
        <h3 className="text-lg font-bold text-white">{t.contests.entries(year)}</h3>
        <span className="text-xs text-white/50">{t.contests.entryCount(entries.length)}</span>
        {parseSemisSlot}
      </header>

      {archived && (
        <p className="rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {t.contests.archivedNote}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-white/50 uppercase tracking-wide border-b border-white/10">
              <th className="px-2 py-1.5">{t.contests.ecols.country}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.artist}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.song}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.semi}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.semiRo}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.semiPlace}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.semiPoints}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.qualified}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.inFinal}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.finalRo}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.finalPlace}</th>
              <th className="px-2 py-1.5">{t.contests.ecols.points}</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              const name = nameOf.get(e.iso) ?? e.iso;
              const dirty = Object.keys(drafts[e.iso] ?? {}).length > 0;
              return (
                <tr
                  key={e.iso}
                  ref={e.iso === focusIso ? focusRef : undefined}
                  aria-current={e.iso === focusIso ? 'true' : undefined}
                  className={`border-b border-white/5 last:border-0${e.iso === focusIso ? ' bg-stage-pink/10 outline outline-1 outline-stage-pink/40' : ''}`}
                >
                  <td className="px-2 py-1.5 text-white">
                    {entryPath ? (
                      <Link to={entryPath(e.iso)} className="hover:underline">{name}</Link>
                    ) : (
                      name
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`${t.contests.ecols.artist} ${e.iso}`}
                      value={valueOf(e, 'artist') ?? ''}
                      onChange={(ev) => edit(e.iso, 'artist', toText(ev.target.value))}
                      placeholder={t.contests.artistPh}
                      className={`${INPUT} w-36 placeholder:text-white/30`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`${t.contests.ecols.song} ${e.iso}`}
                      value={valueOf(e, 'song') ?? ''}
                      onChange={(ev) => edit(e.iso, 'song', toText(ev.target.value))}
                      placeholder={t.contests.songPh}
                      className={`${INPUT} w-36 placeholder:text-white/30`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label={`${t.contests.ecols.semi} ${e.iso}`}
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
                      aria-label={`${t.contests.ecols.semiRo} ${e.iso}`}
                      value={valueOf(e, 'semi_running_order') ?? ''}
                      onChange={(ev) => edit(e.iso, 'semi_running_order', toNum(ev.target.value))}
                      placeholder="4"
                      className={`${INPUT} w-16 placeholder:text-white/30`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      aria-label={`${t.contests.ecols.semiPlace} ${e.iso}`}
                      value={valueOf(e, 'semi_place') ?? ''}
                      onChange={(ev) => edit(e.iso, 'semi_place', toNum(ev.target.value))}
                      placeholder="2"
                      className={`${INPUT} w-16 placeholder:text-white/30`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      aria-label={`${t.contests.ecols.semiPoints} ${e.iso}`}
                      value={valueOf(e, 'semi_points') ?? ''}
                      onChange={(ev) => edit(e.iso, 'semi_points', toNum(ev.target.value))}
                      placeholder="180"
                      className={`${INPUT} w-16 placeholder:text-white/30`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label={`${t.contests.ecols.qualified} ${e.iso}`}
                      value={triState(valueOf(e, 'qualified'))}
                      onChange={(ev) => edit(e.iso, 'qualified', fromTriState(ev.target.value))}
                      className={INPUT}
                    >
                      <option value="" className="bg-[#1a0a2e]">—</option>
                      <option value="yes" className="bg-[#1a0a2e]">{t.contests.yes}</option>
                      <option value="no" className="bg-[#1a0a2e]">{t.contests.no}</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`${t.contests.ecols.inFinal} ${e.iso}`}
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
                        placeholder={c.example}
                        className={`${INPUT} w-16 placeholder:text-white/30`}
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
                        {t.contests.save}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(e.iso)}
                        className="px-2.5 py-1 rounded bg-red-500/80 text-white font-bold text-xs disabled:opacity-40 cursor-pointer"
                      >
                        {t.contests.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="text-sm text-white/50 py-2">{t.contests.noEntries}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t.contests.addCountry}
          value={addIso}
          onChange={(ev) => setAddIso(ev.target.value)}
          className={INPUT}
        >
          <option value="" className="bg-[#1a0a2e]">{t.contests.chooseCountry}</option>
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
          {t.contests.add}
        </button>
      </div>

      {err && <p className="text-sm text-red-300">{err}</p>}
    </section>
  );
}
