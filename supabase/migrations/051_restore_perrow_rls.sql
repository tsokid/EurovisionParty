-- 051_restore_perrow_rls.sql
-- Drops the blanket USING(true) policies installed by 004_fix_rls_simple
-- and restores scoped per-row policies on all 10 core tables.
--
-- Additionally revokes direct UPDATE on score columns (quiz_points,
-- pred_points, duel_points, points_spent) so that only SECURITY DEFINER
-- RPCs (increment_quiz_points, resolve_duel_points, etc.) can modify them.
-- Superuser-owned SECURITY DEFINER functions bypass both RLS and column
-- privileges, so all existing scoring RPCs continue to work unchanged.

-- ── PLAYERS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS players_all ON players;

-- Any room member can see all players in the room (leaderboard, etc.)
CREATE POLICY players_select ON players
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

-- Joining player inserts only their own row
CREATE POLICY players_insert ON players
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND room_id IN (SELECT id FROM rooms)
  );

-- Players may only update their own row (avatar, status, last_seen_at, etc.)
CREATE POLICY players_update ON players
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Score columns are managed exclusively by SECURITY DEFINER RPCs.
-- Column-level REVOKE alone can't override a table-level GRANT, so we:
--   1. Strip the broad table-level UPDATE
--   2. Regrant UPDATE only on the columns clients legitimately write
-- SECURITY DEFINER functions (postgres owner) bypass column privileges entirely.
REVOKE UPDATE ON players FROM authenticated;
GRANT UPDATE (avatar_emoji, country_flag, is_active, status, last_seen_at, left_at)
  ON players TO authenticated;

-- ── ROOMS ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS rooms_all ON rooms;

-- Allow host lookup and member view; third arm covers inactive members
-- who still need to see their room during rejoin / YourRoomsPanel.
CREATE POLICY rooms_select ON rooms
  FOR SELECT TO authenticated
  USING (
    host_id = auth.uid()
    OR is_room_member(id)
    OR id IN (SELECT room_id FROM players WHERE user_id = auth.uid())
  );

-- Only the future host creates the room row (via create_room_with_password RPC)
CREATE POLICY rooms_insert ON rooms
  FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

-- Phase / config mutations go through SECURITY DEFINER RPCs that check host
-- status internally; allow any current member to avoid edge-case lockouts.
CREATE POLICY rooms_update ON rooms
  FOR UPDATE TO authenticated
  USING (
    host_id = auth.uid()
    OR is_room_member(id)
  );

-- ── QUIZ_ROUNDS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS quiz_rounds_all ON quiz_rounds;

CREATE POLICY quiz_rounds_select ON quiz_rounds
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

CREATE POLICY quiz_rounds_insert ON quiz_rounds
  FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id));

CREATE POLICY quiz_rounds_update ON quiz_rounds
  FOR UPDATE TO authenticated
  USING (is_room_member(room_id));

-- ── QUIZ_ANSWERS ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS quiz_answers_all ON quiz_answers;

-- Players can only insert answers for their own player row
CREATE POLICY quiz_answers_insert ON quiz_answers
  FOR INSERT TO authenticated
  WITH CHECK (player_id = my_player_id(room_id));

-- Players see their own answers; host sees all (for scoring review)
CREATE POLICY quiz_answers_select ON quiz_answers
  FOR SELECT TO authenticated
  USING (
    player_id = my_player_id(room_id)
    OR is_room_host(room_id)
  );

-- ── QUESTION_ASSIGNMENTS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS question_assignments_all ON question_assignments;

CREATE POLICY question_assignments_select ON question_assignments
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

CREATE POLICY question_assignments_insert ON question_assignments
  FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id));

-- ── PREDICTIONS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS predictions_all ON predictions;

CREATE POLICY predictions_insert ON predictions
  FOR INSERT TO authenticated
  WITH CHECK (player_id = my_player_id(room_id));

-- Players see their own predictions; host sees all (needed to confirm results)
CREATE POLICY predictions_select ON predictions
  FOR SELECT TO authenticated
  USING (
    player_id = my_player_id(room_id)
    OR is_room_host(room_id)
  );

CREATE POLICY predictions_update ON predictions
  FOR UPDATE TO authenticated
  USING  (player_id = my_player_id(room_id))
  WITH CHECK (player_id = my_player_id(room_id));

-- ── DUELS ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS duels_all ON duels;

-- Challenger creates the duel row for their own player only
CREATE POLICY duels_insert ON duels
  FOR INSERT TO authenticated
  WITH CHECK (
    is_room_member(room_id)
    AND challenger_id = my_player_id(room_id)
  );

-- All room members can see all duels (room history / activity feed)
CREATE POLICY duels_select ON duels
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

-- Both duel participants (accept, answer) and host (resolve) may update
CREATE POLICY duels_update ON duels
  FOR UPDATE TO authenticated
  USING (
    challenger_id = my_player_id(room_id)
    OR challenged_id = my_player_id(room_id)
    OR is_room_host(room_id)
  );

-- ── INTEL_REVEALS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS intel_reveals_all ON intel_reveals;

CREATE POLICY intel_reveals_insert ON intel_reveals
  FOR INSERT TO authenticated
  WITH CHECK (player_id = my_player_id(room_id));

CREATE POLICY intel_reveals_select ON intel_reveals
  FOR SELECT TO authenticated
  USING (player_id = my_player_id(room_id));

-- ── RESULTS ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS results_all ON results;

CREATE POLICY results_select ON results
  FOR SELECT TO authenticated
  USING (is_room_member(room_id));

-- Any room member can insert/update results (host check is in the RPC)
CREATE POLICY results_insert ON results
  FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id));

CREATE POLICY results_update ON results
  FOR UPDATE TO authenticated
  USING  (is_room_member(room_id))
  WITH CHECK (is_room_member(room_id));

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS notifications_all ON notifications;

-- Players see only their own notifications
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (player_id = my_player_id(room_id));

-- Players mark only their own notifications as read
CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING  (player_id = my_player_id(room_id))
  WITH CHECK (player_id = my_player_id(room_id));

-- Any room member can create notifications (triggers, host broadcasts)
CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id));
