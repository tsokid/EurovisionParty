-- 053_security_fixes.sql
-- Three targeted fixes from security review:
--
-- FIX 1: Clamp negative response_seconds in submit_quiz_answer.
--   A client sending a future p_question_opened_at got v_response_secs < 0,
--   which always satisfied the <= 3 tier and awarded 12 pts per correct answer.
--
-- FIX 2: Verify p_player_id belongs to auth.uid() in submit_quiz_answer.
--   SECURITY DEFINER bypasses RLS, so without this check any room member
--   could submit answers for another player — poisoning their UNIQUE slot
--   or awarding/denying points on their behalf.
--
-- FIX 3: Lock down rooms_update to host-only + REVOKE direct UPDATE.
--   The old policy allowed any room member to PATCH any rooms column
--   (phase, host_id, results_confirmed, password_hash, …) directly via
--   PostgREST. No client code ever does a direct rooms UPDATE — all
--   mutations go through SECURITY DEFINER RPCs — so revoking is safe.

-- ── FIX 1 + FIX 2: Updated submit_quiz_answer ────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_room_id            UUID,
  p_player_id          UUID,
  p_round_number       INT,
  p_question_id        INT,
  p_answer_index       INT,
  p_is_correct         BOOLEAN,      -- kept for API compat; value is IGNORED
  p_question_opened_at TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
  v_correct_index  INT;
  v_is_correct     BOOLEAN;
  v_answered_at    TIMESTAMPTZ;
  v_response_secs  NUMERIC(5,2);
  v_points         INT;
  v_answer_id      UUID;
BEGIN
  -- FIX 2: reject calls where the supplied player_id is not the caller's own.
  IF p_player_id != my_player_id(p_room_id) THEN
    RAISE EXCEPTION 'player_id does not belong to the calling user';
  END IF;

  v_answered_at   := NOW();
  v_response_secs := EXTRACT(EPOCH FROM (v_answered_at - p_question_opened_at));

  -- FIX 1: clamp both ends — future timestamp produces negative seconds,
  -- which would always satisfy the fastest-tier check (<= 3).
  IF v_response_secs > 16 THEN v_response_secs := 16; END IF;
  IF v_response_secs < 0  THEN v_response_secs := 16; END IF;

  -- Server-authoritative correctness: ignore client-supplied p_is_correct.
  SELECT correct_index INTO v_correct_index
    FROM public.quiz_questions WHERE id = p_question_id;

  v_is_correct := (v_correct_index IS NOT NULL AND p_answer_index = v_correct_index);

  -- Tier scoring: ≤3s = 12pts, ≤7s = 8pts, ≤15s = 4pts
  v_points := 0;
  IF v_is_correct THEN
    IF    v_response_secs <= 3  THEN v_points := 12;
    ELSIF v_response_secs <= 7  THEN v_points := 8;
    ELSIF v_response_secs <= 15 THEN v_points := 4;
    END IF;
  END IF;

  -- UNIQUE (player_id, question_id, round_number) prevents replay.
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

-- ── FIX 3: rooms_update — host-only + revoke direct UPDATE ───────────────────
DROP POLICY IF EXISTS rooms_update ON rooms;

-- Only the host may update the room row via RLS.
-- All legitimate mutations (phase advance, results confirmation, etc.) go
-- through SECURITY DEFINER RPCs that run as the function owner and bypass
-- both RLS and column privileges, so this does not break any game flow.
CREATE POLICY rooms_update ON rooms
  FOR UPDATE TO authenticated
  USING  (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Strip the broad table-level UPDATE so no client can PATCH sensitive columns
-- (host_id, phase, results_confirmed, password_hash, etc.) directly.
REVOKE UPDATE ON rooms FROM authenticated;
-- No column grants needed: no client code ever does a direct rooms UPDATE.
-- All room mutations are SECURITY DEFINER RPCs that bypass column privileges.
