-- Rollback for 100: reopens the pre-099 answer paths.
grant execute on function public.submit_quiz_answer(uuid, uuid, integer, integer, integer, boolean, timestamp with time zone, integer)
  to authenticated;
grant execute on function public.submit_duel_answers(uuid, uuid, jsonb, integer, integer[])
  to authenticated;
