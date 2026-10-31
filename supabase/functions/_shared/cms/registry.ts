// CMS document types (spec §3 "Files", "Schemas").
//
// Static pages use their SEO-registry pageId as both docId and doc type
// (faq -> faq). Editorial layers (3b) are families keyed by prefix:
// archive-{year} -> archive, country-{ISO} -> country, hub-{year} -> hub.
// Schemas are registered here as Tasks 4-6 migrate each page.
import type { z } from 'zod';

export type DocTypeGroup = 'site' | 'contest' | 'country';

export type DocTypeDef = {
  /** Schema of one locale's content (the document is { en: T, el: T }). */
  schema: z.ZodType;
  label: string;
  group: DocTypeGroup;
};

export const CMS_DOC_TYPES: Record<string, DocTypeDef> = {};

const FAMILIES = ['archive', 'country', 'hub'] as const;

/** Doc type of a document id. */
export function docTypeFor(docId: string): string {
  for (const family of FAMILIES) {
    if (docId.startsWith(`${family}-`) && docId.length > family.length + 1) return family;
  }
  return docId;
}
