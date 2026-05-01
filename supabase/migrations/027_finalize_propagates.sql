-- 027_finalize_propagates.sql
-- Make finalize_results actually propagate the scoreboard to every room
-- with predictions, then score them. Today finalize_results only flips the
-- parse_jobs.status flag; this migration makes one Finalize click do the
-- whole job — auto-score every room, no host-side action needed.
--
-- Also: commit_manual_results now calls finalize_results at the end so the
-- Manual Override path converges on the same propagation logic.
--
-- Idempotent: a room with results.final_ranking already populated (host
-- entered manually via ResultsEntry) is skipped, and per-prediction scoring
-- only runs where scored_at IS NULL inside score_all_predictions.

begin;

-- ---------------------------------------------------------------------------
-- 1. Rewrite finalize_results to propagate + score
-- ---------------------------------------------------------------------------
drop function if exists public.finalize_results(int);

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

  -- 2. Build the ordered ISO array from the parser's scoreboard
  select array_agg(iso order by ranking) into v_ranking_arr
    from public.eurovision_2026_results;

  if v_ranking_arr is null or array_length(v_ranking_arr, 1) is null then
    -- No parser data to propagate (manual override hasn't committed yet,
    -- or the parser hasn't run). Status is flipped, but nothing to score.
    return 0;
  end if;

  -- 3. Propagate to every room with predictions and no per-room results yet.
  --    Rooms where the host already entered manually via ResultsEntry are
  --    skipped (host wins per the original spec).
  for v_room_id in
    select distinct p.room_id
      from public.predictions p
     where not exists (
       select 1 from public.results r where r.room_id = p.room_id
     )
  loop
    -- Find a player to attribute the entry to (must be NOT NULL for the
    -- entered_by_player_id column). Prefer the host; fall back to any
    -- non-exited player if the host has left.
    select id into v_host_id
      from public.players
     where room_id = v_room_id
       and (is_host = true or status <> 'exited')
     order by is_host desc nulls last, joined_at asc
     limit 1;

    if v_host_id is not null then
      insert into public.results (room_id, final_ranking, entered_by_player_id)
      values (v_room_id, to_jsonb(v_ranking_arr), v_host_id)
      on conflict (room_id) do nothing;

      -- score_all_predictions iterates predictions for the room and writes
      -- top5_points/worst5_points/scored_at + adds to players.pred_points.
      perform public.score_all_predictions(v_room_id);
      v_scored_count := v_scored_count + 1;
    end if;
  end loop;

  return v_scored_count;
end;
$fn$;

grant execute on function public.finalize_results(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. commit_manual_results now also propagates by calling finalize_results
-- ---------------------------------------------------------------------------
create or replace function public.commit_manual_results(p_year int, p_isos text[])
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count    int;
  v_expected int;
  i          int;
  v_iso      text;
  v_total    int;
  v_jury     int;
  v_tele     int;
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
    from public.eurovision_2026_participants;
  if v_expected = 0 then
    raise exception 'no participants found — run participants parser first';
  end if;
  if v_count <> v_expected then
    raise exception 'expected % rankings (one per finalist), got %', v_expected, v_count;
  end if;

  perform 1
    from unnest(p_isos) iso(code)
    where not exists (
      select 1 from public.eurovision_2026_participants p where p.iso = iso.code
    )
    limit 1;
  if found then
    raise exception 'one or more ISOs are not in eurovision_2026_participants';
  end if;

  delete from public.eurovision_2026_results;

  for i in 1 .. v_count loop
    v_iso := p_isos[i];
    v_total := (v_count + 1 - i) * 10;
    v_jury := v_total / 2;
    v_tele := v_total - v_jury;
    insert into public.eurovision_2026_results
      (iso, ranking, total_points, jury_points, televote_points, source)
    values
      (v_iso, i, v_total, v_jury, v_tele, 'manual');
  end loop;

  -- Flip status + propagate to all rooms via finalize_results
  perform public.finalize_results(p_year);

  return v_count;
end;
$fn$;

grant execute on function public.commit_manual_results(int, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. reset_manual_results also clears per-room results so that re-finalizing
--    correctly re-propagates. Without this, a Reset → Finalize cycle would
--    skip rooms that already had their old (now-stale) ranking.
-- ---------------------------------------------------------------------------
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

  delete from public.eurovision_2026_results;

  -- Clear per-room rankings + un-score predictions so re-finalize works
  delete from public.results;
  update public.predictions
     set top5_points = null, worst5_points = null,
         scored_at = null, is_locked = false;
  update public.players set pred_points = 0;

  update public.parse_jobs
    set status = 'idle',
        stopped_at = null,
        last_poll_at = null,
        poll_count = 0,
        started_at = null,
        started_by = null
    where year = p_year and kind = 'results';
end;
$fn$;

grant execute on function public.reset_manual_results(int) to authenticated;

commit;
