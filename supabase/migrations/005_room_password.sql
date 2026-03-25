-- ============================================================
-- 005: Room Password Protection
-- Adds bcrypt-hashed password to rooms + RPC functions
-- ============================================================

-- Ensure pgcrypto is available (Supabase puts extensions in 'extensions' schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Add password_hash column (empty string = no password for legacy rooms)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

-- -------------------------------------------------------
-- RPC: Create a room with a hashed password
-- -------------------------------------------------------
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

-- -------------------------------------------------------
-- RPC: Verify room password and return room if correct
-- -------------------------------------------------------
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
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = upper(p_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- If room has a password, verify it
  IF v_room.password_hash != '' AND v_room.password_hash != crypt(p_password, v_room.password_hash) THEN
    RAISE EXCEPTION 'Incorrect password';
  END IF;

  RETURN v_room;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_room_with_password TO authenticated;
GRANT EXECUTE ON FUNCTION verify_room_password TO authenticated;
