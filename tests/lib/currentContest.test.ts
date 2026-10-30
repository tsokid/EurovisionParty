// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { toCurrentContest, useCurrentContest, useCurrentYear, type CurrentContest } from '@/lib/currentContest';
import { getSite } from '@/lib/seo/contentData';
import ContentProvider from '@/lib/seo/ContentProvider';
import { createContentCollector } from '@/lib/seo/contentContext';
import { contestTexts } from '@/pages/seo/content/contestText';
import type { SiteCurrentContest } from '@/content/contests/types';

/** Test-only sync accessor: the live contest from the snapshot's site.json. */
const currentContest = (): CurrentContest => toCurrentContest(getSite().current);

describe('live contest from site.json (snapshot: current_year 2026)', () => {
  it('returns the live contest facts', () => {
    const cc = currentContest();
    expect(cc).toEqual({
      year: 2026,
      city: 'Vienna',
      citySlug: 'vienna',
      finalDate: '2026-05-16',
      semi1Date: '2026-05-12',
      semi2Date: '2026-05-14',
      hostIso: 'AT',
      hostName: { en: 'Austria', el: 'Αυστρία' },
      stage: 'finalized',
      lineupSize: 35,
      finalists: 25,
    });
  });

  it('is memoized per site.json object', () => {
    expect(currentContest()).toBe(currentContest());
  });

  it('the hooks read only site.json, and record it for inlining', () => {
    const collector = createContentCollector();
    let seen: [number, CurrentContest] | null = null;
    function Probe() {
      seen = [useCurrentYear(), useCurrentContest()];
      return null;
    }
    renderToString(createElement(ContentProvider, { collector }, createElement(Probe)));
    expect(seen![0]).toBe(2026);
    expect(seen![1].city).toBe('Vienna');
    expect(Object.keys(collector.files)).toEqual(['site.json']);
  });
});

describe('contestTexts', () => {
  it('formats the yearly facts per locale', () => {
    const t = contestTexts(currentContest());
    expect(t.en).toEqual({
      year: 2026, city: 'Vienna', cityIn: 'in Vienna', cityFrom: 'from Vienna', host: 'Austria',
      finalDay: 'Saturday 16 May 2026', finalDayShort: 'Saturday 16 May', finalMonth: 'May', flag: '🇦🇹', lineup: 35,
      decided: true,
    });
    expect(t.el).toEqual({
      year: 2026, city: 'Βιέννη', cityIn: 'στη Βιέννη', cityFrom: 'από τη Βιέννη', host: 'Αυστρία',
      finalDay: 'Σάββατο 16 Μαΐου 2026', finalDayShort: 'Σάββατο 16 Μαΐου', finalMonth: 'Μάιος', flag: '🇦🇹', lineup: 35,
      decided: true,
    });
  });

  it('falls back to a generic date and handles other Greek prepositions', () => {
    const c: SiteCurrentContest = {
      year: 2099, city: 'Copenhagen', city_slug: 'copenhagen', dates: { semi1: null, semi2: null, final: null },
      stage: 'upcoming', host: { iso: 'DK', name_en: 'Denmark', name_el: 'Δανία' }, entry_count: 0, finalist_count: 0,
    };
    const t = contestTexts(toCurrentContest(c));
    expect(t.en.finalDay).toBe('a Saturday in May');
    expect(t.el.cityFrom).toBe('από την Κοπεγχάγη');
    expect(t.en.host).toBe('Denmark');
    expect(t.en.lineup).toBe(0);
    expect(t.el.finalMonth).toBe('');
    expect(t.en.flag).toBe('🇩🇰');
    expect(t.en.decided).toBe(false);
    expect(contestTexts(toCurrentContest({ ...c, host: null })).en).toMatchObject({ host: '', flag: '' });
  });
});
