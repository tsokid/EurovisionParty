-- ============================================================
-- 010: Phase 2 - Results Entry + Prediction Scoring
-- ============================================================

-- ============================================================
-- 1. Save official results (any player can submit, upserts)
-- ============================================================
CREATE OR REPLACE FUNCTION save_results(
  p_room_id UUID,
  p_player_id UUID,
  p_final_ranking JSONB  -- array of country ISO codes ordered 1st to last
) RETURNS VOID AS $$
BEGIN
  INSERT INTO results (room_id, final_ranking, source, confirmed_by, confirmed_at, fetched_at)
  VALUES (p_room_id, p_final_ranking, 'manual', p_player_id, NOW(), NOW())
  ON CONFLICT (room_id) DO UPDATE SET
    final_ranking = p_final_ranking,
    confirmed_by = p_player_id,
    confirmed_at = NOW(),
    source = 'manual';

  -- Mark room as results confirmed
  UPDATE rooms SET results_confirmed = true, results_source = 'manual' WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Score ALL players' predictions in a room
-- Uses the same logic as the client-side scorePredictions()
-- exactPosition=50, inTop5=20, exactWorst=50, inWorst5=20
-- ============================================================
CREATE OR REPLACE FUNCTION score_all_predictions(p_room_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_ranking JSONB;
  v_official_top5 TEXT[];
  v_official_worst5 TEXT[];
  v_pred RECORD;
  v_top5_pts INT;
  v_worst5_pts INT;
  v_total INT;
  v_results JSONB := '[]'::jsonb;
  v_i INT;
BEGIN
  -- Get the official ranking
  SELECT final_ranking INTO v_ranking FROM results WHERE room_id = p_room_id;
  IF v_ranking IS NULL THEN
    RAISE EXCEPTION 'No results found for this room';
  END IF;

  -- Extract top 5 and worst 5 from ranking (array of country codes)
  -- ranking is a JSON array like ["SE","FR","IT","UA","CH",...,"AL","DE"]
  v_official_top5 := ARRAY(
    SELECT elem::text FROM jsonb_array_elements_text(v_ranking) WITH ORDINALITY AS t(elem, ord)
    WHERE ord <= 5
  );
  v_official_worst5 := ARRAY(
    SELECT elem::text FROM jsonb_array_elements_text(v_ranking) WITH ORDINALITY AS t(elem, ord)
    ORDER BY ord DESC LIMIT 5
  );

  -- Score each player's predictions
  FOR v_pred IN
    SELECT id, player_id, top5, worst5 FROM predictions WHERE room_id = p_room_id
  LOOP
    v_top5_pts := 0;
    v_worst5_pts := 0;

    -- Score top 5
    FOR v_i IN 1..LEAST(5, array_length(v_pred.top5, 1)) LOOP
      IF v_pred.top5[v_i] = v_official_top5[v_i] THEN
        v_top5_pts := v_top5_pts + 50;  -- exact position
      ELSIF v_pred.top5[v_i] = ANY(v_official_top5) THEN
        v_top5_pts := v_top5_pts + 20;  -- in top 5 but wrong position
      END IF;
    END LOOP;

    -- Score worst 5
    FOR v_i IN 1..LEAST(5, array_length(v_pred.worst5, 1)) LOOP
      IF v_pred.worst5[v_i] = v_official_worst5[v_i] THEN
        v_worst5_pts := v_worst5_pts + 50;  -- exact position
      ELSIF v_pred.worst5[v_i] = ANY(v_official_worst5) THEN
        v_worst5_pts := v_worst5_pts + 20;  -- in worst 5 but wrong position
      END IF;
    END LOOP;

    v_total := v_top5_pts + v_worst5_pts;

    -- Update prediction record
    UPDATE predictions SET
      top5_points = v_top5_pts,
      worst5_points = v_worst5_pts,
      scored_at = NOW(),
      is_locked = true
    WHERE id = v_pred.id;

    -- Add to player's pred_points
    UPDATE players SET pred_points = pred_points + v_total WHERE id = v_pred.player_id;

    v_results := v_results || jsonb_build_object(
      'player_id', v_pred.player_id,
      'top5_points', v_top5_pts,
      'worst5_points', v_worst5_pts,
      'total', v_total
    );
  END LOOP;

  RETURN v_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Get intel reveal data from results
-- ============================================================
CREATE OR REPLACE FUNCTION get_intel_reveal(p_room_id UUID, p_reveal_type TEXT)
RETURNS JSONB AS $$
DECLARE
  v_ranking JSONB;
  v_result JSONB;
BEGIN
  SELECT final_ranking INTO v_ranking FROM results WHERE room_id = p_room_id;
  IF v_ranking IS NULL THEN
    RETURN jsonb_build_object('available', false, 'data', '[]'::jsonb);
  END IF;

  IF p_reveal_type = 'top3' THEN
    SELECT jsonb_agg(elem) INTO v_result
    FROM (SELECT elem FROM jsonb_array_elements_text(v_ranking) WITH ORDINALITY AS t(elem, ord) WHERE ord <= 3) sub;
  ELSIF p_reveal_type = 'top10' THEN
    SELECT jsonb_agg(elem) INTO v_result
    FROM (SELECT elem FROM jsonb_array_elements_text(v_ranking) WITH ORDINALITY AS t(elem, ord) WHERE ord <= 10) sub;
  ELSIF p_reveal_type = 'worst3' THEN
    SELECT jsonb_agg(elem) INTO v_result
    FROM (SELECT elem FROM jsonb_array_elements_text(v_ranking) WITH ORDINALITY AS t(elem, ord) ORDER BY ord DESC LIMIT 3) sub;
  ELSE
    RAISE EXCEPTION 'Invalid reveal type: %', p_reveal_type;
  END IF;

  RETURN jsonb_build_object('available', true, 'data', COALESCE(v_result, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
