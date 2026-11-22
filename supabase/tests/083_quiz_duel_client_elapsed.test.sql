-- 083_quiz_duel_client_elapsed.test.sql
-- Scoring proof for migration 083 (client-measured reaction time). Plain SQL,
-- no pgTAP: every check raises an exception when it fails, and the whole
-- script runs in one transaction that is rolled back, so it leaves nothing
-- behind.
--
-- Run it as a superuser on a database that has every migration applied:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/083_quiz_duel_client_elapsed.test.sql
-- tests/db/quizDuelTiming083.test.ts runs this same file in PGlite.
--
-- Callers are simulated the way PostgREST does it: `set local role
-- authenticated` plus request.jwt.claims carrying the auth uid in "sub".
--
-- Note: inside one transaction now() is constant, so the legacy path
-- (NOW() − p_question_opened_at) is exact here.
--
-- Cast: A (player pA) and B (player pB) in room R1.

begin;

-- expect(got, want, label): text comparison, NULL-safe.
create function pg_temp.expect(got text, want text, label text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: expected %, got %', label, coalesce(want, 'NULL'), coalesce(got, 'NULL');
  end if;
end $$;

-- expect_raises(sql, label): the statement must raise.
create function pg_temp.expect_raises(q text, label text) returns void
language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    return;
  end;
  raise exception 'FAIL %: statement did not raise', label;
end $$;

-- Three bank questions with their correct index; w = a wrong index.
create temp table qs on commit drop as
  select row_number() over (order by id) as n, id, correct_index as ok, (correct_index + 1) % 4 as w
    from public.quiz_questions order by id limit 3;
grant select on qs to authenticated;

-- ── Fixtures (as superuser) ─────────────────────────────────────────────
insert into auth.users (id) values
  ('a0000000-0000-4000-8000-0000000000a3'),
  ('b0000000-0000-4000-8000-0000000000b3');

insert into public.rooms (id, code, host_id, host_name, phase) values
  ('10000000-0000-4000-8000-000000000083', 'TIM083', 'a0000000-0000-4000-8000-0000000000a3', 'Ντίσκο', 'predictions_open');

insert into public.players (id, room_id, user_id, name, is_host) values
  ('aaaaaaaa-0000-4000-8000-0000000000a3', '10000000-0000-4000-8000-000000000083', 'a0000000-0000-4000-8000-0000000000a3', 'Ντίσκο', true),
  ('bbbbbbbb-0000-4000-8000-0000000000b3', '10000000-0000-4000-8000-000000000083', 'b0000000-0000-4000-8000-0000000000b3', 'Πούλια', false);

-- ── Quiz: p_response_ms is scored, clamped to [0, 16000] ────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-0000000000a3"}', true);

-- (round, question n, answer, ms, want points, want seconds, label)
create temp table quiz_cases (r int, n int, right_answer boolean, ms int, pts int, secs numeric, label text) on commit drop;
grant select, update on quiz_cases to authenticated;
insert into quiz_cases values
  (1, 1, true,   2100, 12,  2.10, '2.1 s → 12'),
  (1, 2, true,   5000,  8,  5.00, '5 s → 8'),
  (1, 3, true,  10000,  4, 10.00, '10 s → 4'),
  (2, 1, true,   3000, 12,  3.00, '3.000 s is still ≤ 3 → 12'),
  (2, 2, true,   3001,  8,  3.01, '3.001 s rounds up to 3.01 → 8'),
  (2, 3, true,   7000,  8,  7.00, '7.000 s → 8'),
  (3, 1, true,  99999,  4, 16.00, 'huge value clamps to 16 s → 4'),
  (3, 2, true,    -50, 12,  0.00, 'negative clamps to 0 → 12'),
  (3, 3, false,  1000,  0,  1.00, 'wrong answer → 0');

do $$
declare c record; res jsonb;
begin
  for c in select qc.*, q.id as qid, case when qc.right_answer then q.ok else q.w end as ans
             from quiz_cases qc join qs q using (n) order by r, n loop
    -- opened_at a minute in the past: the legacy formula would give 16 s / 4 pts.
    res := public.submit_quiz_answer(
      '10000000-0000-4000-8000-000000000083', 'aaaaaaaa-0000-4000-8000-0000000000a3',
      c.r, c.qid, c.ans, c.right_answer, now() - interval '59 seconds', c.ms);
    perform pg_temp.expect(res ->> 'points_awarded', c.pts::text, c.label || ' (points)');
    perform pg_temp.expect((res ->> 'response_seconds')::numeric::text, c.secs::numeric(5,2)::text, c.label || ' (seconds)');
    perform pg_temp.expect(res ->> 'is_correct', c.right_answer::text, c.label || ' (is_correct)');
  end loop;
end $$;

-- ── Quiz: p_response_ms NULL / omitted keeps the legacy NOW() path ──────
do $$
declare res jsonb; q1 int; ok1 int; q2 int; ok2 int; q3 int; ok3 int;
begin
  select id, ok into q1, ok1 from qs where n = 1;
  select id, ok into q2, ok2 from qs where n = 2;
  select id, ok into q3, ok3 from qs where n = 3;

  res := public.submit_quiz_answer('10000000-0000-4000-8000-000000000083', 'aaaaaaaa-0000-4000-8000-0000000000a3',
    4, q1, ok1, true, now() - interval '5 seconds', null);
  perform pg_temp.expect(res ->> 'points_awarded', '8', 'legacy null: NOW() − opened 5 s → 8');
  perform pg_temp.expect((res ->> 'response_seconds')::numeric::text, '5.00', 'legacy null: 5.00 s');

  -- The pre-083 call shape: seven named arguments, no p_response_ms.
  res := public.submit_quiz_answer(p_room_id => '10000000-0000-4000-8000-000000000083',
    p_player_id => 'aaaaaaaa-0000-4000-8000-0000000000a3', p_round_number => 4, p_question_id => q2,
    p_answer_index => ok2, p_is_correct => true, p_question_opened_at => now() - interval '2 seconds');
  perform pg_temp.expect(res ->> 'points_awarded', '12', 'legacy 7-arg call: 2 s → 12');

  -- Legacy quirk kept: an opened_at in the future (phone clock ahead) → 16 s → 4.
  res := public.submit_quiz_answer('10000000-0000-4000-8000-000000000083', 'aaaaaaaa-0000-4000-8000-0000000000a3',
    4, q3, ok3, true, now() + interval '1 second');
  perform pg_temp.expect(res ->> 'points_awarded', '4', 'legacy future opened_at → 16 s → 4');
end $$;

-- Auth unchanged: A cannot answer as B.
select pg_temp.expect_raises($q$
  select public.submit_quiz_answer('10000000-0000-4000-8000-000000000083', 'bbbbbbbb-0000-4000-8000-0000000000b3',
    5, (select id from qs where n = 1), 0, true, now(), 1000)
$q$, 'A answers as B');

-- ── Quiz: rows and totals ───────────────────────────────────────────────
reset role;
select pg_temp.expect(
  (select string_agg(round_number || ':' || response_seconds || ':' || points_awarded, ' ' order by round_number, question_id)
     from public.quiz_answers where player_id = 'aaaaaaaa-0000-4000-8000-0000000000a3'),
  '1:2.10:12 1:5.00:8 1:10.00:4 2:3.00:12 2:3.01:8 2:7.00:8 3:16.00:4 3:0.00:12 3:1.00:0 4:5.00:8 4:2.00:12 4:16.00:4',
  'stored quiz rows');
select pg_temp.expect(
  (select quiz_points::text from public.players where id = 'aaaaaaaa-0000-4000-8000-0000000000a3'),
  (12 + 8 + 4 + 12 + 8 + 8 + 4 + 12 + 0 + 8 + 12 + 4)::text,
  'A quiz_points = sum of awarded');

-- ── Duel: p_response_ms → server scores 12 − floor(s) per answer ────────
insert into public.duels (id, room_id, challenger_id, challenged_id, status, question_ids, question_id)
select '30000000-0000-4000-8000-000000000083', '10000000-0000-4000-8000-000000000083',
       'aaaaaaaa-0000-4000-8000-0000000000a3', 'bbbbbbbb-0000-4000-8000-0000000000b3', 'accepted',
       array_agg(id order by n), min(id)
  from qs;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-0000000000a3"}', true);

do $$
declare res jsonb; ans jsonb;
begin
  -- Client-side points / total deliberately wrong: the server recomputes.
  select jsonb_agg(jsonb_build_object('questionId', id, 'answerIndex', ok, 'answeredAt', now(), 'responseMs', 99999, 'points', 99) order by n)
    into ans from qs;
  res := public.submit_duel_answers('30000000-0000-4000-8000-000000000083', 'aaaaaaaa-0000-4000-8000-0000000000a3',
    ans, 999, array[2100, 400, 11999]);
  perform pg_temp.expect(res ->> 'score', '23', 'duel A: (12−2) + (12−0) + (12−11) = 23');
  perform pg_temp.expect(res ->> 'status', 'answering', 'duel A: status while B has not answered (084: as stored)');
  perform pg_temp.expect(res ->> 'opponent_answered', 'false', 'duel A: B not answered yet');
end $$;

reset role;
select pg_temp.expect(
  (select challenger_score::text || ' ' || status from public.duels where id = '30000000-0000-4000-8000-000000000083'),
  '23 answering', 'duel A stored score and interim status');
select pg_temp.expect(
  (select string_agg((a ->> 'responseMs') || '/' || (a ->> 'points'), ' ' order by ord)
     from public.duels d, jsonb_array_elements(d.challenger_answers) with ordinality as x(a, ord)
    where d.id = '30000000-0000-4000-8000-000000000083'),
  '2100/10 400/12 11999/1', 'duel A stored answers carry the server responseMs and points');

-- B: clamps and a wrong answer. 20000 → 12000 → 0; −5 → 0 → 12; wrong → 0.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-0000000000b3"}', true);
do $$
declare res jsonb; ans jsonb;
begin
  select jsonb_agg(jsonb_build_object('questionId', id, 'answerIndex', case when n = 3 then w else ok end,
                                      'answeredAt', now(), 'responseMs', 0, 'points', 12) order by n)
    into ans from qs;
  res := public.submit_duel_answers('30000000-0000-4000-8000-000000000083', 'bbbbbbbb-0000-4000-8000-0000000000b3',
    ans, 36, array[20000, -5, 500]);
  perform pg_temp.expect(res ->> 'score', '12', 'duel B: 0 (clamped 12 s) + 12 (clamped 0 s) + 0 (wrong)');
  perform pg_temp.expect(res ->> 'winner_id', 'aaaaaaaa-0000-4000-8000-0000000000a3', 'duel: A wins 23 − 12 on server scores');
end $$;

reset role;
select pg_temp.expect(
  (select string_agg((a ->> 'responseMs') || '/' || (a ->> 'points'), ' ' order by ord)
     from public.duels d, jsonb_array_elements(d.challenged_answers) with ordinality as x(a, ord)
    where d.id = '30000000-0000-4000-8000-000000000083'),
  '12000/0 0/12 500/0', 'duel B stored clamped answers');

-- ── Duel: mismatched p_response_ms length is refused ────────────────────
insert into public.duels (id, room_id, challenger_id, challenged_id, status, question_ids, question_id)
select '40000000-0000-4000-8000-000000000083', '10000000-0000-4000-8000-000000000083',
       'aaaaaaaa-0000-4000-8000-0000000000a3', 'bbbbbbbb-0000-4000-8000-0000000000b3', 'accepted',
       array_agg(id order by n), min(id)
  from qs;
select pg_temp.expect_raises($q$
  select public.submit_duel_answers('40000000-0000-4000-8000-000000000083', 'aaaaaaaa-0000-4000-8000-0000000000a3',
    (select jsonb_agg(jsonb_build_object('questionId', id, 'answerIndex', ok, 'responseMs', 0, 'points', 12)) from qs),
    36, array[1000, 1000])
$q$, 'duel: 2 timings for 3 answers');

-- ── Duel: p_response_ms NULL keeps the legacy path (stored as sent) ─────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-0000000000a3"}', true);
do $$
declare res jsonb; ans jsonb;
begin
  select jsonb_agg(jsonb_build_object('questionId', id, 'answerIndex', ok, 'answeredAt', now(), 'responseMs', 3700, 'points', 9) order by n)
    into ans from qs;
  -- Pre-083 call shape: four named arguments.
  res := public.submit_duel_answers(p_duel_id => '40000000-0000-4000-8000-000000000083',
    p_player_id => 'aaaaaaaa-0000-4000-8000-0000000000a3', p_answers => ans, p_total_score => 27);
  perform pg_temp.expect(res ->> 'score', '27', 'legacy duel: client total kept');
end $$;

reset role;
select pg_temp.expect(
  (select challenger_score::text || ' ' || (challenger_answers -> 0 ->> 'points') || ' ' || (challenger_answers -> 0 ->> 'responseMs')
     from public.duels where id = '40000000-0000-4000-8000-000000000083'),
  '27 9 3700', 'legacy duel: answers stored as sent');

rollback;
