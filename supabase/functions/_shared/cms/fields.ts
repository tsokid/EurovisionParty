// CMS field constructors (spec §3 "Schemas", "Field kinds").
//
// Each constructor returns a plain zod schema and records its metadata in a
// zod registry, which the admin form generator reads back with fieldMeta().
// String fields carry their own checks (required in this locale, maxLength,
// allowed placeholders), so validating a locale is a single safeParse.
// Objects are strict: unknown keys are errors.
//
// Runtime zod is for scripts, tests and the admin route only. Site components
// take types from schemas with `import type` + z.infer, never a value import,
// so zod stays out of the client bundle (tests/scripts/bundleSize.test.ts).
//
// Deno-free. Bare "zod" specifier: Node/Vite resolve it from node_modules; an
// edge function that imports this needs "zod": "npm:zod@4.3.6" in its
// deno.json import map.
import { z } from 'zod';
import { placeholdersIn } from './placeholders.ts';

export type FieldKind = 'text' | 'multiline' | 'richText' | 'list' | 'group' | 'tuple' | 'choice' | 'flag';

export type FieldMeta = {
  kind: FieldKind;
  label?: string;
  help?: string;
  /** String kinds only. */
  maxLength?: number;
  /** String kinds only: placeholder names this field may use (without braces). */
  placeholders?: string[];
  /** String kinds only: must be non-empty (after trim) in every locale. Default true. */
  required?: boolean;
  /** choice only: the allowed values, in display order. */
  options?: string[];
  /**
   * Locale-shared: not translated, so `el` must equal `en` at the same path
   * (validateDocument enforces it). Default true for choice and flag, false
   * otherwise. The admin edits it once for both locales.
   */
  shared?: boolean;
  /** String kinds only: rendered as raw HTML (dangerouslySetInnerHTML), so it may contain tags. */
  rawHtml?: boolean;
  /** Set by optional(): the key may be absent. The rest of the metadata is the inner field's. */
  optional?: boolean;
};

export type StringFieldOptions = {
  label?: string;
  help?: string;
  maxLength?: number;
  placeholders?: string[];
  required?: boolean;
  shared?: boolean;
  rawHtml?: boolean;
};

export type ContainerFieldOptions = { label?: string; help?: string; shared?: boolean };

const cmsFields = z.registry<FieldMeta>();

function stringField(kind: 'text' | 'multiline' | 'richText', opts: StringFieldOptions = {}) {
  const meta: FieldMeta = {
    kind,
    ...(opts.label !== undefined && { label: opts.label }),
    ...(opts.help !== undefined && { help: opts.help }),
    ...(opts.maxLength !== undefined && { maxLength: opts.maxLength }),
    placeholders: [...(opts.placeholders ?? [])],
    required: opts.required ?? true,
    ...(opts.shared && { shared: true }),
    ...(opts.rawHtml && { rawHtml: true }),
  };
  const allowed = new Set(meta.placeholders);
  const schema = z.string().superRefine((value, ctx) => {
    if (meta.required && value.trim() === '') {
      ctx.addIssue({ code: 'custom', message: 'Required: must not be empty' });
    }
    if (meta.maxLength !== undefined && value.length > meta.maxLength) {
      ctx.addIssue({ code: 'custom', message: `Too long: ${value.length} characters, max ${meta.maxLength}` });
    }
    // A templated field renders through interpolate(), which unescapes {{ and }}.
    // A field without placeholders may be rendered raw, so escapes there are
    // almost certainly an extraction mistake.
    if (allowed.size === 0 && (value.includes('{{') || value.includes('}}'))) {
      ctx.addIssue({ code: 'custom', message: 'escaped braces in a field without placeholders' });
    }
    for (const name of placeholdersIn(value)) {
      if (!allowed.has(name)) {
        const list = meta.placeholders!.length ? meta.placeholders!.map((p) => `{${p}}`).join(', ') : 'none';
        ctx.addIssue({ code: 'custom', message: `Unknown placeholder {${name}} (allowed: ${list}; write {{ for a literal brace)` });
      }
    }
  });
  schema.register(cmsFields, meta);
  return schema;
}

/** Single-line string. */
export const text = (opts?: StringFieldOptions) => stringField('text', opts);

/** Multi-line plain string. */
export const multiline = (opts?: StringFieldOptions) => stringField('multiline', opts);

