import { describe, it, expect } from 'vitest';
import { participantsProblem, type ParsedEntry } from '../../supabase/functions/eurovision-parse/parse';

const ISOS = ['AL','AM','AU','AT','AZ','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GE','DE','GR','IS','IE','IL','IT','LV','LT','LU','MT','MD','ME','NL','MK','NO','PL','PT','RO','SM','RS'];
const line = (n: number, blank: string[] = []): ParsedEntry[] =>
  ISOS.slice(0, n).map((iso) => ({
    iso, name: iso, artist: blank.includes(iso) ? '' : `${iso} artist`, song: `${iso} song`, runningOrder: null,
  }));

describe('participantsProblem (rule C)', () => {
  it('accepts a complete grand final of 20 to 27 countries', () => {
    expect(participantsProblem(line(20))).toBeNull();
    expect(participantsProblem(line(25))).toBeNull();
    expect(participantsProblem(line(27))).toBeNull();
  });

  it('blocks the pre-semi list of every entrant (35 countries)', () => {
    expect(participantsProblem(line(35))).toMatch(/35 countries parsed/);
  });

  it('blocks too few countries', () => {
    expect(participantsProblem(line(19))).toMatch(/19 countries parsed/);
  });

  it('blocks a country without artist or song, naming it', () => {
    expect(participantsProblem(line(25, ['GR', 'SE']))).toBe('no artist or song for GR');
    const blankSong = line(25).map((e) => (e.iso === 'CY' ? { ...e, song: '  ' } : e));
    expect(participantsProblem(blankSong)).toBe('no artist or song for CY');
  });
});
