-- 057_fix_players_insert_policy.sql
-- The players_insert policy in 051 had:
--   WITH CHECK (user_id = auth.uid() AND room_id IN (SELECT id FROM rooms))
--
-- Joining users can't see any rooms before they have a player row (no host_id
-- match, is_room_member = false, no existing player rows) → the subquery
-- returns empty → INSERT is blocked with 403.
--
-- Fix: remove the redundant room visibility check.  Security is preserved by:
--   1. Room IDs are UUIDs — unguessable without calling verify_room_password
--      (SECURITY DEFINER) with the correct password.
--   2. FK constraint on players.room_id ensures the room actually exists.
--   3. The player can only insert their own row (user_id = auth.uid()).

DROP POLICY IF EXISTS players_insert ON players;

CREATE POLICY players_insert ON players
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
