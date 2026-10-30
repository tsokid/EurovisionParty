-- ============================================================
-- 071: RPCs on contest_entries (sub-project 2a)
-- ------------------------------------------------------------
-- Section A (Task 3): the four existing result RPCs read and
--   write contest_entries instead of eurovision_2026_*, and every
--   effect on results / predictions / players / rooms is limited
--   to rooms of p_year (rooms.year). Signatures, return types,
--   security definer, search_path and the is_super_admin() gate
--   are unchanged.
--     * finalize_results(int)            (was 038)
--     * commit_manual_results(int, text[]) (was 027)
--     * reset_manual_results(int)        (was 043)
--     * reset_contest(int, bool, bool, bool) (was 042); the legacy
--       1-argument overload from 039/040 is dropped.
-- Later sections are appended by later tasks.
--
-- predictions.total_points and players.total_points are generated
-- columns and are never written here.
-- ============================================================

begin;

-- ════════════════════════════════════════════════════════════
-- Section A: result RPCs on contest_entries, year-scoped
-- ════════════════════════════════════════════════════════════

-- ── A1. finalize_results ────────────────────────────────────
-- Ranking now comes from contest_entries (final_place of p_year).
-- Propagation is limited to rooms of p_year; before, every room
-- with predictions and no results got the ranking, whatever its year.
create or replace function public.finalize_results(p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status        text;
  v_ranking_arr   text[];
  v_room_id       uuid;
  v_host_id       uuid;
  v_scored_count  int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  -- 1. Flip parse_jobs.results status if not already finalized
  select status into v_status
    from public.parse_jobs
   where year = p_year and kind = 'results';
  if v_status is null then
    raise exception 'no results job for year %', p_year;
  end if;
  if v_status <> 'finalized' then
    update public.parse_jobs
       set status = 'finalized', stopped_at = now()
     where year = p_year and kind = 'results';
  end if;

  -- 2. Build the ordered ISO array from the year's final places
  select array_agg(iso order by final_place) into v_ranking_arr
    from public.contest_entries
   where year = p_year and final_place is not null;

  if v_ranking_arr is null or array_length(v_ranking_arr, 1) is null then
    return 0;
  end if;

  -- 3. Propagate to every room of p_year with predictions and no results yet.
  for v_room_id in
    select distinct p.room_id
      from public.predictions p
      join public.rooms ro on ro.id = p.room_id
     where ro.year = p_year
       and not exists (
         select 1 from public.results r where r.room_id = p.room_id
       )
  loop
    select id into v_host_id
      from public.players
     where room_id = v_room_id
       and (is_host = true or status <> 'exited')
     order by is_host desc nulls last, joined_at asc
     limit 1;

    if v_host_id is not null then
      insert into public.results (room_id, final_ranking, confirmed_by)
      values (v_room_id, to_jsonb(v_ranking_arr), v_host_id)
      on conflict (room_id) do nothing;

      perform public.score_all_predictions(v_room_id);
      v_scored_count := v_scored_count + 1;
    end if;
  end loop;

  return v_scored_count;
end;
$fn$;

grant execute on function public.finalize_results(int) to authenticated;

-- ── A2. commit_manual_results ───────────────────────────────
-- p_isos is the full final ranking, winner first. It must name every
-- grand finalist of p_year (final_running_order is not null) exactly once.
-- Clears the year's result columns, then sets final_place = position and
-- source = 'manual'. Points stay null: the old synthetic points
-- ((n + 1 - i) * 10) are no longer invented. Other years are untouched.
create or replace function public.commit_manual_results(p_year int, p_isos text[])
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count    int;
  v_expected int;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1 from public.parse_jobs
     where year = p_year and kind = 'results' and manual_override = true
  ) then
    raise exception 'manual_override is not active for year %', p_year;
  end if;

  v_count := array_length(p_isos, 1);
  if v_count is null or v_count = 0 then
    raise exception 'p_isos must contain at least one ISO';
  end if;

  select count(*) into v_expected
    from public.contest_entries
   where year = p_year and final_running_order is not null;
  if v_expected = 0 then
    raise exception 'no finalists found for % — set the final lineup first', p_year;
  end if;
  if v_count <> v_expected then
    raise exception 'expected % rankings (one per finalist), got %', v_expected, v_count;
  end if;

  perform 1
    from unnest(p_isos) iso(code)
   where not exists (
     select 1 from public.contest_entries e
      where e.year = p_year and e.iso = iso.code and e.final_running_order is not null
   )
   limit 1;
  if found then
    raise exception 'one or more ISOs are not finalists of %', p_year;
  end if;

  if (select count(distinct code) from unnest(p_isos) iso(code)) <> v_count then
    raise exception 'p_isos contains duplicate ISOs';
  end if;

  update public.contest_entries
     set final_place     = null,
         total_points    = null,
         jury_points     = null,
         televote_points = null,
         updated_at      = now()
   where year = p_year;

  update public.contest_entries e
     set final_place = r.pos,
         source      = 'manual',
         updated_at  = now()
    from unnest(p_isos) with ordinality as r(code, pos)
   where e.year = p_year and e.iso = r.code;

  -- Flip status + propagate to the year's rooms via finalize_results
  perform public.finalize_results(p_year);

  return v_count;
end;
$fn$;

grant execute on function public.commit_manual_results(int, text[]) to authenticated;

-- ── A3. reset_manual_results ────────────────────────────────
-- Clears p_year's result columns and un-scores rooms of p_year so a
-- re-finalize re-propagates. Before, it cleared every room.
create or replace function public.reset_manual_results(p_year int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  update public.contest_entries
     set final_place     = null,
         total_points    = null,
         jury_points     = null,
         televote_points = null,
         updated_at      = now()
   where year = p_year;

  delete from public.results
   where room_id in (select id from public.rooms where year = p_year);

  update public.predictions
     set top5_points   = null,
         worst5_points = null,
         scored_at     = null,
         is_locked     = false
   where room_id in (select id from public.rooms where year = p_year);

  -- total_points is a generated column — only zero pred_points
  update public.players
     set pred_points = 0
   where room_id in (select id from public.rooms where year = p_year);

  update public.parse_jobs
     set status       = 'idle',
         stopped_at   = null,
         last_poll_at = null,
         poll_count   = 0,
         started_at   = null,
         started_by   = null
   where year = p_year and kind = 'results';
end;
$fn$;

grant execute on function public.reset_manual_results(int) to authenticated;

-- ── A4. reset_contest ───────────────────────────────────────
-- Clears p_year's lineup and results (final_running_order, qualified and
-- the result columns); entry rows and semi data stay. Refused once the
-- contest is finalized or archived. Room effects are limited to rooms of
-- p_year. Before, it deleted every participant and every room's results.
drop function if exists public.reset_contest(int);

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

  -- Core: always runs
  update public.contest_entries
     set final_running_order = null,
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

    -- total_points is generated; only zero pred_points
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

  -- Optional A
  if p_delete_predictions and not p_delete_rooms then
    delete from public.predictions
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  -- Optional B — zero source columns; total_points regenerates automatically
  if p_reset_points and not p_delete_rooms then
    update public.players
       set quiz_points = 0,
           duel_points = 0,
           pred_points = 0
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  -- Optional C
  if p_delete_rooms then
    delete from public.rooms where year = p_year;
  end if;
end;
$fn$;

grant execute on function public.reset_contest(int, bool, bool, bool) to authenticated;

commit;
