// The end-of-round animation plays once (23 Nov 2026): once it has started,
// even if the player saw only half of it, coming back to the quiz shows the
// final numbers at once, with no replay.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import i18n from '../../../src/i18n';
import { useGameStore } from '../../../src/stores/gameStore';
import RoundResults from '../../../src/components/quiz/RoundResults';
import { quizEndKey } from '../../../src/lib/playedOnce';
import type { Player, QuizAnswer, Room } from '../../../src/lib/types';

vi.mock('framer-motion', async (orig) => {
  const mod = await orig<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => true };
});

beforeAll(async () => { await i18n.changeLanguage('el'); });

const player = (id: string, name: string, total: number): Player => ({
  id, room_id: 'r1', user_id: `u-${id}`, name, avatar_emoji: '🎤', avatar_id: null, country_flag: null,
  quiz_points: total, pred_points: 0, duel_points: 0, points_spent: 0, total_points: total,
  is_host: false, is_active: true, status: 'active', left_at: null, decline_count: 0,
  last_seen_at: '2026-05-16T18:00:00Z', joined_at: '2026-05-16T18:00:00Z',
} as Player);

const room = { id: 'r1', code: 'K3PW7X' } as Room;

const row = (s: number, correct: boolean, points: number): QuizAnswer => ({
  id: `a-${s}`, room_id: 'r1', player_id: 'me', round_number: 1, question_id: 1, answer_index: 1,
  is_correct: correct, question_opened_at: '', answered_at: '', response_seconds: s, points_awarded: points,
});

const answers = [row(2.1, true, 12), row(5.4, true, 8), row(4, false, 0)];
const before = [{ id: 'a', total: 214 }, { id: 'me', total: 170 }, { id: 'b', total: 176 }];

function mount() {
  return render(
    <RoundResults roundNumber={1} answers={answers} questions={[]} onContinue={() => {}} isLastRound={false}
      standingsBefore={before} />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  const st = useGameStore.getState();
  st.reset();
  st.setRoom(room);
  st.setPlayer(player('me', 'Lady Televote', 190));
  st.setPlayers([player('a', 'Douze Points', 214), player('me', 'Lady Televote', 190), player('b', 'Key Change', 176)]);
});
afterEach(() => { vi.useRealTimers(); });

describe('end of a quiz round plays once', () => {
  it('the first time it animates, and it counts as seen as soon as it starts', () => {
    const { unmount } = mount();
    expect(screen.queryByRole('status')).toBeNull();
    expect(localStorage.getItem(quizEndKey('r1', 'me', 1))).toBe('1');
    act(() => { vi.advanceTimersByTime(300); }); // left halfway
    unmount();
  });

  it('coming back after half of it shows the end state at once', () => {
    const first = mount();
    act(() => { vi.advanceTimersByTime(300); });
    first.unmount();

    mount();
    // No time passes: the final numbers and the overtake toast are already there.
    expect(screen.getByText('1×12 + 1×8 = 20')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Πέρασες: Key Change');
  });

  it('another round still animates', () => {
    localStorage.setItem(quizEndKey('r1', 'me', 1), '1');
    render(
      <RoundResults roundNumber={2} answers={answers.map((a) => ({ ...a, round_number: 2 }))} questions={[]}
        onContinue={() => {}} isLastRound={false} standingsBefore={before} />,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
