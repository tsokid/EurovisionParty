import { describe, it, expect } from 'vitest';
import { compareText, sortKey } from '@/lib/seo/textSort';

describe('compareText (deterministic, no localeCompare)', () => {
  it('ignores diacritics and case', () => {
    expect(sortKey('Ελλάδα')).toBe('ελλαδα');
    expect(sortKey('Åland')).toBe('aland');
    expect(['Ισλανδία', 'Άγιος Μαρίνος', 'Ελλάδα', 'Αλβανία'].sort(compareText))
      .toEqual(['Άγιος Μαρίνος', 'Αλβανία', 'Ελλάδα', 'Ισλανδία']);
    expect(['sweden', 'Austria', 'Ålborg', 'belgium'].sort(compareText)).toEqual(['Ålborg', 'Austria', 'belgium', 'sweden']);
  });

  it('breaks ties on the original string, so the order is total', () => {
    expect(['é', 'e', 'E'].sort(compareText)).toEqual(['E', 'e', 'é']);
    expect(compareText('a', 'a')).toBe(0);
  });
});
