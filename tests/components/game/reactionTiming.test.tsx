// Quiz and duel answers are timed from "answers tappable" to the tap, on the
// device (performance.now), not from when the question was scheduled to the
// moment the answer reached the server 2.5 s after the tap.
import type React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../src/i18n';
import { createReactionTimer, isMissingRpcSignature } from '../../../src/lib/reactionTimer';
import QuestionCard, { ENTRANCE_FALLBACK_MS } from '../../../src/components/quiz/QuestionCard';
import DuelPlayScreen, { DUEL_CHIP_HOLD_MS } from '../../../src/components/duels/DuelPlayScreen';
import { QUESTIONS_BY_ID, QUESTIONS } from '../../../src/lib/questions';
import { getLocalizedQuestion } from '../../../src/lib/questionLocale';
import type { Duel, DuelAnswer } from '../../../src/lib/types';

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

const Q = QUESTIONS[20];
const rightText = () => getLocalizedQuestion(Q).options[Q.correct_index];
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
    expect(answerButtons()).toHaveLength(Q.options.length);
    for (const b of answerButtons()) expect(b).toBeDisabled();
    fireEvent.click(screen.getByText(rightText()));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onInteractive).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(ENTRANCE_FALLBACK_MS); });
    expect(onInteractive).toHaveBeenCalledTimes(1);
    for (const b of answerButtons()) expect(b).toBeEnabled();

    fireEvent.click(screen.getByText(rightText()));
    expect(onSelect).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onInteractive).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(Q.correct_index, true);
  });
});

describe('DuelPlayScreen: points use the tap time, not the 2.5 s reveal', () => {
  useFakeClock();

  const duel = {
    id: 'd1', room_id: 'r1', challenger_id: 'a', challenged_id: 'me', status: 'accepted',
    question_ids: [QUESTIONS[20].id, QUESTIONS[21].id, QUESTIONS[22].id],
  } as unknown as Duel;

  it('2.1 s after the answers unlock → responseMs 2100, 12 − 2 = 10; the delays before do not count', () => {
    const onComplete = vi.fn<(a: DuelAnswer[]) => void>();
    render(<DuelPlayScreen duel={duel} playerId="me" onComplete={onComplete} onCancel={() => {}} />);

    for (const [i, reactMs] of [[0, 2100], [1, 400], [2, 11_200]] as const) {
      const q = QUESTIONS_BY_ID.get(duel.question_ids[i])!;
      // The question is on screen but still entering: no clock yet.
      act(() => { vi.advanceTimersByTime(ENTRANCE_FALLBACK_MS); });
      act(() => { vi.advanceTimersByTime(reactMs); });
      fireEvent.click(screen.getByText(getLocalizedQuestion(q).options[q.correct_index]));
      // reveal 500 + advance 2000 + chip hold
      act(() => { vi.advanceTimersByTime(500); });
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(DUEL_CHIP_HOLD_MS); });
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    const answers = onComplete.mock.calls[0][0];
    expect(answers.map((a) => a.responseMs)).toEqual([2100, 400, 11_200]);
    expect(answers.map((a) => a.points)).toEqual([10, 12, 1]);
  });

  it('a timeout is scored as the full 12 s and 0 points', () => {
    const onComplete = vi.fn<(a: DuelAnswer[]) => void>();
    render(<DuelPlayScreen duel={duel} playerId="me" onComplete={onComplete} onCancel={() => {}} />);
    act(() => { vi.advanceTimersByTime(ENTRANCE_FALLBACK_MS); });
    for (let s = 0; s < 12; s++) act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(DUEL_CHIP_HOLD_MS); });
    // The second question is now entering; its clock has not started.
    expect(screen.getAllByRole('button').filter((b) => b.classList.contains('qz-ans')).every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
