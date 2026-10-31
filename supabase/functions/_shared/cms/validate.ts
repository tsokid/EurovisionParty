// Document validation (spec §3 "Locales", "Templates").
//
// A document is { en: T, el: T }, strict at both levels. Every issue is
// reported with its locale and a dotted path inside that locale's content
// (list indices as numbers: "faq.0.a"; "" is the locale root). Issues at the
// document root (not an object, an unknown top-level key) are reported under
// locale "en" with path "".
import { z } from 'zod';
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

export function validateDocument(docType: string, data: unknown): ValidationResult {
  const def = Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, docType) ? CMS_DOC_TYPES[docType] : undefined;
  if (!def) return { ok: false, errors: [{ locale: 'en', path: '', message: `Unknown doc type "${docType}"` }] };
  const parsed = documentSchema(def.schema).safeParse(data);
  if (parsed.success) return { ok: true, value: parsed.data as { en: unknown; el: unknown } };
  return { ok: false, errors: parsed.error.issues.map(toError) };
}
