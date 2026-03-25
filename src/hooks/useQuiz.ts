import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { QuizRound, QuestionAssignment, QuizAnswer } from '../lib/types';

interface UseQuizReturn {
  currentRound: QuizRound | null;
  questions: QuestionAssignment[];
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (idx: number) => void;
  submitAnswer: (
    playerId: string,
    questionId: number,
    answerIndex: number,
    isCorrect: boolean,
    questionOpenedAt: string,
    roomId?: string,
    roundNum?: number
  ) => Promise<QuizAnswer>;
  openRound: (
    roomId: string,
    roundNumber: number,
    questionIds: number[]
  ) => Promise<QuizRound>;
  fetchRound: (roomId: string, roundNumber: number) => Promise<void>;
  answeredQuestions: Set<number>;
  roundStatus: QuizRound['status'] | null;
  isLoading: boolean;
  error: string | null;
}

export function useQuiz(): UseQuizReturn {
  const [currentRound, setCurrentRound] = useState<QuizRound | null>(null);
  const [questions, setQuestions] = useState<QuestionAssignment[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Host: open a new round ---
  const openRound = useCallback(
    async (
      roomId: string,
      roundNumber: number,
      questionIds: number[]
    ): Promise<QuizRound> => {
      setIsLoading(true);
      setError(null);
      try {
        const now = new Date().toISOString();
        // Insert the quiz round
        const { data: roundData, error: roundErr } = await supabase
          .from('quiz_rounds')
          .insert({
            room_id: roomId,
            round_number: roundNumber,
            question_ids: questionIds,
            opened_at: now,
            status: 'active',
          })
          .select()
          .single();

        if (roundErr) throw roundErr;

        // Insert question assignments (one per question, with position)
        const assignments = questionIds.map((qId, idx) => ({
          room_id: roomId,
          question_id: qId,
          round_number: roundNumber,
          position: idx,
        }));

        const { error: assignErr } = await supabase
          .from('question_assignments')
          .insert(assignments);

        if (assignErr) throw assignErr;

        const round = roundData as QuizRound;
        setCurrentRound(round);
        setQuestions(
          assignments.map((a, i) => ({ id: `temp-${i}`, ...a })) as QuestionAssignment[]
        );
        setCurrentQuestionIndex(0);
        setAnsweredQuestions(new Set());

        return round;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to open round';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // --- Fetch existing round ---
  const fetchRound = useCallback(
    async (roomId: string, roundNumber: number): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch round
        const { data: roundData, error: roundErr } = await supabase
          .from('quiz_rounds')
          .select('*')
          .eq('room_id', roomId)
          .eq('round_number', roundNumber)
          .single();

        if (roundErr) throw roundErr;
        setCurrentRound(roundData as QuizRound);

        // Fetch question assignments sorted by position
        const { data: assignData, error: assignErr } = await supabase
          .from('question_assignments')
          .select('*')
          .eq('room_id', roomId)
          .eq('round_number', roundNumber)
          .order('position', { ascending: true });

        if (assignErr) throw assignErr;
        setQuestions((assignData ?? []) as QuestionAssignment[]);
        setCurrentQuestionIndex(0);

        // Fetch which questions the current player already answered
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get player id first
          const { data: playerRow } = await supabase
            .from('players')
            .select('id')
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .single();

          if (playerRow) {
            const { data: answers } = await supabase
              .from('quiz_answers')
              .select('question_id')
              .eq('player_id', playerRow.id)
              .eq('round_number', roundNumber);

            if (answers) {
              setAnsweredQuestions(new Set(answers.map((a) => a.question_id)));
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch round';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // --- Submit answer (server-side scoring via RPC) ---
  const submitAnswer = useCallback(
    async (
      playerId: string,
      questionId: number,
      answerIndex: number,
      isCorrect: boolean,
      questionOpenedAt: string,
      roomId?: string,
      roundNum?: number
    ): Promise<QuizAnswer> => {
      setError(null);
      try {
        const effectiveRoomId = roomId ?? currentRound?.room_id;
        const effectiveRoundNum = roundNum ?? currentRound?.round_number ?? 1;

        if (!effectiveRoomId) throw new Error('No room context');

        // Use server-side RPC for validated scoring
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('submit_quiz_answer', {
          p_room_id: effectiveRoomId,
          p_player_id: playerId,
          p_round_number: effectiveRoundNum,
          p_question_id: questionId,
          p_answer_index: answerIndex,
          p_is_correct: isCorrect,
          p_question_opened_at: questionOpenedAt,
        });

        if (rpcErr) throw rpcErr;

        const pointsAwarded = rpcResult?.points_awarded ?? 0;
        const responseSeconds = rpcResult?.response_seconds ?? 0;

        // Track locally
        setAnsweredQuestions((prev) => new Set(prev).add(questionId));

        return {
          id: rpcResult?.id ?? `local-${Date.now()}`,
          room_id: effectiveRoomId,
          player_id: playerId,
          round_number: effectiveRoundNum,
          question_id: questionId,
          answer_index: answerIndex,
          is_correct: isCorrect,
          question_opened_at: questionOpenedAt,
          answered_at: new Date().toISOString(),
          response_seconds: responseSeconds,
          points_awarded: pointsAwarded,
        } as QuizAnswer;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to submit answer';
        setError(message);
        throw err;
      }
    },
    [currentRound]
  );

  return {
    currentRound,
    questions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    submitAnswer,
    openRound,
    fetchRound,
    answeredQuestions,
    roundStatus: currentRound?.status ?? null,
    isLoading,
    error,
  };
}
