-- 055_raise_room_rate_limit.sql
-- Increase room creation rate limit from 3 → 10 per hour.
-- 3 was too restrictive for testing and for hosts who need to restart
-- a room during a party.

CREATE OR REPLACE FUNCTION check_room_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM rooms
  WHERE host_id = NEW.host_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit: max 10 rooms per hour. Please wait.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
