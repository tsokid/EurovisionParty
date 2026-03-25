-- ============================================================
-- SIMPLE RLS FIX - Allow all authenticated users full access
-- This replaces all previous policies with simple ones
-- ============================================================

-- ROOMS
DROP POLICY IF EXISTS rooms_insert ON rooms;
DROP POLICY IF EXISTS rooms_select ON rooms;
DROP POLICY IF EXISTS rooms_update ON rooms;
CREATE POLICY rooms_all ON rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PLAYERS
DROP POLICY IF EXISTS players_insert ON players;
DROP POLICY IF EXISTS players_select ON players;
DROP POLICY IF EXISTS players_update ON players;
CREATE POLICY players_all ON players FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- QUIZ_ROUNDS
DROP POLICY IF EXISTS quiz_rounds_select ON quiz_rounds;
DROP POLICY IF EXISTS quiz_rounds_insert ON quiz_rounds;
DROP POLICY IF EXISTS quiz_rounds_update ON quiz_rounds;
CREATE POLICY quiz_rounds_all ON quiz_rounds FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- QUIZ_ANSWERS
DROP POLICY IF EXISTS quiz_answers_insert ON quiz_answers;
DROP POLICY IF EXISTS quiz_answers_select ON quiz_answers;
CREATE POLICY quiz_answers_all ON quiz_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- QUESTION_ASSIGNMENTS
DROP POLICY IF EXISTS question_assignments_select ON question_assignments;
DROP POLICY IF EXISTS question_assignments_insert ON question_assignments;
CREATE POLICY question_assignments_all ON question_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PREDICTIONS
DROP POLICY IF EXISTS predictions_insert ON predictions;
DROP POLICY IF EXISTS predictions_select ON predictions;
DROP POLICY IF EXISTS predictions_update ON predictions;
CREATE POLICY predictions_all ON predictions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DUELS
DROP POLICY IF EXISTS duels_insert ON duels;
DROP POLICY IF EXISTS duels_select ON duels;
DROP POLICY IF EXISTS duels_update ON duels;
CREATE POLICY duels_all ON duels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INTEL_REVEALS
DROP POLICY IF EXISTS intel_reveals_insert ON intel_reveals;
DROP POLICY IF EXISTS intel_reveals_select ON intel_reveals;
CREATE POLICY intel_reveals_all ON intel_reveals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RESULTS
DROP POLICY IF EXISTS results_select ON results;
DROP POLICY IF EXISTS results_insert ON results;
DROP POLICY IF EXISTS results_update ON results;
CREATE POLICY results_all ON results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- NOTIFICATIONS
DROP POLICY IF EXISTS notifications_select ON notifications;
DROP POLICY IF EXISTS notifications_update ON notifications;
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_all ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
