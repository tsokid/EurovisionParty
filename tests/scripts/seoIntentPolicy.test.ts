// @vitest-environment node
// scripts/seo/intent.ts: SEO intent entries → the routes and fields the guard allows.
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { intentContext, intentPolicy, docUsesData } from '../../scripts/seo/intent';
import type { IntentEntry } from '../../supabase/functions/_shared/cms/seoIntent';

const ctx = intentContext(resolve(process.cwd()));
const entry = (over: Partial<IntentEntry>): IntentEntry => ({ id: 'e', created_at: 'x', source: 'publish-content', docs: [], data: [], ...over });

describe('intentPolicy', () => {
  it('a static doc maps to its registry route in that locale only', () => {
    const p = intentPolicy([entry({ docs: [{ doc_id: 'faq', locale: 'en', fields: ['title', 'jsonLd'] }] })], ctx);
    expect(p.allows('/en/faq', 'title')).toBe(true);
    expect(p.allows('/en/faq', 'jsonLd')).toBe(true);
    expect(p.allows('/en/faq', 'description')).toBe(false);
    expect(p.allows('/el/faq', 'title')).toBe(false);
    expect(p.allows('/en/about', 'title')).toBe(false);
  });

  it('home maps to /en and /el; the duels doc to its /duels slug', () => {
    const p = intentPolicy([entry({ docs: [
      { doc_id: 'home', locale: 'el', fields: ['h1'] },
      { doc_id: 'eurovision-duels', locale: 'en', fields: ['title'] },
    ] })], ctx);
    expect(p.allows('/el', 'h1')).toBe(true);
    expect(p.allows('/en/duels', 'title')).toBe(true);
  });

  it('an editorial doc maps to the data page built from it', () => {
    const p = intentPolicy([entry({ docs: [{ doc_id: 'archive-2025', locale: 'en', fields: ['description'] }] })], ctx);
    expect(p.allows('/en/past-contests/eurovision-2025-basel', 'description')).toBe(true);
    expect(p.allows('/el/past-contests/eurovision-2025-basel', 'description')).toBe(false);
    expect(p.allows('/en/past-contests', 'description')).toBe(false);
  });

  it('a contest file maps to its data pages (robots included) and to the data-rendering static pages (no robots)', () => {
    const p = intentPolicy([entry({ data: [{ file: 'content/contests/2025.json', fields: ['title', 'description', 'h1', 'jsonLd', 'robots'] }] })], ctx);
    expect(p.allows('/en/past-contests/eurovision-2025-basel', 'robots')).toBe(true);
    expect(p.allows('/el/past-contests', 'jsonLd')).toBe(true);
    expect(p.allows('/en/countries/albania', 'title')).toBe(false); // country pages are built from country files
    expect(p.allows('/en/winners', 'jsonLd')).toBe(true);
    expect(p.allows('/en/winners', 'robots')).toBe(false);
    for (const f of ['canonical', 'hreflang'] as const) expect(p.allows('/en/past-contests/eurovision-2025-basel', f)).toBe(false);
  });

  it('only manual entries reach canonical / hreflang, and only on the routes they list', () => {
    const p = intentPolicy([entry({ source: 'manual', routes: [{ route: '/en/faq', fields: ['canonical'] }] })], ctx);
    expect(p.allows('/en/faq', 'canonical')).toBe(true);
    expect(p.allows('/el/faq', 'canonical')).toBe(false);
  });

  it('no entries allow nothing', () => {
    const p = intentPolicy([], ctx);
    expect(p.allows('/en/faq', 'title')).toBe(false);
    expect(p.allowsRemoval('/en/faq', new Set())).toBe(false);
  });
});

describe('docUsesData', () => {
  it('finds placeholders and fact tokens, not escaped braces', () => {
    expect(docUsesData({ en: { a: 'Eurovision {year}' } })).toBe(true);
    expect(docUsesData({ en: { a: ['Won by {2014.country}'] } })).toBe(true);
    expect(docUsesData({ en: { a: 'literal {{year}}' } })).toBe(false);
    expect(docUsesData(undefined)).toBe(false);
  });
});
