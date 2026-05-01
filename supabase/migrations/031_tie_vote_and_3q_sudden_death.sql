-- ============================================================
-- 031: Tie Vote (champion tiebreak gate) + 3-question Sudden Death
-- ------------------------------------------------------------
-- When the champion category produces co-winners, the host can open
-- a Tie Vote: every active player gets 20 seconds to vote either
-- 'accept' (share the throne) or 'sudden_death' (play it out).
--   • accept majority  → tie locked in, both players keep the card
--   • sudden_death majority → host can then open a 3-question
--                              sudden-death match
--   • equal vote counts → default to accept (less frustrating end)
--
-- Sudden Death moves from a single question to 3 questions per match.
-- Existing single-question rounds keep working for non-champion
-- categories; the 3Q path is opt-in via open_sudden_death_match.
-- ============================================================

create table if not exists public.tie_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category winner_category not null,
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active','accept','sudden_death','cancelled')),
  decided_at timestamptz,
  unique (room_id, category)
);
create index if not exists tie_votes_room_active on public.tie_votes(room_id, status);

create table if not exists public.tie_vote_choices (
  vote_id uuid not null references public.tie_votes(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  choice text not null check (choice in ('accept','sudden_death')),
  voted_at timestamptz not null default now(),
  primary key (vote_id, player_id)
);

alter table public.tie_votes enable row level security;
drop policy if exists tie_votes_read on public.tie_votes;
create policy tie_votes_read on public.tie_votes
  for select to authenticated using (
    exists (select 1 from public.players p where p.room_id = tie_votes.room_id and p.user_id = auth.uid())
  );

alter table public.tie_vote_choices enable row level security;
drop policy if exists tie_vote_choices_read on public.tie_vote_choices;
create policy tie_vote_choices_read on public.tie_vote_choices
  for select to authenticated using (
    exists (
      select 1 from public.tie_votes v
      join public.players p on p.room_id = v.room_id and p.user_id = auth.uid()
      where v.id = tie_vote_choices.vote_id
    )
  );

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

  -- Must be a real tie — at least 2 winners in this category.
  select count(*) into v_count from winners
   where room_id = p_room_id and category = p_category;
  if v_count < 2 then
    raise exception 'no tie to vote on (% winners)', v_count;
  end if;

  delete from tie_votes where room_id = p_room_id and category = p_category;
  insert into tie_votes(room_id, category, closes_at)
  values (p_room_id, p_category, now() + interval '20 seconds')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cast_tie_vote(p_vote_id uuid, p_choice text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_player_id uuid;
  v_status text;
  v_closes timestamptz;
begin
  if p_choice not in ('accept','sudden_death') then
    raise exception 'invalid choice: %', p_choice;
  end if;
  select status, closes_at into v_status, v_closes from tie_votes where id = p_vote_id;
  if v_status is null then raise exception 'no such vote'; end if;
  if v_status <> 'active' then raise exception 'vote already closed (%)', v_status; end if;
  if now() > v_closes then raise exception 'voting window expired'; end if;

  select p.id into v_player_id
    from tie_votes v
    join players p on p.room_id = v.room_id and p.user_id = auth.uid() and p.is_active
   where v.id = p_vote_id;
  if v_player_id is null then raise exception 'not a member of this room'; end if;

  insert into tie_vote_choices(vote_id, player_id, choice)
  values (p_vote_id, v_player_id, p_choice)
  on conflict (vote_id, player_id) do update set choice = excluded.choice, voted_at = now();
end;
$$;

create or replace function public.tally_tie_vote(p_vote_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_room uuid;
  v_status text;
  v_accept int;
  v_sd int;
  v_decision text;
begin
  select room_id, status into v_room, v_status from tie_votes where id = p_vote_id;
  if v_room is null then raise exception 'no such vote'; end if;
  if v_status <> 'active' then return v_status; end if;

  -- Anyone in the room can trigger a tally once the window has expired,
  -- or the host can force-tally early via the admin path.
  select count(*) filter (where choice = 'accept'),
         count(*) filter (where choice = 'sudden_death')
    into v_accept, v_sd
    from tie_vote_choices where vote_id = p_vote_id;

  -- Tie of votes (or no votes at all) → default to accept.
  if v_sd > v_accept then v_decision := 'sudden_death'; else v_decision := 'accept'; end if;

  update tie_votes set status = v_decision, decided_at = now() where id = p_vote_id;
  return v_decision;
end;
$$;

revoke all on function public.open_tie_vote(uuid, winner_category) from public;
revoke all on function public.cast_tie_vote(uuid, text) from public;
revoke all on function public.tally_tie_vote(uuid) from public;
grant execute on function public.open_tie_vote(uuid, winner_category) to authenticated;
grant execute on function public.cast_tie_vote(uuid, text) to authenticated;
grant execute on function public.tally_tie_vote(uuid) to authenticated;

-- ── 3-question sudden-death match ───────────────────────────────────────
-- A "match" is a sequence of 3 sudden_death_rounds rows tied together by
-- a match_id. Each round has its own question and its own answers; the
-- match-level winner = highest total correct (tiebreak: faster total).
alter table public.sudden_death_rounds
  add column if not exists match_id uuid,
  add column if not exists question_index int default 0;

create index if not exists sd_rounds_match on public.sudden_death_rounds(match_id);

create or replace function public.open_sudden_death_match(
  p_room_id uuid, p_category winner_category, p_question_ids int[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_is_host boolean;
  v_match_id uuid := gen_random_uuid();
  v_qid int;
  v_idx int := 0;
begin
  select is_host into v_is_host from players
   where room_id = p_room_id and user_id = auth.uid() and is_active limit 1;
  if not coalesce(v_is_host, false) then
    raise exception 'only host can open sudden death';
  end if;
  if array_length(p_question_ids, 1) is distinct from 3 then
    raise exception 'sudden-death match needs exactly 3 questions';
  end if;

  delete from sudden_death_rounds where room_id = p_room_id and category = p_category;

  foreach v_qid in array p_question_ids loop
    insert into sudden_death_rounds(room_id, category, question_id, match_id, question_index, closes_at)
    values (p_room_id, p_category, v_qid, v_match_id, v_idx,
            now() + interval '15 seconds' * (v_idx + 1));
    v_idx := v_idx + 1;
  end loop;

  return v_match_id;
end;
$$;

create or replace function public.resolve_sudden_death_match(p_match_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_room uuid;
  v_category winner_category;
  v_winner uuid;
begin
  select room_id, category into v_room, v_category
    from sudden_death_rounds where match_id = p_match_id limit 1;
  if v_room is null then raise exception 'no such match'; end if;

  -- Highest total of correct answers across the 3 rounds; tiebreak by
  -- lowest total response_ms.
  select player_id into v_winner
    from sudden_death_answers a
    join sudden_death_rounds r on r.id = a.round_id
   where r.match_id = p_match_id
   group by player_id
   order by sum(case when a.is_correct then 1 else 0 end) desc,
            sum(coalesce(a.response_ms, 999999)) asc
   limit 1;

  if v_winner is not null then
    -- Tag the winner; keep the loser as a runner-up.
    update sudden_death_rounds
       set status = 'completed', winner_player_id = v_winner
     where match_id = p_match_id;

    -- Replace the co-winner pair with the single sudden-death victor.
    update winners set is_sudden_death_winner = true
     where room_id = v_room and category = v_category and player_id = v_winner;
    delete from winners
     where room_id = v_room and category = v_category and player_id <> v_winner;
  end if;

  return v_winner;
end;
$$;

revoke all on function public.open_sudden_death_match(uuid, winner_category, int[]) from public;
revoke all on function public.resolve_sudden_death_match(uuid) from public;
grant execute on function public.open_sudden_death_match(uuid, winner_category, int[]) to authenticated;
grant execute on function public.resolve_sudden_death_match(uuid) to authenticated;
