-- Rollback for 097_security_pack2a.sql. Prepared before applying; not applied.
-- Restores the function bodies, policies, grants and triggers as they were
-- on 27 Nov 2026 (bodies copied from the live database).

begin;

grant execute on function public.verify_room_password(character varying, text) to public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.decline_duel(p_duel_id uuid, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_duel        duels%ROWTYPE;

  v_decline_count integer;

  v_max_declines  integer;

  v_new_count     integer;

BEGIN

  -- Lock duel row to prevent race condition

  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id FOR UPDATE;

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Duel not found';

  END IF;

  IF v_duel.challenged_id <> p_player_id THEN

    RAISE EXCEPTION 'Only the challenged player can decline';

  END IF;

  IF v_duel.status <> 'pending' THEN

    RAISE EXCEPTION 'Duel is not pending';

  END IF;



  -- Get current decline count (lock player row too)

  SELECT decline_count INTO v_decline_count

  FROM players WHERE id = p_player_id FOR UPDATE;



  v_max_declines := get_max_declines(v_duel.room_id);



  IF v_decline_count >= v_max_declines THEN

    RAISE EXCEPTION 'Decline limit reached: % of % used', v_decline_count, v_max_declines;

  END IF;



  -- Decline the duel

  UPDATE duels SET status = 'declined' WHERE id = p_duel_id;



  -- Increment player's decline counter

  v_new_count := v_decline_count + 1;

  UPDATE players SET decline_count = v_new_count WHERE id = p_player_id;



  RETURN jsonb_build_object(

    'decline_count', v_new_count,

    'max_declines',  v_max_declines

  );

END;

$function$;

CREATE OR REPLACE FUNCTION public.link_super_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

begin

  if exists (select 1 from public.super_admin_emails where email = new.email) then

    insert into public.super_admins(user_id, email) values (new.id, new.email)

    on conflict (user_id) do nothing;

  end if;

  return new;

end;

$function$;

CREATE OR REPLACE FUNCTION public.resolve_sudden_death_match(p_match_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_room     uuid;

  v_category winner_category;

  v_winner   uuid;

begin

  select room_id, category into v_room, v_category

    from sudden_death_rounds where match_id = p_match_id limit 1;

  if v_room is null then raise exception 'no such match'; end if;



  with tied as (

    select player_id from winners

     where room_id = v_room and category = v_category

  )

  select a.player_id into v_winner

    from sudden_death_answers a

    join sudden_death_rounds r on r.id = a.round_id

    join tied t on t.player_id = a.player_id

   where r.match_id = p_match_id

   group by a.player_id

   order by sum(case when a.is_correct then 1 else 0 end) desc,

            sum(coalesce(a.response_ms, 999999)) asc

   limit 1;



  if v_winner is not null then

    update sudden_death_rounds

       set status = 'completed', winner_player_id = v_winner

     where match_id = p_match_id;

    update winners set is_sudden_death_winner = true

     where room_id = v_room and category = v_category and player_id = v_winner;

    delete from winners

     where room_id = v_room and category = v_category and player_id <> v_winner;

  end if;



  return v_winner;

end;

$function$;

CREATE OR REPLACE FUNCTION public.submit_sudden_death_answer(p_round_id uuid, p_answer_index integer, p_is_correct boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

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

$function$;

CREATE OR REPLACE FUNCTION public.tally_tie_vote(p_vote_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_room    uuid;

  v_status  text;

  v_accept  int;

  v_sd      int;

  v_total   int;

  v_decision text;

begin

  select room_id, status into v_room, v_status from tie_votes where id = p_vote_id;

  if v_room is null then raise exception 'no such vote'; end if;

  if v_status <> 'active' then return v_status; end if;



  select count(*) filter (where choice = 'accept'),

         count(*) filter (where choice = 'sudden_death')

    into v_accept, v_sd

    from tie_vote_choices where vote_id = p_vote_id;



  v_total := coalesce(v_accept, 0) + coalesce(v_sd, 0);



  if v_sd > v_accept and v_total >= 3 then

    v_decision := 'sudden_death';

  else

    v_decision := 'accept';

  end if;



  update tie_votes set status = v_decision, decided_at = now() where id = p_vote_id;

  return v_decision;

end;

$function$;

drop trigger if exists trg_duels_guard_client_update on public.duels;
drop function if exists public.duels_guard_client_update();

drop trigger if exists trg_link_super_admin on auth.users;
create trigger trg_link_super_admin after insert or update of email on auth.users
  for each row execute function public.link_super_admin();

drop policy if exists quiz_answers_select on public.quiz_answers;
create policy quiz_answers_select on public.quiz_answers for select to authenticated
  using ((player_id = my_player_id(room_id)) or is_room_host(room_id));
create policy quiz_answers_insert on public.quiz_answers for insert to authenticated
  with check (player_id = my_player_id(room_id));
grant insert (player_id, answer_index, answered_at, id, is_correct, points_awarded, question_id, question_opened_at, response_seconds, room_id, round_number),
      update (points_awarded, round_number, answered_at, response_seconds, is_correct, answer_index, room_id, id, player_id, question_id, question_opened_at)
  on public.quiz_answers to authenticated;

create policy quiz_rounds_insert on public.quiz_rounds for insert to authenticated with check (is_room_member(room_id));
create policy quiz_rounds_update on public.quiz_rounds for update to authenticated using (is_room_member(room_id));
create policy question_assignments_insert on public.question_assignments for insert to authenticated with check (is_room_member(room_id));
grant insert (closes_at, question_ids, opened_at, status, id, round_number, room_id),
      update (closes_at, round_number, id, question_ids, status, opened_at, room_id)
  on public.quiz_rounds to authenticated;
grant insert (round_number, question_id, id, room_id, position),
      update (round_number, room_id, id, position, question_id)
  on public.question_assignments to authenticated;

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (is_room_member(room_id));

drop policy if exists predictions_select on public.predictions;
create policy predictions_select on public.predictions for select to authenticated
  using ((player_id = my_player_id(room_id)) or is_room_host(room_id));

alter function public.admin_clear_winners(uuid) reset search_path;
alter function public.admin_set_winner(uuid, winner_category, uuid, numeric) reset search_path;
alter function public.is_super_admin() reset search_path;
alter function public.open_sudden_death(uuid, winner_category, integer) reset search_path;

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = any (array[
         'admin_clear_winners', 'admin_set_winner',
         'arm_parse_job', 'hard_stop_parse_job', 'pause_parse_job', 'reset_parse_job',
         'resume_parse_job', 'set_manual_override', 'set_parse_job_url',
         'set_parse_schedule', 'set_respect_schedule', 'start_parse_job', 'stop_parse_job',
         'advance_room_phase', 'cast_tie_vote', 'compute_winners', 'create_room_with_password',
         'decline_duel', 'get_max_declines', 'open_sudden_death', 'open_sudden_death_match',
         'open_tie_vote', 'resolve_sudden_death_match', 'submit_sudden_death_answer',
         'tally_tie_vote'])
  loop
    execute format('grant execute on function %s to public, anon', f);
  end loop;
end $$;

drop function if exists public.delete_room(uuid);

commit;
