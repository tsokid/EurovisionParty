import { describe, it, expect } from 'vitest';
import { diffRuns, runWarnings, type ReportRow } from '../../src/admin/modules/parser/reportRules';

const URL27 = 'https://www.eurovision.com/eurovision-song-contest/burgas-2027/burgas-2027-grand-final/';
const p = (iso: string, artist = `${iso} a`, song = `${iso} s`): ReportRow => ({ iso, name: iso, artist, song });
const many = (n: number) => Array.from({ length: n }, (_, i) => p(`C${String(i).padStart(2, '0')}`));

describe('diffRuns', () => {
  it('reports nothing on the first run', () => {
    expect(diffRuns('participants', null, [p('GR')])).toEqual({ added: [], removed: [], changed: [] });
  });

  it('finds added, removed and changed countries', () => {
    const prev = [p('GR'), p('SE'), p('CY')];
    const cur = [p('GR', 'New artist'), p('SE'), p('IT')];
    expect(diffRuns('participants', prev, cur)).toEqual({
      added: ['IT'],
      removed: ['CY'],
      changed: [{ iso: 'GR', fields: ['artist'] }],
    });
  });

  it('compares place and points for results', () => {
    const prev: ReportRow[] = [{ iso: 'GR', place: 2, points: 300 }];
    const cur: ReportRow[] = [{ iso: 'GR', place: 1, points: 300 }];
    expect(diffRuns('results', prev, cur).changed).toEqual([{ iso: 'GR', fields: ['place'] }]);
  });
});

describe('runWarnings', () => {
  it('is quiet for a complete grand final of the right year', () => {
    expect(runWarnings('participants', 2027, URL27, many(25))).toEqual([]);
  });

  it('flags the pre-semi list: no songs and 35 countries', () => {
    const rows = many(35).map((r) => ({ ...r, artist: '', song: '' }));
    const w = runWarnings('participants', 2027, URL27, rows);
    expect(w[0]).toMatch(/^Χωρίς καλλιτέχνη ή τραγούδι: C00, C01/);
    expect(w[1]).toMatch(/35 χώρες/);
  });

  it('flags a page of another year and a non-final page', () => {
    const w = runWarnings('participants', 2027, 'https://www.eurovision.com/eurovision-song-contest/basel-2025/basel-2025-first-semi-final/', many(25));
    expect(w).toEqual([
      'Η σελίδα είναι για άλλη χρονιά (2025), όχι για το 2027.',
      'Η σελίδα δεν είναι του τελικού: οι γραμμές μπορεί να είναι από ημιτελικό ή από όλη τη λίστα συμμετοχών.',
    ]);
  });

  it('flags results outside the grand final, a wrong count and a shared place', () => {
    const rows: ReportRow[] = [
      { iso: 'GR', place: 1, points: 400 },
      { iso: 'SE', place: 1, points: 390 },
      { iso: 'XK', place: 3, points: 10 },
    ];
    expect(runWarnings('results', 2027, URL27, rows, ['GR', 'SE', 'CY', 'IT'])).toEqual([
      'Δεν είναι στον τελικό του 2027 (αγνοούνται): XK.',
      '3 αποτελέσματα για 4 φιναλίστ.',
      'Η ίδια θέση δύο φορές: 1.',
    ]);
  });
});
