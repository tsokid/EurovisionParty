-- ============================================================
-- 009: Fix function overload conflicts
-- ============================================================

-- Drop the old VARCHAR version of apply_duel_decision (from migration 006)
-- Keep only the TEXT version (from migration 008)
DROP FUNCTION IF EXISTS apply_duel_decision(UUID, VARCHAR, UUID);

-- Also fix submit_duel_answers: the check for "already submitted" was checking
-- if challenger_answers IS NOT NULL, but JSONB columns default to NULL so this should work.
-- The actual issue is the duel status: we insert with status='pending' then update to 'accepted',
-- but the test was inserting directly with status='accepted'. Let's also ensure the function
-- handles the 'pending' -> 'accepted' transition properly and the answering check uses
-- the JSONB array length instead.

CREATE OR REPLACE FUNCTION submit_duel_answers(
  p_duel_id UUID,
  p_player_id UUID,
  p_answers JSONB,
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

  -- Check player hasn't already answered (check JSONB array length > 0)
  IF v_is_challenger AND v_duel.challenger_answers IS NOT NULL AND jsonb_array_length(v_duel.challenger_answers) > 0 THEN
    RAISE EXCEPTION 'You already submitted answers';
  END IF;
  IF NOT v_is_challenger AND v_duel.challenged_answers IS NOT NULL AND jsonb_array_length(v_duel.challenged_answers) > 0 THEN
    RAISE EXCEPTION 'You already submitted answers';
  END IF;

  -- Check if opponent already answered
  IF v_is_challenger THEN
    v_opponent_answered := (v_duel.challenged_answers IS NOT NULL AND jsonb_array_length(COALESCE(v_duel.challenged_answers, '[]'::jsonb)) > 0);
    v_opponent_score := COALESCE(v_duel.challenged_score, 0);
  ELSE
    v_opponent_answered := (v_duel.challenger_answers IS NOT NULL AND jsonb_array_length(COALESCE(v_duel.challenger_answers, '[]'::jsonb)) > 0);
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

  -- Initialize winner/loser to NULL
  v_winner_id := NULL;
  v_loser_id := NULL;

  -- If both have answered, determine winner
  IF v_opponent_answered THEN
    SELECT COALESCE(SUM((elem->>'responseMs')::numeric), 0) INTO v_my_total_ms
    FROM jsonb_array_elements(p_answers) AS elem;

    IF v_is_challenger THEN
      SELECT COALESCE(SUM((elem->>'responseMs')::numeric), 0) INTO v_opponent_total_ms
      FROM jsonb_array_elements(v_duel.challenged_answers) AS elem;
    ELSE
      SELECT COALESCE(SUM((elem->>'responseMs')::numeric), 0) INTO v_opponent_total_ms
      FROM jsonb_array_elements(v_duel.challenger_answers) AS elem;
    END IF;

    IF p_total_score > v_opponent_score THEN
      v_winner_id := p_player_id;
      v_loser_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
    ELSIF p_total_score < v_opponent_score THEN
      v_winner_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
      v_loser_id := p_player_id;
    ELSE
      IF v_my_total_ms < v_opponent_total_ms THEN
        v_winner_id := p_player_id;
        v_loser_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
      ELSIF v_my_total_ms > v_opponent_total_ms THEN
        v_winner_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
        v_loser_id := p_player_id;
      END IF;
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
