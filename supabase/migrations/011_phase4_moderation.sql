-- ============================================================
-- 011: Phase 4 - Moderation & Rate Limiting
-- ============================================================

-- ============================================================
-- 1. Rate limit room creation: max 3 rooms per user per hour
-- ============================================================
CREATE OR REPLACE FUNCTION check_room_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM rooms
  WHERE host_id = NEW.host_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit: max 3 rooms per hour. Please wait.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_room_rate_limit ON rooms;
CREATE TRIGGER trg_room_rate_limit
  BEFORE INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION check_room_rate_limit();

-- ============================================================
-- 2. Max players per room (server-side enforcement)
-- ============================================================
CREATE OR REPLACE FUNCTION check_max_players()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
  v_max INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM players
  WHERE room_id = NEW.room_id AND is_active = true;

  SELECT max_players INTO v_max FROM rooms WHERE id = NEW.room_id;

  IF v_count >= COALESCE(v_max, 20) THEN
    RAISE EXCEPTION 'Room is full (max % players)', COALESCE(v_max, 20);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_max_players ON players;
CREATE TRIGGER trg_max_players
  BEFORE INSERT ON players
  FOR EACH ROW
  EXECUTE FUNCTION check_max_players();

-- ============================================================
-- 3. Rate limit duel challenges: max 5 active (pending/accepted/answering) per player per room
-- ============================================================
CREATE OR REPLACE FUNCTION check_duel_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM duels
  WHERE room_id = NEW.room_id
    AND challenger_id = NEW.challenger_id
    AND status IN ('pending', 'accepted', 'answering');

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Too many active duels. Complete some before challenging again.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_duel_rate_limit ON duels;
CREATE TRIGGER trg_duel_rate_limit
  BEFORE INSERT ON duels
  FOR EACH ROW
  EXECUTE FUNCTION check_duel_rate_limit();

-- ============================================================
-- 4. Rate limit quiz rounds: max 10 rounds per player per room
-- (each player creates their own rounds since quiz is solo)
-- We check via quiz_answers: max 100 answers per player per room (10 rounds * 10 questions)
-- ============================================================
CREATE OR REPLACE FUNCTION check_quiz_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM quiz_answers
  WHERE room_id = NEW.room_id AND player_id = NEW.player_id;

  IF v_count >= 100 THEN
    RAISE EXCEPTION 'Quiz limit reached (max 10 rounds). Try duels instead!';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quiz_rate_limit ON quiz_answers;
CREATE TRIGGER trg_quiz_rate_limit
  BEFORE INSERT ON quiz_answers
  FOR EACH ROW
  EXECUTE FUNCTION check_quiz_rate_limit();

-- ============================================================
-- 5. Ghost player cleanup: mark inactive if last_seen > 2 hours ago
-- This function can be called periodically or by the cleanup cron
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_ghost_players()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE players
  SET is_active = false
  WHERE is_active = true
    AND last_seen_at < NOW() - INTERVAL '2 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Update the room cleanup function to also clean ghost players
-- Run both in one cron: SELECT cleanup_inactive_rooms(); SELECT cleanup_ghost_players();
-- ============================================================

-- Update the existing cleanup to use 20 days
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  -- First clean ghost players
  PERFORM cleanup_ghost_players();

  -- Then delete rooms inactive for 20 days
  DELETE FROM rooms
  WHERE last_activity_at < NOW() - INTERVAL '20 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. Name uniqueness within a room (already exists as UNIQUE constraint)
-- But add a check for case-insensitive duplicates
-- ============================================================
CREATE OR REPLACE FUNCTION check_unique_name_ci()
RETURNS TRIGGER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM players
    WHERE room_id = NEW.room_id
      AND LOWER(name) = LOWER(NEW.name)
      AND is_active = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Name "%" is already taken in this room', NEW.name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unique_name_ci ON players;
CREATE TRIGGER trg_unique_name_ci
  BEFORE INSERT OR UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION check_unique_name_ci();
