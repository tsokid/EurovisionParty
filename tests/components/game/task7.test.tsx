import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '../../../src/i18n';
import { useGameStore } from '../../../src/stores/gameStore';
import { calculateQuizPoints } from '../../../src/lib/scoringEngine';
import { calcDuelPoints } from '../../../src/hooks/useDuels';
import {
  duelAnswerChip, duelOutcome, duelRewardPreview, formatSeconds, needsRewardChoice, quizAnswerChip,
} from '../../../src/lib/answerPoints';
import { standingsMove } from '../../../src/lib/roundStandings';
import { quizChipView, duelChipView } from '../../../src/components/quiz/chipText';
import { PointsChip, PlayerAvatar } from '../../../src/components/stage';
import RoundResults from '../../../src/components/quiz/RoundResults';
import DuelResultCard from '../../../src/components/duels/DuelResultCard';
import TimerRing from '../../../src/components/quiz/TimerRing';
import { parseName, slugify, titleFrom } from '../../../scripts/avatars/import-avatars';
import type { Duel, DuelAnswer, Player, QuizAnswer, Room } from '../../../src/lib/types';

const reduced = vi.hoisted(() => ({ value: true }));
vi.mock('framer-motion', async (orig) => {
  const mod = await orig<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => reduced.value };
});

beforeAll(async () => { await i18n.changeLanguage('el'); });

const t = i18n.t.bind(i18n);

const player = (id: string, name: string, total: number, extra: Partial<Player> = {}): Player => ({
  id, room_id: 'r1', user_id: `u-${id}`, name, avatar_emoji: '🎤', avatar_id: null, country_flag: null,
  quiz_points: total, pred_points: 0, duel_points: 0, points_spent: 0, total_points: total,
  is_host: false, is_active: true, status: 'active', left_at: null, decline_count: 0,
  last_seen_at: '2026-05-16T18:00:00Z', joined_at: '2026-05-16T18:00:00Z', ...extra,
} as Player);

const room: Room = {
  id: 'r1', code: 'K3PW7X', host_id: 'u1', host_name: 'x', year: 2026, phase: 'pre_night', max_players: 20,
  quiz_rounds: 3, duel_limit: 10, created_at: '2026-05-16T18:00:00Z', phase_updated_at: null,
  quiz_opened_at: null, predictions_opened_at: null, predictions_locked_at: null,
  results_source: 'pending', results_confirmed: false, last_activity_at: '2026-05-16T18:00:00Z',
} as Room;

function quizRow(seconds: number, correct: boolean, points: number, answerIndex: number | null = 1): QuizAnswer {
  return {
    id: `a-${seconds}`, room_id: 'r1', player_id: 'me', round_number: 1, question_id: 1, answer_index: answerIndex,
    is_correct: correct, question_opened_at: '', answered_at: '', response_seconds: seconds, points_awarded: points,
  };
}

function chipText(points: number, reason: string) {
  const { container } = render(<PointsChip points={points} reason={reason} />);
  return container.textContent;
}

describe('quiz points chip shows the scored value', () => {
  it.each([
    [2.1, 12, '+12· 2,1″'],
    [5, 8, '+8· 5,0″'],
    [10, 4, '+4· 10,0″'],
  ])('%s″ → %s points', (secs, expected, text) => {
    // The server tiers (submit_quiz_answer, mirrored by calculateQuizPoints).
    const points = calculateQuizPoints(secs, true);
    expect(points).toBe(expected);
    const view = quizChipView(quizAnswerChip(quizRow(secs, true, points)), t, 'el');
    expect(view.points).toBe(expected);
    expect(chipText(view.points, view.reason)).toBe(text);
  });

  it('displays the server row as is and never re-scores it', () => {
    const view = quizChipView(quizAnswerChip(quizRow(2.1, true, 8)), t, 'el');
    expect(view).toEqual({ points: 8, reason: '2,1″' });
  });

  it('wrong and timed-out answers show 0 with the reason', () => {
    expect(quizChipView(quizAnswerChip(quizRow(4, false, 0)), t, 'el')).toEqual({ points: 0, reason: 'λάθος' });
    expect(quizChipView(quizAnswerChip(quizRow(16, false, 0, -1)), t, 'el')).toEqual({ points: 0, reason: 'χρόνος' });
  });

  it('rounds the time up to the tenth so it stays on the same side of a tier', () => {
    expect(formatSeconds(3.04, 'el')).toBe('3,1″');
    expect(formatSeconds(3, 'el')).toBe('3,0″');
    expect(formatSeconds(2.96, 'en')).toBe('3.0″');
    expect(formatSeconds(2.96, 'el', 'floor')).toBe('2,9″');
  });
});

