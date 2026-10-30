// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { currentContest, toCurrentContest } from '@/lib/currentContest';
import { contestTexts } from '@/pages/seo/content/contestText';
import type { ContestSnapshot } from '@/content/contests/types';

describe('currentContest (snapshot: site.json current_year 2026)', () => {
  it('returns the live contest facts', () => {
    const cc = currentContest()!;
    expect(cc).not.toBeNull();
    expect(cc.year).toBe(2026);
    expect(cc.city).toBe('Vienna');
    expect(cc.citySlug).toBe('vienna');
    expect(cc.finalDate).toBe('2026-05-16');
    expect(cc.semi1Date).toBe('2026-05-12');
    expect(cc.semi2Date).toBe('2026-05-14');
    expect(cc.hostName).toEqual({ en: 'Austria', el: 'Αυστρία' });
    expect(cc.lineupSize).toBe(35);
    expect(cc.stage).toBe('finalized');
  });

  it('is memoized per snapshot object', () => {
    expect(currentContest()).toBe(currentContest());
  });
});

describe('contestTexts', () => {
  it('formats the yearly facts per locale', () => {
    const t = contestTexts(currentContest()!);
    expect(t.en).toEqual({
      year: 2026, city: 'Vienna', cityIn: 'in Vienna', cityFrom: 'from Vienna', host: 'Austria',
      finalDay: 'Saturday 16 May 2026', finalDayShort: 'Saturday 16 May', finalMonth: 'May', flag: '🇦🇹', lineup: 35,
    });
    expect(t.el).toEqual({
      year: 2026, city: 'Βιέννη', cityIn: 'στη Βιέννη', cityFrom: 'από τη Βιέννη', host: 'Αυστρία',
      finalDay: 'Σάββατο 16 Μαΐου 2026', finalDayShort: 'Σάββατο 16 Μαΐου', finalMonth: 'Μάιος', flag: '🇦🇹', lineup: 35,
    });
  });

  it('falls back to a generic date and handles other Greek prepositions', () => {
    const c: ContestSnapshot = {
      year: 2099, city: 'Copenhagen', city_slug: 'copenhagen', host_iso: 'DK',
      dates: { semi1: null, semi2: null, final: null }, stage: 'upcoming', indexable: false, cancelled: false, entries: [],
    };
    const t = contestTexts(toCurrentContest(c));
    expect(t.en.finalDay).toBe('a Saturday in May');
    expect(t.el.cityFrom).toBe('από την Κοπεγχάγη');
    expect(t.en.host).toBe('');
    expect(t.en.lineup).toBe(0);
    expect(t.el.finalMonth).toBe('');
    expect(t.en.flag).toBe('🇩🇰');
  });
});
