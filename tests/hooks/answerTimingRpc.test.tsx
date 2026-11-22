// The quiz and duel submit hooks send the device-measured reaction time
// (p_response_ms, migration 083) and fall back to the old signature when the
// database does not have 083 yet (PostgREST PGRST202).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const state = vi.hoisted(() => ({
  results: [] as { data?: unknown; error: unknown }[],
  calls: [] as { name: string; args: Record<string, unknown> }[],
}));

vi.mock('../../src/lib/supabase', () => {
  const chain = {
    select: () => chain, eq: () => chain, order: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    then: (f: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(f),
  };
  return {
    supabase: {
      rpc: (name: string, args: Record<string, unknown>) => {
        state.calls.push({ name, args });
        return Promise.resolve(state.results.shift() ?? { data: null, error: null });
      },
      from: () => chain,
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: () => {},
    },
  };
});

import { useQuiz } from '../../src/hooks/useQuiz';
import { useDuels } from '../../src/hooks/useDuels';
import type { DuelAnswer } from '../../src/lib/types';

beforeEach(() => {
  state.results = [];
  state.calls = [];
});

const OPENED = '2026-05-16T18:00:00.000Z';

describe('useQuiz.submitAnswer', () => {
  it('sends p_response_ms (rounded) and returns the server score', async () => {
    state.results = [{ data: { id: 'a1', points_awarded: 12, response_seconds: 2.1, is_correct: true }, error: null }];
    const { result } = renderHook(() => useQuiz());
    let row: Awaited<ReturnType<typeof result.current.submitAnswer>> | undefined;
    await act(async () => { row = await result.current.submitAnswer('p1', 7, 2, true, OPENED, 'r1', 1, 2100.4); });
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].name).toBe('submit_quiz_answer');
    expect(state.calls[0].args).toMatchObject({ p_question_opened_at: OPENED, p_response_ms: 2100 });
    expect(row).toMatchObject({ points_awarded: 12, response_seconds: 2.1 });
  });

  it('without a measured time, calls the legacy signature', async () => {
    const { result } = renderHook(() => useQuiz());
    await act(async () => { await result.current.submitAnswer('p1', 7, 2, true, OPENED, 'r1', 1, null); });
    expect(state.calls[0].args).not.toHaveProperty('p_response_ms');
  });

  it('PGRST202 (database before 083) → retries once without p_response_ms', async () => {
    state.results = [
      { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
      { data: { id: 'a1', points_awarded: 8, response_seconds: 4.2, is_correct: true }, error: null },
    ];
    const { result } = renderHook(() => useQuiz());
    await act(async () => { await result.current.submitAnswer('p1', 7, 2, true, OPENED, 'r1', 1, 1000); });
    expect(state.calls).toHaveLength(2);
    expect(state.calls[0].args).toHaveProperty('p_response_ms', 1000);
    expect(state.calls[1].args).not.toHaveProperty('p_response_ms');
  });

  it('any other error is not retried', async () => {
    state.results = [{ data: null, error: { code: 'P0001', message: 'player_id does not belong to the calling user' } }];
    const { result } = renderHook(() => useQuiz());
    await act(async () => {
      await expect(result.current.submitAnswer('p1', 7, 2, true, OPENED, 'r1', 1, 1000)).rejects.toBeTruthy();
    });
    expect(state.calls).toHaveLength(1);
  });
});

describe('useDuels.submitDuelAnswers', () => {
  const answers: DuelAnswer[] = [
    { questionId: 1, answerIndex: 0, answeredAt: OPENED, responseMs: 2100, points: 10 },
    { questionId: 2, answerIndex: 1, answeredAt: OPENED, responseMs: 400.6, points: 12 },
    { questionId: 3, answerIndex: -1, answeredAt: OPENED, responseMs: 12000, points: 0 },
  ];

  it('sends one p_response_ms per answer, in order', async () => {
    const { result } = renderHook(() => useDuels('r1'));
    await act(async () => { await result.current.submitDuelAnswers('d1', 'p1', answers); });
    expect(state.calls[0]).toMatchObject({
      name: 'submit_duel_answers',
      args: { p_duel_id: 'd1', p_player_id: 'p1', p_total_score: 22, p_response_ms: [2100, 401, 12000] },
    });
  });

  it('PGRST202 → retries with the legacy arguments', async () => {
    state.results = [{ error: { code: 'PGRST202', message: 'Could not find the function' } }, { error: null }];
    const { result } = renderHook(() => useDuels('r1'));
    await act(async () => { await result.current.submitDuelAnswers('d1', 'p1', answers); });
    expect(state.calls).toHaveLength(2);
    expect(state.calls[1].args).not.toHaveProperty('p_response_ms');
    expect(state.calls[1].args).toMatchObject({ p_total_score: 22 });
  });
});
