-- 054_fix_players_select_policy.sql
-- The players_select policy in 051 used USING (is_room_member(room_id)).
-- This broke the join flow: a user joining for the first time has no player
-- row yet, so is_room_member returns false, blocking the capacity check and
-- the SELECT that returns the newly-inserted player row after INSERT.
--
-- Fix: add user_id = auth.uid() as a second arm so a player can always
-- read their own rows regardless of active membership status.

DROP POLICY IF EXISTS players_select ON players;

CREATE POLICY players_select ON players
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_room_member(room_id)
  );
