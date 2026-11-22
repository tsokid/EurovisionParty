// src/admin/modules/contests/ContestDetailsForm.tsx
// Details of one contest year: city, city slug, host, the three show
// dates and the indexable switch. Saved through update_contest with only
// the changed fields; a change goes live with the next Publish. Next to
// indexable, the year's editorial (EditorialIndicator) with a link to it.
// city_slug is checked here with the same pattern as the contests check
// constraint of migration 070; the SQL stays authoritative. It is locked
// once the year is archived (part of the archive URL; update_contest
// refuses the change too).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatError } from '../../lib/formatError';
import { EditorialIndicator } from './EditorialIndicator';
import { useUnsavedGuard } from '../../unsavedGuard';
import { t } from '../../i18n';

/** contests.city_slug check of migration 070. */
export const CITY_SLUG_RE = /^[a-z]+(-[a-z]+)*$/;

interface Details {
  city: string;
  city_slug: string;
  host_iso: string | null;
  semi1_date: string | null;
  semi2_date: string | null;
  final_date: string | null;
  indexable: boolean;
}

type Key = keyof Details;

interface Country {
  iso: string;
  name_en: string;
}

const INPUT = 'bg-[#1a0a2e] border border-white/15 text-white rounded px-2 py-1.5';

const DATE_FIELDS: Array<{ key: 'semi1_date' | 'semi2_date' | 'final_date'; label: string }> = [
  { key: 'semi1_date', label: t.contests.dates.semi1_date },
  { key: 'semi2_date', label: t.contests.dates.semi2_date },
  { key: 'final_date', label: t.contests.dates.final_date },
];

const KEYS: Key[] = ['city', 'city_slug', 'host_iso', 'semi1_date', 'semi2_date', 'final_date', 'indexable'];

interface Props {
  year: number;
  /** Called after a successful save, so the parent can refresh its list and the publish bar. */
  onSaved?: () => void;
}

const orNull = (v: string): string | null => (v === '' ? null : v);

export function ContestDetailsForm({ year, onSaved }: Props) {
  const [original, setOriginal] = useState<Details | null>(null);
  const [form, setForm] = useState<Details | null>(null);
  const [archived, setArchived] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, co] = await Promise.all([
        supabase
          .from('contests')
          .select('city, city_slug, host_iso, semi1_date, semi2_date, final_date, indexable, stage')
          .eq('year', year)
          .maybeSingle(),
        supabase.from('countries').select('iso, name_en').order('name_en'),
      ]);
      if (c.error) throw c.error;
      if (co.error) throw co.error;
      const data = (c.data ?? null) as (Details & { stage?: string }) | null;
      const row: Details | null = data
        ? Object.fromEntries(KEYS.map((k) => [k, data[k]])) as unknown as Details
        : null;
      setArchived(data?.stage === 'archived');
      setOriginal(row);
      setForm(row);
      setCountries((co.data ?? []) as Country[]);
    } catch (e) {
      setErr(formatError(e));
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const changed = useMemo(() => {
    const out: Partial<Details> = {};
    if (!form || !original) return out;
    for (const k of KEYS) {
      if (form[k] !== original[k]) (out as Record<string, unknown>)[k] = form[k];
    }
    return out;
  }, [form, original]);
  const dirty = Object.keys(changed).length > 0;
  useUnsavedGuard(dirty);

  const set = <K extends Key>(key: K, value: Details[K]) => {
    setNotice(null);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const save = async () => {
    if (!form || !dirty) return;
    setErr(null);
    setNotice(null);
    if (!form.city.trim()) {
      setErr(t.contests.cityRequired);
      return;
    }
    if (!CITY_SLUG_RE.test(form.city_slug)) {
      setErr(t.contests.slugInvalid);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('update_contest', { p_year: year, p_fields: changed });
      if (error) throw error;
      setNotice(t.contests.savedDetails(year));
      await load();
      onSaved?.();
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!form) {
    return err ? <p className="text-sm text-red-300">{err}</p> : null;
  }

  // A host that is not in countries (should not happen) still shows.
  const hostKnown = form.host_iso === null || countries.some((c) => c.iso === form.host_iso);

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <h3 className="text-lg font-bold text-white">{t.contests.details(year)}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl">
        <label className="text-sm text-white/80 flex flex-col gap-1">
          <span className="text-xs text-white/50 uppercase tracking-wide">{t.contests.city}</span>
          <input
            aria-label={t.contests.city}
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder={t.contests.eg('Burgas')}
            className={`${INPUT} placeholder:text-white/30`}
          />
        </label>
        <label className="text-sm text-white/80 flex flex-col gap-1">
          <span className="text-xs text-white/50 uppercase tracking-wide">{t.contests.citySlug}</span>
          <input
            aria-label={t.contests.citySlug}
            value={form.city_slug}
            onChange={(e) => set('city_slug', e.target.value)}
            disabled={archived}
            placeholder={t.contests.eg('burgas')}
            className={`${INPUT} font-mono disabled:opacity-50 placeholder:text-white/30`}
          />
          {archived && (
            <span className="text-xs text-white/50">
              {t.contests.slugHelp}
            </span>
          )}
        </label>
        <label className="text-sm text-white/80 flex flex-col gap-1">
          <span className="text-xs text-white/50 uppercase tracking-wide">{t.contests.host}</span>
          <select
            aria-label={t.contests.host}
            value={form.host_iso ?? ''}
            onChange={(e) => set('host_iso', orNull(e.target.value))}
            className={INPUT}
          >
            <option value="" className="bg-[#1a0a2e]">{t.contests.hostNone}</option>
            {!hostKnown && form.host_iso && (
              <option value={form.host_iso} className="bg-[#1a0a2e]">{form.host_iso}</option>
            )}
            {countries.map((c) => (
              <option key={c.iso} value={c.iso} className="bg-[#1a0a2e]">{c.name_en}</option>
            ))}
          </select>
        </label>
        {DATE_FIELDS.map((f) => (
          <label key={f.key} className="text-sm text-white/80 flex flex-col gap-1">
            <span className="text-xs text-white/50 uppercase tracking-wide">{f.label}</span>
            <input
              type="date"
              aria-label={f.label}
              value={form[f.key] ?? ''}
              onChange={(e) => set(f.key, orNull(e.target.value))}
              className={INPUT}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            aria-label={t.contests.indexable}
            checked={form.indexable}
            onChange={(e) => set('indexable', e.target.checked)}
          />
          {t.contests.indexable}
        </label>
        <span className="text-xs text-white/50">{t.contests.indexableHelp}</span>
        <EditorialIndicator year={year} archived={archived} />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={busy || !dirty}
        className="px-3 py-1.5 rounded bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 cursor-pointer"
      >
        {busy ? t.contests.saving : t.contests.saveDetails}
      </button>

      {notice && <p className="text-sm text-emerald-300">{notice}</p>}
      {err && <p className="text-sm text-red-300">{err}</p>}
    </section>
  );
}
