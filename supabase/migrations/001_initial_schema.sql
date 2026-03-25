-- ============================================================
-- Eurovision Party Game - Initial Schema Migration
-- ============================================================
-- Creates all 10 tables, indexes, RPC functions, RLS policies,
-- and realtime configuration.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ROOMS
-- ============================================================
CREATE TABLE rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(6) NOT NULL UNIQUE,
  host_id         UUID NOT NULL REFERENCES auth.users(id),
  host_name       VARCHAR(50) NOT NULL,
  year            INT NOT NULL DEFAULT 2026,
  phase           VARCHAR(30) NOT NULL DEFAULT 'lobby'
                    CHECK (phase IN ('lobby','pre_night','show_night','predictions_open','voting_live','final')),
  max_players     INT NOT NULL DEFAULT 20,
  quiz_rounds     INT NOT NULL DEFAULT 3,
  duel_limit      INT NOT NULL DEFAULT 3,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  phase_updated_at    TIMESTAMPTZ DEFAULT now(),
  quiz_opened_at      TIMESTAMPTZ,
  predictions_opened_at TIMESTAMPTZ,
  predictions_locked_at TIMESTAMPTZ,
  results_source  VARCHAR(20) NOT NULL DEFAULT 'pending',
  results_confirmed BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- 2. PLAYERS
-- ============================================================
CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  name            VARCHAR(50) NOT NULL,
  avatar_emoji    VARCHAR(10) NOT NULL DEFAULT '🎤',
  country_flag    VARCHAR(10),
  quiz_points     INT NOT NULL DEFAULT 0,
  pred_points     INT NOT NULL DEFAULT 0,
  duel_points     INT NOT NULL DEFAULT 0,
  points_spent    INT NOT NULL DEFAULT 0,
  total_points    INT GENERATED ALWAYS AS (quiz_points + pred_points + duel_points - points_spent) STORED,
  is_host         BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_seen_at    TIMESTAMPTZ DEFAULT now(),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, name)
);

-- ============================================================
-- 3. QUIZ_ROUNDS
-- ============================================================
CREATE TABLE quiz_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number    INT NOT NULL,
  question_ids    INTEGER[] NOT NULL DEFAULT '{}',
  opened_at       TIMESTAMPTZ,
  closes_at       TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  UNIQUE (room_id, round_number)
);

-- ============================================================
-- 4. QUIZ_ANSWERS
-- ============================================================
CREATE TABLE quiz_answers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id         UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  round_number      INT NOT NULL,
  question_id       INT NOT NULL,
  answer_index      INT,
  is_correct        BOOLEAN,
  question_opened_at TIMESTAMPTZ NOT NULL,
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_seconds  NUMERIC(5,2),
  points_awarded    INT NOT NULL DEFAULT 0,
  CONSTRAINT chk_answer_within_window
    CHECK (answered_at <= question_opened_at + INTERVAL '16 seconds'),
  UNIQUE (player_id, question_id, round_number)
);

-- ============================================================
-- 5. QUESTION_ASSIGNMENTS
-- ============================================================
CREATE TABLE question_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  question_id     INT NOT NULL,
  round_number    INT NOT NULL,
  position        INT NOT NULL,
  UNIQUE (room_id, question_id)
);

-- ============================================================
-- 6. PREDICTIONS
-- ============================================================
CREATE TABLE predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  top5            VARCHAR(5)[] DEFAULT '{}',
  worst5          VARCHAR(5)[] DEFAULT '{}',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_locked       BOOLEAN NOT NULL DEFAULT false,
  top5_points     INT,
  worst5_points   INT,
  total_points    INT GENERATED ALWAYS AS (COALESCE(top5_points, 0) + COALESCE(worst5_points, 0)) STORED,
  scored_at       TIMESTAMPTZ,
  UNIQUE (room_id, player_id)
);

-- ============================================================
-- 7. DUELS
-- ============================================================
CREATE TABLE duels (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  challenger_id         UUID NOT NULL REFERENCES players(id),
  challenged_id         UUID NOT NULL REFERENCES players(id),
  question_id           INT,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','answered','completed','expired','declined')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at           TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  challenger_answer     INT,
  challenger_answered_at TIMESTAMPTZ,
  challenged_answer     INT,
  challenged_answered_at TIMESTAMPTZ,
  winner_id             UUID REFERENCES players(id),
  loser_id              UUID REFERENCES players(id),
  points_transferred    INT NOT NULL DEFAULT 12,
  CONSTRAINT chk_duel_not_self CHECK (challenger_id != challenged_id)
);

