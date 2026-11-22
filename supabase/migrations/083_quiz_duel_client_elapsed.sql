-- 083_quiz_duel_client_elapsed.sql
-- Score quiz and duel answers by the player's real reaction time.
--
-- Until now the quiz scored `NOW() − p_question_opened_at`: the server clock
-- minus a timestamp taken on the phone. Measured on the real code path, a tap
-- 1.0 s after the answers became tappable was scored as 4.2 s (+8 instead of
-- +12) even in the gallery, which has no network and no clock offset:
--   +0.65 s  question_opened_at was taken before the answers were on screen
--            (0.35 s before they were in the DOM, 0.30 s of entrance animation)
--   +2.53 s  the RPC is called after the reveal (500 ms) and auto-advance
--            (2000 ms) delays that follow the tap, so NOW() lands 2.5 s late
-- On a real device, add the request's one-way latency (~0.1–0.3 s) and the
-- phone's clock offset from the server (any sign, often ±1 s; this dev
-- machine was ~1.1 s behind). A phone clock ahead of the server made the
-- difference negative, which the clamp below turned into 16 s (4 points).
-- Duels computed points on the client the same late way (+2.5 s plus ~0.3 s).
--
-- Fix: the client measures the reaction time itself with performance.now(),
-- from the moment the answers are visible and enabled to the tap, and sends
-- it as p_response_ms. The server clamps it and scores by it.
--
-- TRUST: the reaction time is reported by the client. For a casual party game
-- that is acceptable (a determined cheater could already pick correct answers
-- from the bundled question bank); the clamp bounds it to the question's own
-- window, so a forged value can at most claim the fastest tier.
--
-- Backward compatible: p_response_ms defaults to NULL, and NULL keeps the
-- previous behaviour exactly, so clients built before this migration keep
-- working unchanged. New clients retry without it on PGRST202, so they also
-- work against a database that does not have this migration yet.
--
-- Rules (unchanged):
--   quiz  15 s per question; correct ≤ 3 s = 12, ≤ 7 s = 8, later = 4
--   duel  correct = 12 − floor(seconds taken), 0 when wrong or timed out
--
-- Bodies are copied from the latest definitions (quiz: 065, duel: 028) with
-- only the timing changes marked "083". The old signatures are dropped so a
-- call with or without p_response_ms resolves to exactly one function.

begin;

-- ── Quiz ────────────────────────────────────────────────────────────────

drop function if exists public.submit_quiz_answer(uuid, uuid, int, int, int, boolean, timestamptz);

