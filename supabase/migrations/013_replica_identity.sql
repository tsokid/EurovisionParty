-- ============================================================
-- 013: REPLICA IDENTITY FULL for all Realtime tables
-- Required for filtered postgres_changes subscriptions to work
-- correctly for UPDATE and DELETE events.
-- Without this, the Realtime server may reject channel auth (403).
-- ============================================================

ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE duels REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE quiz_rounds REPLICA IDENTITY FULL;
ALTER TABLE quiz_answers REPLICA IDENTITY FULL;
ALTER TABLE predictions REPLICA IDENTITY FULL;
ALTER TABLE results REPLICA IDENTITY FULL;
ALTER TABLE intel_reveals REPLICA IDENTITY FULL;
ALTER TABLE question_assignments REPLICA IDENTITY FULL;
