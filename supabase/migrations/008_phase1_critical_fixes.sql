-- ============================================================
-- 008: Phase 1 Critical Fixes
-- 1. Fix apply_duel_decision (was writing to GENERATED column)
-- 2. Add server-side duel completion function (race condition fix)
-- 3. Add server-side quiz answer validation
-- 4. Add spend_points alias for IntelMarket
-- ============================================================

-- ============================================================
-- FIX 1: apply_duel_decision - only write to duel_points, NOT total_points
-- total_points is GENERATED ALWAYS AS (quiz_points + pred_points + duel_points - points_spent)
-- ============================================================
CREATE OR REPLACE FUNCTION apply_duel_decision(
  p_duel_id UUID,
  p_decision TEXT,
  p_player_id UUID
) RETURNS VOID AS $$
DECLARE
  v_duel RECORD;
  v_winner_score INT;
  v_loser_id UUID;
  v_loser_total_points INT;
  v_actual_steal INT;
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id;

  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;

  IF v_duel.winner_id != p_player_id THEN
    RAISE EXCEPTION 'Only the winner can make the decision';
  END IF;

  IF v_duel.winner_decision IS NOT NULL THEN
    RAISE EXCEPTION 'Decision already made';
  END IF;

  -- Get winner's score from this duel
  IF v_duel.challenger_id = p_player_id THEN
    v_winner_score := v_duel.challenger_score;
    v_loser_id := v_duel.challenged_id;
  ELSE
    v_winner_score := v_duel.challenged_score;
    v_loser_id := v_duel.challenger_id;
  END IF;

  IF p_decision = 'steal' THEN
    -- Check loser's total_points (this is the generated column, read-only)
    SELECT total_points INTO v_loser_total_points FROM players WHERE id = v_loser_id;
    v_actual_steal := LEAST(v_winner_score, GREATEST(0, v_loser_total_points));

    IF v_actual_steal <= 0 THEN
      RAISE EXCEPTION 'Opponent has no points to steal';
    END IF;

    -- Only update duel_points (NOT total_points — it's generated)
    UPDATE players SET duel_points = duel_points + v_actual_steal WHERE id = p_player_id;
    UPDATE players SET duel_points = duel_points - v_actual_steal WHERE id = v_loser_id;

    UPDATE duels SET winner_decision = 'steal',
                     decision_made_at = NOW(),
                     points_transferred = v_actual_steal
    WHERE id = p_duel_id;

  ELSIF p_decision = 'double' THEN
    -- Winner gets double their score via duel_points
    UPDATE players SET duel_points = duel_points + (v_winner_score * 2) WHERE id = p_player_id;

    UPDATE duels SET winner_decision = 'double',
                     decision_made_at = NOW(),
                     points_transferred = v_winner_score * 2
    WHERE id = p_duel_id;

  ELSE
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 2: Server-side duel answer submission + auto-completion
-- This prevents the race condition where both players submit simultaneously
-- and both see opponentAnswered = false
-- ============================================================
CREATE OR REPLACE FUNCTION submit_duel_answers(
  p_duel_id UUID,
  p_player_id UUID,
  p_answers JSONB,     -- array of {questionId, answerIndex, answeredAt, responseMs, points}
  p_total_score INT
) RETURNS JSONB AS $$
DECLARE
  v_duel RECORD;
  v_is_challenger BOOLEAN;
  v_opponent_answered BOOLEAN;
  v_opponent_score INT;
  v_opponent_total_ms NUMERIC;
  v_my_total_ms NUMERIC;
  v_winner_id UUID;
  v_loser_id UUID;
  v_result JSONB;
BEGIN
  -- Lock the duel row to prevent race condition
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;

  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;

  IF v_duel.status NOT IN ('accepted', 'answering') THEN
    RAISE EXCEPTION 'Duel is not in answerable state: %', v_duel.status;
  END IF;

  v_is_challenger := (v_duel.challenger_id = p_player_id);

  -- Check player hasn't already answered
  IF v_is_challenger AND v_duel.challenger_answers IS NOT NULL THEN
    RAISE EXCEPTION 'You already submitted answers';
  END IF;
  IF NOT v_is_challenger AND v_duel.challenged_answers IS NOT NULL THEN
    RAISE EXCEPTION 'You already submitted answers';
  END IF;

  -- Check if opponent already answered
  IF v_is_challenger THEN
    v_opponent_answered := (v_duel.challenged_answers IS NOT NULL);
    v_opponent_score := COALESCE(v_duel.challenged_score, 0);
  ELSE
    v_opponent_answered := (v_duel.challenger_answers IS NOT NULL);
    v_opponent_score := COALESCE(v_duel.challenger_score, 0);
  END IF;

  -- Write our answers
  IF v_is_challenger THEN
    UPDATE duels SET
      challenger_answers = p_answers,
      challenger_score = p_total_score,
      status = CASE WHEN v_opponent_answered THEN 'completed' ELSE 'answering' END
    WHERE id = p_duel_id;
  ELSE
    UPDATE duels SET
      challenged_answers = p_answers,
      challenged_score = p_total_score,
      status = CASE WHEN v_opponent_answered THEN 'completed' ELSE 'answering' END
    WHERE id = p_duel_id;
  END IF;

  -- If both have answered, determine winner
  IF v_opponent_answered THEN
    -- Calculate total response time for tiebreaking
    SELECT COALESCE(SUM((elem->>'responseMs')::numeric), 0) INTO v_my_total_ms
    FROM jsonb_array_elements(p_answers) AS elem;

    IF v_is_challenger THEN
      SELECT COALESCE(SUM((elem->>'responseMs')::numeric), 0) INTO v_opponent_total_ms
      FROM jsonb_array_elements(v_duel.challenged_answers) AS elem;
    ELSE
      SELECT COALESCE(SUM((elem->>'responseMs')::numeric), 0) INTO v_opponent_total_ms
      FROM jsonb_array_elements(v_duel.challenger_answers) AS elem;
    END IF;

    -- Determine winner
    v_winner_id := NULL;
    v_loser_id := NULL;

    IF p_total_score > v_opponent_score THEN
      v_winner_id := p_player_id;
      v_loser_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
    ELSIF p_total_score < v_opponent_score THEN
      v_winner_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
      v_loser_id := p_player_id;
    ELSE
      -- Tie: faster total time wins
      IF v_my_total_ms < v_opponent_total_ms THEN
        v_winner_id := p_player_id;
        v_loser_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
      ELSIF v_my_total_ms > v_opponent_total_ms THEN
        v_winner_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
        v_loser_id := p_player_id;
      END IF;
      -- Perfect tie: both null
    END IF;

    UPDATE duels SET
      winner_id = v_winner_id,
      loser_id = v_loser_id,
      completed_at = NOW(),
      status = 'completed'
    WHERE id = p_duel_id;
  END IF;

  v_result := jsonb_build_object(
    'completed', v_opponent_answered,
    'winner_id', v_winner_id,
    'loser_id', v_loser_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 3: Server-side quiz answer with score validation
-- Validates response time and calculates points server-side
-- ============================================================
CREATE OR REPLACE FUNCTION submit_quiz_answer(
  p_room_id UUID,
  p_player_id UUID,
  p_round_number INT,
  p_question_id INT,
  p_answer_index INT,
  p_is_correct BOOLEAN,
  p_question_opened_at TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
  v_answered_at TIMESTAMPTZ;
  v_response_seconds NUMERIC(5,2);
  v_points INT;
  v_answer_id UUID;
BEGIN
  v_answered_at := NOW();
  v_response_seconds := EXTRACT(EPOCH FROM (v_answered_at - p_question_opened_at));

  -- Reject if more than 16 seconds (server-side enforcement)
  IF v_response_seconds > 16 THEN
    v_response_seconds := 16;
    -- Still allow submission but with 0 points
  END IF;

  -- Server-side scoring: tier1 (0-3s) = 12pts, tier2 (3-7s) = 8pts, tier3 (7-15s) = 4pts
  v_points := 0;
  IF p_is_correct THEN
    IF v_response_seconds <= 3 THEN
      v_points := 12;
    ELSIF v_response_seconds <= 7 THEN
      v_points := 8;
    ELSIF v_response_seconds <= 15 THEN
      v_points := 4;
    END IF;
  END IF;

  -- Insert answer (UNIQUE constraint prevents double-submit)
  INSERT INTO quiz_answers (room_id, player_id, round_number, question_id,
    answer_index, is_correct, question_opened_at, answered_at, response_seconds, points_awarded)
  VALUES (p_room_id, p_player_id, p_round_number, p_question_id,
    p_answer_index, p_is_correct, p_question_opened_at, v_answered_at, v_response_seconds, v_points)
  RETURNING id INTO v_answer_id;

  -- Increment player quiz points
  IF v_points > 0 THEN
    UPDATE players SET quiz_points = quiz_points + v_points WHERE id = p_player_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_answer_id,
    'points_awarded', v_points,
    'response_seconds', v_response_seconds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 4: Add spend_points alias (IntelMarket calls spend_points, DB has spend_intel_points)
-- ============================================================
CREATE OR REPLACE FUNCTION spend_points(p_player_id UUID, p_points INT)
RETURNS VOID AS $$
BEGIN
  UPDATE players SET points_spent = points_spent + p_points WHERE id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % not found', p_player_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
