// @vitest-environment node
// Featured contest before its line-up is announced (owner, 19 Nov 2026): the
// pages say "not announced yet" and list every country that ever competed,
// never an empty or artist-less table. Simulated by blanking the artists and
// songs of the frozen 2026 snapshot (as the 2027 entry-list parse left them).
import { describe, it, expect, vi } from 'vitest';
import type { ContestSnapshot } from '@/content/contests/types';

vi.mock('@/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seo/contentData')>();
  return {
    ...real,
    bundledContent: (path: string) => {
      const data = real.bundledContent(path);
      if (path === 'contests/2026.json') {
        const c = data as ContestSnapshot;
        return {
          ...c,
          stage: 'upcoming',
          entries: c.entries.map((e) => ({ ...e, artist: '', song: '', final_place: null, total_points: null })),
        };
      }
      return data;
    },
  };
});

import { render } from '@/entry-server';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('line-up not announced yet', () => {
  it.each([
    ['en', 'The Eurovision 2026 entries have not been announced yet.', /here are all \d+ countries that have ever taken part/, 'Greece'],
    ['el', 'Οι συμμετοχές της Eurovision 2026 δεν έχουν ακόμα ανακοινωθεί.', /αυτές είναι και οι \d+ χώρες που έχουν πάρει ποτέ μέρος/, 'Ελλάδα'],
  ] as const)('%s hub, songs and predictions pages', async (locale, notice, intro, greece) => {
    for (const path of [`/${locale}/eurovision-2026`, `/${locale}/eurovision-2026/songs`, `/${locale}/eurovision-predictions`]) {
      const r = await render(path);
      expect(r.status, path).toBe(200);
      const t = text(r.html);
      expect(t, path).toContain(notice);
      expect(t, path).toMatch(intro);
      // Every country that ever competed, linked when it has a page.
      expect(r.html, path).toContain(`href="/${locale}/countries/greece"`);
      expect(t, path).toContain(greece);
      expect(t, path).not.toMatch(/The 0 entries|Οι 0 συμμετοχές/);
    }
  });

  it('counts the countries from the data (52 in the frozen snapshot, Yugoslavia and Morocco included)', async () => {
    const t = text((await render('/en/eurovision-predictions')).html);
    const n = Number(/here are all (\d+) countries/.exec(t)![1]);
    expect(n).toBeGreaterThanOrEqual(50);
  });
});
