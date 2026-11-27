-- 099_question_serving.sql
-- Security pack 2b/2c (expand): the server is the referee for every question.
--
-- * question_serves: one row each time a question is shown to a player, in a
--   quiz, a duel or a sudden-death match. Unique per (room, player,
--   question): a question shown once is burnt for that player in that room
--   (owner rule, 27 Nov), whatever the game mode.
-- * Quiz: quiz_state / quiz_next / quiz_answer. The server draws each
--   question for this player (round mix by era from quiz_settings, counted
--   from the room's year; an empty era borrows from the next), starts its
--   15″ clock when it serves it, and scores the answer by its own clock
--   (owner decision 2c: server time only, no network allowance). Once shown,
--   a question's time runs even if the player leaves (decision 1a); on return
--   quiz_state reports the round and question, and the player presses Start.
--   The correct answer is returned only with the verdict.
-- * Duels: the three questions are drawn by the server when the duel is
--   accepted (1 this year, 1 last year, 1 from 2–5 or 5+ years), excluding
--   what either player has seen; both players get the same three. Before
--   acceptance the duel has no questions (A9). duel_next / duel_answer serve
--   and score them one at a time (12″, 12 − whole seconds).
-- * Sudden death: open_sudden_death_match draws its three questions on the
--   server (the client's ids are ignored); sudden_death_question returns the
--   text while open and the correct answer only after the round closes.
-- The old client paths (submit_quiz_answer, submit_duel_answers, the client
-- question ids) keep working until the new client is live; 100 closes them.

-- ── 1. Serves ────────────────────────────────────────────────────────────
create table if not exists public.question_serves (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  kind          text not null check (kind in ('quiz', 'duel', 'sudden')),
  duel_id       uuid references public.duels(id) on delete cascade,
  round_number  int,
  position      int not null,
  question_id   int not null references public.quiz_questions(id),
  served_at     timestamptz not null default now(),
  deadline      timestamptz not null,
  answer_index  int check (answer_index between 0 and 3),
  answered_at   timestamptz,
  response_ms   int,
  is_correct    boolean,
  points        int,
  constraint question_serves_burnt unique (room_id, player_id, question_id),
  constraint question_serves_quiz_shape check (kind <> 'quiz' or (round_number between 1 and 3 and position between 1 and 10)),
  constraint question_serves_duel_shape check (kind <> 'duel' or (duel_id is not null and position between 1 and 3))
);
create unique index if not exists question_serves_quiz_slot
  on public.question_serves (player_id, round_number, position) where kind = 'quiz';
create unique index if not exists question_serves_duel_slot
  on public.question_serves (duel_id, player_id, position) where kind = 'duel';
create index if not exists question_serves_player_idx on public.question_serves (room_id, player_id);

alter table public.question_serves enable row level security;
drop policy if exists question_serves_own on public.question_serves;
create policy question_serves_own on public.question_serves
  for select to authenticated using (player_id = my_player_id(room_id));
revoke all on public.question_serves from anon, authenticated;
grant select on public.question_serves to authenticated;

-- ── 2. What a player has already seen in a room ──────────────────────────
-- Served questions, plus what the older client recorded (quiz answers,
-- duel question lists, sudden-death answers), plus questions reserved for
-- the player's accepted duels that are not played yet.
create or replace function public.seen_question_ids(p_room_id uuid, p_player_id uuid)
returns setof int language sql stable security definer set search_path = public, pg_temp as $$
  select question_id from question_serves where room_id = p_room_id and player_id = p_player_id
  union
  select question_id from quiz_answers where room_id = p_room_id and player_id = p_player_id
  union
  select unnest(d.question_ids) from duels d
   where d.room_id = p_room_id and p_player_id in (d.challenger_id, d.challenged_id)
     and d.status not in ('pending', 'declined')
  union
  select r.question_id from sudden_death_rounds r
   where r.room_id = p_room_id
     and exists (select 1 from sudden_death_answers a where a.round_id = r.id and a.player_id = p_player_id)
$$;
revoke execute on function public.seen_question_ids(uuid, uuid) from public, anon, authenticated;

-- ── 3. Drawing a question ────────────────────────────────────────────────
-- A random verified question of p_era for the room's year, unseen by every
-- player in p_players and not in p_exclude. If that era has none left, the
-- next era is tried (current → previous → recent → classic → current …).
create or replace function public.draw_question(p_room_id uuid, p_players uuid[], p_era text, p_exclude int[] default '{}')
returns int language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_year int;
  v_order text[] := array['current', 'previous', 'recent', 'classic'];
  v_start int;
  v_era text;
  v_qid int;
begin
  select year into v_year from rooms where id = p_room_id;
  v_year := coalesce(v_year, live_contest_year());
  v_start := coalesce(array_position(v_order, p_era), 1);
  for i in 0..3 loop
    v_era := v_order[((v_start - 1 + i) % 4) + 1];
    select q.id into v_qid
      from quiz_questions q
     where q.status = 'verified'
       and question_era(q.contest_year, v_year) = v_era
       and not (q.id = any (coalesce(p_exclude, '{}')))
       and not exists (
         select 1 from unnest(p_players) p(pid)
          where q.id in (select seen_question_ids(p_room_id, p.pid)))
     order by random()
     limit 1;
    if v_qid is not null then return v_qid; end if;
  end loop;
  raise exception 'no_question_left' using errcode = 'P0001';
end $$;
revoke execute on function public.draw_question(uuid, uuid[], text, int[]) from public, anon, authenticated;

-- The question as players see it: text and options, never the answer.
create or replace function public.question_public(p_id int) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('id', id, 'question', question_en, 'question_el', question_el,
                            'options', to_jsonb(options_en), 'options_el', to_jsonb(options_el),
                            'difficulty', difficulty)
    from quiz_questions where id = p_id
$$;
revoke execute on function public.question_public(int) from public, anon, authenticated;

-- ── 4. Quiz ──────────────────────────────────────────────────────────────
create or replace function public.quiz_points_for(p_ms int) returns int
language sql immutable set search_path = public, pg_temp as $$
  -- Rounded up to the hundredth, as 083: 3001 ms is 3.01 s, the 8-point tier.
  select case when ceil(p_ms / 10.0) / 100.0 <= 3 then 12
              when ceil(p_ms / 10.0) / 100.0 <= 7 then 8
              else 4 end
$$;

-- Closes a serve whose time ran out: no answer, no points. For the quiz it
-- also writes the quiz_answers row the rest of the game reads.
create or replace function public.close_expired_serve(p_serve public.question_serves)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update question_serves
     set answered_at = p_serve.deadline, is_correct = false, points = 0,
         response_ms = (extract(epoch from (p_serve.deadline - p_serve.served_at)) * 1000)::int
   where id = p_serve.id and answered_at is null;
  if found and p_serve.kind = 'quiz' then
    insert into quiz_answers (room_id, player_id, round_number, question_id, answer_index, is_correct,
                              question_opened_at, answered_at, response_seconds, points_awarded)
    values (p_serve.room_id, p_serve.player_id, p_serve.round_number, p_serve.question_id, null, false,
            p_serve.served_at, p_serve.deadline,
            round(extract(epoch from (p_serve.deadline - p_serve.served_at))::numeric, 2), 0)
    on conflict (player_id, question_id, round_number) do nothing;
  end if;
end $$;
revoke execute on function public.close_expired_serve(public.question_serves) from public, anon, authenticated;

-- Where the caller is in the quiz. Closes a question whose time ran out.
-- { round, position (next to serve, 1..10), answered (in this round),
--   open: {serve_id, position, remaining_ms} | null, done, rounds, per_round }
create or replace function public.quiz_state(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_player uuid := my_player_id(p_room_id);
  v_serve question_serves;
  v_round int;
  v_n int;
begin
  if v_player is null then raise exception 'not_in_room' using errcode = '42501'; end if;

  for v_serve in select * from question_serves
                  where player_id = v_player and room_id = p_room_id and kind = 'quiz'
                    and answered_at is null and deadline <= now() loop
    perform close_expired_serve(v_serve);
  end loop;

  select * into v_serve from question_serves
   where player_id = v_player and room_id = p_room_id and kind = 'quiz' and answered_at is null
   order by served_at desc limit 1;

  -- The current round: the first with fewer than 10 closed questions.
  -- Answers from the older client count too.
  v_round := 1;
  loop
    select count(*) into v_n from (
      select question_id from question_serves
       where player_id = v_player and room_id = p_room_id and kind = 'quiz' and round_number = v_round and answered_at is not null
      union
      select question_id from quiz_answers where player_id = v_player and room_id = p_room_id and round_number = v_round) x;
    exit when v_n < 10 or v_round = 3;
    v_round := v_round + 1;
  end loop;

  return jsonb_build_object(
    'round', v_round,
    'answered', v_n,
    'position', least(v_n + 1, 10),
    'done', v_round = 3 and v_n >= 10,
    'rounds', 3,
    'per_round', 10,
    'open', case when v_serve.id is null then null else jsonb_build_object(
      'serve_id', v_serve.id, 'round', v_serve.round_number, 'position', v_serve.position,
      'remaining_ms', greatest(0, (extract(epoch from (v_serve.deadline - now())) * 1000)::int)) end);
end $$;

-- Serves the caller's next quiz question of the current round (or the one
-- already open, with the time it has left). p_round must be the current
-- round, so a player cannot skip ahead.
create or replace function public.quiz_next(p_room_id uuid, p_round int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_player uuid := my_player_id(p_room_id);
  v_state jsonb;
  v_serve question_serves;
  v_pos int;
  v_era text;
  v_qid int;
  v_left jsonb := '{}';
  v_pick int;
begin
  v_state := quiz_state(p_room_id);
  if (v_state ->> 'done')::boolean then raise exception 'quiz_done' using errcode = 'P0001'; end if;
  if p_round is distinct from (v_state ->> 'round')::int then
    raise exception 'wrong_round' using errcode = 'P0001';
  end if;

  select * into v_serve from question_serves
   where player_id = v_player and room_id = p_room_id and kind = 'quiz' and answered_at is null
   order by served_at desc limit 1;

  if v_serve.id is null then
    v_pos := (v_state ->> 'position')::int;
    -- Era for this slot: what the round mix still owes, picked at random
    -- in proportion to what is left.
    select jsonb_object_agg(m.era, m.n - coalesce(u.used, 0)) into v_left
      from quiz_round_mix(10) m
      left join (
        select question_era(q.contest_year, coalesce(r.year, live_contest_year())) era, count(*)::int used
          from question_serves s join quiz_questions q on q.id = s.question_id join rooms r on r.id = s.room_id
         where s.player_id = v_player and s.room_id = p_room_id and s.kind = 'quiz' and s.round_number = p_round
         group by 1) u on u.era = m.era;
    v_pick := floor(random() * greatest(1, (select sum(greatest(value::int, 0)) from jsonb_each_text(v_left))))::int;
    for v_era in select key from jsonb_each_text(v_left), lateral (select array_position(array['current','previous','recent','classic'], key) o) z
                  where value::int > 0 order by z.o loop
      exit when v_pick < (v_left ->> v_era)::int;
      v_pick := v_pick - (v_left ->> v_era)::int;
    end loop;
    v_qid := draw_question(p_room_id, array[v_player], coalesce(v_era, 'current'));
    insert into question_serves (room_id, player_id, kind, round_number, position, question_id, deadline)
    values (p_room_id, v_player, 'quiz', p_round, v_pos, v_qid, now() + interval '15 seconds')
    returning * into v_serve;
  end if;

  return jsonb_build_object(
    'serve_id', v_serve.id, 'round', v_serve.round_number, 'position', v_serve.position,
    'question', question_public(v_serve.question_id),
    'served_at', v_serve.served_at, 'deadline', v_serve.deadline, 'server_now', now(),
    'remaining_ms', greatest(0, (extract(epoch from (v_serve.deadline - now())) * 1000)::int),
    'timer_ms', 15000);
end $$;

-- Answers a served quiz question (p_answer_index null = the player let the
-- time run out). Scored by the server clock: on time means by the deadline.
-- Returns the verdict and the correct option.
create or replace function public.quiz_answer(p_serve_id uuid, p_answer_index int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_serve question_serves;
  v_correct int;
  v_ms int;
  v_ok boolean;
  v_pts int := 0;
  v_now timestamptz := now();
  v_answer_id uuid;
begin
  select * into v_serve from question_serves where id = p_serve_id and kind = 'quiz' for update;
  if v_serve.id is null or v_serve.player_id is distinct from my_player_id(v_serve.room_id) then
    raise exception 'not_your_question' using errcode = '42501';
  end if;
  if v_serve.answered_at is not null then raise exception 'already_answered' using errcode = 'P0001'; end if;
  if p_answer_index is not null and p_answer_index not between 0 and 3 then raise exception 'bad_answer'; end if;

  select correct_index into v_correct from quiz_questions where id = v_serve.question_id;

  if p_answer_index is null or v_now > v_serve.deadline then
    perform close_expired_serve(v_serve);
    return jsonb_build_object('is_correct', false, 'timed_out', true, 'correct_index', v_correct,
                              'points_awarded', 0, 'response_seconds', 15);
  end if;

  v_ms := greatest(0, (extract(epoch from (v_now - v_serve.served_at)) * 1000)::int);
  v_ok := p_answer_index = v_correct;
  if v_ok then v_pts := quiz_points_for(v_ms); end if;

  update question_serves set answer_index = p_answer_index, answered_at = v_now, response_ms = v_ms,
                             is_correct = v_ok, points = v_pts
   where id = v_serve.id;

  insert into quiz_answers (room_id, player_id, round_number, question_id, answer_index, is_correct,
                            question_opened_at, answered_at, response_seconds, points_awarded)
  values (v_serve.room_id, v_serve.player_id, v_serve.round_number, v_serve.question_id, p_answer_index, v_ok,
          v_serve.served_at, v_now, ceil(v_ms / 10.0) / 100.0, v_pts)
  returning id into v_answer_id;
  if v_pts > 0 then update players set quiz_points = quiz_points + v_pts where id = v_serve.player_id; end if;

  return jsonb_build_object('id', v_answer_id, 'is_correct', v_ok, 'timed_out', false, 'correct_index', v_correct,
                            'points_awarded', v_pts, 'response_seconds', ceil(v_ms / 10.0) / 100.0);
end $$;

-- ── 5. Duels ─────────────────────────────────────────────────────────────
-- Questions are the server's: a client cannot set them, and they are drawn
-- when the challenged player accepts.
create or replace function public.duels_server_questions() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_q1 int; v_q2 int; v_q3 int;
  v_players uuid[];
begin
  -- (current_user is the definer here, so this cannot tell a client from
  -- the server; nothing but clients creates duels, so every new duel
  -- starts without questions.)
  if tg_op = 'INSERT' then
    new.question_ids := '{}';
    new.question_id := null;
    return new;
  end if;
  if old.status = 'pending' and new.status = 'accepted' and coalesce(cardinality(new.question_ids), 0) = 0 then
    v_players := array[new.challenger_id, new.challenged_id];
    v_q1 := draw_question(new.room_id, v_players, 'current');
    v_q2 := draw_question(new.room_id, v_players, 'previous', array[v_q1]);
    v_q3 := draw_question(new.room_id, v_players, case when random() < 0.5 then 'recent' else 'classic' end, array[v_q1, v_q2]);
    new.question_ids := array[v_q1, v_q2, v_q3];
    new.question_id := v_q1;
    new.accepted_at := coalesce(new.accepted_at, now());
  end if;
  return new;
end $$;

drop trigger if exists duels_server_questions on public.duels;
create trigger duels_server_questions before insert or update of status on public.duels
  for each row execute function public.duels_server_questions();

-- Decides a duel once both players finished (same outcome rules as
-- submit_duel_answers: higher total wins, equal totals tie).
create or replace function public.duel_finish(p_duel_id uuid, p_player uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_duel duels;
  v_answers jsonb;
  v_score int;
  v_me_challenger boolean;
  v_opp_done boolean;
  v_opp_score int;
  v_winner uuid; v_loser uuid; v_status text := 'answering';
begin
  select * into v_duel from duels where id = p_duel_id for update;
  v_me_challenger := v_duel.challenger_id = p_player;
  select coalesce(jsonb_agg(jsonb_build_object('questionId', question_id, 'answerIndex', coalesce(answer_index, -1),
                                               'answeredAt', answered_at, 'responseMs', response_ms,
                                               'points', points, 'correct', is_correct) order by position), '[]'),
         coalesce(sum(points), 0)::int
    into v_answers, v_score
    from question_serves where duel_id = p_duel_id and player_id = p_player and kind = 'duel';

  if v_me_challenger then
    v_opp_done := coalesce(jsonb_array_length(v_duel.challenged_answers), 0) > 0;
    v_opp_score := coalesce(v_duel.challenged_score, 0);
    update duels set challenger_answers = v_answers, challenger_score = v_score,
                     status = case when v_opp_done then 'completed' else 'answering' end where id = p_duel_id;
  else
    v_opp_done := coalesce(jsonb_array_length(v_duel.challenger_answers), 0) > 0;
    v_opp_score := coalesce(v_duel.challenger_score, 0);
    update duels set challenged_answers = v_answers, challenged_score = v_score,
                     status = case when v_opp_done then 'completed' else 'answering' end where id = p_duel_id;
  end if;

  if v_opp_done then
    v_status := 'completed';
    if v_score > v_opp_score then
      v_winner := p_player;
      v_loser := case when v_me_challenger then v_duel.challenged_id else v_duel.challenger_id end;
    elsif v_score < v_opp_score then
      v_winner := case when v_me_challenger then v_duel.challenged_id else v_duel.challenger_id end;
      v_loser := p_player;
    else
      v_status := 'tie';
    end if;
    update duels set winner_id = v_winner, loser_id = v_loser, completed_at = now(), status = v_status where id = p_duel_id;
  end if;

  return jsonb_build_object('status', v_status, 'winner_id', v_winner, 'loser_id', v_loser,
                            'opponent_answered', v_opp_done, 'score', v_score);
end $$;
revoke execute on function public.duel_finish(uuid, uuid) from public, anon, authenticated;

-- Serves the caller's next duel question (or the open one, with its time
-- left). { serve_id, position, question, deadline, remaining_ms, timer_ms }
-- or { finished: true, result } once the three are done.
create or replace function public.duel_next(p_duel_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_duel duels;
  v_player uuid;
  v_serve question_serves;
  v_done int;
begin
  select * into v_duel from duels where id = p_duel_id;
  if v_duel.id is null then raise exception 'duel_not_found'; end if;
  v_player := my_player_id(v_duel.room_id);
  if v_player is null or v_player not in (v_duel.challenger_id, v_duel.challenged_id) then
    raise exception 'not_your_duel' using errcode = '42501';
  end if;
  if v_duel.status not in ('accepted', 'answering') or coalesce(cardinality(v_duel.question_ids), 0) <> 3 then
    raise exception 'duel_not_open' using errcode = 'P0001';
  end if;

  for v_serve in select * from question_serves where duel_id = p_duel_id and player_id = v_player
                    and answered_at is null and deadline <= now() loop
    perform close_expired_serve(v_serve);
  end loop;

  select * into v_serve from question_serves
   where duel_id = p_duel_id and player_id = v_player and answered_at is null limit 1;
  if v_serve.id is null then
    select count(*) into v_done from question_serves where duel_id = p_duel_id and player_id = v_player;
    if v_done >= 3 then
      if (v_duel.challenger_id = v_player and coalesce(jsonb_array_length(v_duel.challenger_answers), 0) = 0)
         or (v_duel.challenged_id = v_player and coalesce(jsonb_array_length(v_duel.challenged_answers), 0) = 0) then
        return jsonb_build_object('finished', true, 'result', duel_finish(p_duel_id, v_player));
      end if;
      return jsonb_build_object('finished', true);
    end if;
    insert into question_serves (room_id, player_id, kind, duel_id, position, question_id, deadline)
    values (v_duel.room_id, v_player, 'duel', p_duel_id, v_done + 1, v_duel.question_ids[v_done + 1], now() + interval '12 seconds')
    returning * into v_serve;
    if v_duel.status = 'accepted' then update duels set status = 'answering' where id = p_duel_id and status = 'accepted'; end if;
  end if;

  return jsonb_build_object('finished', false, 'serve_id', v_serve.id, 'position', v_serve.position,
    'question', question_public(v_serve.question_id), 'deadline', v_serve.deadline, 'server_now', now(),
    'remaining_ms', greatest(0, (extract(epoch from (v_serve.deadline - now())) * 1000)::int), 'timer_ms', 12000);
end $$;

-- Answers a served duel question (null = time ran out): 12 − whole seconds
-- if right, by the server clock. After the third, the duel is decided.
create or replace function public.duel_answer(p_serve_id uuid, p_answer_index int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_serve question_serves;
  v_correct int;
  v_ms int;
  v_ok boolean := false;
  v_pts int := 0;
  v_now timestamptz := now();
  v_result jsonb;
begin
  select * into v_serve from question_serves where id = p_serve_id and kind = 'duel' for update;
  if v_serve.id is null or v_serve.player_id is distinct from my_player_id(v_serve.room_id) then
    raise exception 'not_your_question' using errcode = '42501';
  end if;
  if v_serve.answered_at is not null then raise exception 'already_answered' using errcode = 'P0001'; end if;
  if p_answer_index is not null and p_answer_index not between 0 and 3 then raise exception 'bad_answer'; end if;
  select correct_index into v_correct from quiz_questions where id = v_serve.question_id;

  if p_answer_index is null or v_now > v_serve.deadline then
    perform close_expired_serve(v_serve);
  else
    v_ms := greatest(0, (extract(epoch from (v_now - v_serve.served_at)) * 1000)::int);
    v_ok := p_answer_index = v_correct;
    if v_ok then v_pts := greatest(0, 12 - v_ms / 1000); end if;
    update question_serves set answer_index = p_answer_index, answered_at = v_now, response_ms = v_ms,
                               is_correct = v_ok, points = v_pts where id = v_serve.id;
  end if;

  if v_serve.position = 3 then v_result := duel_finish(v_serve.duel_id, v_serve.player_id); end if;
  return jsonb_build_object('is_correct', v_ok, 'timed_out', p_answer_index is null or v_now > v_serve.deadline,
                            'correct_index', v_correct, 'points', v_pts,
                            'response_ms', coalesce(v_ms, 12000), 'result', v_result);
end $$;

-- ── 6. Sudden death ──────────────────────────────────────────────────────
-- The server draws the three questions, unseen by every tied player; the
-- client's p_question_ids are ignored. The tied players are the players
-- holding the top champion score in winners.
create or replace function public.open_sudden_death_match(p_room_id uuid, p_category winner_category, p_question_ids integer[])
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_is_host boolean;
  v_match_id uuid := gen_random_uuid();
  v_tied uuid[];
  v_ids int[] := '{}';
  v_qid int;
begin
  select is_host into v_is_host from players where room_id = p_room_id and user_id = auth.uid() and is_active limit 1;
  if not coalesce(v_is_host, false) then raise exception 'only host can open sudden death'; end if;

  select coalesce(array_agg(w.player_id), '{}') into v_tied from winners w
   where w.room_id = p_room_id and w.category = p_category;
  for i in 0..2 loop
    v_qid := draw_question(p_room_id, v_tied, (array['current', 'previous', 'classic'])[i + 1], v_ids);
    v_ids := v_ids || v_qid;
  end loop;

  delete from sudden_death_rounds where room_id = p_room_id and category = p_category;
  for i in 0..2 loop
    insert into sudden_death_rounds (room_id, category, question_id, match_id, question_index, closes_at)
    values (p_room_id, p_category, v_ids[i + 1], v_match_id, i, now() + interval '15 seconds' * (i + 1));
  end loop;
  return v_match_id;
end $$;

-- The question of a sudden-death round for a member: text while open, plus
-- the correct option once it has closed.
create or replace function public.sudden_death_question(p_round_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_round sudden_death_rounds;
begin
  select * into v_round from sudden_death_rounds where id = p_round_id;
  if v_round.id is null then raise exception 'round_not_found'; end if;
  if my_player_id(v_round.room_id) is null and not is_super_admin() then
    raise exception 'not_in_room' using errcode = '42501';
  end if;
  return question_public(v_round.question_id)
    || jsonb_build_object('correct_index',
         case when now() >= v_round.closes_at then (select correct_index from quiz_questions where id = v_round.question_id) end);
end $$;

-- ── 7. Grants ────────────────────────────────────────────────────────────
revoke execute on function public.quiz_state(uuid), public.quiz_next(uuid, int), public.quiz_answer(uuid, int),
  public.duel_next(uuid), public.duel_answer(uuid, int), public.sudden_death_question(uuid),
  public.open_sudden_death_match(uuid, winner_category, integer[])
  from public, anon;
grant execute on function public.quiz_state(uuid), public.quiz_next(uuid, int), public.quiz_answer(uuid, int),
  public.duel_next(uuid), public.duel_answer(uuid, int), public.sudden_death_question(uuid),
  public.open_sudden_death_match(uuid, winner_category, integer[])
  to authenticated, service_role;
revoke execute on function public.quiz_points_for(int) from public, anon;
