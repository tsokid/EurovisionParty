-- 100_question_serving_contract.sql
-- Contract step of 099, applied once the client that asks the server for
-- every question is live. The old paths, where the browser chose the
-- question and sent its own timing, are closed:
-- * submit_quiz_answer (any question id, client time) → quiz_next / quiz_answer
-- * submit_duel_answers (all three at once, client time) → duel_next / duel_answer
-- A tab opened before the 099 client must reload to play.

revoke execute on function public.submit_quiz_answer(uuid, uuid, integer, integer, integer, boolean, timestamp with time zone, integer)
  from public, anon, authenticated;
revoke execute on function public.submit_duel_answers(uuid, uuid, jsonb, integer, integer[])
  from public, anon, authenticated;
