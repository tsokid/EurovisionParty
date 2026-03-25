-- Update room cleanup from 10 days to 20 days of inactivity
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rooms
  WHERE last_activity_at < now() - INTERVAL '20 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
