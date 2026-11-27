-- 097: security pack 2a. Server-side game rules that need no new client
-- flow: the server decides sudden death, closes votes and matches only at
-- their deadline, ties every action to the caller's own player, and keeps
-- shared quiz state, notifications and other players' picks out of reach.
-- Also: a host can really delete their own room (owner decision).
--
-- Clients deployed before this keep working: every RPC keeps its signature.
-- Rollback: supabase/rollbacks/097_security_pack2a_rollback.sql.

begin;

-- ── 1. The pre-095 password check is no longer called by any client ─────
revoke execute on function public.verify_room_password(character varying, text)
  from public, anon, authenticated;

-- ── 2. Duels: only your own decline; direct status changes are accept only
create or replace function public.decline_duel(p_duel_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_duel          duels%rowtype;
  v_decline_count integer;
  v_max_declines  integer;
  v_new_count     integer;
begin
  select * into v_duel from duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duel not found';
  end if;
  -- 097: the caller declines for themselves only.
  if p_player_id is distinct from my_player_id(v_duel.room_id) then
    raise exception 'player_id does not belong to the calling user';
  end if;
  if v_duel.challenged_id <> p_player_id then
    raise exception 'Only the challenged player can decline';
  end if;
  if v_duel.status <> 'pending' then
    raise exception 'Duel is not pending';
  end if;

  select decline_count into v_decline_count from players where id = p_player_id for update;
  v_max_declines := get_max_declines(v_duel.room_id);
  if v_decline_count >= v_max_declines then
    raise exception 'Decline limit reached: % of % used', v_decline_count, v_max_declines;
  end if;

  update duels set status = 'declined' where id = p_duel_id;
  v_new_count := v_decline_count + 1;
  update players set decline_count = v_new_count where id = p_player_id;

  return jsonb_build_object('decline_count', v_new_count, 'max_declines', v_max_declines);
end;
$$;

-- A player may change a duel's status directly only to accept a challenge
-- made to them. Everything else (decline, answers, results) goes through
-- the RPCs, which run as the definer and skip this check.
create or replace function public.duels_guard_client_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status = 'accepted'
              and new.challenged_id = public.my_player_id(new.room_id)) then
    raise exception 'duel status can only change through the game' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_duels_guard_client_update on public.duels;
create trigger trg_duels_guard_client_update
  before update on public.duels
  for each row execute function public.duels_guard_client_update();

