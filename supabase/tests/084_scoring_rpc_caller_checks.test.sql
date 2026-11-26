-- 084_scoring_rpc_caller_checks.test.sql
-- Proof for migration 084: the scoring RPCs only act for the calling player,
-- duel answers are bound to the duel's questions, clients cannot write
-- server-owned columns of players / duels, and picks are frozen outside
-- 'predictions_open'. Plain SQL, no pgTAP: every check raises when it fails,
-- and the whole script runs in one transaction that is rolled back.
--
-- Run it as a superuser on a database that has every migration applied:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/084_scoring_rpc_caller_checks.test.sql
-- tests/db/scoringCallerChecks084.test.ts runs this same file in PGlite.
--
-- Callers are simulated the way PostgREST does it: `set local role
-- authenticated` plus request.jwt.claims carrying the auth uid in "sub".
--
-- Cast (room R, phase predictions_open):
--   A  pA  duel challenger            B  pB  duel challenged
--   C  pC  member of R, not in the duel
--   X  pX  member of another room R2 only (a non-member of R)

begin;

-- Supabase grants table privileges to `authenticated` by default; a bare
-- Postgres does not. Column grants from 051 / 084 still apply on top.
grant select on public.players, public.rooms, public.duels, public.predictions to authenticated;
grant insert on public.players, public.predictions to authenticated;
grant update on public.predictions to authenticated;