-- ============================================================
-- 8. INTEL_REVEALS
-- ============================================================
CREATE TABLE intel_reveals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reveal_type     VARCHAR(20) NOT NULL CHECK (reveal_type IN ('top3','top10','worst3')),
  points_cost     INT NOT NULL,
  revealed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, player_id, reveal_type)
);

-- ============================================================
-- 9. RESULTS
-- ============================================================
CREATE TABLE results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  final_ranking       JSONB,
  source              VARCHAR(20),
  source_url          VARCHAR(500),
  fetched_at          TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  confirmed_by        UUID REFERENCES players(id),
  is_partial          BOOLEAN NOT NULL DEFAULT false,
  positions_confirmed INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id)
);

-- ============================================================
-- 10. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_rooms_code          ON rooms (code);
CREATE INDEX idx_players_room        ON players (room_id);
CREATE INDEX idx_players_total       ON players (room_id, total_points DESC);
CREATE INDEX idx_answers_player      ON quiz_answers (player_id);
CREATE INDEX idx_answers_room        ON quiz_answers (room_id);
CREATE INDEX idx_duels_challenged    ON duels (challenged_id);
CREATE INDEX idx_duels_room          ON duels (room_id);
CREATE INDEX idx_notifs_player       ON notifications (player_id);

-- ============================================================
-- RPC FUNCTIONS (SECURITY DEFINER)
-- ============================================================

