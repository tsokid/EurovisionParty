-- 063_repair_quiz_points.sql
-- Migration 062's delta-based CTE zeroed all player quiz_points because
-- PostgreSQL inlined the CTE and old_points was evaluated after the UPDATE,
-- making every delta equal to 0.
--
-- First recompute is_correct + points_awarded from the now-correct
-- quiz_questions table, then recompute every player's quiz_points total
-- as a simple SUM — no deltas, no CTEs, no inlining risk.

-- ── Step 1: recompute per-answer correctness + points ────────────────────────
UPDATE quiz_answers qa
SET
  is_correct     = (qa.answer_index IS NOT NULL AND qa.answer_index = qq.correct_index),
  points_awarded = CASE
    WHEN qa.answer_index IS NOT NULL AND qa.answer_index = qq.correct_index THEN
      CASE
        WHEN COALESCE(qa.response_seconds, 16) <= 3  THEN 12
        WHEN COALESCE(qa.response_seconds, 16) <= 7  THEN 8
        ELSE 4
      END
    ELSE 0
  END
FROM quiz_questions qq
WHERE qq.id = qa.question_id;

-- ── Step 2: recompute player totals from corrected quiz_answers ───────────────
UPDATE players p
SET quiz_points = COALESCE(agg.total, 0)
FROM (
  SELECT player_id, SUM(points_awarded) AS total
  FROM quiz_answers
  GROUP BY player_id
) agg
WHERE p.id = agg.player_id;
