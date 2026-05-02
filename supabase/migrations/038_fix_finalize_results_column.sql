-- 038_fix_finalize_results_column.sql
-- finalize_results in 027 used entered_by_player_id which does not exist on
-- the results table. The correct column is confirmed_by (from 001_initial_schema).

begin;

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
    return 0;
  end if;

  -- 3. Propagate to every room with predictions and no per-room results yet.
  for v_room_id in
    select distinct p.room_id
      from public.predictions p
     where not exists (
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
      -- confirmed_by is the correct column (entered_by_player_id never existed)
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

commit;