describe('duel chips, steal cap, double, tie', () => {
  const ans = (ms: number, points: number, answerIndex = 0): DuelAnswer => ({ questionId: 1, answerIndex, answeredAt: '', responseMs: ms, points });

  it('a correct answer is 12 − seconds, shown as "+10 · 12−2"', () => {
    const points = calcDuelPoints(2100, true);
    expect(points).toBe(10);
    const view = duelChipView(duelAnswerChip(ans(2100, points), true), t);
    expect(view).toEqual({ points: 10, reason: '12−2' });
    expect(chipText(view.points, view.reason)).toBe('+10· 12−2');
    expect(duelChipView(duelAnswerChip(ans(4000, 0), false), t)).toEqual({ points: 0, reason: 'λάθος' });
    expect(duelChipView(duelAnswerChip(ans(12500, 0, -1), false), t)).toEqual({ points: 0, reason: 'χρόνος' });
  });

  it('steal is capped at the other side’s total (apply_duel_decision)', () => {
    expect(duelRewardPreview(26, 100).steal).toBe(26);
    expect(duelRewardPreview(26, 10).steal).toBe(10);
    expect(duelRewardPreview(26, 0)).toMatchObject({ steal: 0, canSteal: false });
    expect(duelRewardPreview(26, -5)).toMatchObject({ steal: 0, canSteal: false });
  });

  it('double is twice the duel score', () => {
    expect(duelRewardPreview(26, 0).double).toBe(52);
    expect(duelRewardPreview(7, 300).double).toBe(14);
  });

  it('a tie has no winner and no chooser', () => {
    const tie = { status: 'tie' as const, winner_id: null, loser_id: null, winner_decision: null };
    expect(duelOutcome(tie, 'me')).toBe('tie');
    expect(needsRewardChoice(tie, 'me')).toBe(false);
    const won = { status: 'completed' as const, winner_id: 'me', loser_id: 'op', winner_decision: null };
    expect(needsRewardChoice(won, 'me')).toBe(true);
    expect(needsRewardChoice(won, 'op')).toBe(false);
    expect(needsRewardChoice({ ...won, winner_decision: 'steal' as const }, 'me')).toBe(false);
  });
});

function duel(partial: Partial<Duel>): Duel {
  return {
    id: 'd1', room_id: 'r1', challenger_id: 'me', challenged_id: 'op', question_id: null, question_ids: [1, 2, 3],
    status: 'completed', created_at: '', accepted_at: null, expires_at: null, completed_at: '',
    challenger_answer: null, challenger_answered_at: null, challenged_answer: null, challenged_answered_at: null,
    challenger_answers: [], challenged_answers: [], challenger_score: 26, challenged_score: 12,
    winner_id: 'me', loser_id: 'op', points_transferred: 0, is_rematch: false, parent_duel_id: null,
    winner_decision: null, decision_made_at: null, ...partial,
  };
}

describe('<DuelResultCard>', () => {
  beforeEach(() => {
    const st = useGameStore.getState();
    st.reset();
    st.setRoom(room);
    st.setPlayer(player('me', 'Douze Points', 100));
    st.setPlayers([player('me', 'Douze Points', 100), player('op', 'Key Change', 10)]);
  });

  it('the winner gets both cards with the exact copy, steal capped, double 2×', () => {
    render(<DuelResultCard duel={duel({})} onDecision={() => {}} />);
    expect(screen.getByText('Κλέψε ή διπλασίασε τους πόντους που κέρδισες')).toBeInTheDocument();
    const steal = screen.getByRole('button', { name: /Κλέψε/ });
    const double = screen.getByRole('button', { name: /Διπλασίασε/ });
    expect(within(steal).getByText('10')).toBeInTheDocument(); // min(26, 10)
    expect(within(double).getByText('52')).toBeInTheDocument(); // 26 × 2
  });

  it('a tie renders no chooser', () => {
    render(<DuelResultCard duel={duel({ status: 'tie', winner_id: null, loser_id: null, challenged_score: 26 })} onDecision={() => {}} />);
    expect(screen.queryByRole('button', { name: /Κλέψε/ })).toBeNull();
    expect(screen.queryByText('Κλέψε ή διπλασίασε τους πόντους που κέρδισες')).toBeNull();
    expect(screen.getAllByText('Ισοπαλία').length).toBeGreaterThan(0);
  });

  it('after the choice it shows the server’s points_transferred', () => {
    render(<DuelResultCard duel={duel({ winner_decision: 'steal', points_transferred: 9 })} />);
    expect(screen.getByText('Κλοπή · +9 σε εσένα')).toBeInTheDocument();
  });
});

