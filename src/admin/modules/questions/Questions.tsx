// /admin/game/questions: the question bank. The round mix by era sits at the
// top (owner: "σε εμφανές και κατάλληλο σημείο"), then the searchable list
// (year, country, topic, status, era, flags, free text) and the editor.
// Super admins only (RLS, 098); players never read this table.
import clsx from 'clsx';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { t } from '../../i18n';
import { Field, StatusChip, TextInput, INPUT, useToast, type ChipTone } from '../../ui/kit';
import {
  DEFAULT_MIX, DIFFICULTIES, ERAS, QUESTION_COLUMNS, STATUSES, TOPICS,
  NO_FILTERS, eraOf, filterQuestions, mixTotal, questionProblem, roundMix,
  type Filters,
  type Era, type Mix, type QuestionRow, type Status,
} from './questionBank';

const T = t.questions;
const PAGE = 50;
const STATUS_TONE: Record<Status, ChipTone> = { draft: 'gold', review: 'pink', verified: 'ok', retired: 'muted' };
const SELECT = clsx(INPUT, 'pr-8');

interface Country { iso: string; name_el: string }

// ── Round mix ───────────────────────────────────────────────────────────
function MixCard({ liveYear, stock }: { liveYear: number | null; stock: Record<Era, number> }) {
  const toast = useToast();
  const [saved, setSaved] = useState<Mix | null>(null);
  const [mix, setMix] = useState<Mix>(DEFAULT_MIX);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from('quiz_settings').select('era_current, era_previous, era_recent, era_classic').maybeSingle()
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        if (!data) return;
        const m: Mix = { current: data.era_current, previous: data.era_previous, recent: data.era_recent, classic: data.era_classic };
        setSaved(m); setMix(m);
      });
  }, []);

  const total = mixTotal(mix);
  const dirty = saved != null && ERAS.some((e) => saved[e] !== mix[e]);
  const perRound = roundMix(mix);

  async function save() {
    setBusy(true); setErr(null);
    const { error } = await supabase.from('quiz_settings')
      .update({ era_current: mix.current, era_previous: mix.previous, era_recent: mix.recent, era_classic: mix.classic })
      .eq('id', true);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSaved(mix);
    toast.show(T.mixSaved);
  }

  return (
    <section className="rounded-stage border border-stage-line bg-stage-surface p-5" aria-labelledby="qmix-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="qmix-title" className="text-base font-bold text-stage-text m-0">{T.mixTitle}</h3>
        {liveYear != null && <span className="t-meta">{T.liveYear(liveYear)}</span>}
      </div>
      <p className="t-meta mt-1 mb-4">{T.mixLede}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ERAS.map((e) => (
          <Field key={e} label={`${T.era[e]} (%)`} hint={`${T.eraHint[e]} · ${T.stock(stock[e])}`}>
            <TextInput
              type="number" inputMode="numeric" min={0} max={100} step={5}
              value={mix[e]}
              onChange={(ev) => setMix({ ...mix, [e]: Math.max(0, Math.min(100, Math.round(Number(ev.target.value) || 0))) })}
            />
          </Field>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className={clsx('font-semibold', total === 100 ? 'text-stage-text' : 'text-stage-bad')} aria-live="polite">
          {T.mixTotal(total)}{total !== 100 && ` · ${T.mixMustBe100}`}
        </span>
        {total === 100 && (
          <span className="text-stage-text-2">
            {T.mixPerRound} {ERAS.map((e) => `${perRound[e]} ${T.era[e].toLowerCase()}`).join(' · ')}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || total !== 100 || busy}
          className="ml-auto rounded-stage-sm bg-stage-pink px-4 min-h-10 font-semibold text-white disabled:opacity-40"
        >
          {busy ? t.common.saving : t.common.save}
        </button>
      </div>
      <p className="t-meta mt-3 mb-0">{T.duelMix}</p>
      {err && <p className="text-sm text-stage-bad mt-2 mb-0" role="alert">{err}</p>}
    </section>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────
type Draft = Omit<QuestionRow, 'id' | 'verified_at' | 'updated_at'> & { id: number | null };

const EMPTY: Draft = {
  id: null, correct_index: 0, contest_year: null, iso: null, topic: 'song', difficulty: 'medium',
  question_en: '', question_el: '', options_en: ['', '', '', ''], options_el: ['', '', '', ''],
  fact: '', source: '', note: '', lyric_check: false, time_sensitive: false, status: 'draft',
};

function Editor({ initial, countries, years, onDone, onCancel }: {
  initial: Draft; countries: Country[]; years: number[];
  onDone: (id: number) => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const problem = questionProblem({ ...d, source: d.source ?? '' });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setOpt = (lang: 'options_en' | 'options_el', i: number, v: string) =>
    setD((x) => ({ ...x, [lang]: x[lang].map((o, j) => (j === i ? v : o)) }));

  async function save() {
    if (problem) { setErr(T.problem[problem]); return; }
    setBusy(true); setErr(null);
    const row = {
      correct_index: d.correct_index, contest_year: d.contest_year, iso: d.iso, topic: d.topic, difficulty: d.difficulty,
      question_en: d.question_en.trim(), question_el: d.question_el.trim(),
      options_en: d.options_en.map((o) => o.trim()), options_el: d.options_el.map((o) => o.trim()),
      fact: d.fact.trim(), source: d.source?.trim() || null, note: d.note?.trim() || null,
      lyric_check: d.lyric_check, time_sensitive: d.time_sensitive, status: d.status,
    };
    const q = d.id == null
      ? supabase.from('quiz_questions').insert(row).select('id').single()
      : supabase.from('quiz_questions').update(row).eq('id', d.id).select('id').single();
    const { data, error } = await q;
    setBusy(false);
    if (error) { setErr(/fact_uniq/.test(error.message) ? T.duplicate : error.message); return; }
    toast.show(d.id == null ? T.created(data.id) : T.saved);
    onDone(data.id);
  }

  const optionRows = (lang: 'options_en' | 'options_el', label: string) => (
    <fieldset className="min-w-0 border-0 p-0 m-0">
      <legend className="text-[13px] font-semibold text-stage-text-2 mb-1">{label}</legend>
      <div className="space-y-2">
        {d[lang].map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio" name={`correct-${lang}`} checked={d.correct_index === i}
              onChange={() => set('correct_index', i)} aria-label={T.correctAria(i)} className="size-4 accent-[var(--color-stage-pink)]"
            />
            <TextInput value={o} onChange={(e) => setOpt(lang, i, e.target.value)} aria-label={`${label} · ${T.option(i)}`}
              className={d.correct_index === i ? 'border-stage-ok' : undefined} />
          </div>
        ))}
      </div>
    </fieldset>
  );

  return (
    <section className="rounded-stage border border-stage-line-2 bg-stage-surface p-5 space-y-4" aria-label={d.id == null ? T.create : T.edit(d.id)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-stage-text m-0">{d.id == null ? T.create : T.edit(d.id)}</h3>
        <StatusChip tone={STATUS_TONE[d.status]}>{T.status[d.status]}</StatusChip>
        {d.lyric_check && <StatusChip tone="pink">{T.flagLyric}</StatusChip>}
        {d.time_sensitive && <StatusChip tone="muted">{T.flagTime}</StatusChip>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={T.filterYear}>
          <select className={SELECT} value={d.contest_year ?? ''} onChange={(e) => set('contest_year', e.target.value ? Number(e.target.value) : null)}>
            <option value="">{T.general}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
        <Field label={T.filterCountry}>
          <select className={SELECT} value={d.iso ?? ''} onChange={(e) => set('iso', e.target.value || null)}>
            <option value="">{T.noCountry}</option>
            {countries.map((c) => <option key={c.iso} value={c.iso}>{c.name_el}</option>)}
          </select>
        </Field>
        <Field label={T.filterTopic}>
          <select className={SELECT} value={d.topic} onChange={(e) => set('topic', e.target.value as Draft['topic'])}>
            {TOPICS.map((k) => <option key={k} value={k}>{T.topic[k]}</option>)}
          </select>
        </Field>
        <Field label={T.cols.diff}>
          <select className={SELECT} value={d.difficulty} onChange={(e) => set('difficulty', e.target.value as Draft['difficulty'])}>
            {DIFFICULTIES.map((k) => <option key={k} value={k}>{T.difficulty[k]}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label={T.questionEl}>
            <textarea className={clsx(INPUT, 'h-auto min-h-20 py-2')} value={d.question_el} onChange={(e) => set('question_el', e.target.value)} />
          </Field>
          {optionRows('options_el', T.optionsEl)}
        </div>
        <div className="space-y-3">
          <Field label={T.questionEn}>
            <textarea className={clsx(INPUT, 'h-auto min-h-20 py-2')} value={d.question_en} onChange={(e) => set('question_en', e.target.value)} />
          </Field>
          {optionRows('options_en', T.optionsEn)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={T.fact} hint={T.factHint}>
          <TextInput value={d.fact} onChange={(e) => set('fact', e.target.value)} />
        </Field>
        <Field label={T.source} hint={T.sourceHint}>
          <TextInput value={d.source ?? ''} onChange={(e) => set('source', e.target.value)} type="url" />
        </Field>
      </div>
      <Field label={T.note}>
        <TextInput value={d.note ?? ''} onChange={(e) => set('note', e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stage-text-2">
        <Field label={T.filterStatus}>
          <select className={SELECT} value={d.status} onChange={(e) => set('status', e.target.value as Status)}>
            {STATUSES.map((s) => <option key={s} value={s}>{T.status[s]}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 mt-5">
          <input type="checkbox" checked={d.lyric_check} onChange={(e) => set('lyric_check', e.target.checked)} className="size-4" />
          {T.flagLyric}
        </label>
        <label className="flex items-center gap-2 mt-5">
          <input type="checkbox" checked={d.time_sensitive} onChange={(e) => set('time_sensitive', e.target.checked)} className="size-4" />
          {T.flagTime}
        </label>
      </div>

      {err && <p className="text-sm text-stage-bad m-0" role="alert">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="rounded-stage-sm border border-stage-line-2 px-4 min-h-10 text-stage-text-2">{t.common.cancel}</button>
        <button type="button" onClick={save} disabled={busy} className="rounded-stage-sm bg-stage-pink px-4 min-h-10 font-semibold text-white disabled:opacity-40">
          {busy ? t.common.saving : t.common.save}
        </button>
      </div>
    </section>
  );
}

// ── Editor dialog ───────────────────────────────────────────────────────
// The editor opens over the list (owner, 27 Nov: opened above the list it
// was off screen once the list was scrolled, so a second question seemed
// not to open). Esc and the backdrop close it.
function EditorDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-5xl">{children}</div>
    </div>,
    document.body,
  );
}

// ── Bulk actions ────────────────────────────────────────────────────────
type BulkAction =
  | { kind: 'status'; status: Status }
  | { kind: 'flag'; flag: 'lyric_check' | 'time_sensitive'; on: boolean };

function BulkBar({ count, rows, onClear, onDone }: {
  count: number; rows: QuestionRow[]; onClear: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(a: BulkAction) {
    setBusy(true); setMsg(null);
    let targets = rows;
    const skipped: number[] = [];
    if (a.kind === 'status' && a.status === 'verified') {
      // An active question needs a source (098); those without one are left as they are.
      targets = rows.filter((r) => (r.source ?? '').trim() !== '');
      skipped.push(...rows.filter((r) => !targets.includes(r)).map((r) => r.id));
    }
    const patch = a.kind === 'status' ? { status: a.status } : { [a.flag]: a.on };
    const ids = targets.map((r) => r.id);
    const failed: number[] = [];
    if (ids.length) {
      const { error } = await supabase.from('quiz_questions').update(patch).in('id', ids);
      if (error) {
        // One row broke a rule (e.g. two live questions for one fact): apply row by row and report.
        for (const id of ids) {
          const r = await supabase.from('quiz_questions').update(patch).eq('id', id);
          if (r.error) failed.push(id);
        }
      }
    }
    setBusy(false);
    const done = ids.length - failed.length;
    const notes = [
      skipped.length ? T.bulkNoSource(skipped) : '',
      failed.length ? T.bulkFailed(failed) : '',
    ].filter(Boolean).join(' ');
    if (notes) setMsg(notes);
    toast.show(T.bulkDone(done));
    if (!notes) onDone();
  }

  const btn = 'rounded-stage-sm border border-stage-line-2 px-3 min-h-9 text-sm text-stage-text hover:bg-stage-surface-2 disabled:opacity-40';
  return (
    <div className="sticky top-2 z-10 rounded-stage border border-stage-pink/50 bg-stage-surface p-3 space-y-2" role="region" aria-label={T.bulkTitle}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-stage-text mr-2">{T.selected(count)}</span>
        <span className="t-meta">{T.bulkStatus}</span>
        {(['verified', 'review', 'draft', 'retired'] as Status[]).map((s) => (
          <button key={s} type="button" disabled={busy} className={btn} onClick={() => run({ kind: 'status', status: s })}>
            {T.status[s]}
          </button>
        ))}
        <span className="t-meta ml-2">{T.bulkFlags}</span>
        <button type="button" disabled={busy} className={btn} onClick={() => run({ kind: 'flag', flag: 'lyric_check', on: true })}>+ {T.flagLyric}</button>
        <button type="button" disabled={busy} className={btn} onClick={() => run({ kind: 'flag', flag: 'lyric_check', on: false })}>− {T.flagLyric}</button>
        <button type="button" disabled={busy} className={btn} onClick={() => run({ kind: 'flag', flag: 'time_sensitive', on: true })}>+ {T.flagTime}</button>
        <button type="button" disabled={busy} className={btn} onClick={() => run({ kind: 'flag', flag: 'time_sensitive', on: false })}>− {T.flagTime}</button>
        <button type="button" className={clsx(btn, 'ml-auto')} onClick={onClear}>{T.clearSelection}</button>
      </div>
      {msg && <p className="text-sm text-stage-bad m-0" role="alert">{msg} <button type="button" className="underline" onClick={onDone}>{t.common.close}</button></p>}
    </div>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────
export default function Questions() {
  const [rows, setRows] = useState<QuestionRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [liveYear, setLiveYear] = useState<number | null>(null);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [tick, setTick] = useState(0);
  const reload = () => setTick((n) => n + 1);

  useEffect(() => {
    let live = true;
    void supabase.from('quiz_questions').select(QUESTION_COLUMNS)
      .not('question_en', 'is', null).order('contest_year', { ascending: false, nullsFirst: false }).order('id')
      .then(({ data, error }) => {
        if (!live) return;
        setLoadErr(error ? error.message : null);
        if (!error) setRows((data ?? []) as unknown as QuestionRow[]);
      });
    return () => { live = false; };
  }, [tick]);

  useEffect(() => {
    void supabase.from('countries').select('iso, name_el').order('name_el').then(({ data }) => setCountries((data ?? []) as Country[]));
    void supabase.from('contests').select('year').order('year', { ascending: false }).then(({ data }) => setYears((data ?? []).map((c) => c.year as number)));
    void supabase.rpc('live_contest_year').then(({ data }) => { if (typeof data === 'number') setLiveYear(data); });
  }, []);

  const live = liveYear ?? new Date().getFullYear();
  const filtered = useMemo(() => (rows ? filterQuestions(rows, f, live) : []), [rows, f, live]);
  const stock = useMemo(() => {
    const s: Record<Era, number> = { current: 0, previous: 0, recent: 0, classic: 0 };
    for (const r of rows ?? []) if (r.status === 'verified') s[eraOf(r.contest_year, live)] += 1;
    return s;
  }, [rows, live]);
  const yearsInBank = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.contest_year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [rows]);
  const countryName = useMemo(() => new Map(countries.map((c) => [c.iso, c.name_el])), [countries]);
  const setFilter = (k: keyof Filters, v: string) => { setF((x) => ({ ...x, [k]: v })); setShown(PAGE); };

  const open = (r: QuestionRow) => setEditing({ ...r, options_en: [...r.options_en], options_el: [...r.options_el] });

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h2 className="text-2xl font-bold text-stage-text m-0">{T.title}</h2>
        <p className="text-sm text-stage-text-2 mt-1 mb-0">{T.lede}</p>
      </header>

      <MixCard liveYear={liveYear} stock={stock} />

      {editing && (
        <EditorDialog onClose={() => setEditing(null)}>
          <Editor
            key={editing.id ?? 'new'}
            initial={editing} countries={countries} years={years}
            onCancel={() => setEditing(null)}
            onDone={() => { setEditing(null); reload(); }}
          />
        </EditorDialog>
      )}

      <section className="space-y-3" aria-label={T.title}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7 items-end">
          <div className="sm:col-span-3 lg:col-span-2">
            <Field label={T.search}>
              <TextInput type="search" value={f.q} placeholder={T.searchPh} onChange={(e) => setFilter('q', e.target.value)} />
            </Field>
          </div>
          <Field label={T.filterYear}>
            <select className={SELECT} value={f.year} onChange={(e) => setFilter('year', e.target.value)}>
              <option value="">{T.all}</option>
              <option value="none">{T.general}</option>
              {yearsInBank.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label={T.filterCountry}>
            <select className={SELECT} value={f.iso} onChange={(e) => setFilter('iso', e.target.value)}>
              <option value="">{T.all}</option>
              <option value="none">{T.noCountry}</option>
              {countries.map((c) => <option key={c.iso} value={c.iso}>{c.name_el}</option>)}
            </select>
          </Field>
          <Field label={T.filterTopic}>
            <select className={SELECT} value={f.topic} onChange={(e) => setFilter('topic', e.target.value)}>
              <option value="">{T.all}</option>
              {TOPICS.map((k) => <option key={k} value={k}>{T.topic[k]}</option>)}
            </select>
          </Field>
          <Field label={T.filterEra}>
            <select className={SELECT} value={f.era} onChange={(e) => setFilter('era', e.target.value)}>
              <option value="">{T.all}</option>
              {ERAS.map((k) => <option key={k} value={k}>{T.era[k]}</option>)}
            </select>
          </Field>
          <Field label={T.filterStatus}>
            <select className={SELECT} value={f.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">{T.all}</option>
              {STATUSES.map((k) => <option key={k} value={k}>{T.status[k]}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Field label={T.filterFlag}>
            <select className={SELECT} value={f.flag} onChange={(e) => setFilter('flag', e.target.value)}>
              <option value="">{T.all}</option>
              <option value="lyric">{T.flagLyric}</option>
              <option value="time">{T.flagTime}</option>
            </select>
          </Field>
          {rows && <span className="t-meta mt-5" aria-live="polite">{T.count(filtered.length, rows.length)}</span>}
          <button
            type="button" onClick={() => setEditing({ ...EMPTY, options_en: ['', '', '', ''], options_el: ['', '', '', ''] })}
            className="ml-auto mt-5 inline-flex items-center gap-1.5 rounded-stage-sm bg-stage-pink px-4 min-h-10 font-semibold text-white"
          >
            <Plus size={16} aria-hidden /> {T.newQuestion}
          </button>
        </div>

        {loadErr && <p className="text-sm text-stage-bad" role="alert">{T.loadError} {loadErr}</p>}
        {!rows && !loadErr && <p className="t-meta">{t.common.loading}</p>}
        {rows && filtered.length === 0 && <p className="t-meta">{T.none}</p>}

        {selected.size > 0 && (
          <BulkBar
            count={selected.size}
            rows={(rows ?? []).filter((r) => selected.has(r.id))}
            onClear={() => setSelected(new Set())}
            onDone={() => { setSelected(new Set()); reload(); }}
          />
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto rounded-stage border border-stage-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stage-text-3 uppercase tracking-wide border-b border-stage-line">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox" className="size-4"
                      aria-label={T.selectAll(filtered.length)}
                      checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                      ref={(el) => { if (el) el.indeterminate = filtered.some((r) => selected.has(r.id)) && !filtered.every((r) => selected.has(r.id)); }}
                      onChange={(e) => setSelected((prev) => {
                        const next = new Set(prev);
                        for (const r of filtered) { if (e.target.checked) next.add(r.id); else next.delete(r.id); }
                        return next;
                      })}
                    />
                  </th>
                  <th className="px-3 py-2">{T.cols.id}</th>
                  <th className="px-3 py-2">{T.cols.year}</th>
                  <th className="px-3 py-2">{T.cols.country}</th>
                  <th className="px-3 py-2">{T.cols.topic}</th>
                  <th className="px-3 py-2">{T.cols.diff}</th>
                  <th className="px-3 py-2">{T.cols.question}</th>
                  <th className="px-3 py-2">{T.cols.status}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((r) => (
                  <tr key={r.id} className={clsx('border-b border-stage-line/50 last:border-0', (editing?.id === r.id || selected.has(r.id)) && 'bg-stage-surface-2')}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox" className="size-4" aria-label={T.selectOne(r.id)}
                        checked={selected.has(r.id)}
                        onChange={(e) => setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.id); else next.delete(r.id);
                          return next;
                        })}
                      />
                    </td>
                    <td className="px-3 py-2 text-stage-text-3 tabular-nums">{r.id}</td>
                    <td className="px-3 py-2 tabular-nums">{r.contest_year ?? T.general.split(' ')[0]}</td>
                    <td className="px-3 py-2 text-stage-text-2">{r.iso ? countryName.get(r.iso) ?? r.iso : t.common.none}</td>
                    <td className="px-3 py-2 text-stage-text-2">{T.topic[r.topic]}</td>
                    <td className="px-3 py-2 text-stage-text-2">{T.difficulty[r.difficulty]}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => open(r)} className="text-left text-stage-text hover:underline">
                        {r.question_el}
                      </button>
                      <span className="block t-meta">{r.options_el[r.correct_index]}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <StatusChip tone={STATUS_TONE[r.status]}>{T.status[r.status]}</StatusChip>
                        {r.lyric_check && <StatusChip tone="pink">{T.flagLyric}</StatusChip>}
                        {r.time_sensitive && <StatusChip tone="muted">{T.flagTime}</StatusChip>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > shown && (
          <button type="button" onClick={() => setShown((n) => n + PAGE)}
            className="rounded-stage-sm border border-stage-line-2 px-4 min-h-10 text-stage-text-2">
            {T.more} ({filtered.length - shown})
          </button>
        )}
      </section>
    </div>
  );
}
