-- Fix RLS policies to work properly with anonymous auth
-- The issue: anonymous users have the 'authenticated' role but
-- some policies are too restrictive for the first player insert

-- Drop and recreate players insert policy to be more permissive
DROP POLICY IF EXISTS players_insert ON players;
CREATE POLICY players_insert ON players
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND room_id IN (SELECT id FROM rooms)
  );

-- Also fix rooms select - host should always see their room even before joining as player
DROP POLICY IF EXISTS rooms_select ON rooms;
CREATE POLICY rooms_select ON rooms
  FOR SELECT TO authenticated
  USING (
    host_id = auth.uid()
    OR is_room_member(id)
    OR id IN (SELECT room_id FROM players WHERE user_id = auth.uid())
  );

-- Fix rooms update - any room member can update (no host requirement since we removed host concept)
DROP POLICY IF EXISTS rooms_update ON rooms;
CREATE POLICY rooms_update ON rooms
  FOR UPDATE TO authenticated
  USING (
    host_id = auth.uid()
    OR is_room_member(id)
  );

-- Fix quiz_rounds insert - any room member can create rounds (no host requirement)
DROP POLICY IF EXISTS quiz_rounds_insert ON quiz_rounds;
CREATE POLICY quiz_rounds_insert ON quiz_rounds
  FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id));

DROP POLICY IF EXISTS quiz_rounds_update ON quiz_rounds;
CREATE POLICY quiz_rounds_update ON quiz_rounds
  FOR UPDATE TO authenticated
  USING (is_room_member(room_id));

-- Fix question_assignments insert - any room member
DROP POLICY IF EXISTS question_assignments_insert ON question_assignments;
CREATE POLICY question_assignments_insert ON question_assignments
  FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id));

-- Fix results insert/update - any room member
DROP POLICY IF EXISTS results_insert ON results;
CREATE POLICY results_insert ON results
  FOR INSERT TO authenticated
  WITH CHECK (is_room_member(room_id));

DROP POLICY IF EXISTS results_update ON results;
CREATE POLICY results_update ON results
  FOR UPDATE TO authenticated
  USING (is_room_member(room_id));