-- ── 3. Sudden death: the server decides right or wrong, inside the window ─
create or replace function public.submit_sudden_death_answer(
  p_round_id uuid, p_answer_index integer, p_is_correct boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_round   sudden_death_rounds%rowtype;
  v_player  uuid;
  v_correct integer;
begin
  -- p_is_correct is ignored (kept for the signature of older clients).
  select * into v_round from sudden_death_rounds where id = p_round_id;
  if not found then raise exception 'no_such_round'; end if;

  v_player := my_player_id(v_round.room_id);
  if v_player is null then raise exception 'not_in_room'; end if;

  -- The deadline plus 2 s for the network.
  if now() > v_round.closes_at + interval '2 seconds' then
    raise exception 'round_closed';
  end if;

  select correct_index into v_correct from quiz_questions where id = v_round.question_id;

  insert into sudden_death_answers (round_id, player_id, answer_index, is_correct, response_ms)
  values (
    p_round_id, v_player, p_answer_index,
    v_correct is not null and p_answer_index = v_correct,
    greatest(0, (extract(epoch from (now() - v_round.opened_at)) * 1000)::int)
  )
  on conflict (round_id, player_id) do nothing;
end;
$$;

-- ── 4. Votes and matches close at their deadline, by a member ───────────
-- Clients call these when their own countdown hits zero; 2 s of tolerance
-- covers a fast clock, and an early call raises 'too_early' (clients retry).
create or replace function public.tally_tie_vote(p_vote_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vote     tie_votes%rowtype;
  v_accept   int;
  v_sd       int;
  v_decision text;
begin
  select * into v_vote from tie_votes where id = p_vote_id for update;
  if not found then raise exception 'no such vote'; end if;
  if my_player_id(v_vote.room_id) is null and not is_super_admin() then
    raise exception 'not a member of this room';
  end if;
  if v_vote.status <> 'active' then return v_vote.status; end if;
  if now() < v_vote.closes_at - interval '2 seconds' then
    raise exception 'too_early';
  end if;

  select count(*) filter (where choice = 'accept'),
         count(*) filter (where choice = 'sudden_death')
    into v_accept, v_sd
    from tie_vote_choices where vote_id = p_vote_id;

  if coalesce(v_sd, 0) > coalesce(v_accept, 0) and coalesce(v_sd, 0) + coalesce(v_accept, 0) >= 3 then
    v_decision := 'sudden_death';
  else
    v_decision := 'accept';
  end if;

  update tie_votes set status = v_decision, decided_at = now() where id = p_vote_id;
  return v_decision;
end;
$$;

create or replace function public.resolve_sudden_death_match(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room     uuid;
  v_category winner_category;
  v_closes   timestamptz;
  v_winner   uuid;
begin
  select room_id, category, max(closes_at) into v_room, v_category, v_closes
    from sudden_death_rounds where match_id = p_match_id
   group by room_id, category
   limit 1;
  if v_room is null then raise exception 'no such match'; end if;
  if my_player_id(v_room) is null and not is_super_admin() then
    raise exception 'not a member of this room';
  end if;
  if now() < v_closes - interval '2 seconds' then
    raise exception 'too_early';
  end if;

  -- Already decided: return the same winner (the panel of every member calls this).
  select winner_player_id into v_winner
    from sudden_death_rounds where match_id = p_match_id and status = 'completed' limit 1;
  if v_winner is not null then return v_winner; end if;

  with tied as (
    select player_id from winners where room_id = v_room and category = v_category
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
    update sudden_death_rounds set status = 'completed', winner_player_id = v_winner
     where match_id = p_match_id;
    update winners set is_sudden_death_winner = true
     where room_id = v_room and category = v_category and player_id = v_winner;
    delete from winners
     where room_id = v_room and category = v_category and player_id <> v_winner;
  end if;

  return v_winner;
end;
$$;

-- ── 5. Quiz answers only through submit_quiz_answer; own answers only ───
drop policy if exists quiz_answers_insert on public.quiz_answers;
revoke insert, update, delete on public.quiz_answers from anon, authenticated;

drop policy if exists quiz_answers_select on public.quiz_answers;
create policy quiz_answers_select on public.quiz_answers
  for select to authenticated
  using (player_id = my_player_id(room_id));

-- ── 6. Shared quiz state is not written by clients (none do) ────────────
drop policy if exists quiz_rounds_insert on public.quiz_rounds;
drop policy if exists quiz_rounds_update on public.quiz_rounds;
drop policy if exists question_assignments_insert on public.question_assignments;
revoke insert, update, delete on public.quiz_rounds from anon, authenticated;
revoke insert, update, delete on public.question_assignments from anon, authenticated;

-- ── 7. Notifications: duel messages to a player of the same room ────────
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    my_player_id(room_id) is not null
    and type in ('duel_challenge', 'duel_accepted', 'duel_declined')
    and exists (select 1 from public.players p
                 where p.id = notifications.player_id and p.room_id = notifications.room_id)
  );
revoke insert, update, delete on public.notifications from anon;

-- ── 8. Admin allowlist: only a confirmed email is promoted ──────────────
create or replace function public.link_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.super_admin_emails where email = new.email) then
    insert into public.super_admins(user_id, email) values (new.id, new.email)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_super_admin on auth.users;
create trigger trg_link_super_admin
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.link_super_admin();

-- ── 9. Fixed search_path; nothing game- or admin-related for anon ───────
alter function public.admin_clear_winners(uuid) set search_path = public, pg_temp;
alter function public.admin_set_winner(uuid, winner_category, uuid, numeric) set search_path = public, pg_temp;
alter function public.is_super_admin() set search_path = public, pg_temp;
alter function public.open_sudden_death(uuid, winner_category, integer) set search_path = public, pg_temp;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
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
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ── 10. Predictions: each player sees their own (the host too) ──────────
drop policy if exists predictions_select on public.predictions;
create policy predictions_select on public.predictions
  for select to authenticated
  using (player_id = my_player_id(room_id));

-- ── 11. A host deletes their own room (owner decision, option α) ────────
create or replace function public.delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from rooms where id = p_room_id and host_id = auth.uid()) then
    raise exception 'not_host' using errcode = '42501';
  end if;
  delete from rooms where id = p_room_id;
end;
$$;

revoke execute on function public.delete_room(uuid) from public, anon;
grant execute on function public.delete_room(uuid) to authenticated, service_role;

commit;
