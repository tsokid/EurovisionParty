import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  questions: [] as Row[],
  settings: { era_current: 30, era_previous: 30, era_recent: 20, era_classic: 20 } as Row,
  updates: [] as Array<{ table: string; values: Row }>,
  inserts: [] as Array<{ table: string; values: Row }>,
  writeError: null as { message: string } | null,
}));

vi.mock('../../src/lib/supabase', () => {
  const table = (name: string) => {
    const result = () => {
      if (name === 'quiz_questions') return h.questions;
      if (name === 'countries') return [{ iso: 'SE', name_el: 'Σουηδία' }, { iso: 'BG', name_el: 'Βουλγαρία' }];
      if (name === 'contests') return [{ year: 2026 }, { year: 1974 }];
      return [];
    };
    const chain: Record<string, unknown> = {
      select: () => chain, eq: () => chain, order: () => chain, not: () => chain,
      maybeSingle: () => Promise.resolve({ data: h.settings, error: null }),
      single: () => Promise.resolve(h.writeError ? { data: null, error: h.writeError } : { data: { id: 77 }, error: null }),
      update: (values: Row) => { h.updates.push({ table: name, values }); return chain; },
      insert: (values: Row) => { h.inserts.push({ table: name, values }); return chain; },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
        Promise.resolve({ data: result(), error: null }).then(ok, bad),
    };
    return chain;
  };
  return {
    supabase: {
      from: (name: string) => table(name),
      rpc: (name: string) => Promise.resolve({ data: name === 'live_contest_year' ? 2026 : null, error: null }),
    },
  };
});

import Questions from '../../src/admin/modules/questions/Questions';

const q = (over: Row): Row => ({
  id: 5, correct_index: 1, contest_year: 2026, iso: 'BG', topic: 'winner', difficulty: 'easy',
  question_en: 'Who won 2026?', question_el: 'Ποια χώρα κέρδισε το 2026;',
  options_en: ['Sweden', 'Bulgaria', 'Israel', 'Austria'], options_el: ['Σουηδία', 'Βουλγαρία', 'Ισραήλ', 'Αυστρία'],
  fact: '2026|BG|winner|winning country', source: 'https://example.test', note: null,
  lyric_check: false, time_sensitive: false, status: 'verified', verified_at: null, updated_at: '',
  ...over,
});

describe('Questions admin', () => {
  beforeEach(() => {
    h.questions = [q({}), q({ id: 21, contest_year: 1974, iso: 'SE', topic: 'lyrics', question_el: 'Συμπλήρωσε', status: 'draft', lyric_check: true, fact: 'x' })];
    h.updates = []; h.inserts = []; h.writeError = null;
  });

  it('shows the round mix first, with per-round counts and stock per era', async () => {
    render(<Questions />);
    const mix = await screen.findByRole('region', { name: 'Σύνθεση γύρου quiz' });
    expect(mix).toBeTruthy();
    await screen.findByText(/Ανά γύρο: 3 φέτος · 3 πέρυσι · 2 2–5 χρόνια · 2 5\+ χρόνια/);
    expect(screen.getByText(/Χρονιά παιχνιδιού σήμερα: 2026/)).toBeTruthy();
    expect(screen.getByText(/η χρονιά του δωματίου · 1 ελεγμένες/)).toBeTruthy();
  });

  it('refuses a mix that does not add up to 100, saves one that does', async () => {
    render(<Questions />);
    const current = await screen.findByLabelText(/^Φέτος \(%\)/);
    await waitFor(() => expect((current as HTMLInputElement).value).toBe('30'));
    fireEvent.change(current, { target: { value: '40' } });
    expect(screen.getByText(/Σύνολο 110%/)).toBeTruthy();
    const save = screen.getAllByRole('button', { name: 'Αποθήκευση' })[0] as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Πέρυσι \(%\)/), { target: { value: '20' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(h.updates).toHaveLength(1));
    expect(h.updates[0]).toEqual({ table: 'quiz_settings', values: { era_current: 40, era_previous: 20, era_recent: 20, era_classic: 20 } });
  });

  it('lists questions with their correct answer and flags, and filters them', async () => {
    render(<Questions />);
    await screen.findByText('Ποια χώρα κέρδισε το 2026;');
    expect(screen.getAllByText('Βουλγαρία').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Θέλει έλεγχο στίχου').length).toBeGreaterThan(0);
    expect(screen.getByText('2 από 2')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Σημάνσεις'), { target: { value: 'lyric' } });
    expect(screen.getByText('1 από 2')).toBeTruthy();
    expect(screen.queryByText('Ποια χώρα κέρδισε το 2026;')).toBeNull();
  });

  it('edits a question and reports a duplicate fact in plain words', async () => {
    render(<Questions />);
    fireEvent.click(await screen.findByText('Ποια χώρα κέρδισε το 2026;'));
    await screen.findByRole('region', { name: 'Ερώτηση #5' });
    h.writeError = { message: 'duplicate key value violates unique constraint "quiz_questions_fact_uniq"' };
    fireEvent.click(screen.getAllByRole('button', { name: 'Αποθήκευση' })[1]);
    await screen.findByText('Υπάρχει ήδη ζωντανή ερώτηση για αυτό το γεγονός.');
    expect(h.updates.at(-1)?.table).toBe('quiz_questions');
  });

  it('will not save a verified question without a source', async () => {
    render(<Questions />);
    fireEvent.click(await screen.findByRole('button', { name: /Νέα ερώτηση/ }));
    await screen.findByRole('region', { name: 'Νέα ερώτηση' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Αποθήκευση' })[1]);
    await screen.findByText('Γράψε την ερώτηση και στις δύο γλώσσες.');
    expect(h.inserts).toHaveLength(0);
  });
});
