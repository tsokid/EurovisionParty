-- ============================================================
-- 006: Duel System Rework
-- 3 questions per duel, async play, rematch, steal/double
-- ============================================================

-- Drop old status CHECK constraint
ALTER TABLE duels DROP CONSTRAINT IF EXISTS duels_status_check;

-- Add new columns
ALTER TABLE duels
  ADD COLUMN IF NOT EXISTS question_ids INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS challenger_answers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS challenged_answers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS challenger_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS challenged_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_rematch BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_duel_id UUID REFERENCES duels(id),
  ADD COLUMN IF NOT EXISTS winner_decision VARCHAR(20),
  ADD COLUMN IF NOT EXISTS decision_made_at TIMESTAMPTZ;

-- New status constraint (added 'answering' for when at least one player has answered)
ALTER TABLE duels
  ADD CONSTRAINT duels_status_check
  CHECK (status IN ('pending','accepted','answering','completed','expired','declined'));

-- RPC: Apply duel decision (steal or double)
CREATE OR REPLACE FUNCTION apply_duel_decision(
  p_duel_id UUID,
  p_decision VARCHAR(20),
  p_player_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel duels;
  v_points INT;
  v_opponent_id UUID;
  v_opponent_duel_points INT;
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;

  IF v_duel.winner_id != p_player_id THEN
    RAISE EXCEPTION 'Only the winner can make this decision';
  END IF;

  IF v_duel.winner_decision IS NOT NULL THEN
    RAISE EXCEPTION 'Decision already made';
  END IF;

  -- Determine winner's score
  IF v_duel.challenger_id = p_player_id THEN
    v_points := v_duel.challenger_score;
    v_opponent_id := v_duel.challenged_id;
  ELSE
    v_points := v_duel.challenged_score;
    v_opponent_id := v_duel.challenger_id;
  END IF;

  IF p_decision = 'steal' THEN
    -- Get opponent's available duel points
    SELECT duel_points INTO v_opponent_duel_points FROM players WHERE id = v_opponent_id;
    -- Cap steal at what opponent has
    v_points := LEAST(v_points, COALESCE(v_opponent_duel_points, 0));

    -- Transfer points
    UPDATE players SET duel_points = duel_points + v_points WHERE id = p_player_id;
    UPDATE players SET duel_points = GREATEST(duel_points - v_points, 0) WHERE id = v_opponent_id;

  ELSIF p_decision = 'double' THEN
    -- Double the winner's score (no loss for opponent)
    UPDATE players SET duel_points = duel_points + (v_points * 2) WHERE id = p_player_id;

  ELSE
    RAISE EXCEPTION 'Invalid decision: must be steal or double';
  END IF;

  -- Mark decision
  UPDATE duels
  SET winner_decision = p_decision, decision_made_at = now(), points_transferred = v_points
  WHERE id = p_duel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_duel_decision TO authenticated;
