-- 067_fix_room_creation_phase.sql
-- Migration 066 skipped 'lobby' entirely for rooms created after participants
-- are done, which bypassed the 2-player minimum enforced in the lobby UI.
--
-- Fix:
--   1. Revert create_room_with_password to always start at 'lobby'.
--   2. Update advance_room_phase so that lobby→pre_night skips straight to
--      predictions_open when participants are already done.
--      The host still has to wait for 2+ players (lobby gate unchanged),
--      but once they click Start the room lands on predictions_open directly.

-- ─── 1. Revert room creation to always start at lobby ────────────────────────
CREATE OR REPLACE FUNCTION create_room_with_password(
  p_code VARCHAR(6),
  p_host_name VARCHAR(50),
  p_password TEXT
)
RETURNS rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_room rooms;
BEGIN
  INSERT INTO rooms (code, host_id, host_name, password_hash)
  VALUES (
    p_code,
    auth.uid(),
    p_host_name,
    crypt(p_password, gen_salt('bf'))
  )
  RETURNING * INTO v_room;

  RETURN v_room;
END;
$$;

-- ─── 2. advance_room_phase: skip pre_night → predictions_open when done ───────
CREATE OR REPLACE FUNCTION advance_room_phase(p_room_id UUID, p_player_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room               rooms%ROWTYPE;
  v_phases             TEXT[] := ARRAY['lobby','pre_night','predictions_open','voting_live','final'];
  v_idx                INT;
  v_next_phase         TEXT;
  v_participants_done  BOOLEAN;
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

  -- When advancing out of lobby, check if participants are already done.
  -- If so, skip pre_night and land directly on predictions_open.
  IF v_room.phase = 'lobby' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.parse_jobs
       WHERE year   = v_room.year
         AND kind   = 'participants'
         AND status = 'done'
    ) INTO v_participants_done;

    IF v_participants_done THEN
      v_next_phase := 'predictions_open';
    END IF;
  END IF;

  UPDATE rooms SET phase = v_next_phase, phase_updated_at = NOW() WHERE id = p_room_id;
  RETURN v_next_phase;
END;
$$;
