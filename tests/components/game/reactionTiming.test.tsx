// The reaction timer and the question card. Since 099 the server serves
// every question and keeps the clock: the card in server mode reports the
// pick and reveals only when the server says which option was right.
import type React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../src/i18n';
import { createReactionTimer, isMissingRpcSignature } from '../../../src/lib/reactionTimer';
import QuestionCard, { ENTRANCE_FALLBACK_MS } from '../../../src/components/quiz/QuestionCard';
import DuelPlayScreen from '../../../src/components/duels/DuelPlayScreen';
import type { Duel, DuelAnswer, QuizQuestion } from '../../../src/lib/types';

const h = vi.hoisted(() => ({ next: vi.fn(), answer: vi.fn() }));
vi.mock('../../../src/lib/servedQuestions', async (orig) => {
  const mod = await orig<typeof import('../../../src/lib/servedQuestions')>();
  return { ...mod, duelNext: h.next, duelAnswer: h.answer };
});

// framer's frame loop does not advance under jsdom + fake timers, so enter /
// exit animations never report completion here. AnimatePresence becomes a
// pass-through (the next question mounts at once) and ENTRANCE_FALLBACK_MS is
// what unlocks the answers: the same gate the real entrance-complete opens.
vi.mock('framer-motion', async (orig) => {
  const mod = await orig<typeof import('framer-motion')>();
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return { ...mod, useReducedMotion: () => true, AnimatePresence: Passthrough };
});

beforeAll(async () => { await i18n.changeLanguage('el'); });

describe('createReactionTimer', () => {
  it('measures start → stop with the injected clock and freezes at stop', () => {
    let t = 1000;
    const r = createReactionTimer(() => t);
    expect(r.started).toBe(false);
    expect(r.stop()).toBeNull();
    expect(r.elapsed()).toBeNull();
    r.start();
    t = 3100.4;
    expect(r.elapsed()).toBe(2100);
    expect(r.stop()).toBe(2100);
    t = 9000; // the reveal / advance / network after the tap do not count
    expect(r.stop()).toBe(2100);
    expect(r.elapsed()).toBe(2100);
  });

  it('a second start() does not move the start point; reset() clears it', () => {
    let t = 0;
    const r = createReactionTimer(() => t);
    r.start();
    t = 500;
    r.start();
    t = 1500;
    expect(r.stop()).toBe(1500);
    r.reset();
    expect(r.started).toBe(false);
    expect(r.stop()).toBeNull();
    t = 2000;
    r.start();
    t = 2250;
    expect(r.stop()).toBe(250);
  });

  it('never returns a negative time', () => {
    let t = 100;
    const r = createReactionTimer(() => t);
    r.start();
    t = 50;
    expect(r.stop()).toBe(0);
  });

  it('defaults to performance.now', () => {
    const spy = vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValueOnce(4210);
    const r = createReactionTimer();
    r.start();
    expect(r.stop()).toBe(4200);
    spy.mockRestore();
  });

  it('isMissingRpcSignature recognises PostgREST PGRST202 only', () => {
    expect(isMissingRpcSignature({ code: 'PGRST202' })).toBe(true);
    expect(isMissingRpcSignature({ code: 'P0001' })).toBe(false);
    expect(isMissingRpcSignature(null)).toBe(false);
  });
});

// Fake timers and performance.now on one clock: the reaction timer reads the
// same time the test advances.
function useFakeClock() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
}

const Q: QuizQuestion = {
  id: 9001, question: 'Which city?', question_el: 'Ποια πόλη;',
  options: ['Vienna', 'Basel', 'Malmö', 'Turin'], options_el: ['Βιέννη', 'Βασιλεία', 'Μάλμε', 'Τορίνο'],
  correct_index: 1, category: 'history', difficulty: 'easy',
};
const SERVED: QuizQuestion = { ...Q, correct_index: -1 };
const answerButtons = () => screen.getAllByRole('button').filter((b) => b.classList.contains('qz-ans'));

