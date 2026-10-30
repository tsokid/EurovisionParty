import { describe, it, expect } from 'vitest';
import contestIndex from '../../../content/contests/index.json';
import { songsItemList } from '@/pages/contest/hub';
import { cityName, CITY_EL, formatDate, formatDayPair, greekCountrySubject, hubCopy, hubFacts } from '@/pages/contest/content/hubCopy';
import { visibleTable } from '@/pages/contest/table';
import contest2026 from '../../../content/contests/2026.json';
import type { ContestSnapshot } from '@/content/contests/types';

const c2026 = contest2026 as ContestSnapshot;

describe('cityName', () => {
  it('maps 2026 (vienna) to Βιέννη with its preposition', () => {
    expect(cityName('el', c2026.city_slug, c2026.city)).toEqual({ name: 'Βιέννη', in: 'στη Βιέννη' });
  });

  it('falls back to the English name when the city is not in the map', () => {
    expect(cityName('el', 'atlantis', 'Atlantis')).toEqual({ name: 'Atlantis', in: 'στο Atlantis' });
    expect(cityName('en', 'vienna', 'Vienna')).toEqual({ name: 'Vienna', in: 'in Vienna' });
  });
});

describe('CITY_EL', () => {
  it('has a Greek name for every host city in the snapshot', () => {
    const slugs = [...new Set(Object.values(contestIndex).map((c) => c.city_slug))];
    expect(slugs.length).toBeGreaterThan(40);
    for (const slug of slugs) expect(CITY_EL[slug], slug).toBeDefined();
  });
});

describe('songsItemList', () => {
  it('skips entries without a song title', () => {
    const entries = c2026.entries.slice(0, 3).map((e, i) => (i === 1 ? { ...e, song: null } : e));
    const list = songsItemList(entries, 'Songs');
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(list.itemListElement.map((i) => i.item.name)).toEqual([entries[0].song, entries[2].song]);
  });
});

describe('dates', () => {
  it('formats ISO dates in each locale without Intl', () => {
    expect(formatDate('2026-05-16', 'en')).toBe('16 May 2026');
    expect(formatDate('2026-05-16', 'el')).toBe('16 Μαΐου 2026');
  });

  it('collapses a same-month pair', () => {
    expect(formatDayPair('2026-05-12', '2026-05-14', 'en')).toBe('12 and 14 May');
    expect(formatDayPair('2026-05-12', '2026-05-14', 'el')).toBe('12 και 14 Μαΐου');
    expect(formatDayPair('2026-04-30', '2026-05-02', 'en')).toBe('30 April and 2 May');
  });
});

describe('greekCountrySubject', () => {
  it('uses the right article', () => {
    expect(greekCountrySubject('BG', 'Βουλγαρία')).toBe('Η Βουλγαρία');
    expect(greekCountrySubject('IL', 'Ισραήλ')).toBe('Το Ισραήλ');
    expect(greekCountrySubject('SM', 'Άγιος Μαρίνος')).toBe('Ο Άγιος Μαρίνος');
  });
});

describe('hubCopy', () => {
  it('builds the winner callout from data in both locales', () => {
    expect(hubCopy.en.winner(hubFacts(c2026, 'en'))).toBe('Bulgaria won Eurovision 2026 with 516 points');
    expect(hubCopy.el.winner(hubFacts(c2026, 'el'))).toBe('Η Βουλγαρία κέρδισε τη Eurovision 2026 με 516 βαθμούς');
  });

  it('copes with a contest that has no dates or results yet', () => {
    const bare: ContestSnapshot = {
      ...c2026, stage: 'upcoming', dates: { semi1: null, semi2: null, final: null },
      entries: c2026.entries.map((e) => ({ ...e, final_place: null, total_points: null, jury_points: null, televote_points: null, semi_place: null, semi_points: null, qualified: null, in_final: false })),
    };
    for (const locale of ['en', 'el'] as const) {
      const f = hubFacts(bare, locale);
      expect(f.winner).toBeNull();
      const c = hubCopy[locale];
      for (const text of [c.hub.description(f), c.schedule.description(f), c.semis.description(f), c.songs.description(f)]) {
        expect(text).not.toMatch(/null|undefined|NaN/);
      }
    }
  });
});

describe('visibleTable', () => {
  it('drops columns where no row has a value', () => {
    const rows = [{ a: 1, b: null }, { a: 2, b: null }];
    const t = visibleTable(rows, [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
    ]);
    expect(t.headers).toEqual(['A']);
    expect(t.rows).toEqual([[1], [2]]);
  });

  it('renders a dash for a missing value in a visible column', () => {
    const t = visibleTable([{ a: 1 }, { a: null }], [{ header: 'A', value: (r) => r.a, align: 'right' }]);
    expect(t.rows).toEqual([[1], ['—']]);
    expect(t.align).toEqual(['right']);
  });
});
