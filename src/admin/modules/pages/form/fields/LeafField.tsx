// A leaf field: text, multiline, richText, href (strings), choice, flag.
// EN and EL side by side; a locale-shared field is one control that writes
// both locales. String fields show a counter against their soft limit
// (counting the interpolated text when live-contest vars are given) and
// placeholder chips that insert at the cursor.
import { useContext, useId, useLayoutEffect, useRef } from 'react';
import type { FieldMeta } from '../../../../../../supabase/functions/_shared/cms/fields';
import { interpolate } from '../../../../../../supabase/functions/_shared/cms/placeholders';
import { useFormApi, useIssues, VarsContext } from '../context';
import { editLocales, LOCALES, schemaInfo, setIn, type Issue, type Locale } from '../formModel';
import type { FieldProps } from './Field';
import { IssueList } from './IssueList';
import { FIELD_LABEL, HELP, INPUT } from './styles';

const RAW_HTML_HINT = 'Allowed: <strong>, <em>, <b>, <i>, <br>, <a href="/…">';

const isString = (kind: FieldMeta['kind']) => kind === 'text' || kind === 'multiline' || kind === 'richText' || kind === 'href';

export function LeafField({ schema, segments, path, name, label, en, el, hasEn, hasEl, shared, bare }: FieldProps) {
  const { edit } = useFormApi();
  const issues = useIssues(path);
  const { meta } = schemaInfo(schema);
  const isShared = shared || !!meta.shared;

  const write = (locales: readonly Locale[], v: unknown) =>
    edit((doc) => editLocales(doc, locales, (root) => setIn(root, segments, v)));

  const present = LOCALES.filter((l) => (l === 'en' ? hasEn : hasEl));

  return (
    <div className="space-y-1">
      {!bare && <div className={FIELD_LABEL}>{label}</div>}
      {meta.help && <p className={HELP}>{meta.help}</p>}
      {meta.rawHtml && <p className={`${HELP} font-mono`}>{RAW_HTML_HINT}</p>}
      {isShared ? (
        <LocaleControl
          meta={meta}
          locale={hasEn ? 'en' : 'el'}
          name={`${name} (EN + EL)`}
          tag="EN + EL"
          value={hasEn ? en : el}
          issues={issues}
          withLocale
          onValue={(v) => write(present, v)}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {LOCALES.map((l) =>
            (l === 'en' ? hasEn : hasEl) ? (
              <LocaleControl
                key={l}
                meta={meta}
                locale={l}
                name={`${name} (${l.toUpperCase()})`}
                tag={l.toUpperCase()}
                value={l === 'en' ? en : el}
                issues={issues.filter((i) => i.locale === l)}
                onValue={(v) => write([l], v)}
              />
            ) : (
              <div key={l} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

type ControlProps = {
  meta: FieldMeta;
  /** The locale whose live-contest vars the counter uses (EN for a shared field). */
  locale: Locale;
  /** Accessible name: full path and locale, e.g. "FAQ › Item 1 › Question (EL)". */
  name: string;
  tag: string;
  value: unknown;
  issues: readonly Issue[];
  withLocale?: boolean;
  onValue: (v: unknown) => void;
};

function LocaleControl({ meta, locale, name, tag, value, issues, withLocale, onValue }: ControlProps) {
  const id = useId();
  const vars = useContext(VarsContext)?.[locale];
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const text = typeof value === 'string' ? value : '';

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null || !inputRef.current) return;
    pendingCaret.current = null;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(caret, caret);
  }, [text]);

  const hasErrors = issues.some((i) => i.level === 'error');
  const issuesId = `${id}-issues`;
  const counterId = `${id}-counter`;
  const limit = isString(meta.kind) ? (meta.softMaxLength ?? meta.maxLength) : undefined;
  const describedBy = [limit !== undefined && counterId, issues.length > 0 && issuesId].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    'aria-invalid': hasErrors || undefined,
    'aria-describedby': describedBy,
  };

  let control;
  if (meta.kind === 'choice') {
    const options = meta.options ?? [];
    const v = typeof value === 'string' ? value : '';
    control = (
      <select {...common} value={v} onChange={(e) => onValue(e.target.value)} className={INPUT}>
        {!options.includes(v) && <option value={v} className="bg-[#1a0a2e]">{v || '—'}</option>}
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#1a0a2e]">{o}</option>
        ))}
      </select>
    );
  } else if (meta.kind === 'flag') {
    control = (
      <input {...common} type="checkbox" checked={value === true} onChange={(e) => onValue(e.target.checked)} />
    );
  } else if (meta.kind === 'text' || meta.kind === 'href') {
    if (meta.rawHtml) {
      control = <textarea {...common} ref={inputRef} rows={3} value={text} onChange={(e) => onValue(e.target.value)} className={`${INPUT} font-mono`} />;
    } else {
      control = <input {...common} ref={inputRef} type="text" value={text} onChange={(e) => onValue(e.target.value)} className={`${INPUT}${meta.kind === 'href' ? ' font-mono' : ''}`} />;
    }
  } else {
    control = (
      <textarea {...common} ref={inputRef} rows={meta.kind === 'richText' ? 5 : 3} value={text} onChange={(e) => onValue(e.target.value)} className={`${INPUT}${meta.rawHtml ? ' font-mono' : ''}`} />
    );
  }

  const insert = (placeholder: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    pendingCaret.current = start + placeholder.length;
    onValue(text.slice(0, start) + placeholder + text.slice(end));
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="sr-only">{name}</label>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[10px] font-bold text-white/40 w-10 shrink-0">{tag}</span>
        <div className="flex-1 min-w-0">{control}</div>
      </div>
      {limit !== undefined && <Counter id={counterId} text={text} limit={limit} soft={meta.softMaxLength !== undefined} placeholders={meta.placeholders} vars={vars} />}
      {isString(meta.kind) && meta.placeholders && meta.placeholders.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {meta.placeholders.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={`Insert {${p}} into ${name}`}
              title={meta.placeholderHelp?.[p]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(`{${p}}`)}
              className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/80 hover:bg-white/20 cursor-pointer"
            >
              {`{${p}}`}
            </button>
          ))}
        </div>
      )}
      <IssueList id={issuesId} issues={issues} withLocale={withLocale} />
    </div>
  );
}

type CounterProps = {
  id: string;
  text: string;
  limit: number;
  soft: boolean;
  placeholders?: string[];
  vars?: Record<string, string | number>;
};

/** Characters against the limit; amber above a soft limit. Never blocks typing. */
function Counter({ id, text, limit, soft, placeholders, vars }: CounterProps) {
  let shown = text;
  if (vars && placeholders?.length) {
    try {
      shown = interpolate(text, vars);
    } catch {
      // A placeholder without a value: count the raw text (validation reports the placeholder).
    }
  }
  const over = shown.length > limit;
  return (
    <div id={id} className="flex items-center gap-2 text-[11px]">
      <span className={over ? (soft ? 'text-amber-300' : 'text-red-300') : 'text-white/40'}>{`${shown.length} / ${limit}`}</span>
      {over && soft && <span className="text-amber-300">Search engines may cut this off</span>}
    </div>
  );
}
