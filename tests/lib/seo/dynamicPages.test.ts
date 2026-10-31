import { describe, it, expect } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { dynamicPageUrls, hubYearFromSlug, type ContentData } from '@/lib/seo/dynamicPages';
import { contentData, getSite, getContest, allContests, getCountryBySlug, allCountries } from '@/lib/seo/contentData';
import { allPublicUrls, allPageUrls, INCLUDE_DYNAMIC } from '@/lib/seo/registry';
import { routes } from '@/routeConfig';
import { loadContent } from '../../../scripts/seo/loadContent';

const pages = dynamicPageUrls(contentData());
const find = (path: string) => pages.find((p) => p.path === path);

describe('contentData (import.meta.glob over content/)', () => {
  it('loads site, contests and countries', () => {
    expect(getSite().current_year).toBe(2026);
    expect(allContests()).toHaveLength(71);
    expect(allContests()[0].year).toBe(1956);
    expect(getContest(1975)?.city_slug).toBe('stockholm');
    expect(getContest(1800)).toBeUndefined();
    expect(getCountryBySlug('greece')?.iso).toBe('GR');
    expect(getCountryBySlug('atlantis')).toBeUndefined();
    expect(allCountries().length).toBe(52);
  });

  it('matches the Node (fs) loader used by the build scripts', () => {
    expect(loadContent()).toEqual(contentData());
  });
});

describe('dynamicPageUrls against the committed snapshot', () => {
  it('builds the hub and its 3 subpages for the live year 2026, indexable, in both locales', () => {
    const hub = pages.filter((p) => p.kind === 'hub');
    expect(hub.map((p) => p.path).sort()).toEqual([
      '/el/eurovision-2026', '/el/eurovision-2026/schedule', '/el/eurovision-2026/semifinals', '/el/eurovision-2026/songs',
      '/en/eurovision-2026', '/en/eurovision-2026/schedule', '/en/eurovision-2026/semifinals', '/en/eurovision-2026/songs',
    ]);
    expect(hub.every((p) => p.indexable)).toBe(true);
  });

  it('builds the two index pages, indexable', () => {
    expect(find('/en/past-contests')).toMatchObject({ kind: 'archive-index', indexable: true, locale: 'en' });
    expect(find('/el/past-contests')).toMatchObject({ kind: 'archive-index', indexable: true, locale: 'el' });
    expect(find('/en/countries')).toMatchObject({ kind: 'country-index', indexable: true });
    expect(find('/el/countries')).toMatchObject({ kind: 'country-index', indexable: true });
  });

  it('has an archive page for each of the 70 archived years (1956–2025) per locale', () => {
    const en = pages.filter((p) => p.kind === 'archive' && p.locale === 'en');
    const el = pages.filter((p) => p.kind === 'archive' && p.locale === 'el');
    expect(en).toHaveLength(70);
    expect(el).toHaveLength(70);
    expect(find('/en/past-contests/eurovision-1956-lugano')).toBeDefined();
    expect(find('/en/past-contests/eurovision-2020-rotterdam')).toBeDefined();
    expect(pages.some((p) => p.kind === 'archive' && p.path.includes('eurovision-2026'))).toBe(false);
  });

  it('1975 follows contests.indexable (false)', () => {
    expect(find('/en/past-contests/eurovision-1975-stockholm')).toMatchObject({ kind: 'archive', indexable: false });
    expect(find('/el/past-contests/eurovision-1975-stockholm')).toMatchObject({ indexable: false });
  });

  it('Greece is indexable (>= 3 participations)', () => {
    expect(find('/en/countries/greece')).toMatchObject({ kind: 'country', indexable: true });
    expect(find('/el/countries/greece')).toMatchObject({ kind: 'country', indexable: true });
  });

  it('a one-time participant (Morocco) is built but not indexable', () => {
    expect(find('/en/countries/morocco')).toMatchObject({ kind: 'country', indexable: false });
  });

  it('has one country page per country with >= 1 participation (52) per locale', () => {
    expect(pages.filter((p) => p.kind === 'country' && p.locale === 'en')).toHaveLength(52);
  });

  it('paths are unique', () => {
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length);
  });

  // The editorial doc (CMS 3c) is listed whether or not it exists: the sitemap's
  // lastmod skips missing files, so a page without editorial keeps its date.
  it('every page lists the content files it is built from, its editorial doc included', () => {
    expect(find('/en/past-contests/eurovision-1975-stockholm')?.files)
      .toEqual(['content/contests/1975.json', 'content/pages/archive-1975.json']);
    expect(find('/en/countries/greece')?.files).toEqual(['content/countries/GR.json', 'content/pages/country-gr.json']);
    expect(find('/en/eurovision-2026')?.files).toEqual(['content/contests/2026.json', 'content/pages/hub-2026.json']);
  });

  it('the hub subpages take no editorial: their files are the contest only', () => {
    for (const sub of ['schedule', 'semifinals', 'songs']) {
      expect(find(`/en/eurovision-2026/${sub}`)?.files, sub).toEqual(['content/contests/2026.json']);
    }
  });
});

