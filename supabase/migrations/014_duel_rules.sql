-- ─────────────────────────────────────────────────────────────────
-- 014_duel_rules.sql
-- Duel decline limits + challenge rules enforcement
-- ─────────────────────────────────────────────────────────────────

-- 1. Track how many times a player has declined a duel
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS decline_count integer NOT NULL DEFAULT 0;

-- 2. Helper: max declines based on room player count
--    ≤5 players → 2 · 6-10 → 3 · 11-15 → 4 · 15+ → 5
CREATE OR REPLACE FUNCTION get_max_declines(p_room_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM players
  WHERE room_id = p_room_id AND is_active = true;

  IF    v_count <= 5  THEN RETURN 2;
  ELSIF v_count <= 10 THEN RETURN 3;
  ELSIF v_count <= 15 THEN RETURN 4;
  ELSE                     RETURN 5;
  END IF;
END;
$$;

-- 3. RPC: decline a duel with limit enforcement
--    Returns { decline_count, max_declines } so the client can display progress.
--    Both regular declines and rematch declines count (Rule 5).
DROP FUNCTION IF EXISTS decline_duel(uuid, uuid);

CREATE OR REPLACE FUNCTION decline_duel(p_duel_id uuid, p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel        duels%ROWTYPE;
  v_decline_count integer;
  v_max_declines  integer;
  v_new_count     integer;
BEGIN
  -- Lock duel row to prevent race condition
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;
  IF v_duel.challenged_id <> p_player_id THEN
    RAISE EXCEPTION 'Only the challenged player can decline';
  END IF;
  IF v_duel.status <> 'pending' THEN
    RAISE EXCEPTION 'Duel is not pending';
  END IF;

  -- Get current decline count (lock player row too)
  SELECT decline_count INTO v_decline_count
  FROM players WHERE id = p_player_id FOR UPDATE;

  v_max_declines := get_max_declines(v_duel.room_id);

  IF v_decline_count >= v_max_declines THEN
    RAISE EXCEPTION 'Decline limit reached: % of % used', v_decline_count, v_max_declines;
  END IF;

  -- Decline the duel
  UPDATE duels SET status = 'declined' WHERE id = p_duel_id;

  -- Increment player's decline counter
  v_new_count := v_decline_count + 1;
  UPDATE players SET decline_count = v_new_count WHERE id = p_player_id;

  RETURN jsonb_build_object(
    'decline_count', v_new_count,
    'max_declines',  v_max_declines
  );
END;
$$;
