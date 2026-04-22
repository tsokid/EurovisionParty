-- supabase/migrations/015_player_status.sql

BEGIN;

-- 1. Create the enum type (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_status') THEN
    CREATE TYPE player_status AS ENUM ('active', 'away', 'exited');
  END IF;
END $$;

-- 2. Add columns (idempotent)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS status  player_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- 3. Backfill: existing inactive rows become exited
UPDATE players SET status = 'exited' WHERE is_active = false;

-- 4. Index for rejoin queries
CREATE INDEX IF NOT EXISTS idx_players_status ON players (room_id, status);

-- 5. Trigger function: keep is_active in sync with status
--    active → is_active = true
--    away   → is_active = true  (still participates in game)
--    exited → is_active = false
CREATE OR REPLACE FUNCTION sync_player_is_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_active := (NEW.status IN ('active', 'away'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_player_is_active ON players;
CREATE TRIGGER trg_sync_player_is_active
  BEFORE INSERT OR UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION sync_player_is_active();

-- 6. Update cleanup_ghost_players to drive status, not is_active directly
--    (the trigger would negate direct is_active writes)
CREATE OR REPLACE FUNCTION cleanup_ghost_players()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE players
  SET status  = 'exited'::player_status,
      left_at = NOW()
  WHERE status IN ('active', 'away')
    AND last_seen_at < NOW() - INTERVAL '2 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
