-- Migration 016: Remove show_night phase, leaving 5 phases total:
--   lobby → pre_night → predictions_open → voting_live → final

-- 1. Migrate any rooms currently stuck in show_night → predictions_open
UPDATE rooms SET phase = 'predictions_open' WHERE phase = 'show_night';

-- 2. Drop the old CHECK constraint and add the new one
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_phase_check;
ALTER TABLE rooms
  ADD CONSTRAINT rooms_phase_check
  CHECK (phase IN ('lobby','pre_night','predictions_open','voting_live','final'));

-- 3. Update advance_room_phase RPC to use the new 5-phase sequence
CREATE OR REPLACE FUNCTION advance_room_phase(p_room_id UUID, p_player_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room   rooms%ROWTYPE;
  v_phases TEXT[] := ARRAY['lobby','pre_night','predictions_open','voting_live','final'];
  v_idx    INT;
  v_next_phase TEXT;
BEGIN
  -- Only the host may advance
  IF NOT EXISTS (
    SELECT 1 FROM players
    WHERE id = p_player_id AND room_id = p_room_id AND is_host = TRUE AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Only the host can advance the game phase';
  END IF;

  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  v_idx := array_position(v_phases, v_room.phase);

  IF v_idx IS NULL OR v_idx >= array_length(v_phases, 1) THEN
    RAISE EXCEPTION 'Already at the final phase';
  END IF;

  v_next_phase := v_phases[v_idx + 1];
  UPDATE rooms SET phase = v_next_phase, phase_updated_at = NOW() WHERE id = p_room_id;
  RETURN v_next_phase;
END;
$$;
