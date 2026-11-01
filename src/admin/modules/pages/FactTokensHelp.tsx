// Editor help: the contest fact tokens any text field may use, so copy that
// changes with the contest (the live city, records, counts) never needs a
// hand edit. Grammar: supabase/functions/_shared/cms/facts.ts.
import { STATS_FIELDS, YEAR_FIELDS } from '../../../../supabase/functions/_shared/cms/facts';

export default function FactTokensHelp() {
  const code = (s: string) => <code key={s} className="rounded bg-white/10 px-1 font-mono text-[11px] text-white/85">{s}</code>;
  return (
    <details className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
      <summary className="cursor-pointer font-semibold text-white/85">Contest facts: values from the contest tables</summary>
      <div className="mt-2 space-y-2">
        <p>
          Write a token instead of a value that changes with the contest; the page fills it in, in the page's language.
          Fixed history (a past winner, a past song) can stay as plain text.
        </p>
        <p>
          <strong className="text-white/85">Live contest:</strong> {code('{current.year}')} {code('{current.city}')} {code('{current.host}')} {code('{current.date}')}.{' '}
          <strong className="text-white/85">Latest winner:</strong> {code('{latest.country}')} {code('{latest.artist}')} {code('{latest.song}')}.{' '}
          <strong className="text-white/85">Any year:</strong> {code('{2014.song}')}.
        </p>
        <p className="flex flex-wrap gap-1">Year fields: {YEAR_FIELDS.map((f) => code(f))}</p>
        <p className="flex flex-wrap gap-1">Records and counts: {STATS_FIELDS.map((f) => code(`{stats.${f}}`))}</p>
        <p>A token with no value in the tables (a typo, a year without a winner) is an error, and the build stops before it reaches the site.</p>
      </div>
    </details>
  );
}
