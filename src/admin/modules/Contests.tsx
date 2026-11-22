// src/admin/modules/Contests.tsx
// Admin Contests module: the publish bar, every contest year with its
// lifecycle (start, finalize, archive, un-archive), a "Create year" form,
// and the details form and entries editor of the selected year (archived
// years included: Edit + Republish). Lifecycle rules live in
// contests/lifecycle.ts and mirror the SQL guards of migration 071; the
// SQL stays authoritative and its refusals show through formatError.
// Finalize, Archive and Un-archive publish automatically once they
// succeed (spec §7); a failed publish never undoes the lifecycle move.
//
// In the admin shell the selected year is the URL (/admin/contests/:year,
// …/entries, …/entries/:iso): the route passes `year`, `section`, `iso` and
// `onSelect`. Rendered alone (tests), the year is local state.

import { useCallback, useEffect, useRef, useState } from 'react';
import { archivePath, hubPath } from '../../lib/seo/dynamicPages';
import { useAdminLive } from '../adminMeta';
import { useUnsavedGuard } from '../unsavedGuard';
import { supabase } from '../../lib/supabase';
import { formatError } from '../lib/formatError';
import { ContestList, type ContestSummary } from './contests/ContestList';
import { EntriesEditor } from './contests/EntriesEditor';
import { ContestDetailsForm } from './contests/ContestDetailsForm';
import { PublishBar } from './contests/PublishBar';
import { usePublisher } from './contests/publish';
import { ParseSemisButton } from './parser/ParseSemisButton';
import { ACTION_LABELS, confirmText, type ContestAction } from './contests/lifecycle';
import { t } from '../i18n';

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

// `example` is the placeholder; date inputs ignore placeholders, so dates show it as a hint below.
const FORM_FIELDS: Array<{ key: keyof Form; label: string; type: string; example: string }> = [
  { key: 'year', label: t.contests.fields.year, type: 'number', example: t.contests.examples.year },
  { key: 'city', label: t.contests.fields.city, type: 'text', example: t.contests.examples.city },
  { key: 'slug', label: t.contests.fields.slug, type: 'text', example: t.contests.examples.slug },
  { key: 'host', label: t.contests.fields.host, type: 'text', example: t.contests.examples.host },
  { key: 'semi1', label: t.contests.fields.semi1, type: 'date', example: t.contests.examples.semi1 },
  { key: 'semi2', label: t.contests.fields.semi2, type: 'date', example: t.contests.examples.semi2 },
  { key: 'final', label: t.contests.fields.final, type: 'date', example: t.contests.examples.final },
];

export interface ContestsProps {
  /** The selected year (from the URL). Only read when `onSelect` is given. */
  year?: number | null;
  /** Which part of the year's editor to bring into view. */
  section?: 'details' | 'entries';
  /** One entry to bring into view and highlight (entries section). */
  iso?: string | null;
  /** Selects a year (null: none), e.g. by navigating. */
  onSelect?: (year: number | null) => void;
  /** Admin link of one entry, shown on its country name. */
  entryPath?: (year: number, iso: string) => string;
}

export default function Contests({ year, section = 'details', iso = null, onSelect, entryPath }: ContestsProps = {}) {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [localYear, setLocalYear] = useState<number | null>(null);
  const selectedYear = onSelect ? year ?? null : localYear;
  const setSelectedYear = (y: number | null) => (onSelect ? onSelect(y) : setLocalYear(y));
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

  const act = async (action: ContestAction, c: ContestSummary) => {
    if (!window.confirm(confirmText(action, c))) return;
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const { data, error } = await supabase.rpc(RPC[action], { p_year: c.year });
      if (error) throw error;
      setNotice(
        action === 'finalize' && typeof data === 'number'
          ? t.contests.doneWinners(ACTION_LABELS[action], c.year, Number(data))
          : t.contests.done(ACTION_LABELS[action], c.year),
      );
      await load();
    } catch (e) {
      setErr(formatError(e));
      return;
    } finally {
      setBusy(false);
    }
    // Outcome (including failure) shows in the PublishBar; the move stands either way.
    // Contests only: CMS page drafts ship only from an explicit Publish click (I3).
    if (AUTO_PUBLISH.has(action)) await publish({ cms: false });
    else refreshPublish();
  };

  const create = async () => {
    const year = Number(form.year);
    if (!Number.isInteger(year) || !form.city.trim() || !form.slug.trim()) {
      setErr(t.contests.required);
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
      setNotice(t.contests.created(year));
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
  useAdminLive(selected ? (selected.stage === 'archived' ? archivePath(selected.year, selected.city_slug) : hubPath(selected.year)) : null);
  // The create form counts as unsaved edits once anything is typed.
  useUnsavedGuard(showCreate && Object.values(form).some((v) => v !== ''));

  // The editor renders below the full year list (70+ rows): bring it into
  // view on Edit, or the click looks like it did nothing. A deep link to the
  // entries (or one entry, which EntriesEditor scrolls to) skips the details.
  const editorRef = useRef<HTMLElement>(null);
  const entriesRef = useRef<HTMLDivElement>(null);
  const shown = selected !== null;
  useEffect(() => {
    if (selectedYear === null || !shown || iso) return;
    const target = section === 'entries' ? entriesRef.current : editorRef.current;
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [selectedYear, shown, section, iso]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-stage-text m-0">{t.contests.title}</h2>
          <p className="t-small mt-1.5 max-w-2xl">{t.contests.lede}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm cursor-pointer"
        >
          {t.contests.create}
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
                  aria-label={f.label}
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.type === 'date' ? undefined : f.example}
                  className={`${INPUT} placeholder:text-white/30`}
                />
                {f.type === 'date' && <span className="text-xs text-white/40">{f.example}</span>}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
          >
            {busy ? t.contests.working : t.contests.createBtn}
          </button>
        </section>
      )}

      {notice && <p className="text-sm text-emerald-300">{notice}</p>}
      {err && <p className="text-sm text-red-300">{err}</p>}

      <ContestList
        contests={contests}
        selectedYear={selectedYear}
        busy={busy}
        onAction={act}
        onSelect={setSelectedYear}
      />

      {selected && (
        <section ref={editorRef} aria-label={t.contests.editAria(selected.year)} className="space-y-4 scroll-mt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white">{t.contests.editing(selected.year, selected.city)}</h3>
            <button
              type="button"
              onClick={() => setSelectedYear(null)}
              className="px-2.5 py-1 rounded border border-white/15 text-white/80 text-xs cursor-pointer"
            >
              {t.contests.close}
            </button>
          </div>
          <ContestDetailsForm key={`details-${selected.year}`} year={selected.year} onSaved={changed} />
        </section>
      )}

      {selected && (
        <div ref={entriesRef} className="scroll-mt-4">
        <EntriesEditor
          key={selected.year}
          year={selected.year}
          archived={selected.stage === 'archived'}
          onChanged={changed}
          reloadKey={entriesReload}
          focusIso={iso}
          entryPath={entryPath ? (code) => entryPath(selected.year, code) : undefined}
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
        </div>
      )}
    </div>
  );
}
