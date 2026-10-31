// Document validation (spec §3 "Locales", "Templates").
//
// A document is { en: T, el: T }, strict at both levels. Every issue is
// reported with its locale and a dotted path inside that locale's content
// (list indices as numbers: "faq.0.a"; "" is the locale root). Issues at the
// document root (not an object, an unknown top-level key) are reported under
// locale "en" with path "".
//
// Locale-shared fields (fieldMeta().shared: choices, flags, hrefs...) are not
// translated: their el value must equal the en value at the same path. Inside
// lists they are compared by index, for the indices both locales have.
import { z } from 'zod';
import { fieldMeta, schemaDef } from './fields.ts';
import { CMS_DOC_TYPES } from './registry.ts';

export type Locale = 'en' | 'el';

export type ValidationError = { path: string; locale: Locale; message: string };

export type ValidationResult<T = unknown> =
  | { ok: true; value: { en: T; el: T } }
  | { ok: false; errors: ValidationError[] };

/** The { en, el } document schema for one locale's schema. */
export function documentSchema<T extends z.ZodType>(schema: T) {
  return z.strictObject({ en: schema, el: schema });
}

function toError(issue: z.core.$ZodIssue): ValidationError {
  const [head, ...rest] = issue.path;
  if (head === 'en' || head === 'el') {
    return { locale: head, path: rest.map(String).join('.'), message: issue.message };
  }
  return { locale: 'en', path: '', message: issue.message };
}

const SHARED_MESSAGE = 'must equal the en value (locale-shared field)';

/** Structural equality of JSON values (object key order ignored). */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
    const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Paths where a locale-shared field's el value differs from its en value. */
export function sharedMismatches(schema: z.ZodType, en: unknown, el: unknown, path = ''): string[] {
  if (fieldMeta(schema).shared) return sameJson(en, el) ? [] : [path];
  const def = schemaDef(schema);
  const at = (k: string | number) => (path ? `${path}.${k}` : String(k));
  switch (def.type) {
    case 'object':
      if (!isRecord(en) || !isRecord(el)) return [];
      return Object.entries(def.shape!).flatMap(([k, s]) => sharedMismatches(s, en[k], el[k], at(k)));
    case 'array':
    case 'tuple': {
      if (!Array.isArray(en) || !Array.isArray(el)) return [];
      const n = Math.min(en.length, el.length);
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        const item = def.type === 'array' ? def.element! : def.items![i];
        if (item) out.push(...sharedMismatches(item, en[i], el[i], at(i)));
      }
      return out;
    }
    case 'optional':
      return en === undefined || el === undefined ? [] : sharedMismatches(def.innerType!, en, el, path);
    default:
      return [];
  }
}

export function validateDocument(docType: string, data: unknown): ValidationResult {
  const def = Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, docType) ? CMS_DOC_TYPES[docType] : undefined;
  if (!def) return { ok: false, errors: [{ locale: 'en', path: '', message: `Unknown doc type "${docType}"` }] };
  const parsed = documentSchema(def.schema).safeParse(data);
  const errors = parsed.success ? [] : parsed.error.issues.map(toError);
  if (isRecord(data)) {
    for (const path of sharedMismatches(def.schema, data.en, data.el)) {
      errors.push({ path, locale: 'el', message: SHARED_MESSAGE });
    }
  }
  if (parsed.success && !errors.length) return { ok: true, value: parsed.data as { en: unknown; el: unknown } };
  return { ok: false, errors };
}
