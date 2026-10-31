// The one walker over a CMS schema tree (and, optionally, values shaped by it).
//
// Every traversal of a schema (field paths, lookups, locale-shared checks,
// string mapping for extraction and interpolation, validation warnings) goes
// through walkSchema, so the tree shape is interpreted in exactly one place.
//
// Node types are zod's own def types for the kinds the field constructors
// build: object (group, image, video), array (list, blocks), tuple, optional,
// union (the items of blocks), and the leaves string
// (text/multiline/richText/href/mediaRef), enum (choice) and boolean (flag).
import type { z } from 'zod';
import { fieldMeta, type FieldMeta } from './fields.ts';

type Def = {
  type: string;
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  items?: z.ZodType[];
  innerType?: z.ZodType;
  options?: z.ZodType[];
  discriminator?: string;
};

const defOf = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

export type Segment = string | number;

/** The variant name of a union option: the single value of its discriminator choice. */
function variantName(option: z.ZodType, discriminator: string): string | undefined {
  const key = defOf(option).shape?.[discriminator];
  return key ? fieldMeta(key).options?.[0] : undefined;
}

/**
 * The schema of each block type of a blocks() field (or of its union), by
 * type name, in display order. `emptyValue(variants[name])` is a new block.
 */
export function blockVariants(schema: z.ZodType): Record<string, z.ZodType> {
  let def = defOf(schema);
  if (def.type === 'optional') def = defOf(def.innerType!); // optional(blocks())
  const union = def.type === 'array' ? defOf(def.element!) : def;
  if (union.type !== 'union') throw new Error('blockVariants: not a blocks() field');
  return Object.fromEntries(union.options!.map((o) => [variantName(o, union.discriminator!)!, o]));
}

export type WalkNode = {
  schema: z.ZodType;
  meta: FieldMeta;
  /** zod def type: object, array, tuple, optional, union, string, enum, boolean. */
  type: string;
  /** Path from the root. A list item is `*` in a schema-only walk, its index when walking values. */
  segments: Segment[];
  /** `segments` joined with dots ("" at the root). */
  path: string;
  /** The value(s) at this node, one per value passed to walkSchema (may be undefined). */
  values: unknown[];
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Visits every node of `schema` depth-first, parents before children, object
 * keys in schema order. `visit` returning false skips the node's children.
 *
 * An optional() wrapper is visited, then its inner field at the same path.
 * A union (a block) is visited, then its variants at the same path; with
 * values, only the variant named by the discriminator of every value (the
 * walk stops there if the values name different variants or none).
 *
 * With `values` (e.g. `[en, el]`), each node gets the matching value from each
 * one, and the walk only goes where every value does: into an object's keys if
 * every value is an object, a list's or tuple's items up to the shortest array
 * (indices as numbers), an optional's inner field if no value is undefined. Without values
 * a list's item schema is visited once, at `*`.
 */
// Never call a walker from module top level (fields.ts ↔ walk.ts import cycle).
export function walkSchema(schema: z.ZodType, visit: (node: WalkNode) => boolean | void, values: unknown[] = []): void {
  const withValues = values.length > 0;
  const step = (node: z.ZodType, segments: Segment[], vals: unknown[]): void => {
    const def = defOf(node);
    const go = visit({ schema: node, meta: fieldMeta(node), type: def.type, segments, path: segments.join('.'), values: vals });
    if (go === false) return;
    switch (def.type) {
      case 'object':
        if (withValues && !vals.every(isRecord)) return;
        for (const [k, child] of Object.entries(def.shape!)) {
          step(child, [...segments, k], vals.map((v) => (v as Record<string, unknown>)[k]));
        }
        return;
      case 'array':
        if (!withValues) return step(def.element!, [...segments, '*'], vals);
        if (!vals.every(Array.isArray)) return;
        for (let i = 0; i < Math.min(...vals.map((v) => (v as unknown[]).length)); i++) {
          step(def.element!, [...segments, i], vals.map((v) => (v as unknown[])[i]));
        }
        return;
      case 'tuple': {
        if (withValues && !vals.every(Array.isArray)) return;
        const n = Math.min(def.items!.length, ...vals.map((v) => (v as unknown[]).length));
        for (let i = 0; i < n; i++) step(def.items![i], [...segments, i], vals.map((v) => (v as unknown[])[i]));
        return;
      }
      case 'optional':
        if (withValues && vals.some((v) => v === undefined)) return;
        return step(def.innerType!, segments, vals);
      case 'union': {
        if (!withValues) {
          for (const option of def.options!) step(option, segments, vals);
          return;
        }
        const names = vals.map((v) => (isRecord(v) ? v[def.discriminator!] : undefined));
        const option = def.options!.find((o) => variantName(o, def.discriminator!) === names[0]);
        if (option && names.every((name) => name === names[0])) step(option, segments, vals);
        return;
      }
      default:
    }
  };
  step(schema, [], values);
}

/**
 * Dotted paths (`*` for any list index) of the fields whose metadata matches
 * `pred`, outermost first: a matching field's children are not searched. An
 * optional() wrapper is tested (and reported) at its own path, once. A
 * blocks() field lists a path of several variants once.
 */
export function fieldPaths(schema: z.ZodType, pred: (meta: FieldMeta) => boolean): string[] {
  const out = new Set<string>();
  walkSchema(schema, (n) => {
    if (!pred(n.meta)) return true;
    out.add(n.path);
    return false;
  });
  // A path under a union is listed once, however many variants have it.
  return [...out];
}

/** The field at a dotted `path` (`*` or a number for a list index), or undefined. */
export function fieldAt(schema: z.ZodType, path: string): z.ZodType | undefined {
  const want = path ? path.split('.') : [];
  const matches = (seg: Segment, w: string) => String(seg) === w || (seg === '*' && /^\d+$/.test(w));
  let found: z.ZodType | undefined;
  walkSchema(schema, (n) => {
    if (found) return false;
    if (n.segments.length > want.length || !n.segments.every((s, i) => matches(s, want[i]))) return false;
    if (n.segments.length === want.length) {
      found = n.schema;
      return false;
    }
    return true;
  });
  return found;
}

/** Whether `schema` is, or holds at any depth, a field whose metadata matches `pred`. */
export function holdsField(schema: z.ZodType, pred: (meta: FieldMeta) => boolean): boolean {
  return fieldPaths(schema, pred).length > 0;
}

/** Sets `value` at `segments` inside `root` (whose containers exist). */
function setAt(root: unknown, segments: Segment[], value: unknown): unknown {
  if (!segments.length) return value;
  let node = root as Record<string | number, unknown>;
  for (const seg of segments.slice(0, -1)) node = node[seg] as Record<string | number, unknown>;
  node[segments[segments.length - 1]] = value;
  return root;
}

/**
 * A copy of `value` with every string leaf the schema describes replaced by
 * `fn(string, meta, path)` (list indices as numbers in `path`). Everything else
 * (other leaves, keys the schema does not know) is copied as it is.
 */
export function mapStrings(
  schema: z.ZodType,
  value: unknown,
  fn: (s: string, meta: FieldMeta, path: string) => string,
): unknown {
  let out: unknown = value === undefined ? undefined : structuredClone(value);
  walkSchema(schema, (n) => {
    if (n.type === 'string' && typeof n.values[0] === 'string') out = setAt(out, n.segments, fn(n.values[0], n.meta, n.path));
  }, [value]);
  return out;
}
