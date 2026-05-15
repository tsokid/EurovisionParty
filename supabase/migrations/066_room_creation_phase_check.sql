-- 066_room_creation_phase_check.sql
-- When a room is created after the participants parser has finished (status='done'),
-- start the room in 'predictions_open' instead of 'lobby'.
--
-- The trigger in 030 only fires once when parse_jobs flips to 'done', so rooms
-- created *after* that event were stuck at 'lobby' → 'pre_night' with no
-- automation to push them forward. This migration fixes creation-time logic.
--
-- Everything else in create_room_with_password is unchanged.

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
  v_participants_done BOOLEAN;
BEGIN
  INSERT INTO rooms (code, host_id, host_name, password_hash)
  VALUES (
    p_code,
    auth.uid(),
    p_host_name,
    crypt(p_password, gen_salt('bf'))
  )
  RETURNING * INTO v_room;

  -- If the participants parser for this contest year has already finished,
  -- skip lobby/pre_night and open predictions immediately.
  SELECT EXISTS (
    SELECT 1 FROM public.parse_jobs
     WHERE year   = v_room.year
       AND kind   = 'participants'
       AND status = 'done'
  ) INTO v_participants_done;

  IF v_participants_done THEN
    UPDATE rooms
       SET phase            = 'predictions_open',
           phase_updated_at = now()
     WHERE id = v_room.id;

    -- Reflect the updated phase in the returned row
    v_room.phase            := 'predictions_open';
    v_room.phase_updated_at := now();
  END IF;

  RETURN v_room;
END;
$$;
