-- Rollback of 108: the per-room Finalize as it was live on 28 Nov 2026.
begin;
CREATE OR REPLACE FUNCTION public.finalize_results(p_year integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select array_agg(iso order by final_place) into v_ranking_arr
    from public.game_entries
   where year = p_year and in_final and final_place is not null;

  if v_ranking_arr is null or array_length(v_ranking_arr, 1) is null then
    return 0;
  end if;

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
$function$
;
CREATE OR REPLACE FUNCTION public.finalize_contest(p_year integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  perform public.finalize_results(p_year);

  update public.contests
     set stage = 'finalized', finalized_at = now(), updated_at = now()
   where year = p_year;

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

  return v_count;
end;
$function$
;
drop function if exists public._score_year_predictions(int);
commit;
