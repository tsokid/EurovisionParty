-- 059_fix_notifications_realtime.sql
-- The notifications_select policy in 051 used:
--   USING (player_id = my_player_id(room_id))
-- Supabase Realtime v2 validates client filter values against the RLS policy
-- at subscription time.  It cannot evaluate my_player_id(room_id) without
-- a specific room_id, so filtered subscriptions (player_id=eq.X) are rejected
-- with "mismatch between server and client bindings".
--
-- Fix: replace with a subquery join that Realtime CAN evaluate — check that
-- the notification's player_id belongs to the current auth user.
-- Functionally equivalent: players can only see their own notifications.

DROP POLICY IF EXISTS notifications_select ON notifications;

CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
       WHERE players.id = player_id
         AND players.user_id = auth.uid()
    )
  );

-- Same fix for UPDATE (mark as read)
DROP POLICY IF EXISTS notifications_update ON notifications;

CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
       WHERE players.id = player_id
         AND players.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
       WHERE players.id = player_id
         AND players.user_id = auth.uid()
    )
  );
