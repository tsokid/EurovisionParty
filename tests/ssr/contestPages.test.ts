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
import { allPublicUrls } from '@/lib/seo/registry';
import { contentData } from '@/lib/seo/contentData';
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
    // The header reads site.json (the nav's "Eurovision {year}" link) on every page.
    expect(faq.content).toEqual({ 'site.json': expect.anything() });
  });

  it.each([
    '/en/eurovision-1999', '/el/eurovision-1999/songs', '/en/eurovision-2027',
    '/en/not-a-hub', '/en/not-a-hub/schedule',
  ])('%s is a 404', async (url) => {
    const r = await render(url);
    expect(r.status).toBe(404);
  });
});

const robots = (r: Awaited<ReturnType<typeof render>>) => r.head?.robots;
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const h2s = (html: string) => [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1]);
/** The first table row containing `needle` (searching from `from`). */
function rowWith(html: string, needle: string, from = 0): string {
  const at = html.indexOf(needle, from);
  if (at < 0) return '';
  const start = html.lastIndexOf('<tr', at);
  const end = html.indexOf('</tr>', at);
  return start < 0 || end < 0 ? '' : html.slice(start, end);
}

describe('archive year pages (SSR)', () => {
  it('archive year pages read the slim years.json, not the contests index (M7)', async () => {
    const r = await render('/en/past-contests/eurovision-2019-tel-aviv');
    expect(Object.keys(r.content)).toContain('contests/years.json');
    expect(Object.keys(r.content)).not.toContain('contests/index.json');
    expect(JSON.stringify(r.content['contests/years.json']).length).toBeLessThan(4000);
  });

  it('/en/past-contests/eurovision-2019-tel-aviv: winner, final, both semis, nav', async () => {
    const r = await render('/en/past-contests/eurovision-2019-tel-aviv');
    expect(r.status).toBe(200);
    expect(r.head?.title).toBe('Eurovision 2019 in Tel Aviv: final results, semi-finals & winner');
    expect(r.head?.canonical).toBe(`${ORIGIN}/en/past-contests/eurovision-2019-tel-aviv`);
    expect(h1(r.html)).toBe('Eurovision 2019 in Tel Aviv');
    expect(r.html).toContain('Netherlands won Eurovision 2019 with 498 points');
    expect(r.html).toContain('Arcade');
    expect(r.html).toContain('Duncan Laurence');
    expect(r.html).toContain('id="final"');
    expect(r.html).toContain('id="semi-1"');
    expect(r.html).toContain('id="semi-2"');
    // Winner callout, then the final ranking, then the semis.
    expect(r.html.indexOf('id="winner"')).toBeLessThan(r.html.indexOf('id="final"'));
    expect(r.html.indexOf('id="final"')).toBeLessThan(r.html.indexOf('id="semi-1"'));
    // 2019 is not indexable in the snapshot.
    expect(robots(r)).toBe('noindex');
    const links = hrefs(r.html);
    expect(links).toContain('/en/past-contests/eurovision-2018-lisbon');
    expect(links).toContain('/en/past-contests/eurovision-2020-rotterdam');
    expect(links).toContain('/en/countries/netherlands');
    const types = jsonLd(r).map((b) => b['@type']);
    expect(types).toEqual(expect.arrayContaining(['Event', 'ItemList', 'BreadcrumbList']));
    const event = jsonLd(r).find((b) => b['@type'] === 'Event')!;
    expect(event.startDate).toBe('2019-05-18');
    expect(Object.keys(r.content).sort()).toEqual(['contests/2019.json', 'contests/years.json', 'site.json']);
  });

  it('/el/past-contests/eurovision-2019-tel-aviv has the Greek title', async () => {
    const r = await render('/el/past-contests/eurovision-2019-tel-aviv');
    expect(r.head?.title).toBe('Eurovision 2019 στο Τελ Αβίβ: αποτελέσματα, ημιτελικοί και νικητής');
    expect(r.html).toContain('Η Ολλανδία κέρδισε τη Eurovision 2019 με 498 βαθμούς');
  });

  it('/el/past-contests/eurovision-1975-stockholm: Greek, noindex, no semi-finals', async () => {
    const r = await render('/el/past-contests/eurovision-1975-stockholm');
    expect(r.status).toBe(200);
    expect(h1(r.html)).toMatch(GREEK);
    expect(h1(r.html)).toContain('Στοκχόλμη');
    expect(robots(r)).toBe('noindex');
    expect(r.html).not.toContain('id="semi-1"');
    expect(r.html).toContain('Ολλανδία');
    expect(r.html).toContain('href="/el/countries/netherlands"');
  });

  it('2020 is a cancelled note with the entries and no results', async () => {
    const r = await render('/en/past-contests/eurovision-2020-rotterdam');
    expect(r.status).toBe(200);
    expect(r.html).toContain('id="cancelled"');
    expect(r.html).not.toContain('id="final"');
    expect(headerCells(r.html)).not.toContain('Points');
    expect(headerCells(r.html)).not.toContain('Place');
    const event = jsonLd(r).find((b) => b['@type'] === 'Event')!;
    expect(event.eventStatus).toBe('https://schema.org/EventCancelled');
  });

  it('1969 shows all four winners', async () => {
    const r = await render('/en/past-contests/eurovision-1969-madrid');
    expect(r.status).toBe(200);
    const callout = r.html.slice(r.html.indexOf('id="winner"'), r.html.indexOf('id="final"'));
    for (const name of ['Spain', 'France', 'United Kingdom', 'Netherlands']) expect(callout).toContain(name);
  });

  it('1956: the winner without published points', async () => {
    const r = await render('/en/past-contests/eurovision-1956-lugano');
    expect(r.html).toContain('Switzerland won Eurovision 1956');
    expect(r.head?.description).not.toMatch(/null|undefined|NaN/);
    expect(hrefs(r.html)).toContain('/en/past-contests/eurovision-1957-frankfurt');
  });

  it.each([
    '/en/past-contests/eurovision-1999-nowhere',
    '/en/past-contests/eurovision-2019-lisbon',
    '/en/past-contests/eurovision-2026-vienna',
    '/en/past-contests/eurovision-1066-hastings',
    '/el/past-contests/not-a-contest',
    '/en/countries/atlantis',
    '/el/countries/GR',
  ])('%s is a 404', async (url) => {
    const r = await render(url);
    expect(r.status).toBe(404);
  });
});

