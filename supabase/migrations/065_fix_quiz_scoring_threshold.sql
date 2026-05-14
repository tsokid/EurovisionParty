-- 065_fix_quiz_scoring_threshold.sql
-- The RPC awarded 4pts only for ≤15s correct answers, giving 0pts for answers
-- between 15s and 16s.  With a 500ms startup delay + network latency, correct
-- answers legitimately arrive at 15.x–16s and were silently penalised.
--
-- Fix: drop the ≤15 upper bound — any correct answer slower than 7s gets 4pts.
-- The clamp (v_response_secs capped at 16) still prevents absurd values.

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_room_id            UUID,
  p_player_id          UUID,
  p_round_number       INT,
  p_question_id        INT,
  p_answer_index       INT,
  p_is_correct         BOOLEAN,
  p_question_opened_at TIMESTAMPTZ
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
  v_response_secs := EXTRACT(EPOCH FROM (v_answered_at - p_question_opened_at));

  IF v_response_secs > 16 THEN v_response_secs := 16; END IF;
  IF v_response_secs < 0  THEN v_response_secs := 16; END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
