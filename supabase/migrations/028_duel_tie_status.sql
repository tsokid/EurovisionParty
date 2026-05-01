-- ============================================================
-- 028: Tie status for duels
-- Equal scores = tie. No winner. No points stolen or doubled.
-- The previous tiebreaker (faster total response time) wrongly
-- crowned a "winner" of 0-0 duels, surfacing a Steal/Double
-- prompt with nothing to win. We drop the time-based tiebreaker
-- entirely: equal totals are ties, period.
-- ============================================================

-- Allow 'tie' as a terminal status alongside 'completed'.
ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_status_check;
ALTER TABLE duels
  ADD CONSTRAINT duels_status_check
  CHECK (status IN ('pending','accepted','answering','completed','tie','expired','declined'));

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
  v_winner_id UUID;
  v_loser_id UUID;
  v_final_status TEXT;
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

  v_winner_id := NULL;
  v_loser_id := NULL;
  v_final_status := 'completed';

  -- If both have answered, decide outcome by total score only.
  -- Equal totals → tie. No winner. No points changed hands.
  IF v_opponent_answered THEN
    IF p_total_score > v_opponent_score THEN
      v_winner_id := p_player_id;
      v_loser_id := CASE WHEN v_is_challenger THEN v_duel.challenged_id ELSE v_duel.challenger_id END;
    ELSIF p_total_score < v_opponent_score THEN
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
    'opponent_answered', v_opponent_answered
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill any existing 0-0 (or otherwise equal-score) "completed" duels
-- so they no longer dangle as fake decisions in the UI.
UPDATE duels
   SET status = 'tie',
       winner_id = NULL,
       loser_id = NULL
 WHERE status = 'completed'
   AND winner_decision IS NULL
   AND COALESCE(challenger_score, 0) = COALESCE(challenged_score, 0);
