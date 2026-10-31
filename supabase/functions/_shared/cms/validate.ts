// Document validation (spec §3 "Locales", "Templates").
//
// A document is { en: T, el: T }, strict at both levels. Every issue is
// reported with its locale and a dotted path inside that locale's content
// (list indices as numbers: "faq.0.a"; "" is the locale root). Document-level
// issues (not an object, an unknown top-level key, an unknown doc type) belong
// to no locale: they are reported with locale null and path "".
//
// Locale-shared fields (fieldMeta().shared: choices, flags, hrefs...) are not
// translated: their el value must equal the en value at the same path. Inside
// lists they are compared by index, so a list holding any shared field must
// also have the same length in both locales.
import { z } from 'zod';
import { holdsField, walkSchema } from './walk.ts';
import { CMS_DOC_TYPES } from './registry.ts';

export type Locale = 'en' | 'el';

/** `locale` is null for a document-level issue (not inside either locale). */
export type ValidationError = { path: string; locale: Locale | null; message: string };

/** Advice that never blocks saving or publishing; `locale` as for errors. */
export type ValidationWarning = ValidationError;

/** `errors` is empty when `ok`; `warnings` may be non-empty either way. */
export type ValidationResult<T = unknown> =
  | { ok: true; value: { en: T; el: T }; errors: []; warnings: ValidationWarning[] }
  | { ok: false; value?: undefined; errors: ValidationError[]; warnings: ValidationWarning[] };

const LOCALES: readonly Locale[] = ['en', 'el'];

/** The { en, el } document schema for one locale's schema. */
export function documentSchema<T extends z.ZodType>(schema: T) {
  return z.strictObject({ en: schema, el: schema });
}

function toError(issue: z.core.$ZodIssue): ValidationError {
  const [head, ...rest] = issue.path;
  if (head === 'en' || head === 'el') {
    return { locale: head, path: rest.map(String).join('.'), message: issue.message };
  }
  return { locale: null, path: '', message: issue.message };
}

const SHARED_MESSAGE = 'must equal the en value (locale-shared field)';
const LENGTH_MESSAGE = 'must have the same number of items as en (list holds locale-shared fields)';

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

/** Whether `schema` is, or holds at any depth, a locale-shared field. */
export const holdsShared = (schema: z.ZodType): boolean => holdsField(schema, (m) => !!m.shared);

export type SharedMismatch = { path: string; message: string };

/**
 * Where el breaks a locale-shared rule: a shared field whose el value differs
 * from en, or a list holding shared fields whose el length differs from en
 * (its items line up by index). Tuples are fixed-length, so exempt. Shared
 * fields are still compared for the indices both locales have.
 */
export function sharedMismatches(schema: z.ZodType, en: unknown, el: unknown): SharedMismatch[] {
  const out: SharedMismatch[] = [];
  walkSchema(schema, (n) => {
    const [a, b] = n.values;
    if (n.type === 'union' && isRecord(a) && isRecord(b)) {
      // Blocks line up by index; the walk only goes into a block both locales have the same type of.
      const key = n.meta.discriminator!;
      if (a[key] !== b[key]) out.push({ path: `${n.path}.${key}`, message: SHARED_MESSAGE });
      return;
    }
    if (n.meta.shared) {
      if (!sameJson(a, b)) out.push({ path: n.path, message: SHARED_MESSAGE });
      return false;
    }
    if (n.type === 'array' && Array.isArray(a) && Array.isArray(b) && a.length !== b.length && holdsShared(n.schema)) {
      out.push({ path: n.path, message: LENGTH_MESSAGE });
    }
  }, [en, el]);
  return out;
}

/** Context for the hardcoded-fact warning: the live contest's year and host city names. */
export type ValidationContext = { year: number; cities: string[] };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FACT_MESSAGE = 'Possible hardcoded year/city: use the contest placeholders';

/**
 * Advice that never blocks saving or publishing:
 * - a string longer than its field's softMaxLength;
 * - (with `context`) a string naming the live contest's year or host city,
 *   which should be a placeholder so it stays right next year (a dated past
 *   fact is a legitimate hit: review, then ignore);
 * - a non-shared optional field set in one locale but empty in the other
 *   (lists compared for the indices both locales have).
 */
export function documentWarnings(schema: z.ZodType, data: unknown, context?: ValidationContext): ValidationWarning[] {
  if (!isRecord(data)) return [];
  const warnings: ValidationWarning[] = [];
  const fact = context
    ? new RegExp([`(?<!\\d)${context.year}(?!\\d)`, ...context.cities.filter(Boolean).map(escapeRe)].join('|'))
    : null;
  for (const locale of LOCALES) {
    walkSchema(schema, (n) => {
      const v = n.values[0];
      if (n.type !== 'string' || typeof v !== 'string') return;
      const soft = n.meta.softMaxLength;
      if (soft !== undefined && v.length > soft) {
        warnings.push({ locale, path: n.path, message: `Longer than recommended: ${v.length} characters, recommended max ${soft}` });
      }
      if (fact?.test(v)) warnings.push({ locale, path: n.path, message: FACT_MESSAGE });
    }, [data[locale]]);
  }
  const isSet = (v: unknown) => v !== undefined && !(typeof v === 'string' && v.trim() === '');
  walkSchema(schema, (n) => {
    if (n.meta.shared) return false;
    const optional = n.meta.optional || (n.type === 'string' && n.meta.required === false);
    if (!optional) return;
    const [en, el] = n.values.map(isSet);
    if (en !== el) warnings.push({ locale: en ? 'el' : 'en', path: n.path, message: `Empty here but set in ${en ? 'en' : 'el'}` });
    return false;
  }, [data.en, data.el]);
  return warnings;
}

/**
 * Validates a { en, el } document of `docType`. `ok` is false when there is
 * any error; warnings (see documentWarnings) never affect it. Pass `context`
 * (the live contest's year and city names) to get the hardcoded-fact warning:
 * validation stays pure, the caller reads the contest.
 */
export function validateDocument(docType: string, data: unknown, context?: ValidationContext): ValidationResult {
  const def = Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, docType) ? CMS_DOC_TYPES[docType] : undefined;
  if (!def) return { ok: false, errors: [{ locale: null, path: '', message: `Unknown doc type "${docType}"` }], warnings: [] };
  const parsed = documentSchema(def.schema).safeParse(data);
  const errors = parsed.success ? [] : parsed.error.issues.map(toError);
  if (isRecord(data)) {
    for (const { path, message } of sharedMismatches(def.schema, data.en, data.el)) {
      errors.push({ path, locale: 'el', message });
    }
  }
  const warnings = documentWarnings(def.schema, data, context);
  if (parsed.success && !errors.length) return { ok: true, value: parsed.data as { en: unknown; el: unknown }, errors: [], warnings };
  return { ok: false, errors, warnings };
}
