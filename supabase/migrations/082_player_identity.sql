-- 082_player_identity.sql
-- Stage redesign identity (owner decision 21 Nov 2026):
--   * players.name stays the STAGE NAME (shown everywhere, used for rejoin).
--   * players.avatar_id: chosen avatar from the app's avatar set.
--   * player_secrets.real_name: the player's real name, SECRET until the room
--     reaches the end of the game (rooms.phase = 'final'), then revealed in
--     "Ποιος ήταν ποιος;". Secrecy is enforced here by RLS, not by the UI.
-- Additive only: no existing column, row or policy changes.

ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_id TEXT;

CREATE TABLE IF NOT EXISTS player_secrets (
  player_id  UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  real_name  VARCHAR(50) NOT NULL CHECK (char_length(btrim(real_name)) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE player_secrets ENABLE ROW LEVEL SECURITY;

-- Owner of the player row (same anonymous auth user) can write and read it.
CREATE POLICY player_secrets_insert ON player_secrets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM players p WHERE p.id = player_id AND p.user_id = auth.uid()
  ));

CREATE POLICY player_secrets_update ON player_secrets
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM players p WHERE p.id = player_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM players p WHERE p.id = player_id AND p.user_id = auth.uid()
  ));

-- Read: own secret always; other players' secrets only for members of the
-- same room once the game has ended (phase 'final').
--
-- "Member" is an active player row of the caller in that room that was
-- created BEFORE the room reached 'final' (joined_at <= phase_updated_at).
-- verify_room_password does not refuse a finished room, so without this a
-- late joiner with the code and password could join after the end only to
-- read every real name. phase_updated_at is set by every phase change
-- (finalize included), so it marks when the room became 'final'.
-- The host has no extra arm: before 'final' a host reads only its own row.
CREATE POLICY player_secrets_select ON player_secrets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM players p
      JOIN rooms r ON r.id = p.room_id
     WHERE p.id = player_id
       AND (
         p.user_id = auth.uid()
         OR (
           r.phase = 'final'
           AND EXISTS (
             SELECT 1 FROM players me
              WHERE me.room_id = p.room_id
                AND me.user_id = auth.uid()
                AND me.is_active = true
                AND me.joined_at <= COALESCE(r.phase_updated_at, now())
           )
         )
       )
  ));

-- Not added to supabase_realtime: secrets are fetched on demand only.
REVOKE ALL ON player_secrets FROM anon;
GRANT SELECT, INSERT, UPDATE ON player_secrets TO authenticated;
