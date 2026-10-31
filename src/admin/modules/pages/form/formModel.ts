// Pure helpers of the schema-driven form: schema introspection (through
// walkSchema only), labels, immutable updates with structural sharing, and
// the store that hands each field its own errors and warnings.
import type { z } from 'zod';
import { blockVariants, holdsField, walkSchema, type Segment } from '../../../../../supabase/functions/_shared/cms/walk';
import type { FieldMeta } from '../../../../../supabase/functions/_shared/cms/fields';
import type { Locale, ValidationError } from '../../../../../supabase/functions/_shared/cms/validate';

export type { Locale, Segment };

/** A document being edited: one value per locale. */
export type DocValue = { en: unknown; el: unknown };

export const LOCALES: readonly Locale[] = ['en', 'el'];

export type SchemaInfo = {
  meta: FieldMeta;
  /** group: its keys in schema order; tuple: its positions. */
  children: { key: Segment; schema: z.ZodType }[];
  /** list: the item schema. */
  element?: z.ZodType;
  /** optional wrapper: the inner field. */
  inner?: z.ZodType;
  /** list: whether its items hold a locale-shared field (items then line up by index across locales). */
  holdsShared: boolean;
  /**
   * blocks and union: the schema of each block type, keyed by its `type`
   * value. A key such as `body` means a different field in each variant, so a
   * block is always looked up by its type, never by path.
   */
  variants?: Record<string, z.ZodType>;
  /** blocks and union: the key holding the variant name. */
  discriminator?: string;
};

const infoCache = new WeakMap<z.ZodType, SchemaInfo>();

/** One level of a schema node, read with walkSchema (never zod internals). Cached per schema. */
export function schemaInfo(schema: z.ZodType): SchemaInfo {
  const cached = infoCache.get(schema);
  if (cached) return cached;
  let info: SchemaInfo | undefined;
  walkSchema(schema, (n) => {
    if (!info) {
      info = { meta: n.meta, children: [], holdsShared: false };
      // A union's variants are visited at its own path: they are read below, by type.
      return n.meta.kind !== 'union';
    }
    // optional(): the wrapper is visited, then its inner field at the same path.
    if (n.segments.length === 0) {
      info.inner = n.schema;
      return false;
    }
    if (n.segments[0] === '*') info.element = n.schema;
    else info.children.push({ key: n.segments[0], schema: n.schema });
    return false;
  });
  const out = info!;
  if (out.meta.kind === 'blocks' || out.meta.kind === 'union') {
    out.variants = blockVariants(schema);
    out.discriminator = out.meta.discriminator;
  }
  if (out.element) out.holdsShared = holdsField(out.element, (m) => !!m.shared);
  infoCache.set(schema, out);
  return out;
}

/** "camelCase" -> "Camel case"; a list/tuple index 2 -> "Item 3". */
export function humanize(key: Segment): string {
  if (typeof key === 'number' || /^\d+$/.test(key)) return `Item ${Number(key) + 1}`;
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The display label of a child at `key`: its schema label, else the humanised key. */
export function childLabel(key: Segment, schema: z.ZodType): string {
  if (typeof key === 'number') return humanize(key);
  return schemaInfo(schema).meta.label ?? humanize(key);
}

/** "Parent › Child" (the full field path shown to screen readers and in button names). */
export const joinName = (parent: string, label: string) => (parent ? `${parent} › ${label}` : label);

export const joinPath = (parent: string, seg: Segment) => (parent ? `${parent}.${seg}` : String(seg));

type Container = Record<string | number, unknown> | unknown[];

export function getIn(value: unknown, segments: Segment[]): unknown {
  let node = value;
  for (const seg of segments) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string | number, unknown>)[seg];
  }
  return node;
}

/**
 * A copy of `value` with `next` at `segments`. Only the containers along the
 * path are copied; everything else is shared with `value`, which is never
 * changed. Missing containers are created (an array for a numeric segment).
 */
export function setIn(value: unknown, segments: Segment[], next: unknown): unknown {
  if (!segments.length) return next;
  const [seg, ...rest] = segments;
  const node: Container = value && typeof value === 'object' ? (value as Container) : typeof seg === 'number' ? [] : {};
  const child = setIn((node as Record<string | number, unknown>)[seg], rest, next);
  if (Array.isArray(node)) {
    const copy = node.slice();
    copy[seg as number] = child;
    return copy;
  }
  return { ...node, [seg]: child };
}

/** `setIn(value, segments, fn(current))`. */
export const updateIn = (value: unknown, segments: Segment[], fn: (current: unknown) => unknown) =>
  setIn(value, segments, fn(getIn(value, segments)));

/** A copy of `value` without the object key at `segments` (unchanged if it is not there). */
export function removeIn(value: unknown, segments: Segment[]): unknown {
  const parentSegs = segments.slice(0, -1);
  const key = segments[segments.length - 1];
  const parent = getIn(value, parentSegs);
  if (!parent || typeof parent !== 'object' || Array.isArray(parent) || !(key in parent)) return value;
  const rest = { ...(parent as Record<string, unknown>) };
  delete rest[key as string];
  return setIn(value, parentSegs, rest);
}

/** Applies `fn` to the locales in `locales`, returning a new document (the others are shared). */
export function editLocales(doc: DocValue, locales: readonly Locale[], fn: (v: unknown) => unknown): DocValue {
  let next = doc;
  for (const l of locales) next = { ...next, [l]: fn(next[l]) };
  return next;
}

export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

// ---- Issues ----------------------------------------------------------------

export type Issue = { locale: Locale | null; message: string; level: 'error' | 'warning' };

const EMPTY: Issue[] = [];

const sameIssues = (a: Issue[], b: Issue[]) =>
  a.length === b.length && a.every((x, i) => x.locale === b[i].locale && x.message === b[i].message && x.level === b[i].level);

/**
 * Errors and warnings by path, for useSyncExternalStore: each field subscribes
 * to its own path, and an array is replaced only when that path's issues
 * change, so new validation results re-render only the fields they concern.
 */
export class IssueStore {
  private byPath = new Map<string, Issue[]>();
  private listeners = new Set<() => void>();

  set(errors: readonly ValidationError[], warnings: readonly ValidationError[]): void {
    const next = new Map<string, Issue[]>();
    const add = (list: readonly ValidationError[], level: Issue['level']) => {
      for (const e of list) {
        if (e.locale === null) continue; // document-level: shown at the top of the form
        const arr = next.get(e.path) ?? [];
        arr.push({ locale: e.locale, message: e.message, level });
        next.set(e.path, arr);
      }
    };
    add(errors, 'error');
    add(warnings, 'warning');
    let changed = next.size !== this.byPath.size;
    for (const [path, arr] of next) {
      const old = this.byPath.get(path);
      if (old && sameIssues(old, arr)) next.set(path, old);
      else changed = true;
    }
    this.byPath = next;
    if (changed) this.listeners.forEach((l) => l());
  }

  get = (path: string): Issue[] => this.byPath.get(path) ?? EMPTY;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
