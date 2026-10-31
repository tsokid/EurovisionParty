// Contexts of the schema form. FormApi is created once per form and never
// changes identity, so reading it does not make a field re-render.
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { Vars } from '../../../../../supabase/functions/_shared/cms/interpolateDocument';
import type { DocValue, Issue, IssueStore } from './formModel';

export type FormApi = {
  /** Replaces the document with `fn(current)`; `fn` must not mutate. */
  edit: (fn: (doc: DocValue) => DocValue) => void;
  issues: IssueStore;
  /** Test hook: called with a field's path each time that field renders. */
  rendered: (path: string) => void;
};

export const FormApiContext = createContext<FormApi | null>(null);

/** Live-contest placeholder values: counters count the interpolated text. */
export const VarsContext = createContext<Vars | undefined>(undefined);

export function useFormApi(): FormApi {
  const api = useContext(FormApiContext);
  if (!api) throw new Error('useFormApi: outside SchemaForm');
  return api;
}

/** The errors and warnings at exactly `path` (a stable array while they do not change). */
export function useIssues(path: string): Issue[] {
  const { issues } = useFormApi();
  const get = useCallback(() => issues.get(path), [issues, path]);
  return useSyncExternalStore(issues.subscribe, get, get);
}
