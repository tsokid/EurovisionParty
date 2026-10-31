// The schema-driven CMS form (spec §6 "Editor"): generated from a document
// type's schema, EN and EL side by side, inline errors and warnings.
//
// Controlled: `onChange` always receives a NEW { en, el } built with
// structural sharing (only the containers along the edited path are copied;
// `value` itself is never mutated). Fields are memoised on path and value, so
// typing re-renders only the edited field and its ancestors.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';
import type { Vars } from '../../../../../supabase/functions/_shared/cms/interpolateDocument';
import type { ValidationError, ValidationWarning } from '../../../../../supabase/functions/_shared/cms/validate';
import { FormApiContext, VarsContext, type FormApi } from './context';
import { IssueStore, type DocValue } from './formModel';
import { Field } from './fields/Field';

export type { DocValue };

export type SchemaFormProps = {
  /** Schema of one locale's content. */
  schema: z.ZodType;
  value: DocValue;
  onChange: (next: DocValue) => void;
  errors: readonly ValidationError[];
  warnings: readonly ValidationWarning[];
  /** Live-contest placeholder values: counters then count the interpolated text. */
  vars?: Vars;
  /** Test hook: called with a field's path each time that field renders. */
  onFieldRender?: (path: string) => void;
};

const ROOT: never[] = [];

export function SchemaForm({ schema, value, onChange, errors, warnings, vars, onFieldRender }: SchemaFormProps) {
  const [issues] = useState(() => {
    const store = new IssueStore();
    store.set(errors, warnings);
    return store;
  });
  useLayoutEffect(() => {
    issues.set(errors, warnings);
  }, [issues, errors, warnings]);

  // Latest value and callbacks for the (stable) edit function.
  const latest = useRef({ value, onChange, onFieldRender });
  useLayoutEffect(() => {
    latest.current = { value, onChange, onFieldRender };
  });

  const api = useMemo<FormApi>(
    () => ({
      edit: (fn) => {
        const prev = latest.current.value;
        const next = fn(prev);
        if (next === prev) return;
        // Two edits before the next render (e.g. a chip click) chain on each other.
        latest.current = { ...latest.current, value: next };
        latest.current.onChange(next);
      },
      issues,
      rendered: (path) => latest.current.onFieldRender?.(path),
    }),
    [issues],
  );

  // A new vars object with the same values must not re-render every counter.
  const varsKey = vars ? JSON.stringify(vars) : '';
  const stableVars = useMemo<Vars | undefined>(() => (varsKey ? (JSON.parse(varsKey) as Vars) : undefined), [varsKey]);

  const docErrors = errors.filter((e) => e.locale === null);
  const docWarnings = warnings.filter((w) => w.locale === null);

  return (
    <div className="space-y-4">
      {docErrors.length > 0 && (
        <div role="alert" className="rounded border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          <ul className="space-y-0.5">
            {docErrors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}
      {docWarnings.length > 0 && (
        <div className="rounded border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <ul className="space-y-0.5">
            {docWarnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      <FormApiContext.Provider value={api}>
        <VarsContext.Provider value={stableVars}>
          <Field schema={schema} segments={ROOT} path="" name="" label="" en={value.en} el={value.el} hasEn hasEl shared={false} />
        </VarsContext.Provider>
      </FormApiContext.Provider>
    </div>
  );
}
