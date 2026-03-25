-- ============================================================
-- 007: Enable Realtime on duels + Fix steal to check opponent points
-- ============================================================

-- 1. Enable Realtime on duels table
ALTER PUBLICATION supabase_realtime ADD TABLE duels;

-- 2. Replace apply_duel_decision to check opponent has enough points for steal
CREATE OR REPLACE FUNCTION apply_duel_decision(
  p_duel_id UUID,
  p_decision TEXT,   -- 'steal' or 'double'
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
    -- Check how many points the loser actually has (total_points)
    SELECT total_points INTO v_loser_total_points FROM players WHERE id = v_loser_id;

    -- Can only steal up to what the loser has
    v_actual_steal := LEAST(v_winner_score, GREATEST(0, v_loser_total_points));

    IF v_actual_steal <= 0 THEN
      RAISE EXCEPTION 'Opponent has no points to steal';
    END IF;

    -- Winner gains stolen points as duel_points
    UPDATE players SET duel_points = duel_points + v_actual_steal,
                       total_points = total_points + v_actual_steal
    WHERE id = p_player_id;

    -- Loser loses those points from total (and duel_points goes negative if needed)
    UPDATE players SET duel_points = duel_points - v_actual_steal,
                       total_points = GREATEST(0, total_points - v_actual_steal)
    WHERE id = v_loser_id;

    -- Record in duel
    UPDATE duels SET winner_decision = 'steal',
                     decision_made_at = NOW(),
                     points_transferred = v_actual_steal
    WHERE id = p_duel_id;

  ELSIF p_decision = 'double' THEN
    -- Winner gets double their score, nobody loses points
    UPDATE players SET duel_points = duel_points + (v_winner_score * 2),
                       total_points = total_points + (v_winner_score * 2)
    WHERE id = p_player_id;

    UPDATE duels SET winner_decision = 'double',
                     decision_made_at = NOW(),
                     points_transferred = v_winner_score * 2
    WHERE id = p_duel_id;

  ELSE
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
