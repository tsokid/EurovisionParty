// The text diff (field by field, per locale, with word highlights) and the
// SEO delta of a publish (CMS P5, spec §4).
import clsx from 'clsx';
import type { z } from 'zod';
import { CheckCircle2, OctagonAlert, Info } from 'lucide-react';
import { getAt, pathKey, type Path } from '../cms/fieldDiff';
import { labelForPath } from '../cms/historyApi';
import { wordDiff, type SeoRow } from './diff';
import { t } from '../i18n';

const show = (v: unknown): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v, null, 2);
};

const BOX = 'min-w-0 rounded-stage-sm border border-stage-line bg-stage-bg p-2.5 text-[13px] text-stage-text whitespace-pre-wrap break-words max-h-56 overflow-auto';

/** Before and after of one value, the changed words marked. */
export function WordPair({ before, after }: { before: unknown; after: unknown }) {
  const a = show(before);
  const b = show(after);
  const parts = a !== null && b !== null && typeof before === 'string' && typeof after === 'string' ? wordDiff(a, b) : null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="min-w-0">
        <p className="t-meta mb-1">{t.publishFlow.before}</p>
        <div className={BOX} data-testid="diff-before">
          {a === null ? <span className="text-stage-text-3 italic">{t.publishFlow.empty}</span> : parts
            ? parts.filter((p) => p.kind !== 'add').map((p, i) => (
              <span key={i} className={p.kind === 'del' ? 'rounded-sm bg-[rgb(255_92_122/0.22)] text-stage-text line-through decoration-[#ff5c7a]/70' : undefined}>{p.text}</span>
            ))
            : a}
        </div>
      </div>
      <div className="min-w-0">
        <p className="t-meta mb-1 text-[#35d29a]">{t.publishFlow.after}</p>
        <div className={BOX} data-testid="diff-after">
          {b === null ? <span className="text-stage-text-3 italic">{t.publishFlow.empty}</span> : parts
            ? parts.filter((p) => p.kind !== 'del').map((p, i) => (
              <span key={i} className={p.kind === 'add' ? 'rounded-sm bg-[rgb(53_210_154/0.22)] text-stage-text' : undefined}>{p.text}</span>
            ))
            : b}
        </div>
      </div>
    </div>
  );
}

/** Every changed field, EN then EL, with the form's own labels. */
export function TextDiff({ schema, live, draft, changes }: { schema?: z.ZodType; live: unknown; draft: unknown; changes: readonly Path[] }) {
  if (changes.length === 0) return <p className="t-small">{t.publishFlow.noChange}</p>;
  const ordered = [...changes].sort((a, b) => (a[0] === b[0] ? 0 : a[0] === 'en' ? -1 : 1));
  return (
    <section className="space-y-4" data-testid="text-diff">
      <p className="t-meta m-0">{t.publishFlow.fieldsChanged(changes.length)}</p>
      <ul className="space-y-4">
        {ordered.map((p) => {
          const before = getAt(live, p);
          const after = getAt(draft, p);
          const tag = before === undefined ? t.publishFlow.added : after === undefined ? t.publishFlow.removed : null;
          return (
            <li key={pathKey(p)} className="space-y-1.5">
              <p className="text-sm font-semibold text-stage-text m-0">
                {labelForPath(schema, draft, p)}
                {tag && <span className="chip ml-2 text-[11px]">{tag}</span>}
              </p>
              <WordPair before={before} after={after} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Which title, meta, H1 and JSON-LD fields change, where, and whether the guard accepts them. */
export function SeoDelta({ rows, siteWide }: { rows: readonly SeoRow[]; siteWide: boolean }) {
  return (
    <section className="space-y-3" data-testid="seo-delta">
      <p className="t-small m-0">{t.publishFlow.seoLede}</p>
      {siteWide ? (
        <p className="flex gap-2 rounded-stage border border-stage-gold/40 bg-stage-gold/10 p-3 t-small m-0">
          <Info size={16} aria-hidden className="mt-0.5 shrink-0 text-stage-gold" />
          <span>{t.publishFlow.seoSiteWide}</span>
        </p>
      ) : rows.length === 0 ? (
        <p className="t-small m-0">{t.publishFlow.seoNone}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={i} className="rounded-stage border border-stage-line bg-stage-bg-2 p-3 space-y-2" data-testid="seo-row" data-field={r.field} data-allowed={r.allowed}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-stage-text">{t.publishFlow.seoField[r.field]}</span>
                <span className="chip text-[11px]">{r.locale.toUpperCase()}</span>
                <span className="t-meta font-mono">{r.route ?? t.publishFlow.seoNoRoute}</span>
                {!r.definite && <span className="t-meta italic">{t.publishFlow.seoMay}</span>}
                <span className={clsx('ml-auto inline-flex items-center gap-1 text-xs font-semibold', r.allowed ? 'text-[#35d29a]' : 'text-stage-bad')}>
                  {r.allowed ? <CheckCircle2 size={14} aria-hidden /> : <OctagonAlert size={14} aria-hidden />}
                  {r.allowed ? t.publishFlow.seoAllowed : t.publishFlow.seoBlocked}
                </span>
              </div>
              {(r.before !== undefined || r.after !== undefined) && r.definite && <WordPair before={r.before} after={r.after} />}
            </li>
          ))}
        </ul>
      )}
      {!siteWide && rows.some((r) => r.allowed) && <p className="t-meta m-0">{t.publishFlow.seoAllowedWhy}</p>}
      <p className="t-meta m-0">{t.publishFlow.seoFixed}</p>
    </section>
  );
}