describe('past contests index (SSR)', () => {
  it('/en/past-contests lists every year newest first, indexable', async () => {
    const r = await render('/en/past-contests');
    expect(r.status).toBe(200);
    expect(robots(r)).toBeUndefined();
    expect(rowWith(r.html, 'Wasted Love')).toContain('436');
    expect(r.html.indexOf('/en/past-contests/eurovision-2025-basel')).toBeLessThan(
      r.html.indexOf('/en/past-contests/eurovision-1956-lugano'));
    expect(r.html).not.toContain('eurovision-2026-vienna');
    expect(Object.keys(r.content).sort()).toEqual(['contests/index.json', 'site.json']);
  });

  it('/el/past-contests is Greek', async () => {
    const r = await render('/el/past-contests');
    expect(h1(r.html)).toMatch(GREEK);
    expect(r.html).toContain('Αυστρία');
  });
});

describe('country pages (SSR)', () => {
  it('/en/countries/greece: summary, the 2005 win, links to each year', async () => {
    const r = await render('/en/countries/greece');
    expect(r.status).toBe(200);
    expect(robots(r)).toBeUndefined();
    expect(h1(r.html)).toContain('Greece');
    expect(r.html).toContain('id="wins"');
    expect(rowWith(r.html, 'My Number One')).toContain('Helena Paparizou');
    expect(r.html).toContain('id="last-10"');
    expect(r.html).toContain('id="history"');
    const links = hrefs(r.html);
    expect(links).toContain('/en/past-contests/eurovision-2005-kyiv');
    expect(links).toContain('/en/past-contests/eurovision-1974-brighton');
    expect(links).toContain('/en/eurovision-2026');
    expect(Object.keys(r.content).sort()).toEqual(['contests/index.json', 'countries/GR.json', 'countries/index.json', 'site.json']);
  });

  it('/el/countries/greece: Greek H1', async () => {
    const r = await render('/el/countries/greece');
    expect(h1(r.html)).toContain('Ελλάδα');
  });

  it('/en/countries/morocco is noindex (one participation)', async () => {
    const r = await render('/en/countries/morocco');
    expect(r.status).toBe(200);
    expect(robots(r)).toBe('noindex');
  });

  it('see also lists the related countries', async () => {
    const r = await render('/en/countries/serbia-and-montenegro');
    expect(r.html).toContain('id="see-also"');
    const links = hrefs(r.html);
    expect(links).toContain('/en/countries/yugoslavia');
    expect(links).toContain('/en/countries/serbia');
    expect(links).toContain('/en/countries/montenegro');
  });
});