create or replace function public.submit_quiz_answer(
  p_room_id            UUID,
  p_player_id          UUID,
  p_round_number       INT,
  p_question_id        INT,
  p_answer_index       INT,
  p_is_correct         BOOLEAN,
  p_question_opened_at TIMESTAMPTZ,
  p_response_ms        INT DEFAULT NULL   -- 083: client-measured reaction time
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_index  INT;
  v_is_correct     BOOLEAN;
  v_answered_at    TIMESTAMPTZ;
  v_response_secs  NUMERIC(5,2);
  v_points         INT;
  v_answer_id      UUID;
BEGIN
  IF p_player_id != my_player_id(p_room_id) THEN
    RAISE EXCEPTION 'player_id does not belong to the calling user';
  END IF;

  v_answered_at   := NOW();

  IF p_response_ms IS NOT NULL THEN
    -- 083: trusted client timing (casual party game), clamped to
    -- [0, 16000] ms: the 15 s question plus the same 1 s slack as before.
    -- Rounded UP to the hundredth so the stored value never lands on the
    -- faster side of a tier boundary (3001 ms → 3.01 s → 8 points).
    v_response_secs := CEIL(LEAST(GREATEST(p_response_ms, 0), 16000) / 10.0) / 100.0;
  ELSE
    -- Legacy path (clients before 083), unchanged.
    v_response_secs := EXTRACT(EPOCH FROM (v_answered_at - p_question_opened_at));

    IF v_response_secs > 16 THEN v_response_secs := 16; END IF;
    IF v_response_secs < 0  THEN v_response_secs := 16; END IF;
  END IF;

  SELECT correct_index INTO v_correct_index
    FROM public.quiz_questions WHERE id = p_question_id;

  v_is_correct := (v_correct_index IS NOT NULL AND p_answer_index = v_correct_index);

  -- Tier scoring: ≤3s = 12pts, ≤7s = 8pts, else = 4pts
  -- No upper bound on the slow tier — network/startup latency means correct
  -- answers can legitimately arrive past 15s and still deserve 4pts.
  v_points := 0;
  IF v_is_correct THEN
    IF    v_response_secs <= 3 THEN v_points := 12;
    ELSIF v_response_secs <= 7 THEN v_points := 8;
    ELSE                             v_points := 4;
    END IF;
  END IF;

  INSERT INTO quiz_answers (
    room_id, player_id, round_number, question_id,
    answer_index, is_correct, question_opened_at,
    answered_at, response_seconds, points_awarded
  ) VALUES (
    p_room_id, p_player_id, p_round_number, p_question_id,
    p_answer_index, v_is_correct, p_question_opened_at,
    v_answered_at, v_response_secs, v_points
  ) RETURNING id INTO v_answer_id;

  IF v_points > 0 THEN
    UPDATE players SET quiz_points = quiz_points + v_points WHERE id = p_player_id;
  END IF;

  RETURN jsonb_build_object(
    'id',               v_answer_id,
    'points_awarded',   v_points,
    'response_seconds', v_response_secs,
    'is_correct',       v_is_correct
  );
END;
$$;

grant execute on function public.submit_quiz_answer(uuid, uuid, int, int, int, boolean, timestamptz, int) to authenticated;

-- ── Duel ────────────────────────────────────────────────────────────────

drop function if exists public.submit_duel_answers(uuid, uuid, jsonb, int);

create or replace function public.submit_duel_answers(
  p_duel_id     UUID,
  p_player_id   UUID,
  p_answers     JSONB,
  p_total_score INT,
  p_response_ms INT[] DEFAULT NULL   -- 083: client-measured reaction time per answer, in p_answers order
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- 083: pinned (028 had none); every object used lives in public
AS $$
DECLARE
  v_duel RECORD;
  v_is_challenger BOOLEAN;
  v_opponent_answered BOOLEAN;
  v_opponent_score INT;
  v_winner_id UUID;
  v_loser_id UUID;
  v_final_status TEXT;
  v_answers JSONB;   -- 083
  v_score   INT;     -- 083
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;

  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;

  IF v_duel.status NOT IN ('accepted', 'answering') THEN
    RAISE EXCEPTION 'Duel is not in answerable state: %', v_duel.status;
  END IF;

  v_is_challenger := (v_duel.challenger_id = p_player_id);

  IF v_is_challenger AND v_duel.challenger_answers IS NOT NULL AND jsonb_array_length(v_duel.challenger_answers) > 0 THEN
    RAISE EXCEPTION 'You already submitted answers';
  END IF;
  IF NOT v_is_challenger AND v_duel.challenged_answers IS NOT NULL AND jsonb_array_length(v_duel.challenged_answers) > 0 THEN
    RAISE EXCEPTION 'You already submitted answers';
  END IF;

  -- 083: with client timings, the server scores each answer itself:
  -- correct (answerIndex = quiz_questions.correct_index) earns
  -- 12 − floor(ms / 1000), with ms trusted from the client (casual party
  -- game) but clamped to the duel's [0, 12000] ms window. The stored answer
  -- carries the clamped responseMs and the server's points, and the score is
  -- their sum (p_total_score is ignored). Without timings: legacy, the
  -- client's answers and total are stored as sent.
  IF p_response_ms IS NOT NULL THEN
    IF jsonb_typeof(p_answers) <> 'array'
       OR COALESCE(array_length(p_response_ms, 1), 0) <> jsonb_array_length(p_answers) THEN
      RAISE EXCEPTION 'p_response_ms must have one entry per answer';
    END IF;

    SELECT COALESCE(jsonb_agg(e.a || jsonb_build_object('responseMs', s.ms, 'points', s.pts) ORDER BY e.ord), '[]'::jsonb),
           COALESCE(SUM(s.pts), 0)::INT
      INTO v_answers, v_score
      FROM jsonb_array_elements(p_answers) WITH ORDINALITY AS e(a, ord)
      LEFT JOIN public.quiz_questions qq
             ON qq.id = (e.a ->> 'questionId')::INT
      CROSS JOIN LATERAL (
        SELECT LEAST(GREATEST(COALESCE(p_response_ms[e.ord], 12000), 0), 12000) AS ms
      ) m
      CROSS JOIN LATERAL (
        SELECT m.ms,
               CASE WHEN qq.correct_index IS NOT NULL
                         AND (e.a ->> 'answerIndex')::INT = qq.correct_index
                    THEN GREATEST(0, 12 - m.ms / 1000)   -- INT division = floor
                    ELSE 0
               END AS pts
      ) s;
  ELSE
    v_answers := p_answers;
    v_score   := p_total_score;
  END IF;

  IF v_is_challenger THEN
    v_opponent_answered := (v_duel.challenged_answers IS NOT NULL AND jsonb_array_length(COALESCE(v_duel.challenged_answers, '[]'::jsonb)) > 0);
    v_opponent_score := COALESCE(v_duel.challenged_score, 0);
  ELSE
    v_opponent_answered := (v_duel.challenger_answers IS NOT NULL AND jsonb_array_length(COALESCE(v_duel.challenger_answers, '[]'::jsonb)) > 0);
    v_opponent_score := COALESCE(v_duel.challenger_score, 0);
  END IF;

  -- Write our answers (interim status while opponent still has to answer)
  IF v_is_challenger THEN
    UPDATE duels SET
      challenger_answers = v_answers,
      challenger_score = v_score,
      status = CASE WHEN v_opponent_answered THEN 'completed' ELSE 'answering' END
    WHERE id = p_duel_id;
  ELSE
    UPDATE duels SET
      challenged_answers = v_answers,
      challenged_score = v_score,
      status = CASE WHEN v_opponent_answered THEN 'completed' ELSE 'answering' END
    WHERE id = p_duel_id;
  END IF;

  v_winner_id := NULL;
  v_loser_id := NULL;
  v_final_status := 'completed';

  -- If both have answered, decide outcome by total score only.
  -- Equal totals → tie. No winner. No points changed hands.
  IF v_opponent_answered THEN
    IF v_score > v_opponent_score THEN
      v_winner_id := p_player_id;
      v_loser_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
    ELSIF v_score < v_opponent_score THEN
      v_winner_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
      v_loser_id := p_player_id;
    ELSE
      v_final_status := 'tie';
    END IF;

    UPDATE duels SET
      winner_id = v_winner_id,
      loser_id = v_loser_id,
      completed_at = NOW(),
      status = v_final_status
    WHERE id = p_duel_id;
  END IF;

  RETURN jsonb_build_object(
    'winner_id', v_winner_id,
    'loser_id', v_loser_id,
    'status', v_final_status,
    'opponent_answered', v_opponent_answered,
    'score', v_score   -- 083: the score as stored
  );
END;
$$;

grant execute on function public.submit_duel_answers(uuid, uuid, jsonb, int, int[]) to authenticated;

commit;

-- PostgREST caches function signatures; pick up the new ones.
notify pgrst, 'reload schema';
