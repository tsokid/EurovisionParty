-- 061_widen_quiz_answer_window.sql
-- The 16-second check on answered_at was too tight.
--
-- Timeline for an auto-submitted answer (timer ran out):
--   500ms  startup delay before timer begins
--  15000ms  TIMER_SECONDS countdown
--   ~500ms  network round trip to Supabase
--   ~10ms   server processing
--   ───────
--  ~16010ms  total — fails the 16s constraint by ~10ms, INSERT silently fails.
--
-- When the INSERT fails the RPC throws, the answer is added to local state as a
-- fallback (is_correct=false, points_awarded=0) but never reaches quiz_answers.
-- The completion summary query then finds no Round 3 rows, so the Round 3 bar
-- disappears from the Final Results screen.
--
-- Fix: widen to 60 seconds. Scoring fairness is enforced by the RPC which
-- already clamps response_seconds at 16 regardless of actual elapsed time.

ALTER TABLE quiz_answers
  DROP CONSTRAINT chk_answer_within_window,
  ADD CONSTRAINT chk_answer_within_window
    CHECK (answered_at <= question_opened_at + INTERVAL '60 seconds');
