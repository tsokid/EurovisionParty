-- 094: intel purchases decided on the server (security pack 2, item 1).
--
-- Before: purchase_intel took the player and the cost from the caller (a
-- negative cost minted points, a rival's id drained theirs), players could
-- INSERT intel_reveals rows directly (a free reveal), and get_intel_reveal
-- answered anyone, for any room, purchased or not.
--
-- After:
--   * purchase_intel keeps its signature (the live client keeps working) but
--     acts only for the caller's own player in that room; the cost comes from
--     the reveal type (top3 50, top10 150, worst3 50 = INTEL_COSTS in
--     src/lib/constants.ts), p_cost is ignored. The player row is locked, so
--     two taps can't spend the same points twice.
--   * get_intel_reveal answers only a member who bought that reveal.
--   * Players can no longer write intel_reveals directly.
--   * anon can execute neither function.

begin;

create or replace function public.purchase_intel(
  p_room_id uuid, p_player_id uuid, p_reveal_type text, p_cost integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me    uuid := public.my_player_id(p_room_id);
  v_cost  int;
  v_total int;
begin
  if v_me is null then
    raise exception 'Not a member of this room' using errcode = '42501';
  end if;
  if p_player_id is distinct from v_me then
    raise exception 'Player does not belong to the calling user' using errcode = '42501';
  end if;

  v_cost := case p_reveal_type
              when 'top3'   then 50
              when 'top10'  then 150
              when 'worst3' then 50
            end;
  if v_cost is null then
    raise exception 'Invalid reveal type: %', p_reveal_type;
  end if;

  -- Lock the buyer's row: concurrent purchases are serialised.
  select total_points into v_total from players where id = v_me for update;

  if exists (select 1 from intel_reveals
              where room_id = p_room_id and player_id = v_me and reveal_type = p_reveal_type) then
    raise exception 'Already purchased this intel';
  end if;

  if v_total < v_cost then
    raise exception 'Not enough points (have %, need %)', v_total, v_cost;
  end if;

  insert into intel_reveals (room_id, player_id, reveal_type, points_cost)
  values (p_room_id, v_me, p_reveal_type, v_cost);

  update players set points_spent = points_spent + v_cost where id = v_me;

  return public.get_intel_reveal(p_room_id, p_reveal_type);
end;
$$;

create or replace function public.get_intel_reveal(p_room_id uuid, p_reveal_type text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me      uuid := public.my_player_id(p_room_id);
  v_ranking jsonb;
  v_result  jsonb;
begin
  if v_me is null then
    raise exception 'Not a member of this room' using errcode = '42501';
  end if;
  if not exists (select 1 from intel_reveals
                  where room_id = p_room_id and player_id = v_me and reveal_type = p_reveal_type) then
    raise exception 'Intel not purchased' using errcode = '42501';
  end if;

  select final_ranking into v_ranking from results where room_id = p_room_id;
  if v_ranking is null then
    return jsonb_build_object('available', false, 'data', '[]'::jsonb);
  end if;

  if p_reveal_type = 'top3' then
    select jsonb_agg(elem order by ord) into v_result
      from jsonb_array_elements_text(v_ranking) with ordinality as t(elem, ord) where ord <= 3;
  elsif p_reveal_type = 'top10' then
    select jsonb_agg(elem order by ord) into v_result
      from jsonb_array_elements_text(v_ranking) with ordinality as t(elem, ord) where ord <= 10;
  elsif p_reveal_type = 'worst3' then
    select jsonb_agg(elem order by ord desc) into v_result
      from (select elem, ord from jsonb_array_elements_text(v_ranking) with ordinality as t(elem, ord)
             order by ord desc limit 3) s;
  else
    raise exception 'Invalid reveal type: %', p_reveal_type;
  end if;

  return jsonb_build_object('available', true, 'data', coalesce(v_result, '[]'::jsonb));
end;
$$;

revoke execute on function public.purchase_intel(uuid, uuid, text, integer) from public, anon;
revoke execute on function public.get_intel_reveal(uuid, text) from public, anon;
grant execute on function public.purchase_intel(uuid, uuid, text, integer) to authenticated, service_role;
grant execute on function public.get_intel_reveal(uuid, text) to authenticated, service_role;

drop policy if exists intel_reveals_insert on public.intel_reveals;
revoke insert, update, delete on public.intel_reveals from anon, authenticated;

commit;
