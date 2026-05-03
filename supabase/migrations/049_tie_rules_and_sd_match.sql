-- ============================================================
-- 049: Tighter tie-vote rules + tied-players-only sudden death
-- ------------------------------------------------------------
-- Rules per the host spec:
--   • Sudden death wins ONLY if it has strict majority AND ≥3 total
--     votes were cast. Otherwise the room defaults to Accept (tie
--     stays, all tied players become co-champions).
--   • Sudden death match resolution must consider ONLY the tied
--     players' answers. The previous implementation picked the best
--     answerer across the whole room, then deleted everyone else from
--     winners — which would WIPE all the original co-champions if a
--     non-tied player happened to answer fastest.
--
-- Also adds:
--   • pick_sd_questions(p_count int) — utility to grab N random quiz
--     question IDs for the SD match (host-side convenience so the UI
--     doesn't need to roll its own random query).
-- ============================================================

begin;

-- ── 1. tally_tie_vote with 3-vote threshold ────────────────────────────
create or replace function public.tally_tie_vote(p_vote_id uuid)
returns text language plpgsql security definer set search_path = public as $$
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

  -- Sudden death wins only when it has strict majority AND the room
  -- mustered at least 3 voters. Anything else (no votes, fewer than 3,
  -- accept majority, or a tie of votes) defaults to accept so the show
  -- doesn't stall.
  if v_sd > v_accept and v_total >= 3 then
    v_decision := 'sudden_death';
  else
    v_decision := 'accept';
  end if;

  update tie_votes set status = v_decision, decided_at = now() where id = p_vote_id;
  return v_decision;
end;
$$;

-- ── 2. resolve_sudden_death_match scoped to tied players ───────────────
-- Tied = the set of player_ids currently holding a winners row for this
-- (room, category). Without this scope a non-tied player who happened to
-- answer first would "win" the SD and the delete clause would wipe every
-- original co-winner, leaving the room with no champion at all.
create or replace function public.resolve_sudden_death_match(p_match_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_room     uuid;
  v_category winner_category;
  v_winner   uuid;
begin
  select room_id, category into v_room, v_category
    from sudden_death_rounds where match_id = p_match_id limit 1;
  if v_room is null then raise exception 'no such match'; end if;

  -- Tied-players-only: rank by correct answers desc, then by total
  -- response time asc. If no tied player answered correctly, fall back
  -- to fastest-overall to still produce a winner.
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
$$;

-- ── 3. pick_sd_questions helper ────────────────────────────────────────
-- Returns N random quiz_questions ids. Host-side convenience — the UI
-- can pass the result straight into open_sudden_death_match.
create or replace function public.pick_sd_questions(p_count int default 3)
returns int[] language sql security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}'::int[])
    from (
      select id from public.quiz_questions
      order by random()
      limit p_count
    ) sub;
$$;

grant execute on function public.pick_sd_questions(int) to authenticated;

-- ── 4. Add sudden_death_rounds + sudden_death_answers to realtime ──────
-- Players watching the SD match need live updates as rounds advance and
-- answers come in. Add to supabase_realtime publication if missing.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sudden_death_rounds'
  ) then
    alter publication supabase_realtime add table public.sudden_death_rounds;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sudden_death_answers'
  ) then
    alter publication supabase_realtime add table public.sudden_death_answers;
  end if;
end$$;

commit;
