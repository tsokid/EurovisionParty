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

export type FieldKind = 'text' | 'multiline' | 'richText' | 'list' | 'group';

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
};

export type StringFieldOptions = {
  label?: string;
  help?: string;
  maxLength?: number;
  placeholders?: string[];
  required?: boolean;
};

export type ContainerFieldOptions = { label?: string; help?: string };

const cmsFields = z.registry<FieldMeta>();

function stringField(kind: 'text' | 'multiline' | 'richText', opts: StringFieldOptions = {}) {
  const meta: FieldMeta = {
    kind,
    ...(opts.label !== undefined && { label: opts.label }),
    ...(opts.help !== undefined && { help: opts.help }),
    ...(opts.maxLength !== undefined && { maxLength: opts.maxLength }),
    placeholders: [...(opts.placeholders ?? [])],
    required: opts.required ?? true,
  };
  const allowed = new Set(meta.placeholders);
  const schema = z.string().superRefine((value, ctx) => {
    if (meta.required && value.trim() === '') {
      ctx.addIssue({ code: 'custom', message: 'Required: must not be empty' });
    }
    if (meta.maxLength !== undefined && value.length > meta.maxLength) {
      ctx.addIssue({ code: 'custom', message: `Too long: ${value.length} characters, max ${meta.maxLength}` });
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

/** Metadata of a schema built by one of the constructors above. */
export function fieldMeta(schema: z.ZodType): FieldMeta {
  const meta = cmsFields.get(schema);
  if (!meta) throw new Error('fieldMeta: schema is not a CMS field (build it with text/multiline/richText/list/group)');
  return meta;
}
