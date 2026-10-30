// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Hub pages are prerendered and must never touch Supabase: any property access
// on the client throws. tests/setup.ts stubs the env vars globally; this file
// unsets VITE_SUPABASE_URL so nothing can fall back to a real project.
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy({}, {
    get(_t, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      throw new Error(`supabase.${prop} accessed while rendering a hub page`);
    },
  }),
}));

import { render } from '@/entry-server';
import contest2026 from '../../content/contests/2026.json';

const ORIGIN = 'https://eurovision.games';
const HUB_URLS = [
  '/en/eurovision-2026', '/el/eurovision-2026',
  '/en/eurovision-2026/schedule', '/el/eurovision-2026/schedule',
  '/en/eurovision-2026/semifinals', '/el/eurovision-2026/semifinals',
  '/en/eurovision-2026/songs', '/el/eurovision-2026/songs',
];
const GREEK = /[Ͱ-Ͽ]/;

const h1 = (html: string) => /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1].replace(/<[^>]+>/g, '') ?? '';
const jsonLd = (r: Awaited<ReturnType<typeof render>>) => [r.head?.jsonLd].flat() as Array<Record<string, unknown>>;
const headerCells = (html: string) => [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1]);

describe('contest hub pages (SSR)', () => {
  beforeAll(() => {
    vi.unstubAllEnvs();
    // A local .env may define it; unset it outright for this file.
    vi.stubEnv('VITE_SUPABASE_URL', undefined);
    expect(import.meta.env.VITE_SUPABASE_URL).toBeFalsy();
  });

  it.each(HUB_URLS)('%s renders 200 with its own canonical and hreflang', async (url) => {
    const r = await render(url);
    expect(r.status).toBe(200);
    expect(r.head?.canonical).toBe(ORIGIN + url);
    expect(r.head?.robots).toBeUndefined();
    const unprefixed = url.replace(/^\/(en|el)/, '');
    expect(r.head?.hreflang).toEqual([
      { hreflang: 'en', href: `${ORIGIN}/en${unprefixed}` },
      { hreflang: 'el', href: `${ORIGIN}/el${unprefixed}` },
      { hreflang: 'x-default', href: `${ORIGIN}/en${unprefixed}` },
    ]);
    expect(h1(r.html)).toContain('2026');
    const crumbs = jsonLd(r).find((b) => b['@type'] === 'BreadcrumbList');
    expect(crumbs).toBeTruthy();
  });

  it('the EN hub H1 names the city, the EL hub H1 is Greek', async () => {
    const en = await render('/en/eurovision-2026');
    expect(h1(en.html)).toBe('Eurovision 2026 in Vienna');
    const el = await render('/el/eurovision-2026');
    expect(h1(el.html)).toMatch(GREEK);
    expect(h1(el.html)).toContain('Βιέννη');
    expect(el.head?.title).toBe('Eurovision 2026 στη Βιέννη: ημερομηνίες, ημιτελικοί και τραγούδια');
  });

  it('titles and descriptions are unique across every hub page and locale', async () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const url of HUB_URLS) {
      const r = await render(url);
      titles.add(r.head!.title);
      descriptions.add(r.head!.description);
    }
    expect(titles.size).toBe(HUB_URLS.length);
    expect(descriptions.size).toBe(HUB_URLS.length);
  });

  it('finalized hub leads with the results table and a winner callout', async () => {
    const en = await render('/en/eurovision-2026');
    expect(en.html).toContain('Bulgaria won Eurovision 2026 with 516 points');
    const resultsAt = en.html.indexOf('Final results');
    expect(resultsAt).toBeGreaterThan(-1);
    expect(en.html.indexOf('At a glance')).toBeGreaterThan(resultsAt);
    const el = await render('/el/eurovision-2026');
    expect(el.html).toContain('Η Βουλγαρία κέρδισε τη Eurovision 2026 με 516 βαθμούς');
  });

  it('hub emits an Event with the final date and the host city', async () => {
    const r = await render('/en/eurovision-2026');
    const event = jsonLd(r).find((b) => b['@type'] === 'Event') as Record<string, unknown> & { location: { name: string } };
    expect(event.name).toBe('Eurovision Song Contest 2026');
    expect(event.startDate).toBe(contest2026.dates.final);
    expect(event.location.name).toBe('Vienna');
  });

  it('/en/eurovision-2026/songs lists every entry and emits an ItemList', async () => {
    const r = await render('/en/eurovision-2026/songs');
    const rows = r.html.match(/<tr /g)?.length ?? 0;
    expect(rows - 1).toBeGreaterThanOrEqual(30);
    expect(r.html).toContain('Bangaranga');
    const list = jsonLd(r).find((b) => b['@type'] === 'ItemList') as { itemListElement: unknown[] };
    expect(list.itemListElement).toHaveLength(contest2026.entries.length);
  });

  it('/el/eurovision-2026/songs shows Greek country names', async () => {
    const r = await render('/el/eurovision-2026/songs');
    expect(r.html).toContain('Ελλάδα');
    expect(r.html).toContain('Βουλγαρία');
  });

  it('hides columns with no data (no language or running order in the 2026 snapshot)', async () => {
    const songs = await render('/en/eurovision-2026/songs');
    expect(headerCells(songs.html)).not.toContain('Language');
    const semis = await render('/en/eurovision-2026/semifinals');
    expect(headerCells(semis.html)).not.toContain('Running order');
    expect(headerCells(semis.html)).toContain('Points');
  });

  it('collects the content files each page read', async () => {
    const r = await render('/en/eurovision-2026/schedule');
    expect(Object.keys(r.content).sort()).toEqual(['contests/2026.json', 'site.json']);
    expect((r.content['contests/2026.json'] as { year: number }).year).toBe(2026);
    const faq = await render('/en/faq');
    expect(faq.content).toEqual({});
  });

  it.each([
    '/en/eurovision-1999', '/el/eurovision-1999/songs', '/en/eurovision-2027',
    '/en/not-a-hub', '/en/not-a-hub/schedule',
  ])('%s is a 404', async (url) => {
    const r = await render(url);
    expect(r.status).toBe(404);
  });
});
