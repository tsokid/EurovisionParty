-- ============================================================
-- 108: Finalize scores the whole year in a few statements (F9)
-- ------------------------------------------------------------
-- 28 Nov 2026. Finalize used to walk every room, and inside it every
-- prediction, one UPDATE at a time (about 10,000 single-row updates for
-- 5,000 players), with the rooms already flipped to 'final' at the start,
-- so every room row stayed locked for the whole run. Each player update
-- was also pushed to the room one by one.
--
-- Now:
--   * _score_year_predictions(year) writes the results row of every room
--     still unscored, scores every prediction of those rooms and adds the
--     points to the players, in three set-based statements. The points
--     are exactly score_all_predictions' (50 for the right place, 20 for
--     a right country in the wrong place, top 5 and worst 5).
--   * The player rows it touches are not pushed one by one: each scored
--     room gets one 'refresh' message and the phones reread the standings.
--   * finalize_contest scores, writes the winners, and flips the rooms to
--     'final' LAST, so the room rows are locked only for that final step.
--     finalize_results (the parser's button) scores, then flips.
-- Nothing else changes: same guards, same return values.
-- ============================================================
begin;

create or replace function public._score_year_predictions(p_year int)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ranking text[];
  v_n       int;
  v_top     text[];
  v_worst   text[];
  v_rooms   uuid[];
  v_room    uuid;
begin
  select array_agg(iso order by final_place) into v_ranking
    from public.game_entries
   where year = p_year and in_final and final_place is not null;
  v_n := coalesce(array_length(v_ranking, 1), 0);
  if v_n = 0 then return 0; end if;

  v_top := v_ranking[1:5];
  v_worst := array(select v_ranking[v_n - i + 1] from generate_series(1, least(5, v_n)) i order by i);

  -- The results row of every room with predictions and no results yet,
  -- confirmed by its host (or its earliest player still in the room).
  with targets as (
    select distinct p.room_id
      from public.predictions p
      join public.rooms ro on ro.id = p.room_id
     where ro.year = p_year
       and not exists (select 1 from public.results r where r.room_id = p.room_id)
  ), confirmers as (
    select t.room_id,
           (select pl.id from public.players pl
             where pl.room_id = t.room_id and (pl.is_host = true or pl.status <> 'exited')
             order by pl.is_host desc nulls last, pl.joined_at asc
             limit 1) as host_id
      from targets t
  ), ins as (
    insert into public.results (room_id, final_ranking, confirmed_by)
    select room_id, to_jsonb(v_ranking), host_id
      from confirmers
     where host_id is not null
    on conflict (room_id) do nothing
    returning room_id
  )
  select array_agg(room_id) into v_rooms from ins;

  if v_rooms is null then return 0; end if;

  -- One 'refresh' per room below, not one push per player row.
  perform set_config('app.rt_bulk', 'on', true);

  with scored as (
    select pr.id, pr.player_id,
           (select coalesce(sum(case when pr.top5[i] = v_top[i] then 50
                                     when pr.top5[i] = any (v_top) then 20
                                     else 0 end), 0)
              from generate_series(1, 5) i)::int as t5,
           (select coalesce(sum(case when pr.worst5[i] = v_worst[i] then 50
                                     when pr.worst5[i] = any (v_worst) then 20
                                     else 0 end), 0)
              from generate_series(1, 5) i)::int as w5
      from public.predictions pr
     where pr.room_id = any (v_rooms)
  ), upd as (
    update public.predictions p
       set top5_points = s.t5, worst5_points = s.w5, scored_at = now(), is_locked = true
      from scored s
     where p.id = s.id
    returning s.player_id, s.t5 + s.w5 as pts
  )
  update public.players pl
     set pred_points = pl.pred_points + x.pts
    from (select player_id, sum(pts)::int as pts from upd group by player_id) x
   where pl.id = x.player_id;

  perform set_config('app.rt_bulk', 'off', true);

  foreach v_room in array v_rooms loop
    perform public.rt_push('room:' || v_room, 'players',
      jsonb_build_object('table', 'players', 'op', 'REFRESH', 'new', null, 'old', null));
  end loop;

  return array_length(v_rooms, 1);
end $$;
revoke execute on function public._score_year_predictions(int) from public, anon, authenticated;

create or replace function public.finalize_results(p_year int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_scored int;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select status into v_status
    from public.parse_jobs
   where year = p_year and kind = 'results';
  if v_status is null then
    raise exception 'no results job for year %', p_year;
  end if;

  v_scored := public._score_year_predictions(p_year);

  -- Last: the status change moves every room of the year to 'final'
  -- (trg_results_status_advance).
  if v_status <> 'finalized' then
    update public.parse_jobs
       set status = 'finalized', stopped_at = now()
     where year = p_year and kind = 'results';
  end if;

  return v_scored;
end $$;
revoke execute on function public.finalize_results(int) from public, anon;
grant execute on function public.finalize_results(int) to authenticated;

create or replace function public.finalize_contest(p_year int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_stage public.contest_stage;
  v_room  uuid;
  v_count int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year for update;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage <> 'current' then
    raise exception 'contest % is %; finalize requires current', p_year, v_stage;
  end if;
  if not exists (
    select 1 from public.game_entries where year = p_year and in_final and final_place is not null
  ) then
    raise exception 'contest % has no results; finalize refused', p_year;
  end if;
  if not exists (select 1 from public.parse_jobs where year = p_year and kind = 'results') then
    raise exception 'no results job for year %', p_year;
  end if;

  -- 1. Scores.
  perform public._score_year_predictions(p_year);

  update public.contests
     set stage = 'finalized', finalized_at = now(), updated_at = now()
   where year = p_year;

  -- 2. Winners of every room that has none yet.
  for v_room in
    select r.id
      from public.rooms r
     where r.year = p_year
       and not exists (select 1 from public.winners w where w.room_id = r.id)
     order by r.id
  loop
    perform public.compute_winners(v_room);
    v_count := v_count + 1;
  end loop;

  -- 3. Last, the flip to 'final' (scores are already in, so this scores
  --    nothing more).
  perform public.finalize_results(p_year);

  return v_count;
end $$;
revoke execute on function public.finalize_contest(int) from public, anon;
grant execute on function public.finalize_contest(int) to authenticated;

commit;
