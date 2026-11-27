// The quiz with the server as referee (099): where the player is comes from
// the server, a returning player sees the round and question and presses
// Start, the first question of a round is served only after its intro, and
// the verdict (with the correct option) comes from the server's reply.
import type React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../src/i18n';
import { useGameStore } from '../../../src/stores/gameStore';
import type { Player, Room } from '../../../src/lib/types';

vi.mock('framer-motion', async (orig) => {
  const mod = await orig<typeof import('framer-motion')>();
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return { ...mod, useReducedMotion: () => true, AnimatePresence: Passthrough };
});

const h = vi.hoisted(() => ({ state: vi.fn(), next: vi.fn(), answer: vi.fn() }));
vi.mock('../../../src/lib/servedQuestions', async (orig) => {
  const mod = await orig<typeof import('../../../src/lib/servedQuestions')>();
  return { ...mod, quizState: h.state, quizNext: h.next, quizAnswer: h.answer };
});
vi.mock('../../../src/lib/supabase', () => {
  const chain: Record<string, unknown> = {
    select: () => chain, eq: () => chain, order: () => chain,
    then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
  };
  return { supabase: { from: () => chain, rpc: vi.fn() } };
});

import QuizScreen from '../../../src/components/quiz/QuizScreen';
import { ENTRANCE_FALLBACK_MS } from '../../../src/components/quiz/QuestionCard';

const served = (position: number) => ({
  serveId: `s${position}`, position, round: 1,
  question: {
    id: 100 + position, question: `Question ${position}?`, question_el: `Ερώτηση ${position};`,
    options: ['A', 'B', 'C', 'D'], options_el: ['Α', 'Β', 'Γ', 'Δ'], correct_index: -1, category: '', difficulty: 'easy' as const,
  },
  deadlineMs: Date.now() + 15_000, timerMs: 15_000,
});

beforeAll(async () => { await i18n.changeLanguage('el'); });

beforeEach(() => {
  h.state.mockReset(); h.next.mockReset(); h.answer.mockReset();
  useGameStore.setState({
    room: { id: 'r1' } as Room,
    player: { id: 'p1', name: 'Π', total_points: 0, quiz_points: 0 } as Player,
    players: [{ id: 'p1', name: 'Π', total_points: 0, quiz_points: 0, is_active: true } as Player],
    quizProgress: null,
  });
});

describe('QuizScreen, served by the server', () => {
  it('a returning player sees the round and question, and Start resumes without the intro', async () => {
    h.state.mockResolvedValue({ round: 2, position: 4, answered: 3, done: false, open: null });
    h.next.mockResolvedValue({ ...served(4), round: 2 });
    render(<QuizScreen />);
    expect(await screen.findByTestId('quiz-resume')).toHaveTextContent('Γύρο 2, ερώτηση 4 από 10');
    fireEvent.click(screen.getByRole('button', { name: /Έναρξη/ }));
    await screen.findByText('Ερώτηση 4;');
    expect(h.next).toHaveBeenCalledWith('r1', 2);
  });

  it('a fresh round serves its first question only after the intro', async () => {
    h.state.mockResolvedValue({ round: 1, position: 1, answered: 0, done: false, open: null });
    h.next.mockResolvedValue(served(1));
    render(<QuizScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Γύρο 1/ }));
    expect(h.next).not.toHaveBeenCalled();
  });

  it('the pick goes to the server; the verdict and the right option come from its reply', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    try {
      h.state.mockResolvedValue({ round: 1, position: 2, answered: 1, done: false, open: null });
      h.next.mockResolvedValueOnce(served(2)).mockResolvedValueOnce(served(3));
      h.answer.mockResolvedValue({ isCorrect: true, timedOut: false, correctIndex: 2, points: 12, responseSeconds: 2.1 });
      render(<QuizScreen />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(screen.getByRole('button', { name: /Έναρξη/ }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      await act(async () => { await vi.advanceTimersByTimeAsync(ENTRANCE_FALLBACK_MS); });
      fireEvent.click(screen.getByText('Γ'));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(h.answer).toHaveBeenCalledWith('s2', 2);
      expect(screen.getByRole('status')).toHaveTextContent(/Σωστ/);
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(h.next).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Ερώτηση 3;')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a finished quiz shows the completion, not a start button', async () => {
    h.state.mockResolvedValue({ round: 3, position: 10, answered: 10, done: true, open: null });
    render(<QuizScreen />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('button', { name: /Γύρο 1/ })).toBeNull();
    expect(h.next).not.toHaveBeenCalled();
  });
});
