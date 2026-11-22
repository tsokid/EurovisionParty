// Missing translations of a { en, el } document (CMS P6, spec §4 "EN/EL":
// flags at field, doc and tree level).
//
// A translatable string field (not locale-shared, not a hidden id) is
// missing in a locale when it is required and empty there. A field that may
// be empty (required: false) is never a missing translation: the languages
// legitimately differ there (Greek needs a word before a link that English
// does not). An optional field present in one locale only is missing as a
// whole in the other. A free list may have a different length per language
// (keywords): its items are compared for the positions both have. Shared
// fields (choices, flags, links, media) are one value for both languages, so
// they never count.
//
// Pure, Deno-free; the admin and the SEO panel (hreflang pair) both use it.
import type { z } from 'zod';
import { walkSchema } from './walk.ts';
import { CMS_DOC_TYPES } from './registry.ts';
import type { FieldMeta } from './fields.ts';

export type Locale = 'en' | 'el';

export type MissingTranslations = Record<Locale, string[]>;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const blank = (v: unknown) => typeof v !== 'string' || v.trim() === '';
const present = (v: unknown) => v !== undefined && !(typeof v === 'string' && v.trim() === '');

const STRING_KINDS = new Set<FieldMeta['kind']>(['text', 'multiline', 'richText']);

/** Whether a string field with this metadata is translated (not shared, not hidden). */
export const isTranslated = (meta: FieldMeta) => STRING_KINDS.has(meta.kind) && !meta.shared && !meta.hidden;

/** Whether `value` (this locale) is a missing translation (`_other`, the other locale's value, is for callers that show both). */
export function missingHere(meta: FieldMeta, value: unknown, _other?: unknown): boolean {
  return isTranslated(meta) && meta.required !== false && blank(value);
}

/** The paths missing in each locale, in document order. */
export function missingTranslations(schema: z.ZodType, doc: unknown): MissingTranslations {
  const out: MissingTranslations = { en: [], el: [] };
  if (!isRecord(doc)) return out;
  walkSchema(schema, (n) => {
    const [en, el] = n.values;
    if (n.meta.shared) return false;
    if (n.type === 'optional') {
      // Present in one locale only: the whole field is missing in the other.
      if (en === undefined && present(el)) out.en.push(n.path);
      if (el === undefined && present(en)) out.el.push(n.path);
      return;
    }
    if (n.type !== 'string') return;
    if (missingHere(n.meta, en, el)) out.en.push(n.path);
    if (missingHere(n.meta, el, en)) out.el.push(n.path);
  }, [doc.en, doc.el]);
  return out;
}

/** missingTranslations for a doc type (none for an unknown one). */
export function missingTranslationsOf(docType: string, doc: unknown): MissingTranslations {
  const def = Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, docType) ? CMS_DOC_TYPES[docType] : undefined;
  return def ? missingTranslations(def.schema, doc) : { en: [], el: [] };
}
