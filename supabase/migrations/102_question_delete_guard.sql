-- 102_question_delete_guard.sql
-- Owner, 27 Nov: questions can be deleted for good from /admin. A question
-- that was ever shown to a player stays (it is part of that room's history,
-- the "never the same question twice" rule and duel results); retire it
-- instead. The check covers the served questions (099) and the records
-- the earlier client left (quiz answers, duel lists, sudden death).

create or replace function public.quiz_questions_delete_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from question_serves where question_id = old.id)
     or exists (select 1 from quiz_answers where question_id = old.id)
     or exists (select 1 from duels where old.id = any (question_ids) or question_id = old.id)
     or exists (select 1 from sudden_death_rounds where question_id = old.id) then
    raise exception 'question_played: question % was already shown to players; retire it instead', old.id
      using errcode = 'P0001';
  end if;
  return old;
end $$;

drop trigger if exists quiz_questions_delete_guard on public.quiz_questions;
create trigger quiz_questions_delete_guard before delete on public.quiz_questions
  for each row execute function public.quiz_questions_delete_guard();
