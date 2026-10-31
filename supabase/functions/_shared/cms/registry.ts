// CMS document types (spec §3 "Files", "Schemas").
//
// Static pages use their SEO-registry pageId as both docId and doc type
// (faq -> faq). Editorial layers (3b) are families keyed by prefix:
// archive-{year} -> archive, country-{ISO} -> country, hub-{year} -> hub.
// Schemas are registered here as Tasks 4-6 migrate each page.
import type { z } from 'zod';
import { aboutSchema } from './schemas/about.ts';
import { cookiesSchema } from './schemas/cookies.ts';
import { dashboardSchema } from './schemas/dashboard.ts';
import { faqSchema } from './schemas/faq.ts';
import { privacySchema } from './schemas/privacy.ts';
import { rulesSchema } from './schemas/rules.ts';
import { scoringSchema } from './schemas/scoring.ts';
import { termsSchema } from './schemas/terms.ts';

export type DocTypeGroup = 'site' | 'contest' | 'country';

export type DocTypeDef = {
  /** Schema of one locale's content (the document is { en: T, el: T }). */
  schema: z.ZodType;
  label: string;
  group: DocTypeGroup;
};

export const CMS_DOC_TYPES: Record<string, DocTypeDef> = {
  about: { schema: aboutSchema, label: 'About', group: 'site' },
  privacy: { schema: privacySchema, label: 'Privacy policy', group: 'site' },
  terms: { schema: termsSchema, label: 'Terms of use', group: 'site' },
  cookies: { schema: cookiesSchema, label: 'Cookies & consent', group: 'site' },
  dashboard: { schema: dashboardSchema, label: 'Dashboard guide', group: 'site' },
  scoring: { schema: scoringSchema, label: 'Scoring', group: 'site' },
  rules: { schema: rulesSchema, label: 'Rules', group: 'site' },
  faq: { schema: faqSchema, label: 'FAQ', group: 'site' },
};

const FAMILIES = ['archive', 'country', 'hub'] as const;

/** Doc type of a document id. */
export function docTypeFor(docId: string): string {
  for (const family of FAMILIES) {
    if (docId.startsWith(`${family}-`) && docId.length > family.length + 1) return family;
  }
  return docId;
}