describe('QuestionCard: answers unlock only after the entrance', () => {
  useFakeClock();

  it('buttons are disabled and taps ignored until interactive; onInteractive fires once', () => {
    const onInteractive = vi.fn();
    const onSelect = vi.fn();
    const onAnswer = vi.fn();
    render(
      <QuestionCard question={Q} questionIndex={0} totalQuestions={3} onAnswer={onAnswer}
        onSelect={onSelect} onInteractive={onInteractive} timeRemaining={15} />,
    );
    expect(answerButtons()).toHaveLength(4);
    for (const b of answerButtons()) expect(b).toBeDisabled();
    fireEvent.click(screen.getByText('Βασιλεία'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onInteractive).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(ENTRANCE_FALLBACK_MS); });
    expect(onInteractive).toHaveBeenCalledTimes(1);
    for (const b of answerButtons()) expect(b).toBeEnabled();

    fireEvent.click(screen.getByText('Βασιλεία'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onInteractive).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(1, true);
  });
});

describe('QuestionCard in server mode: no answer in the browser', () => {
  useFakeClock();

  it('reports the pick as the server option index and reveals only when the server answers', () => {
    const onPick = vi.fn();
    const onAnswer = vi.fn();
    const { rerender } = render(
      <QuestionCard question={SERVED} questionIndex={0} totalQuestions={10} onAnswer={onAnswer}
        onPick={onPick} correctIndex={null} timeRemaining={15} />,
    );
    act(() => { vi.advanceTimersByTime(ENTRANCE_FALLBACK_MS); });
    fireEvent.click(screen.getByText('Μάλμε'));
    expect(onPick).toHaveBeenCalledWith(2);
    act(() => { vi.advanceTimersByTime(5000); });
    // No verdict yet: nothing is revealed and nothing moves on.
    expect(screen.queryByRole('status')).toBeNull();
    expect(onAnswer).not.toHaveBeenCalled();

    rerender(
      <QuestionCard question={SERVED} questionIndex={0} totalQuestions={10} onAnswer={onAnswer}
        onPick={onPick} correctIndex={1} timeRemaining={15} />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/Λάθος|Λαθος|wrong/i);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onAnswer).toHaveBeenCalledWith(2, false);
  });

  it('a timeout reports null and reveals the server answer', () => {
    const onPick = vi.fn();
    const onAnswer = vi.fn();
    const { rerender } = render(
      <QuestionCard question={SERVED} questionIndex={0} totalQuestions={10} onAnswer={onAnswer}
        onPick={onPick} correctIndex={null} timeRemaining={0} />,
    );
    expect(onPick).toHaveBeenCalledWith(null);
    rerender(
      <QuestionCard question={SERVED} questionIndex={0} totalQuestions={10} onAnswer={onAnswer}
        onPick={onPick} correctIndex={1} timeRemaining={0} />,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onAnswer).toHaveBeenCalledWith(-1, false);
  });
});

describe('DuelPlayScreen: the server serves and scores each question', () => {
  useFakeClock();

  const duel = { id: 'd1', room_id: 'r1', challenger_id: 'a', challenged_id: 'me', status: 'accepted', question_ids: [] } as unknown as Duel;
  const serveAt = (position: number) => ({
    finished: false as const, serveId: `s${position}`, position,
    question: { ...SERVED, id: 9000 + position },
    deadlineMs: Date.now() + 12_000, timerMs: 12_000,
  });

  beforeEach(() => {
    h.next.mockReset();
    h.answer.mockReset();
    let pos = 0;
    h.next.mockImplementation(async () => (pos >= 3 ? { finished: true } : serveAt(++pos)));
    h.answer.mockImplementation(async (_serve: string, idx: number | null) => ({
      isCorrect: idx === 1, timedOut: idx == null, correctIndex: 1,
      points: idx === 1 ? 10 : 0, responseSeconds: 2.1, responseMs: 2100,
    }));
  });

  it('sends each pick to the server and finishes after the third, with the server points', async () => {
    const onComplete = vi.fn<(a: DuelAnswer[]) => void>();
    render(<DuelPlayScreen duel={duel} playerId="me" onComplete={onComplete} onCancel={() => {}} />);
    for (const pick of ['Βασιλεία', 'Βιέννη', 'Βασιλεία']) {
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      await act(async () => { await vi.advanceTimersByTimeAsync(ENTRANCE_FALLBACK_MS); });
      fireEvent.click(screen.getByText(pick));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(h.answer.mock.calls.map((c) => c[1])).toEqual([1, 0, 1]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const answers = onComplete.mock.calls[0][0];
    expect(answers.map((a) => a.points)).toEqual([10, 0, 10]);
    expect(answers.map((a) => a.correct)).toEqual([true, false, true]);
  });
});
