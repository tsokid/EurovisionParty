import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MIX, NO_FILTERS, eraOf, filterQuestions, mixTotal, questionProblem, roundMix, type QuestionRow,
} from '../../src/admin/modules/questions/questionBank';

const row = (over: Partial<QuestionRow>): QuestionRow => ({
  id: 1, correct_index: 0, contest_year: 2026, iso: 'BG', topic: 'winner', difficulty: 'easy',
  question_en: 'Who won 2026?', question_el: 'Ποιος κέρδισε το 2026;',
  options_en: ['A', 'B', 'C', 'D'], options_el: ['Α', 'Β', 'Γ', 'Δ'],
  fact: '2026|BG|winner|winning country', source: 'https://example.test', note: null,
  lyric_check: false, time_sensitive: false, status: 'verified', verified_at: null, updated_at: '',
  ...over,
});

describe('question bank: eras (mirrors public.question_era)', () => {
  it('counts from the room year', () => {
    expect(eraOf(2026, 2026)).toBe('current');
    expect(eraOf(2025, 2026)).toBe('previous');
    expect(eraOf(2024, 2026)).toBe('recent');
    expect(eraOf(2021, 2026)).toBe('recent');
    expect(eraOf(2020, 2026)).toBe('classic');
    expect(eraOf(null, 2026)).toBe('classic');
    expect(eraOf(2027, 2026)).toBe('current');
  });
});

describe('question bank: round mix (mirrors public.quiz_round_mix)', () => {
  it('30/30/20/20 is 3/3/2/2', () => {
    expect(roundMix(DEFAULT_MIX)).toEqual({ current: 3, previous: 3, recent: 2, classic: 2 });
  });
  it('35/25/20/20 rounds to the newer era and adds up to 10', () => {
    const m = roundMix({ current: 35, previous: 25, recent: 20, classic: 20 });
    expect(m).toEqual({ current: 4, previous: 2, recent: 2, classic: 2 });
  });
  it('any round size adds up', () => {
    for (const size of [1, 3, 7, 10]) {
      const m = roundMix({ current: 33, previous: 33, recent: 17, classic: 17 }, size);
      expect(m.current + m.previous + m.recent + m.classic).toBe(size);
    }
  });
  it('totals the percentages', () => {
    expect(mixTotal(DEFAULT_MIX)).toBe(100);
  });
});

describe('question bank: save checks (mirror the 098 constraints)', () => {
  it('accepts a complete question', () => {
    expect(questionProblem(row({}))).toBeNull();
  });
  it('refuses missing text, repeated options, no fact, verified without a source', () => {
    expect(questionProblem(row({ question_el: ' ' }))).toBe('text');
    expect(questionProblem(row({ options_en: ['A', 'B', 'b ', 'D'] }))).toBe('options');
    expect(questionProblem(row({ options_el: ['Α', 'Β', 'Γ', ''] }))).toBe('options');
    expect(questionProblem(row({ fact: '' }))).toBe('fact');
    expect(questionProblem(row({ source: '' }))).toBe('source');
    expect(questionProblem(row({ source: '', status: 'draft' }))).toBeNull();
  });
});

describe('question bank: list filters', () => {
  const rows = [
    row({ id: 1 }),
    row({ id: 2, contest_year: 1974, iso: 'SE', topic: 'song', question_el: 'Το Waterloo;', status: 'draft', lyric_check: true }),
    row({ id: 3, contest_year: null, iso: null, topic: 'records', time_sensitive: true }),
  ];
  const ids = (f: Partial<typeof NO_FILTERS>) => filterQuestions(rows, { ...NO_FILTERS, ...f }, 2026).map((r) => r.id);
  it('filters by year, country, topic, status, era, flags and text', () => {
    expect(ids({})).toEqual([1, 2, 3]);
    expect(ids({ year: '1974' })).toEqual([2]);
    expect(ids({ year: 'none' })).toEqual([3]);
    expect(ids({ iso: 'none' })).toEqual([3]);
    expect(ids({ iso: 'BG' })).toEqual([1]);
    expect(ids({ topic: 'song' })).toEqual([2]);
    expect(ids({ status: 'draft' })).toEqual([2]);
    expect(ids({ era: 'classic' })).toEqual([2, 3]);
    expect(ids({ era: 'current' })).toEqual([1]);
    expect(ids({ flag: 'lyric' })).toEqual([2]);
    expect(ids({ flag: 'time' })).toEqual([3]);
    expect(ids({ q: 'waterloo' })).toEqual([2]);
  });
});