describe('countries index (SSR)', () => {
  it('/el/countries groups countries by their Greek initial', async () => {
    const r = await render('/el/countries');
    expect(r.status).toBe(200);
    expect(robots(r)).toBeUndefined();
    expect(h2s(r.html)).toEqual(expect.arrayContaining(['Α', 'Ε']));
    expect(r.html).toContain('href="/el/countries/greece"');
    expect(r.html.indexOf('Αλβανία')).toBeLessThan(r.html.indexOf('Ελλάδα'));
    expect(Object.keys(r.content).sort()).toEqual(['countries/index.json', 'site.json']);
  });

  it('/en/countries groups by the English initial', async () => {
    const r = await render('/en/countries');
    expect(h2s(r.html).slice(0, 3)).toEqual(['A', 'B', 'C']);
  });
});

describe('/winners from data (SSR)', () => {
  it('lists the latest winner, the first contest and the leaderboard', async () => {
    const r = await render('/en/winners');
    expect(r.status).toBe(200);
    expect(r.head?.title).toBe('Eurovision Winners — Every Champion 1956 to Today · Eurovision Games');
    const row2025 = rowWith(r.html, 'Wasted Love');
    for (const s of ['2025', 'Austria', 'JJ', '436']) expect(row2025).toContain(s);
    const row1956 = rowWith(r.html, 'Refrain');
    expect(row1956).toContain('1956');
    expect(row1956).toContain('Switzerland');
    expect(r.html).toContain('Recent winners (2011–2026)');
    const crumbs = jsonLd(r).find((b) => b['@type'] === 'BreadcrumbList') as { itemListElement: { item: string }[] };
    expect(crumbs.itemListElement.map((i) => i.item)).toContain(`${ORIGIN}/en/past-contests`);
    expect(Object.keys(r.content).sort()).toEqual(['contests/index.json', 'site.json']);
  });

  it('the recent table has the last 15 champions', async () => {
    const r = await render('/en/winners');
    const start = r.html.indexOf('id="recent"');
    const recent = r.html.slice(start, r.html.indexOf('</table>', start));
    expect((recent.match(/<tr /g) ?? []).length - 1).toBe(15);
  });

  it('the leaderboard counts shared wins (1969) and sorts by wins', async () => {
    const r = await render('/en/winners');
    const from = r.html.indexOf('<table', r.html.indexOf('id="leaderboard"'));
    expect(rowWith(r.html, 'Ireland', from)).toContain('>7<');
    expect(rowWith(r.html, 'Sweden', from)).toContain('>7<');
    expect(rowWith(r.html, 'France', from)).toContain('>5<');
    expect(rowWith(r.html, 'United Kingdom', from)).toContain('>5<');
    expect(r.html.indexOf('Ireland', from)).toBeLessThan(r.html.indexOf('France', from));
  });

  it('/el/winners keeps its Greek copy', async () => {
    const r = await render('/el/winners');
    expect(r.head?.title).toBe('Νικητές Eurovision — Όλοι οι Πρωταθλητές 1956 έως Σήμερα · Eurovision Games');
    expect(r.html).toContain('Αυστρία');
  });
});

