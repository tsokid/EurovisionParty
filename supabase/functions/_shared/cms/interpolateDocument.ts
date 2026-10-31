// A whole { en, el } document rendered with placeholder values: every
// templated field (one whose schema declares placeholders) goes through
// interpolate(); every other field is left exactly as written, braces included.
// What a page renders for those fields; used by extraction proofs and the
// admin preview.
import type { z } from 'zod';
import { interpolate } from './placeholders.ts';
import { mapStrings } from './walk.ts';

export type Vars = Record<string, string | number>;

export function interpolateDocument(schema: z.ZodType, doc: Record<'en' | 'el', unknown>, vars: Vars): Record<'en' | 'el', unknown> {
  const one = (v: unknown) => mapStrings(schema, v, (s, meta) => (meta.placeholders?.length ? interpolate(s, vars) : s));
  return { en: one(doc.en), el: one(doc.el) };
}
