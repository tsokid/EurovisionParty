// Editor help: the contest fact tokens any text field may use, so copy that
// changes with the contest (the live city, records, counts) never needs a
// hand edit. Grammar: supabase/functions/_shared/cms/facts.ts.
import { STATS_FIELDS, YEAR_FIELDS } from '../../../../supabase/functions/_shared/cms/facts';
import { t } from '../../i18n';

export default function FactTokensHelp() {
  const code = (s: string) => <code key={s} className="rounded bg-white/10 px-1 font-mono text-[11px] text-white/85">{s}</code>;
  return (
    <details className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
      <summary className="cursor-pointer font-semibold text-white/85">{t.form.facts.summary}</summary>
      <div className="mt-2 space-y-2">
        <p>{t.form.facts.p1}</p>
        <p>
          <strong className="text-white/85">{t.form.facts.live}</strong> {code('{current.year}')} {code('{current.city}')} {code('{current.host}')} {code('{current.date}')}.{' '}
          <strong className="text-white/85">{t.form.facts.latest}</strong> {code('{latest.country}')} {code('{latest.artist}')} {code('{latest.song}')}.{' '}
          <strong className="text-white/85">{t.form.facts.any}</strong> {code('{2014.song}')}.
        </p>
        <p className="flex flex-wrap gap-1">{t.form.facts.year} {YEAR_FIELDS.map((f) => code(f))}</p>
        <p className="flex flex-wrap gap-1">{t.form.facts.stats} {STATS_FIELDS.map((f) => code(`{stats.${f}}`))}</p>
        <p>{t.form.facts.p2}</p>
      </div>
    </details>
  );
}
