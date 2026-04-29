-- 019_winners.sql
-- Winner categories per room. One row per (room, category, player).
-- Multiple rows per category = co-winners.

do $$ begin
  create type winner_category as enum ('champion', 'thief', 'duelist', 'oracle', 'guru');
exception when duplicate_object then null; end $$;

create table if not exists public.winners (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category winner_category not null,
  player_id uuid not null references public.players(id) on delete cascade,
  metric_value numeric not null,
  is_sudden_death_winner boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (room_id, category, player_id)
);

create index if not exists winners_room on public.winners(room_id);

create table if not exists public.sudden_death_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category winner_category not null,
  question_id int not null,
  opened_at timestamptz not null default now(),
  closes_at timestamptz,
  status text not null default 'active' check (status in ('active','completed')),
  winner_player_id uuid references public.players(id),
  unique (room_id, category)
);

create table if not exists public.sudden_death_answers (
  round_id uuid not null references public.sudden_death_rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  answer_index int,
  answered_at timestamptz not null default now(),
  response_ms int,
  is_correct boolean,
  primary key (round_id, player_id)
);

create or replace function public.compute_winners(p_room_id uuid)
returns int language plpgsql security definer as $$
declare
  inserted int := 0;
begin
  delete from public.winners where room_id = p_room_id and is_sudden_death_winner = false;

  -- CHAMPION: max(total_points). Ties = co-winners.
  insert into public.winners(room_id, category, player_id, metric_value)
  select p_room_id, 'champion', p.id, p.total_points
  from public.players p
  where p.room_id = p_room_id and p.status <> 'exited'
    and p.total_points = (select max(total_points) from public.players where room_id = p_room_id and status <> 'exited');

  -- THIEF: max sum of duels.points_transferred where winner_decision='steal'
  insert into public.winners(room_id, category, player_id, metric_value)
  with stolen as (
    select winner_id as pid, coalesce(sum(points_transferred),0) as v
    from public.duels
    where room_id = p_room_id and status='completed' and winner_decision='steal' and winner_id is not null
    group by winner_id
  ), top as (select max(v) as m from stolen where v > 0)
  select p_room_id, 'thief', s.pid, s.v
  from stolen s, top
  where s.v = top.m and top.m > 0;

  -- DUELIST: max count of duels.winner_id
  insert into public.winners(room_id, category, player_id, metric_value)
  with wins as (
    select winner_id as pid, count(*)::numeric as v
    from public.duels where room_id = p_room_id and status='completed' and winner_id is not null
    group by winner_id
  ), top as (select max(v) as m from wins where v > 0)
  select p_room_id, 'duelist', w.pid, w.v
  from wins w, top
  where w.v = top.m and top.m > 0;

  -- ORACLE: max predictions.total_points
  insert into public.winners(room_id, category, player_id, metric_value)
  with pp as (
    select player_id as pid, coalesce(sum(total_points),0) as v
    from public.predictions where room_id = p_room_id
    group by player_id
  ), top as (select max(v) as m from pp where v > 0)
  select p_room_id, 'oracle', pp.pid, pp.v
  from pp, top
  where pp.v = top.m and top.m > 0;

  -- GURU: most CORRECT quiz answers (count where is_correct=true)
  insert into public.winners(room_id, category, player_id, metric_value)
  with qq as (
    select player_id as pid, count(*)::numeric as v
    from public.quiz_answers where room_id = p_room_id and is_correct = true
    group by player_id
  ), top as (select max(v) as m from qq where v > 0)
  select p_room_id, 'guru', qq.pid, qq.v
  from qq, top
  where qq.v = top.m and top.m > 0;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

alter table public.winners enable row level security;
drop policy if exists winners_read on public.winners;
create policy winners_read on public.winners
  for select using (
    exists (select 1 from public.players where players.room_id = winners.room_id and players.user_id = auth.uid())
  );

alter table public.sudden_death_rounds enable row level security;
drop policy if exists sd_rounds_read on public.sudden_death_rounds;
create policy sd_rounds_read on public.sudden_death_rounds
  for select using (
    exists (select 1 from public.players where players.room_id = sudden_death_rounds.room_id and players.user_id = auth.uid())
  );

alter table public.sudden_death_answers enable row level security;
drop policy if exists sd_answers_read on public.sudden_death_answers;
create policy sd_answers_read on public.sudden_death_answers
  for select using (
    exists (
      select 1 from public.sudden_death_rounds r
      join public.players pl on pl.room_id = r.room_id
      where r.id = sudden_death_answers.round_id and pl.user_id = auth.uid()
    )
  );
