-- 056_verify_room_checks_capacity.sql
-- Move the capacity check into verify_room_password (SECURITY DEFINER) so
-- joining users never need a direct SELECT on the players table before they
-- have a player row.  The old client-side players count query was returning
-- 403 because the joining user has no player row → is_room_member = false
-- → RLS blocks the read.

CREATE OR REPLACE FUNCTION verify_room_password(
  p_code VARCHAR(6),
  p_password TEXT
)
RETURNS rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_room rooms;
  v_count INT;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = upper(p_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Verify password if the room has one
  IF v_room.password_hash != '' AND v_room.password_hash != crypt(p_password, v_room.password_hash) THEN
    RAISE EXCEPTION 'Incorrect password';
  END IF;

  -- Capacity check (bypasses RLS — SECURITY DEFINER can read players directly)
  SELECT COUNT(*) INTO v_count
  FROM players
  WHERE room_id = v_room.id
    AND is_active = true;

  IF v_count >= COALESCE(v_room.max_players, 20) THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  RETURN v_room;
END;
$$;