describe('hub copy polish', () => {
  it('Greek finalized chip and songs title', async () => {
    const hub = await render('/el/eurovision-2026');
    expect(hub.html).toContain('Βγήκαν τα αποτελέσματα');
    const songs = await render('/el/eurovision-2026/songs');
    expect(songs.head?.title).toBe('Τραγούδια Eurovision 2026: όλες οι 35 συμμετοχές');
  });
});

describe('every public page', () => {
  it('renders 200 with a unique title and description per locale', async () => {
    const urls = allPublicUrls(contentData(), true);
    expect(urls.length).toBeGreaterThan(250);
    const seen = new Map<string, string>();
    for (const { path, indexable } of urls) {
      const r = await render(path);
      expect(r.status, path).toBe(200);
      expect(r.head?.canonical, path).toBe(ORIGIN + path);
      if (!indexable) expect(r.head?.robots, path).toBe('noindex');
      const locale = path.split('/')[1];
      for (const key of [`t ${locale} ${r.head?.title}`, `d ${locale} ${r.head?.description}`]) {
        expect(seen.get(key), `${path} duplicates ${seen.get(key)}`).toBeUndefined();
        seen.set(key, path);
      }
    }
  }, 120_000);
});

describe('review round 1', () => {
  it('2005 (one semi-final) in EN: singular title, lede and heading', async () => {
    const r = await render('/en/past-contests/eurovision-2005-kyiv');
    expect(r.status).toBe(200);
    expect(r.head?.title).toBe('Eurovision 2005 in Kyiv: final results, semi-final & winner');
    expect(r.html).toContain('id="semi-1"');
    expect(r.html).not.toContain('id="semi-2"');
    expect(h2s(r.html)).toContain('Semi-final · 19 May 2005');
    expect(r.html).toContain('the full grand final ranking and the semi-final');
    expect(r.html).not.toMatch(/both semi-finals/);
  });

  it('2005 (one semi-final) in EL: singular title, lede and heading', async () => {
    const r = await render('/el/past-contests/eurovision-2005-kyiv');
    expect(r.head?.title).toBe('Eurovision 2005 στο Κίεβο: αποτελέσματα, ημιτελικός και νικητής');
    expect(h2s(r.html)).toContain('Ημιτελικός · 19 Μαΐου 2005');
    expect(r.html).toContain('και ο ημιτελικός');
    expect(r.html).not.toContain('οι δύο ημιτελικοί');
    expect(r.html).not.toContain('Α΄ ημιτελικός');
  });

  it('2019 (two semi-finals) keeps the numbered headings', async () => {
    const r = await render('/en/past-contests/eurovision-2019-tel-aviv');
    expect(h2s(r.html)).toContain('Semi-final 1 · 14 May 2019');
    expect(r.html).toContain('both semi-finals');
  });

  it('1969: plural lede, gender-neutral Greek', async () => {
    const en = await render('/en/past-contests/eurovision-1969-madrid');
    expect(en.html).toContain('Below: the winners and the full ranking');
    const el = await render('/el/past-contests/eurovision-1969-madrid');
    expect(el.html).toContain('μοιράστηκαν την πρώτη θέση');
    expect(el.html).toContain('Παρακάτω: οι νικητές και η πλήρης κατάταξη');
    expect(el.html).not.toContain('όλες πρώτες');
    expect(el.html).not.toContain('η καθεμία');
  });

  it('2020: the ItemList is the entries, not a ranking', async () => {
    const en = await render('/en/past-contests/eurovision-2020-rotterdam');
    const list = jsonLd(en).find((b) => b['@type'] === 'ItemList')!;
    expect(list.name).toBe('Eurovision 2020 entries');
    const el = await render('/el/past-contests/eurovision-2020-rotterdam');
    expect(jsonLd(el).find((b) => b['@type'] === 'ItemList')!.name).toBe('Οι συμμετοχές της Eurovision 2020');
  });

  it.each([
    ['/en/eurovision-2026', '2026-05-16', 'https://schema.org/EventScheduled'],
    ['/el/past-contests/eurovision-2019-tel-aviv', '2019-05-18', 'https://schema.org/EventScheduled'],
    ['/en/past-contests/eurovision-2020-rotterdam', '2020-05-16', 'https://schema.org/EventCancelled'],
  ])('%s Event has image, organizer, endDate, attendance mode and status (M6)', async (url, final, status) => {
    const event = jsonLd(await render(url)).find((b) => b['@type'] === 'Event')!;
    expect(event).toMatchObject({
      startDate: final,
      endDate: final,
      image: 'https://eurovision.games/logo.png',
      organizer: { '@type': 'Organization', name: 'European Broadcasting Union', url: 'https://www.ebu.ch' },
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: status,
    });
    expect(event.performer).toBeUndefined();
  });

  it('Event location uses the city name in the page locale', async () => {
    const el = await render('/el/past-contests/eurovision-2019-tel-aviv');
    const event = jsonLd(el).find((b) => b['@type'] === 'Event') as { location: { name: string } };
    expect(event.location.name).toBe('Τελ Αβίβ');
    const hub = await render('/el/eurovision-2026');
    expect((jsonLd(hub).find((b) => b['@type'] === 'Event') as { location: { name: string } }).location.name).toBe('Βιέννη');
  });

  it('a country with no wins has a title without "win"', async () => {
    const en = await render('/en/countries/morocco');
    expect(en.head?.title).toBe('Morocco at Eurovision: every entry and result');
    const el = await render('/el/countries/morocco');
    expect(el.head?.title).toBe('Μαρόκο στη Eurovision: όλες οι συμμετοχές και τα αποτελέσματα');
    const gr = await render('/en/countries/greece');
    expect(gr.head?.title).toBe('Greece at Eurovision: every entry, result and win');
  });

  it('wins count completed contests: Bulgaria won 2026 (finalized), as the hub says', async () => {
    const r = await render('/en/countries/bulgaria');
    expect(r.html).toContain('id="wins"');
    expect(r.head?.title).toBe('Bulgaria at Eurovision: every entry, result and win');
    expect(r.head?.description).toContain('1 win (2026)');
    expect(rowWith(r.html, 'Bangaranga')).toContain('href="/en/eurovision-2026"');
  });

  it('/winners runs to the latest completed year (2026)', async () => {
    const en = await render('/en/winners');
    expect(en.head?.title).toBe('Eurovision Winners — Every Champion 1956 to Today · Eurovision Games');
    expect(en.head?.description).toBe(
      'Complete list of Eurovision Song Contest winners from 1956 to 2026. Recent champions, all-time leaderboard, record-holders, and notable moments.');
    expect(en.head?.keywords).toContain('eurovision 2026 winner');
    const row = rowWith(en.html, 'Bangaranga');
    for (const s of ['2026', 'Bulgaria', '516', 'href="/en/eurovision-2026"']) expect(row).toContain(s);
    const el = await render('/el/winners');
    expect(el.head?.title).toBe('Νικητές Eurovision — Όλοι οι Πρωταθλητές 1956 έως Σήμερα · Eurovision Games');
    expect(el.head?.description).toContain('από το 1956 μέχρι το 2026.');
  });

  it('/winners breadcrumb reads Past contests in the page and the JSON-LD', async () => {
    for (const [locale, label] of [['en', 'Past contests'], ['el', 'Προηγούμενοι διαγωνισμοί']] as const) {
      const r = await render(`/${locale}/winners`);
      expect(r.html).toMatch(new RegExp(`href="/${locale}/past-contests"[^>]*>${label}</a>`));
      const crumbs = jsonLd(r).find((b) => b['@type'] === 'BreadcrumbList') as { itemListElement: { name: string; item: string }[] };
      expect(crumbs.itemListElement[1]).toMatchObject({ name: label, item: `${ORIGIN}/${locale}/past-contests` });
    }
  });

  it('/winners shows the 2020 note because 2020 is inside the recent window', async () => {
    const r = await render('/en/winners');
    expect(r.html).toContain('(No 2020 — the contest was cancelled due to COVID.)');
  });
});
