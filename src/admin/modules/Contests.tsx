// src/admin/modules/Contests.tsx
// Admin Contests module: the publish bar, every contest year with its
// lifecycle (start, finalize, archive, un-archive), a "Create year" form,
// and the details form and entries editor of the selected year (archived
// years included: Edit + Republish). Lifecycle rules live in
// contests/lifecycle.ts and mirror the SQL guards of migration 071; the
// SQL stays authoritative and its refusals show through formatError.
// Finalize, Archive and Un-archive publish automatically once they
// succeed (spec §7); a failed publish never undoes the lifecycle move.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatError } from '../lib/formatError';
import { ContestList, type ContestSummary } from './contests/ContestList';
import { EntriesEditor } from './contests/EntriesEditor';
import { ContestDetailsForm } from './contests/ContestDetailsForm';
import { PublishBar } from './contests/PublishBar';
import { usePublisher } from './contests/publish';
import { ParseSemisButton } from './parser/ParseSemisButton';
import { ACTION_LABELS, confirmText, type ContestAction } from './contests/lifecycle';

const RPC: Record<ContestAction, string> = {
  start: 'start_contest',
  finalize: 'finalize_contest',
  archive: 'archive_contest',
  unarchive: 'unarchive_contest',
};

// Lifecycle moves that change public pages, so they publish on success.
const AUTO_PUBLISH: ReadonlySet<ContestAction> = new Set(['finalize', 'archive', 'unarchive']);

const INPUT = 'bg-[#1a0a2e] border border-white/15 text-white rounded px-2 py-1.5';

const EMPTY_FORM = { year: '', city: '', slug: '', host: '', semi1: '', semi2: '', final: '' };
type Form = typeof EMPTY_FORM;

const FORM_FIELDS: Array<{ key: keyof Form; label: string; type: string }> = [
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'slug', label: 'Slug', type: 'text' },
  { key: 'host', label: 'Host ISO', type: 'text' },
  { key: 'semi1', label: 'Semi 1', type: 'date' },
  { key: 'semi2', label: 'Semi 2', type: 'date' },
  { key: 'final', label: 'Final', type: 'date' },
];

export default function Contests() {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  // Years known to have at least one room. Only Y+1 of the latest archived
  // year is checked (it gates Un-archive); unknown years count as having rooms.
  const [roomsChecked, setRoomsChecked] = useState<Record<number, boolean>>({});
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [entriesReload, setEntriesReload] = useState(0);
  const publisher = usePublisher();
  const { refresh: refreshPublish, publish } = publisher;

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('contest_summaries');
      if (error) throw error;
      const rows = (data ?? []) as ContestSummary[];
      setContests(rows);

      const archived = rows.filter((r) => r.stage === 'archived').map((r) => r.year);
      const latest = archived.length ? Math.max(...archived) : null;
      const next = latest === null ? undefined : rows.find((r) => r.year === latest + 1);
      if (next && next.stage === 'current') {
        const res = await supabase.rpc('contest_has_rooms', { p_year: next.year });
        if (res.error) throw res.error;
        setRoomsChecked({ [next.year]: res.data === true });
      } else {
        setRoomsChecked({});
      }
    } catch (e) {
      setErr(formatError(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // After any edit: refresh the list and the "unpublished changes" count.
  const changed = useCallback(() => {
    load();
    refreshPublish();
  }, [load, refreshPublish]);

  const hasRooms = (year: number) => roomsChecked[year] ?? true;

  const act = async (action: ContestAction, c: ContestSummary) => {
    if (!window.confirm(confirmText(action, c, contests))) return;
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const { data, error } = await supabase.rpc(RPC[action], { p_year: c.year });
      if (error) throw error;
      setNotice(
        action === 'finalize' && typeof data === 'number'
          ? `${ACTION_LABELS[action]} ${c.year} done. Winners computed for ${data} room${data === 1 ? '' : 's'}.`
          : `${ACTION_LABELS[action]} ${c.year} done.`,
      );
      await load();
    } catch (e) {
      setErr(formatError(e));
      return;
    } finally {
      setBusy(false);
    }
    // Outcome (including failure) shows in the PublishBar; the move stands either way.
    if (AUTO_PUBLISH.has(action)) await publish();
    else refreshPublish();
  };

  const create = async () => {
    const year = Number(form.year);
    if (!Number.isInteger(year) || !form.city.trim() || !form.slug.trim()) {
      setErr('Year, city and slug are required.');
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const { error } = await supabase.rpc('create_contest', {
        p_year: year,
        p_city: form.city.trim(),
        p_city_slug: form.slug.trim(),
        p_host_iso: form.host.trim() ? form.host.trim().toUpperCase() : null,
        p_semi1: form.semi1 || null,
        p_semi2: form.semi2 || null,
        p_final: form.final || null,
      });
      if (error) throw error;
      setNotice(`Created ${year}.`);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      changed();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const selected = contests.find((c) => c.year === selectedYear) ?? null;

  return (
    <div className="p-4 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">🗓️ Contests</h2>
          <p className="text-sm text-white/60 mt-1 max-w-2xl">
            Every contest year and its lifecycle: upcoming → current → finalized → archived.
            Only the moves the database allows right now are offered.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm cursor-pointer"
        >
          Create year
        </button>
      </header>

      <PublishBar publisher={publisher} />

      {showCreate && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-4 max-w-3xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {FORM_FIELDS.map((f) => (
              <label key={f.key} className="text-sm text-white/80 flex flex-col gap-1">
                <span className="text-xs text-white/50 uppercase tracking-wide">{f.label}</span>
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className={INPUT}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy ? 'Working…' : 'Create'}
          </button>
        </section>
      )}

      {notice && <p className="text-sm text-emerald-300">{notice}</p>}
      {err && <p className="text-sm text-red-300">{err}</p>}

      <ContestList
        contests={contests}
        hasRooms={hasRooms}
        selectedYear={selectedYear}
        busy={busy}
        onAction={act}
        onSelect={setSelectedYear}
      />

      {selected && (
        <ContestDetailsForm key={`details-${selected.year}`} year={selected.year} onSaved={changed} />
      )}

      {selected && (
        <EntriesEditor
          key={selected.year}
          year={selected.year}
          archived={selected.stage === 'archived'}
          onChanged={changed}
          reloadKey={entriesReload}
          parseSemisSlot={
            selected.stage === 'current' || selected.stage === 'finalized' ? (
              <ParseSemisButton
                year={selected.year}
                onParsed={() => {
                  setEntriesReload((n) => n + 1);
                  changed();
                }}
              />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
