-- 079: The owner drives the game phases; the parser only fetches data.
-- Owner decisions, 19 Nov 2026 (docs/superpowers/roadmap/2026-11-18-roadmap.md,
-- "The owner drives the game phases"):
--
-- * contests.game_phase: the phase the owner has set for that year's rooms
--   (pre_night | predictions_open | voting_live | final).
-- * set_game_phase(year, phase): the admin "Open predictions" and "Close
--   predictions" buttons. Moves every room of that year that is past the
--   lobby and not yet final, and notifies its players. 'final' only comes
--   from Finalize.
-- * Parser state no longer moves rooms: a participants parse turning done
--   no longer opens predictions (030/071 E4 trigger dropped), and a results
--   parse starting no longer opens voting. Finalize (results 'finalized')
--   still moves that year's rooms to final, and now also sets game_phase.
-- * advance_room_phase: the host only starts the game (lobby). The room
--   lands on its year's game_phase when predictions or voting are open,
--   else on pre_night.
-- * admin_advance_all_rooms (030) is dropped: it moved rooms of every year.
-- * reset_contest puts game_phase back to pre_night.

begin;

-- ── game_phase ──────────────────────────────────────────────────────────
alter table public.contests
  add column if not exists game_phase text not null default 'pre_night'
  check (game_phase in ('pre_night', 'predictions_open', 'voting_live', 'final'));

update public.contests set game_phase = 'final' where stage in ('finalized', 'archived');

-- ── set_game_phase ──────────────────────────────────────────────────────
create or replace function public.set_game_phase(p_year int, p_phase text)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_phase is null or p_phase not in ('pre_night', 'predictions_open', 'voting_live') then
    raise exception 'invalid phase %; final comes from Finalize', p_phase;
  end if;
  if not exists (select 1 from public.contests where year = p_year) then
    raise exception 'contest % not found', p_year;
  end if;

  update public.contests
     set game_phase = p_phase, updated_at = now()
   where year = p_year;

  with flipped as (
    update public.rooms
       set phase = p_phase, phase_updated_at = now()
     where year = p_year
       and phase in ('pre_night', 'predictions_open', 'voting_live')
       and phase <> p_phase
    returning id
  ), notified as (
    insert into public.notifications (room_id, player_id, type, payload, is_read)
    select p.room_id, p.id,
           case p_phase when 'pre_night' then 'phase_changed' else p_phase end,
           jsonb_build_object('to', p_phase, 'reason', 'owner'),
           false
      from public.players p
     where p.is_active = true
       and p.room_id in (select id from flipped)
  )
  select count(*) into v_count from flipped;

  return v_count;
end;
$fn$;

revoke execute on function public.set_game_phase(int, text) from public, anon;
grant execute on function public.set_game_phase(int, text) to authenticated;

-- ── Parser no longer moves rooms ────────────────────────────────────────
drop trigger if exists trg_participants_done_open_predictions on public.parse_jobs;
drop function if exists public._tg_participants_done_open_predictions();
drop function if exists public._open_predictions_for_pre_night_rooms(int);
drop function if exists public._open_voting_for_predictions_rooms(int);

create or replace function public._tg_results_status_advance()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.kind = 'results'
     and new.status = 'finalized'
     and (old.status is distinct from 'finalized') then
    update public.contests set game_phase = 'final', updated_at = now() where year = new.year;
    perform public._move_all_to_final(new.year);
  end if;
  return new;
end;
$fn$;

-- ── advance_room_phase: host starts the game only ───────────────────────
create or replace function public.advance_room_phase(p_room_id uuid, p_player_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_room rooms%rowtype;
  v_game text;
  v_next text;
begin
  if not exists (
    select 1 from public.players
     where id = p_player_id and room_id = p_room_id and is_host = true and is_active = true
  ) then
    raise exception 'Only the host can advance the game phase';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if v_room.phase is distinct from 'lobby' then
    raise exception 'Only the lobby can be advanced by the host';
  end if;

  select game_phase into v_game from public.contests where year = v_room.year;
  v_next := case when v_game in ('predictions_open', 'voting_live') then v_game else 'pre_night' end;

  update public.rooms set phase = v_next, phase_updated_at = now() where id = p_room_id;
  return v_next;
end;
$fn$;

-- ── Old unscoped bulk switch ────────────────────────────────────────────
drop function if exists public.admin_advance_all_rooms(text, text);

-- ── reset_contest: same as 071, plus game_phase back to pre_night ───────
create or replace function public.reset_contest(
  p_year                 int,
  p_delete_predictions   bool default false,
  p_reset_points         bool default false,
  p_delete_rooms         bool default false
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year;
  if v_stage in ('finalized', 'archived') then
    raise exception 'contest % is %; reset refused', p_year, v_stage;
  end if;

  update public.contest_entries
     set in_final            = false,
         final_running_order = null,
         final_place         = null,
         total_points        = null,
         jury_points         = null,
         televote_points     = null,
         qualified           = null,
         updated_at          = now()
   where year = p_year;

  delete from public.results
   where room_id in (select id from public.rooms where year = p_year);

  if not p_delete_rooms then
    update public.predictions
       set top5_points   = null,
           worst5_points = null,
           scored_at     = null,
           is_locked     = false
     where room_id in (select id from public.rooms where year = p_year);

    update public.players
       set pred_points = 0
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  update public.parse_jobs
     set status       = 'idle',
         started_at   = null,
         stopped_at   = null,
         last_poll_at = null,
         poll_count   = 0
   where year = p_year;

  update public.contests set game_phase = 'pre_night', updated_at = now() where year = p_year;

  if p_delete_predictions and not p_delete_rooms then
    delete from public.predictions
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  if p_reset_points and not p_delete_rooms then
    update public.players
       set quiz_points = 0,
           duel_points = 0,
           pred_points = 0
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  if p_delete_rooms then
    delete from public.rooms where year = p_year;
  end if;
end;
$fn$;

revoke execute on function public.reset_contest(int, bool, bool, bool) from public, anon;
grant execute on function public.reset_contest(int, bool, bool, bool) to authenticated;

commit;