-- Increment quiz points for a player
CREATE OR REPLACE FUNCTION increment_quiz_points(p_player_id UUID, p_points INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE players
     SET quiz_points = quiz_points + p_points
   WHERE id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % not found', p_player_id;
  END IF;
END;
$$;

-- Increment prediction points for a player
CREATE OR REPLACE FUNCTION increment_pred_points(p_player_id UUID, p_points INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE players
     SET pred_points = pred_points + p_points
   WHERE id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % not found', p_player_id;
  END IF;
END;
$$;

-- Resolve a duel: winner gains points, loser loses points
CREATE OR REPLACE FUNCTION resolve_duel_points(p_winner_id UUID, p_loser_id UUID, p_points INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE players
     SET duel_points = duel_points + p_points
   WHERE id = p_winner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Winner player % not found', p_winner_id;
  END IF;

  UPDATE players
     SET duel_points = duel_points - p_points
   WHERE id = p_loser_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loser player % not found', p_loser_id;
  END IF;
END;
$$;

-- Spend intel points (increase points_spent)
CREATE OR REPLACE FUNCTION spend_intel_points(p_player_id UUID, p_cost INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE players
     SET points_spent = points_spent + p_cost
   WHERE id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % not found', p_player_id;
  END IF;
END;
$$;

-- ============================================================
-- ROOM AUTO-CLEANUP (10 days of inactivity)
-- ============================================================

-- Add last_activity_at column to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Function to update last_activity_at on any player action
CREATE OR REPLACE FUNCTION touch_room_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rooms SET last_activity_at = now() WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

-- Trigger on player joins
CREATE TRIGGER trg_player_touch_room
  AFTER INSERT ON players
  FOR EACH ROW EXECUTE FUNCTION touch_room_activity();

-- Trigger on quiz answers
CREATE TRIGGER trg_answer_touch_room
  AFTER INSERT ON quiz_answers
  FOR EACH ROW EXECUTE FUNCTION touch_room_activity();

-- Trigger on predictions
CREATE TRIGGER trg_prediction_touch_room
  AFTER INSERT OR UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION touch_room_activity();

-- Function to delete inactive rooms (older than 10 days)
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

-- To run this automatically, set up a Supabase cron job:
-- SELECT cron.schedule('cleanup-inactive-rooms', '0 3 * * *', 'SELECT cleanup_inactive_rooms()');

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE players, rooms, notifications;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper: check if the current user is a member of a room
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
     WHERE room_id = p_room_id
       AND user_id = auth.uid()
       AND is_active = true
  );
$$;

-- Helper: check if the current user is the host of a room
CREATE OR REPLACE FUNCTION is_room_host(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM rooms
     WHERE id = p_room_id
       AND host_id = auth.uid()
  );
$$;

-- Helper: get the current user's player id for a room
CREATE OR REPLACE FUNCTION my_player_id(p_room_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM players
   WHERE room_id = p_room_id
     AND user_id = auth.uid()
   LIMIT 1;
$$;

-- -------------------------------------------------------
-- ROOMS
-- -------------------------------------------------------
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY rooms_insert ON rooms
  FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY rooms_select ON rooms
  FOR SELECT TO authenticated
  USING (
    host_id = auth.uid()
    OR is_room_member(id)
  );

CREATE POLICY rooms_update ON rooms
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- -------------------------------------------------------
-- PLAYERS
-- -------------------------------------------------------
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY players_insert ON players
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY players_select ON players
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

CREATE POLICY players_update ON players
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -------------------------------------------------------
-- QUIZ_ROUNDS
-- -------------------------------------------------------
ALTER TABLE quiz_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY quiz_rounds_select ON quiz_rounds
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

CREATE POLICY quiz_rounds_insert ON quiz_rounds
  FOR INSERT TO authenticated
  WITH CHECK (is_room_host(room_id));

CREATE POLICY quiz_rounds_update ON quiz_rounds
  FOR UPDATE TO authenticated
  USING (is_room_host(room_id))
  WITH CHECK (is_room_host(room_id));

-- -------------------------------------------------------
-- QUIZ_ANSWERS
-- -------------------------------------------------------
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY quiz_answers_insert ON quiz_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    player_id = my_player_id(room_id)
  );

CREATE POLICY quiz_answers_select ON quiz_answers
  FOR SELECT TO authenticated
  USING (
    player_id = my_player_id(room_id)
    OR is_room_host(room_id)
  );

-- -------------------------------------------------------
-- QUESTION_ASSIGNMENTS
-- -------------------------------------------------------
ALTER TABLE question_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY question_assignments_select ON question_assignments
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

CREATE POLICY question_assignments_insert ON question_assignments
  FOR INSERT TO authenticated
  WITH CHECK (is_room_host(room_id));

-- -------------------------------------------------------
-- PREDICTIONS
-- -------------------------------------------------------
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY predictions_insert ON predictions
  FOR INSERT TO authenticated
  WITH CHECK (
    player_id = my_player_id(room_id)
  );

CREATE POLICY predictions_select ON predictions
  FOR SELECT TO authenticated
  USING (
    player_id = my_player_id(room_id)
    OR is_room_host(room_id)
  );

CREATE POLICY predictions_update ON predictions
  FOR UPDATE TO authenticated
  USING (player_id = my_player_id(room_id))
  WITH CHECK (player_id = my_player_id(room_id));

-- -------------------------------------------------------
-- DUELS
-- -------------------------------------------------------
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;

CREATE POLICY duels_insert ON duels
  FOR INSERT TO authenticated
  WITH CHECK (
    is_room_member(room_id)
    AND challenger_id = my_player_id(room_id)
  );

CREATE POLICY duels_select ON duels
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

CREATE POLICY duels_update ON duels
  FOR UPDATE TO authenticated
  USING (
    challenger_id = my_player_id(room_id)
    OR challenged_id = my_player_id(room_id)
    OR is_room_host(room_id)
  );

-- -------------------------------------------------------
-- INTEL_REVEALS
-- -------------------------------------------------------
ALTER TABLE intel_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY intel_reveals_insert ON intel_reveals
  FOR INSERT TO authenticated
  WITH CHECK (
    player_id = my_player_id(room_id)
  );

CREATE POLICY intel_reveals_select ON intel_reveals
  FOR SELECT TO authenticated
  USING (
    player_id = my_player_id(room_id)
  );

-- -------------------------------------------------------
-- RESULTS
-- -------------------------------------------------------
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

CREATE POLICY results_select ON results
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

CREATE POLICY results_insert ON results
  FOR INSERT TO authenticated
  WITH CHECK (is_room_host(room_id));

CREATE POLICY results_update ON results
  FOR UPDATE TO authenticated
  USING (is_room_host(room_id))
  WITH CHECK (is_room_host(room_id));

-- -------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (player_id = my_player_id(room_id));

CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING (player_id = my_player_id(room_id))
  WITH CHECK (player_id = my_player_id(room_id));

CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id));