create function pg_temp.expect(got text, want text, label text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: expected %, got %', label, coalesce(want, 'NULL'), coalesce(got, 'NULL');
  end if;
end $$;

-- expect_error(sql, pattern, label): the statement must raise an error whose
-- message matches the pattern (so an unrelated error cannot pass the check).
create function pg_temp.expect_error(q text, pattern text, label text) returns void
language plpgsql as $$
declare msg text;
begin
  begin
    execute q;
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg !~* pattern then
      raise exception 'FAIL %: raised "%" instead of /%/', label, msg, pattern;
    end if;
    return;
  end;
  raise exception 'FAIL %: statement did not raise', label;
end $$;

-- expect_denied(sql, label): must fail with SQLSTATE 42501 (privilege / RLS).
create function pg_temp.expect_denied(q text, label text) returns void
language plpgsql as $$
begin
  begin
    execute q;
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'FAIL %: statement was allowed', label;
end $$;

create function pg_temp.as_user(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;

create temp table qs on commit drop as
  select row_number() over (order by id) as n, id, correct_index as ok
    from public.quiz_questions order by id limit 4;
grant select on qs to authenticated;

-- ── Fixtures (as superuser) ─────────────────────────────────────────────
insert into auth.users (id) values
  ('a0000000-0000-4000-8000-0000000000a4'),
  ('b0000000-0000-4000-8000-0000000000b4'),
  ('c0000000-0000-4000-8000-0000000000c4'),
  ('e0000000-0000-4000-8000-0000000000e4'),
  ('f0000000-0000-4000-8000-0000000000f4');

insert into public.rooms (id, code, host_id, host_name, phase) values
  ('10000000-0000-4000-8000-000000000084', 'SEC084', 'a0000000-0000-4000-8000-0000000000a4', 'Ντίσκο', 'predictions_open'),
  ('20000000-0000-4000-8000-000000000084', 'SEC085', 'f0000000-0000-4000-8000-0000000000f4', 'Άλλο',   'predictions_open');

insert into public.players (id, room_id, user_id, name, is_host) values
  ('aaaaaaaa-0000-4000-8000-0000000000a4', '10000000-0000-4000-8000-000000000084', 'a0000000-0000-4000-8000-0000000000a4', 'Ντίσκο', true),
  ('bbbbbbbb-0000-4000-8000-0000000000b4', '10000000-0000-4000-8000-000000000084', 'b0000000-0000-4000-8000-0000000000b4', 'Πούλια', false),
  ('cccccccc-0000-4000-8000-0000000000c4', '10000000-0000-4000-8000-000000000084', 'c0000000-0000-4000-8000-0000000000c4', 'Γκλίτερ', false),
  ('ffffffff-0000-4000-8000-0000000000f4', '20000000-0000-4000-8000-000000000084', 'f0000000-0000-4000-8000-0000000000f4', 'Άλλο', true);

insert into public.duels (id, room_id, challenger_id, challenged_id, status, question_ids, question_id)
select '30000000-0000-4000-8000-000000000084', '10000000-0000-4000-8000-000000000084',
       'aaaaaaaa-0000-4000-8000-0000000000a4', 'bbbbbbbb-0000-4000-8000-0000000000b4', 'accepted',
       array_agg(id order by n), min(id)
  from qs where n <= 3;

-- A tie: no winner.
insert into public.duels (id, room_id, challenger_id, challenged_id, status, question_ids, question_id,
                          challenger_score, challenged_score)
select '40000000-0000-4000-8000-000000000084', '10000000-0000-4000-8000-000000000084',
       'aaaaaaaa-0000-4000-8000-0000000000a4', 'bbbbbbbb-0000-4000-8000-0000000000b4', 'tie',
       array_agg(id order by n), min(id), 20, 20
  from qs where n <= 3;

-- ── EXECUTE privileges ──────────────────────────────────────────────────
select pg_temp.expect(
  (select string_agg(f || ':' || has_function_privilege('anon', f, 'execute') || '/' || has_function_privilege('authenticated', f, 'execute'), ' ' order by f)
     from unnest(array[
       'public.submit_quiz_answer(uuid, uuid, int, int, int, boolean, timestamptz, int)',
       'public.submit_duel_answers(uuid, uuid, jsonb, int, int[])',
       'public.apply_duel_decision(uuid, text, uuid)']) as f),
  'public.apply_duel_decision(uuid, text, uuid):false/true '
  || 'public.submit_duel_answers(uuid, uuid, jsonb, int, int[]):false/true '
  || 'public.submit_quiz_answer(uuid, uuid, int, int, int, boolean, timestamptz, int):false/true',
  'anon cannot execute, authenticated can');

set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.expect_denied($q$
  select public.submit_quiz_answer('10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4',
    1, (select 1), 0, true, now(), 1000)
$q$, 'anon calls submit_quiz_answer');
reset role;

-- ── Quiz ────────────────────────────────────────────────────────────────
set local role authenticated;

-- Non-member X (my_player_id(R) is NULL): the pre-084 `!=` let this through.
select pg_temp.as_user('f0000000-0000-4000-8000-0000000000f4');
select pg_temp.expect_error($q$
  select public.submit_quiz_answer('10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4',
    1, (select id from qs where n = 1), (select ok from qs where n = 1), true, now(), 500)
$q$, 'does not belong to the calling user', 'quiz: non-member answers as A');

-- A user with no player row anywhere.
select pg_temp.as_user('e0000000-0000-4000-8000-0000000000e4');
select pg_temp.expect_error($q$
  select public.submit_quiz_answer('10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4',
    1, (select id from qs where n = 1), (select ok from qs where n = 1), true, now(), 500)
$q$, 'does not belong to the calling user', 'quiz: user with no player answers as A');

-- Another member C.
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c4');
select pg_temp.expect_error($q$
  select public.submit_quiz_answer('10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4',
    1, (select id from qs where n = 1), (select ok from qs where n = 1), true, now(), 500)
$q$, 'does not belong to the calling user', 'quiz: member C answers as A');

-- Legitimate: A answers as A.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a4');
select pg_temp.expect(
  (public.submit_quiz_answer('10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4',
     1, (select id from qs where n = 1), (select ok from qs where n = 1), true, now(), 500)) ->> 'points_awarded',
  '12', 'quiz: A answers as A');

reset role;
select pg_temp.expect(
  (select quiz_points::text from public.players where id = 'aaaaaaaa-0000-4000-8000-0000000000a4'),
  '12', 'quiz: only A scored');

-- ── Duel answers ────────────────────────────────────────────────────────
reset role;
create function pg_temp.duel_call(player text, ans_sql text default 'n <= 3') returns text
language plpgsql as $$
declare ans jsonb; res jsonb;
begin
  execute format('select jsonb_agg(jsonb_build_object(''questionId'', id, ''answerIndex'', ok, ''responseMs'', 0, ''points'', 12) order by n) from qs where %s', ans_sql)
    into ans;
  res := public.submit_duel_answers('30000000-0000-4000-8000-000000000084', player::uuid, ans, 36,
           (select array_agg(1000) from jsonb_array_elements(ans)));
  return res::text;
end $$;
set local role authenticated;


select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c4');
select pg_temp.expect_error($q$select pg_temp.duel_call('cccccccc-0000-4000-8000-0000000000c4')$q$,
  'not a participant', 'duel: member C answers as C (not in the duel)');
select pg_temp.expect_error($q$select pg_temp.duel_call('bbbbbbbb-0000-4000-8000-0000000000b4')$q$,
  'does not belong to the calling user', 'duel: member C answers as B');

select pg_temp.as_user('f0000000-0000-4000-8000-0000000000f4');
select pg_temp.expect_error($q$select pg_temp.duel_call('bbbbbbbb-0000-4000-8000-0000000000b4')$q$,
  'does not belong to the calling user', 'duel: non-member answers as B');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a4');
select pg_temp.expect_error($q$select pg_temp.duel_call('bbbbbbbb-0000-4000-8000-0000000000b4')$q$,
  'does not belong to the calling user', 'duel: A answers as the opponent B');

-- S2: answers bound to the duel's questions.
select pg_temp.expect_error($q$
  select public.submit_duel_answers('30000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4',
    (select jsonb_agg(jsonb_build_object('questionId', id, 'answerIndex', ok)) from qs, generate_series(1, 3) where n = 1),
    36, array[0, 0, 0])
$q$, 'once each', 'duel: three copies of one correct question');
select pg_temp.expect_error($q$select pg_temp.duel_call('aaaaaaaa-0000-4000-8000-0000000000a4', 'n in (1, 2, 4)')$q$,
  'once each', 'duel: a question that is not in the duel');
select pg_temp.expect_error($q$
  select public.submit_duel_answers('30000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4',
    (select jsonb_agg(jsonb_build_object('questionId', id, 'answerIndex', ok)) from qs, generate_series(1, 20) where n <= 3),
    720, null)
$q$, 'one answer per duel question', 'duel: 60 answers for 3 questions (legacy path)');
select pg_temp.expect_error($q$
  select public.submit_duel_answers('30000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4',
    '[]'::jsonb, 0, null)
$q$, 'one answer per duel question', 'duel: empty answers');

-- Legitimate: A answers as A (server scored: 3 × (12 − 1) = 33).
select pg_temp.expect(pg_temp.duel_call('aaaaaaaa-0000-4000-8000-0000000000a4')::jsonb ->> 'score', '33', 'duel: A answers as A');

-- Legitimate legacy call by B: the client total is clamped to 12 × 3.
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b4');
select pg_temp.expect(
  (public.submit_duel_answers(p_duel_id => '30000000-0000-4000-8000-000000000084',
     p_player_id => 'bbbbbbbb-0000-4000-8000-0000000000b4',
     p_answers => (select jsonb_agg(jsonb_build_object('questionId', id, 'answerIndex', ok, 'responseMs', 0, 'points', 12) order by n) from qs where n <= 3),
     p_total_score => 999)) ->> 'score',
  '36', 'duel: legacy total 999 clamped to 36');

reset role;
select pg_temp.expect(
  (select challenger_score || ' ' || challenged_score || ' ' || status || ' ' || winner_id
     from public.duels where id = '30000000-0000-4000-8000-000000000084'),
  '33 36 completed bbbbbbbb-0000-4000-8000-0000000000b4', 'duel: stored result, B wins');

-- ── Steal / double ──────────────────────────────────────────────────────
set local role authenticated;

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a4');
select pg_temp.expect_error($q$
  select public.apply_duel_decision('30000000-0000-4000-8000-000000000084', 'double', 'bbbbbbbb-0000-4000-8000-0000000000b4')
$q$, 'does not belong to the calling user', 'decision: loser A chooses for winner B');
select pg_temp.expect_error($q$
  select public.apply_duel_decision('30000000-0000-4000-8000-000000000084', 'steal', 'aaaaaaaa-0000-4000-8000-0000000000a4')
$q$, 'only the winner', 'decision: loser A chooses as A');
-- A tie has no winner: the pre-084 `winner_id != p` passed on NULL.
select pg_temp.expect_error($q$
  select public.apply_duel_decision('40000000-0000-4000-8000-000000000084', 'double', 'aaaaaaaa-0000-4000-8000-0000000000a4')
$q$, 'only the winner', 'decision: a tie cannot be doubled');

select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c4');
select pg_temp.expect_error($q$
  select public.apply_duel_decision('30000000-0000-4000-8000-000000000084', 'steal', 'bbbbbbbb-0000-4000-8000-0000000000b4')
$q$, 'does not belong to the calling user', 'decision: member C chooses for B');

select pg_temp.as_user('f0000000-0000-4000-8000-0000000000f4');
select pg_temp.expect_error($q$
  select public.apply_duel_decision('30000000-0000-4000-8000-000000000084', 'double', 'bbbbbbbb-0000-4000-8000-0000000000b4')
$q$, 'does not belong to the calling user', 'decision: non-member chooses for B');

-- Legitimate: winner B doubles.
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b4');
select public.apply_duel_decision('30000000-0000-4000-8000-000000000084', 'double', 'bbbbbbbb-0000-4000-8000-0000000000b4');

reset role;
select pg_temp.expect(
  (select duel_points || ' ' || (select winner_decision from public.duels where id = '30000000-0000-4000-8000-000000000084')
     from public.players where id = 'bbbbbbbb-0000-4000-8000-0000000000b4'),
  '72 double', 'decision: B doubled 36 → +72');

-- ── duels: clients cannot write scores or the winner ────────────────────
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a4');
select pg_temp.expect_denied($q$
  update public.duels set challenger_score = 999 where id = '40000000-0000-4000-8000-000000000084'
$q$, 'duels: participant writes a score');
select pg_temp.expect_denied($q$
  insert into public.duels (room_id, challenger_id, challenged_id, question_ids, status, winner_id, challenger_score)
  values ('10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4', 'cccccccc-0000-4000-8000-0000000000c4',
          '{1,2,3}', 'completed', 'aaaaaaaa-0000-4000-8000-0000000000a4', 500)
$q$, 'duels: challenger inserts a completed duel it already won');
-- Legitimate: challenge (useDuels.createDuel) and accept (useDuels.acceptDuel).
insert into public.duels (room_id, challenger_id, challenged_id, question_ids, question_id)
select '10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4', 'cccccccc-0000-4000-8000-0000000000c4',
       array_agg(id order by n), min(id)
  from qs where n <= 3;
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c4');
update public.duels set status = 'accepted', accepted_at = now()
 where challenged_id = 'cccccccc-0000-4000-8000-0000000000c4' and status = 'pending';
reset role;
select pg_temp.expect((select string_agg(status, ',') from public.duels where challenged_id = 'cccccccc-0000-4000-8000-0000000000c4'),
  'accepted', 'duels: challenge and accept still work');

-- ── players: joined_at, user_id, room_id and scores are server-owned ────
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a4');
select pg_temp.expect_denied($q$
  update public.players set joined_at = '2000-01-01' where id = 'aaaaaaaa-0000-4000-8000-0000000000a4'
$q$, 'players: A backdates own joined_at');
select pg_temp.expect_denied($q$
  update public.players set user_id = 'e0000000-0000-4000-8000-0000000000e4' where id = 'aaaaaaaa-0000-4000-8000-0000000000a4'
$q$, 'players: A moves own row to another user');
-- Legitimate client updates (RoomPage heartbeat, leave, rejoin).
update public.players set last_seen_at = now(), is_active = false, status = 'away', left_at = null
 where id = 'aaaaaaaa-0000-4000-8000-0000000000a4';
update public.players set is_active = true, status = 'active' where id = 'aaaaaaaa-0000-4000-8000-0000000000a4';

-- A new player cannot choose joined_at or points: since 096 a guest can't
-- insert at all, and join_room takes neither.
select pg_temp.as_user('e0000000-0000-4000-8000-0000000000e4');
select pg_temp.expect_denied($q$
  insert into public.players (id, room_id, user_id, name, joined_at, quiz_points, duel_points)
  values ('eeeeeeee-0000-4000-8000-0000000000e4', '10000000-0000-4000-8000-000000000084',
          'e0000000-0000-4000-8000-0000000000e4', 'Νέο', '2000-01-01', 999, 999)
$q$, 'players: guest direct insert (096)');
select public.join_room('SEC084', '', 'Νέο', '🎤');
reset role;
select pg_temp.expect(
  (select (joined_at = now())::text || ' ' || quiz_points || ' ' || duel_points
     from public.players where user_id = 'e0000000-0000-4000-8000-0000000000e4'),
  'true 0 0', 'players: join_room gives joined_at = now() and 0 points');
select pg_temp.expect(
  (select is_active || ' ' || status || ' ' || (left_at is null) from public.players where id = 'aaaaaaaa-0000-4000-8000-0000000000a4'),
  'true active true', 'players: legitimate client updates applied');

-- ── predictions: player picks only while predictions are open ───────────
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a4');
insert into public.predictions (room_id, player_id, top5, worst5)
values ('10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4', '{SE,FR,IT,UA,GR}', '{DE,GB,ES,PL,CY}')
on conflict (room_id, player_id) do update set top5 = excluded.top5, worst5 = excluded.worst5;
update public.predictions set top5 = '{FR,SE,IT,UA,GR}' where player_id = 'aaaaaaaa-0000-4000-8000-0000000000a4';

reset role;
update public.rooms set phase = 'voting_live' where id = '10000000-0000-4000-8000-000000000084';
set local role authenticated;

select pg_temp.expect_denied($q$
  update public.predictions set top5 = '{UA,SE,FR,IT,GR}' where player_id = 'aaaaaaaa-0000-4000-8000-0000000000a4'
$q$, 'predictions: A edits picks during voting_live');
select pg_temp.expect_denied($q$
  insert into public.predictions (room_id, player_id, top5, worst5)
  values ('10000000-0000-4000-8000-000000000084', 'aaaaaaaa-0000-4000-8000-0000000000a4', '{UA,SE,FR,IT,GR}', '{DE,GB,ES,PL,CY}')
  on conflict (room_id, player_id) do update set top5 = excluded.top5
$q$, 'predictions: A upserts picks during voting_live (PredictionsScreen path)');
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b4');
select pg_temp.expect_denied($q$
  insert into public.predictions (room_id, player_id, top5, worst5)
  values ('10000000-0000-4000-8000-000000000084', 'bbbbbbbb-0000-4000-8000-0000000000b4', '{UA,SE,FR,IT,GR}', '{DE,GB,ES,PL,CY}')
$q$, 'predictions: B first submits during voting_live');

-- Scoring after voting (SECURITY DEFINER / owner) is not blocked.
reset role;
update public.predictions set top5_points = 50, worst5_points = 20, scored_at = now()
 where player_id = 'aaaaaaaa-0000-4000-8000-0000000000a4';
select pg_temp.expect(
  (select array_to_string(top5, ',') || ' ' || total_points from public.predictions
    where player_id = 'aaaaaaaa-0000-4000-8000-0000000000a4'),
  'FR,SE,IT,UA,GR 70', 'predictions: open-phase edit kept, scoring written after voting');

rollback;