/** Limited Markdown, stored as a string; rendered in 3b. */
export const richText = (opts?: StringFieldOptions) => stringField('richText', opts);

/** Ordered list of `item`. */
export function list<T extends z.ZodType>(item: T, opts: ContainerFieldOptions = {}) {
  const schema = z.array(item);
  schema.register(cmsFields, { kind: 'list', ...opts });
  return schema;
}

/** Strict object of named fields. */
export function group<S extends Record<string, z.ZodType>>(shape: S, opts: ContainerFieldOptions = {}) {
  const schema = z.strictObject(shape);
  schema.register(cmsFields, { kind: 'group', ...opts });
  return schema;
}

/** Fixed-length list with one schema per position (e.g. a table's column headers). */
export function tuple<const T extends readonly [z.ZodType, ...z.ZodType[]]>(items: T, opts: ContainerFieldOptions = {}) {
  const schema = z.tuple(items);
  schema.register(cmsFields, { kind: 'tuple', ...opts });
  return schema;
}

/**
 * One of a fixed set of string values (a presentation switch such as a table
 * cell's tone, or a stable anchor id). Not translated text: editors pick a value.
 */
export function choice<const V extends readonly [string, ...string[]]>(values: V, opts: ContainerFieldOptions = {}) {
  const schema = z.enum(values);
  schema.register(cmsFields, { kind: 'choice', ...opts, options: [...values], shared: opts.shared ?? true });
  return schema;
}

/** A true/false switch. */
export function flag(opts: ContainerFieldOptions = {}) {
  const schema = z.boolean();
  schema.register(cmsFields, { kind: 'flag', ...opts, shared: opts.shared ?? true });
  return schema;
}

/**
 * `inner`, but the key may be absent (mirrors `?:` in a copy interface). The
 * wrapper carries the inner field's metadata plus `optional: true`, so every
 * node of a schema tree resolves through fieldMeta().
 */
export function optional<T extends z.ZodType>(inner: T) {
  const schema = inner.optional();
  cmsFields.add(schema as z.ZodType, { ...fieldMeta(inner), optional: true });
  return schema;
}

/** Metadata of a schema built by one of the constructors above. */
export function fieldMeta(schema: z.ZodType): FieldMeta {
  const meta = cmsFields.get(schema);
  if (!meta) throw new Error('fieldMeta: schema is not a CMS field (build it with text/multiline/richText/list/group/tuple/choice/flag/optional)');
  return meta;
}

// ---- schema tree ---------------------------------------------------------

type Def = {
  type: string;
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  items?: z.ZodType[];
  innerType?: z.ZodType;
};

/** zod's internal definition of a schema node (the kinds the constructors build). */
export const schemaDef = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

/**
 * Dotted paths (`*` for any list index) of the fields whose metadata matches
 * `pred`. An optional() wrapper is reported at its own path, once (its inner
 * field is not visited separately).
 */
export function fieldPaths(schema: z.ZodType, pred: (meta: FieldMeta) => boolean, path = ''): string[] {
  const at = (k: string | number) => (path ? `${path}.${k}` : String(k));
  if (pred(fieldMeta(schema))) return [path];
  const def = schemaDef(schema);
  switch (def.type) {
    case 'object':
      return Object.entries(def.shape!).flatMap(([k, s]) => fieldPaths(s, pred, at(k)));
    case 'array':
      return fieldPaths(def.element!, pred, at('*'));
    case 'tuple':
      return def.items!.flatMap((s, i) => fieldPaths(s, pred, at(i)));
    case 'optional':
      return fieldPaths(def.innerType!, pred, path);
    default:
      return [];
  }
}

/** The field at a dotted `path` (`*` or a number for a list index), or undefined. */
export function fieldAt(schema: z.ZodType, path: string): z.ZodType | undefined {
  let node: z.ZodType | undefined = schema;
  for (const seg of path ? path.split('.') : []) {
    let def = schemaDef(node);
    while (def.type === 'optional') {
      node = def.innerType!;
      def = schemaDef(node);
    }
    if (def.type === 'object') node = Object.prototype.hasOwnProperty.call(def.shape!, seg) ? def.shape![seg] : undefined;
    else if (def.type === 'array') node = def.element;
    else if (def.type === 'tuple') node = def.items![Number(seg)];
    else node = undefined;
    if (!node) return undefined;
  }
  return node;
}