describe('dynamicPageUrls rules (synthetic data)', () => {
  const contest = (year: number, stage: 'archived' | 'current' | 'finalized', indexable = true) => ({
    year, city: 'X', city_slug: 'x', host_iso: null, dates: { semi1: null, semi2: null, final: null },
    stage, indexable, cancelled: false, entries: [],
  });
  const part = (year: number, cancelled = false) => ({
    year, city_slug: 'x', cancelled, final_place: null, semi: null, semi_place: null, semi_points: null,
    qualified: null, artist: null, song: null, points: null,
  });
  const country = (iso: string, slug: string, participations: ReturnType<typeof part>[]) => ({
    iso, slug, name_en: slug, name_el: slug, related_iso: [], participations,
  });
  const data = (over: Partial<ContentData> = {}): ContentData => ({
    site: { current_year: 2027, live_stage: 'current', generated_at: '' },
    contests: [contest(2025, 'archived'), contest(2027, 'current')],
    countries: [],
    ...over,
  });

  it('a cancelled participation does not count towards the 3', () => {
    const d = data({ countries: [country('AA', 'aa', [part(2019), part(2020, true), part(2021)])] });
    expect(dynamicPageUrls(d).find((p) => p.path === '/en/countries/aa')?.indexable).toBe(false);
    const d3 = data({ countries: [country('AA', 'aa', [part(2018), part(2019), part(2021)])] });
    expect(dynamicPageUrls(d3).find((p) => p.path === '/en/countries/aa')?.indexable).toBe(true);
  });

  it('a country with no participation gets no page', () => {
    const d = data({ countries: [country('ZZ', 'zz', [])] });
    expect(dynamicPageUrls(d).some((p) => p.path.endsWith('/countries/zz'))).toBe(false);
  });

  it('no hub when the live year is archived or missing', () => {
    const archived = data({ site: { current_year: 2025, live_stage: 'archived', generated_at: '' } });
    expect(dynamicPageUrls(archived).some((p) => p.kind === 'hub')).toBe(false);
    const missing = data({ site: { current_year: 2030, live_stage: 'current', generated_at: '' } });
    expect(dynamicPageUrls(missing).some((p) => p.kind === 'hub')).toBe(false);
  });

  it('only archived years get archive pages', () => {
    const urls = dynamicPageUrls(data()).filter((p) => p.kind === 'archive').map((p) => p.path);
    expect(urls).toEqual(['/en/past-contests/eurovision-2025-x', '/el/past-contests/eurovision-2025-x']);
  });
});

describe('hubYearFromSlug', () => {
  it('parses eurovision-{4 digits} only', () => {
    expect(hubYearFromSlug('eurovision-2026')).toBe(2026);
    expect(hubYearFromSlug('eurovision-26')).toBeNull();
    expect(hubYearFromSlug('eurovision-2026-predictions')).toBeNull();
    expect(hubYearFromSlug('faq')).toBeNull();
    expect(hubYearFromSlug(undefined)).toBeNull();
  });
});

describe('allPublicUrls', () => {
  it('the gate is on: the data-driven pages are public', () => {
    expect(INCLUDE_DYNAMIC).toBe(true);
    expect(allPublicUrls(contentData())).toEqual(allPublicUrls(contentData(), true));
  });

  it('with the gate off equals the static registry URLs, all indexable', () => {
    expect(allPublicUrls(contentData(), false)).toEqual(allPageUrls().map((u) => ({ ...u, indexable: true })));
  });

  it('with dynamic pages included = static ∪ dynamic', () => {
    const all = allPublicUrls(contentData(), true);
    expect(all).toHaveLength(allPageUrls().length + pages.length);
    expect(all).toContainEqual(expect.objectContaining({ path: '/en/countries/morocco', indexable: false }));
    expect(all).toContainEqual(expect.objectContaining({ path: '/en/faq', indexable: true }));
  });
});

describe('dynamic routes', () => {
  it('every dynamic page URL matches a real route (not the * fallback)', () => {
    for (const { path } of pages) {
      const m = matchRoutes(routes, path);
      expect(m, path).not.toBeNull();
      expect(m!.at(-1)!.route.path, path).not.toBe('*');
    }
  });

  it('static routes still win over the dynamic :slug route', () => {
    for (const path of ['/en/faq', '/en/eurovision-predictions', '/el/winners']) {
      expect(matchRoutes(routes, path)!.at(-1)!.route.path).not.toBe(':slug');
    }
  });
});
