-- ============================================================
-- 048: Bump tie-vote window from 20 s to 60 s
-- ------------------------------------------------------------
-- Players reported 20 s wasn't enough time to read the prompt and
-- vote, especially when the panel scrolls into view late. Move it to
-- 60 s. tally_tie_vote already defaults to 'accept' on no-vote /
-- tied-vote, so a slow room still resolves cleanly to a co-champion
-- crown rather than blocking the show.
-- ============================================================

begin;

create or replace function public.open_tie_vote(p_room_id uuid, p_category winner_category)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_is_host boolean;
  v_id uuid;
  v_count int;
begin
  select is_host into v_is_host from players
   where room_id = p_room_id and user_id = auth.uid() and is_active limit 1;
  if not coalesce(v_is_host, false) then
    raise exception 'only host can open tie vote';
  end if;

  select count(*) into v_count from winners
   where room_id = p_room_id and category = p_category;
  if v_count < 2 then
    raise exception 'no tie to vote on (% winners)', v_count;
  end if;

  delete from tie_votes where room_id = p_room_id and category = p_category;
  insert into tie_votes(room_id, category, closes_at)
  values (p_room_id, p_category, now() + interval '60 seconds')
  returning id into v_id;
  return v_id;
end;
$$;

commit;
