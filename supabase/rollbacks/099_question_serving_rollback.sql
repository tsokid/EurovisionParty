-- Rollback for 099_question_serving.sql. Serves are dropped (take a dump
-- first); quiz answers already written stay. Sudden death goes back to the
-- client's question ids.

drop trigger if exists duels_server_questions on public.duels;
drop function if exists public.duels_server_questions();

drop function if exists public.quiz_state(uuid);
drop function if exists public.quiz_next(uuid, int);
drop function if exists public.quiz_answer(uuid, int);
drop function if exists public.duel_next(uuid);
drop function if exists public.duel_answer(uuid, int);
drop function if exists public.duel_finish(uuid, uuid);
drop function if exists public.sudden_death_question(uuid);
drop function if exists public.close_expired_serve(public.question_serves);
drop function if exists public.quiz_points_for(int);
drop function if exists public.question_public(int);
drop function if exists public.draw_question(uuid, uuid[], text, int[]);
drop function if exists public.seen_question_ids(uuid, uuid);
drop table if exists public.question_serves;

create or replace function public.open_sudden_death_match(p_room_id uuid, p_category winner_category, p_question_ids integer[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_is_host boolean; v_match_id uuid := gen_random_uuid(); v_qid int; v_idx int := 0;
begin
  select is_host into v_is_host from players where room_id = p_room_id and user_id = auth.uid() and is_active limit 1;
  if not coalesce(v_is_host, false) then raise exception 'only host can open sudden death'; end if;
  if array_length(p_question_ids, 1) is distinct from 3 then raise exception 'sudden-death match needs exactly 3 questions'; end if;
  delete from sudden_death_rounds where room_id = p_room_id and category = p_category;
  foreach v_qid in array p_question_ids loop
    insert into sudden_death_rounds(room_id, category, question_id, match_id, question_index, closes_at)
    values (p_room_id, p_category, v_qid, v_match_id, v_idx, now() + interval '15 seconds' * (v_idx + 1));
    v_idx := v_idx + 1;
  end loop;
  return v_match_id;
end; $$;
