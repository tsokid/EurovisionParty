// @vitest-environment node
// Final-review C1(b): a contest from 2004 on whose entries carry no semi
// assignment (production 2026 before migration 075) must not claim that
// nobody ran in a semi-final. The split is treated as unknown: no
// "straight to the final" list or column, no semi counts, neutral copy.
import { describe, it, expect, vi } from 'vitest';
import type { ContestSnapshot, CountrySnapshot } from '@/content/contests/types';

vi.mock('@/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seo/contentData')>();
  const strip = <T extends object>(x: T) => ({ ...x, semi: null, semi_place: null, semi_points: null, semi_running_order: null });
  return {
    ...real,
    bundledContent: (path: string) => {
      const data = real.bundledContent(path);
      if (path === 'contests/2026.json') {
        const c = data as ContestSnapshot;
        // As production before 075: finalists qualified null, the rest qualified false.
        return { ...c, entries: c.entries.map((e) => ({ ...strip(e), qualified: e.in_final ? null : false })) };
      }
      if (path === 'countries/AM.json') {
        const c = data as CountrySnapshot;
        return { ...c, participations: c.participations.map((p) => (p.year === 2026 ? { ...strip(p), qualified: false } : p)) };
      }
      return data;
    },
  };
});

import { render } from '@/entry-server';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('2026 hub without semi-final data', () => {
  it.each([
    ['en', 'Straight to the final', 'Semi-final results will appear here.', /\b0 countries/],
    ['el', 'Απευθείας στον τελικό', 'Τα αποτελέσματα των ημιτελικών θα εμφανιστούν εδώ.', /\b0 χώρες/],
  ] as const)('%s hub: no direct-to-final claims, neutral semis copy', async (locale, direct, pending, zero) => {
    const r = await render(`/${locale}/eurovision-2026`);
    expect(r.status).toBe(200);
    const t = text(r.html);
    expect(t).not.toContain(direct);
    expect(t).toContain(pending);
    expect(t).not.toMatch(zero);
    expect(r.head!.description).not.toMatch(zero);
  });

  it.each([
    ['en', 'Already in the final', 'Semi-final results will appear here.', /\b0 countries/],
    ['el', 'Ήδη στον τελικό', 'Τα αποτελέσματα των ημιτελικών θα εμφανιστούν εδώ.', /\b0 χώρες/],
  ] as const)('%s semifinals page: no direct list, neutral copy', async (locale, directTitle, pending, zero) => {
    const r = await render(`/${locale}/eurovision-2026/semifinals`);
    expect(r.status).toBe(200);
    const t = text(r.html);
    expect(t).not.toContain(directTitle);
    expect(t).toContain(pending);
    expect(t).not.toMatch(zero);
    expect(r.head!.description).not.toMatch(zero);
    expect(r.head!.title).not.toMatch(zero);
  });

  it.each([
    ['en', 'Straight to the final', 'skip the semi-finals'],
    ['el', 'Απευθείας στον τελικό', 'δεν διαγωνίζονται σε ημιτελικό'],
  ] as const)('%s schedule: no direct-to-final section', async (locale, directTitle, directText) => {
    const r = await render(`/${locale}/eurovision-2026/schedule`);
    expect(r.status).toBe(200);
    const t = text(r.html);
    expect(t).not.toContain(directTitle);
    expect(t).not.toContain(directText);
  });

  it.each([
    ['en', 'Straight to the final'],
    ['el', 'Απευθείας στον τελικό'],
  ] as const)('%s songs page: no "straight to the final" semi column', async (locale, direct) => {
    const r = await render(`/${locale}/eurovision-2026/songs`);
    expect(r.status).toBe(200);
    expect(text(r.html)).not.toContain(direct);
  });

  it.each([
    ['en', '/en/countries/armenia', 'Out in the semi-finals'],
    ['el', '/el/countries/armenia', 'Αποκλεισμός στους ημιτελικούς'],
  ] as const)('%s country page: a 2026 non-qualifier without a semi number still reads as out in the semis', async (_l, url, out) => {
    const r = await render(url);
    expect(r.status).toBe(200);
    expect(text(r.html)).toContain(out);
  });
});
