-- 019b_sudden_death_rpc.sql
-- Sudden-death RPCs: open round (host), submit answer (any player), resolve (host or after timeout).

create or replace function public.open_sudden_death(p_room_id uuid, p_category winner_category, p_question_id int)
returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  if not exists (select 1 from public.rooms where id = p_room_id and host_id = auth.uid()) then
    raise exception 'not_host';
  end if;
  delete from public.sudden_death_rounds where room_id = p_room_id and category = p_category;
  insert into public.sudden_death_rounds(room_id, category, question_id, closes_at)
    values (p_room_id, p_category, p_question_id, now() + interval '20 seconds')
    returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.submit_sudden_death_answer(p_round_id uuid, p_answer_index int, p_is_correct boolean)
returns void language plpgsql security definer as $$
declare v_player_id uuid;
begin
  select id into v_player_id from public.players
    where user_id = auth.uid() and room_id = (select room_id from public.sudden_death_rounds where id = p_round_id);
  if v_player_id is null then raise exception 'not_in_room'; end if;
  insert into public.sudden_death_answers(round_id, player_id, answer_index, is_correct, response_ms)
    values (p_round_id, v_player_id, p_answer_index, p_is_correct,
      extract(milliseconds from (now() - (select opened_at from public.sudden_death_rounds where id = p_round_id)))::int)
    on conflict do nothing;
end;
$$;

create or replace function public.resolve_sudden_death(p_round_id uuid)
returns uuid language plpgsql security definer as $$
declare v_winner uuid; v_room uuid; v_cat winner_category;
begin
  select room_id, category into v_room, v_cat from public.sudden_death_rounds where id = p_round_id;
  select player_id into v_winner from public.sudden_death_answers
    where round_id = p_round_id and is_correct = true
    order by response_ms asc nulls last limit 1;
  if v_winner is null then return null; end if;

  update public.sudden_death_rounds set status='completed', winner_player_id = v_winner where id = p_round_id;
  delete from public.winners where room_id = v_room and category = v_cat;
  insert into public.winners(room_id, category, player_id, metric_value, is_sudden_death_winner)
    values (v_room, v_cat, v_winner, 0, true);
  return v_winner;
end;
$$;
