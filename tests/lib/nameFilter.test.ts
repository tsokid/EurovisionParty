import { describe, it, expect } from 'vitest';
import { checkStageName, validateName, validateRealName, REAL_NAME_LIMITS } from '../../src/lib/nameFilter';

describe('validateRealName (secret real name: required, 1–50, filtered)', () => {
  it('accepts 1 to 50 characters, Greek or Latin', () => {
    expect(validateRealName('Ά')).toBeNull();
    expect(validateRealName('Μαρία Παπαδοπούλου')).toBeNull();
    expect(validateRealName('x'.repeat(REAL_NAME_LIMITS.max))).toBeNull();
  });
  it('requires a non-blank value', () => {
    expect(validateRealName('')).toBe('tooShort');
    expect(validateRealName('   ')).toBe('tooShort');
  });
  it('rejects more than 50 characters', () => {
    expect(validateRealName('x'.repeat(51))).toBe('tooLong');
  });
  it('runs the profanity filter', () => {
    expect(validateRealName('fuck')).toBe('blocked');
    expect(validateRealName('μαλάκ')).toBe('blocked');
    expect(validateRealName('sh1t')).toBe('blocked');
  });
  it('trims before measuring', () => {
    expect(validateRealName('  Νίκη  ')).toBeNull();
  });
});

describe('stage name rules are unchanged', () => {
  it('2–20 characters, filtered', () => {
    expect(checkStageName('A')).toBe('tooShort');
    expect(checkStageName('x'.repeat(21))).toBe('tooLong');
    expect(checkStageName('Ντίσκο Μπάλα')).toBeNull();
    expect(validateName('A')).toBe('Name must be at least 2 characters');
    expect(validateName('nazi')).toBe('Please choose a different name');
    expect(validateName('Ντίσκο')).toBeNull();
  });
});