describe('round end', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const st = useGameStore.getState();
    st.reset();
    st.setRoom(room);
    st.setPlayer(player('me', 'Lady Televote', 209));
    st.setPlayers([
      player('a', 'Douze Points', 214), player('me', 'Lady Televote', 209),
      player('b', 'Key Change', 176), player('c', 'Wind Machine', 98),
    ]);
  });

  it('tallies the server points, shows the formula and a neutral overtake toast', () => {
    const answers = [quizRow(2.1, true, 12), quizRow(5.4, true, 8), quizRow(4, false, 0), quizRow(9.6, true, 4)];
    render(
      <RoundResults roundNumber={1} answers={answers} questions={[]} onContinue={() => {}} isLastRound={false}
        standingsBefore={[{ id: 'a', total: 214 }, { id: 'me', total: 170 }, { id: 'b', total: 176 }, { id: 'c', total: 98 }]} />,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText('+24')).toBeInTheDocument();
    expect(screen.getByText('1×12 + 1×8 + 1×4 = 24')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Πέρασες: Key Change');
    expect(document.body.textContent).not.toMatch(/Πρωταθλητ|Κλέφτ|Μονομάχ|Μάντ|Γκουρού/);
    expect(document.body.textContent).not.toMatch(/(ο|η|τον|την|του|της) (Key|Douze|Wind|Lady)/);
    vi.useRealTimers();
  });

  it('standingsMove finds who was passed', () => {
    const m = standingsMove([{ id: 'x', total: 50 }, { id: 'me', total: 40 }], [{ id: 'x', total: 50 }, { id: 'me', total: 60 }], 'me');
    expect(m.overtaken).toEqual(['x']);
    expect(m.delta('me')).toBe(1);
  });
});

describe('timer ring', () => {
  it('turns to the warning state in the last 5″', () => {
    const { container, rerender } = render(<TimerRing seconds={15} remaining={6} />);
    expect(container.querySelector('.qz-ring.warn')).toBeNull();
    rerender(<TimerRing seconds={15} remaining={5} />);
    expect(container.querySelector('.qz-ring.warn')).not.toBeNull();
  });
});

describe('avatar viewer', () => {
  it('opens, closes with Esc and backdrop, and never renders a real name', async () => {
    // A row that (wrongly) carries a real name: the viewer only ever takes the stage name.
    const row = { ...player('p', 'Glitter Bomb', 0, { avatar_id: 'av-05' }), real_name: 'Μαρία Παπαδοπούλου' } as Player & { real_name: string };
    render(<PlayerAvatar name={row.name} avatarId={row.avatar_id} />);
    const btn = screen.getByRole('button', { name: 'Δες το avatar: Glitter Bomb' });
    fireEvent.click(btn);
    const dialog = screen.getByRole('dialog', { name: 'Avatar: Glitter Bomb' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Glitter Bomb')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Μαρία Παπαδοπούλου');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Κλείσιμο' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(btn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('avatar-viewer-backdrop'));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('interactive={false} renders a plain avatar (no nested button)', () => {
    render(<PlayerAvatar name="Key Change" interactive={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('import-avatars naming', () => {
  it('derives ids and titles from file names', () => {
    expect(parseName('01_disco_commander.png')).toEqual({ id: 'img-01', num: 1, title: 'Disco Commander' });
    expect(parseName('28_techno_dj.png').title).toBe('Techno DJ');
    expect(parseName('49_Wild_Dance_Captain.png')).toMatchObject({ id: 'img-49', title: 'Wild Dance Captain' });
    expect(parseName('Ντίβα των Πούλιων.webp')).toMatchObject({ id: 'img-ntiva-ton-poulion', num: null, title: 'Ντίβα των Πούλιων' });
    expect(slugify('Ούζο Pop!')).toBe('ouzo-pop');
    expect(titleFrom('ice_diva')).toBe('Ice Diva');
  });
});
