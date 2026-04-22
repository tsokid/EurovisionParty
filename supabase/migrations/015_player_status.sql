-- supabase/migrations/015_player_status.sql

-- 1. Create the enum type
CREATE TYPE player_status AS ENUM ('active', 'away', 'exited');

-- 2. Add status column (defaults active for all existing rows)
ALTER TABLE players
  ADD COLUMN status player_status NOT NULL DEFAULT 'active',
  ADD COLUMN left_at TIMESTAMPTZ;

-- 3. Backfill: rows that were inactive before this migration → exited
UPDATE players SET status = 'exited' WHERE is_active = false;

-- 4. Trigger: keep is_active in sync with status automatically
--    active  → is_active = true
--    away    → is_active = true  (still participates in game)
--    exited  → is_active = false
CREATE OR REPLACE FUNCTION sync_player_is_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_active := (NEW.status IN ('active', 'away'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_player_is_active
  BEFORE INSERT OR UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION sync_player_is_active();
