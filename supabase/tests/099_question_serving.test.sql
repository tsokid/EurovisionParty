-- 099_question_serving.test.sql
-- Proof for migration 099 (the server serves and scores every question).
-- Runs on a database with production's broad grants
-- (tests/db/questionServing099.test.ts). Every failed check raises; the
-- transaction is rolled back.

begin;

create function pg_temp.expect(got text, want text, label text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: expected %, got %', label, coalesce(want, 'NULL'), coalesce(got, 'NULL');
  end if;
end $$;

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

create function pg_temp.as_user(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;

-- Moves a serve's clock back by p_ms, as if it had been served earlier.
create function pg_temp.age(p_serve uuid, p_ms int) returns void
language sql as $$
  update public.question_serves
     set served_at = served_at - make_interval(secs => p_ms / 1000.0),
         deadline  = deadline  - make_interval(secs => p_ms / 1000.0)
   where id = p_serve;
$$;

-- ── Fixtures ────────────────────────────────────────────────────────────
-- Room R plays 2090. The bank: 40 verified questions per era (current 2090,
-- previous 2089, recent 2087, classic 2070 or general), correct option 2;
-- plus a draft and a retired question that must never be served.
insert into public.contests (year, city, city_slug, stage) values
  (2070, 'Q', 'q', 'archived'), (2087, 'Q', 'q', 'archived'), (2089, 'Q', 'q', 'archived'), (2090, 'Q', 'q', 'archived')
  on conflict (year) do nothing;

insert into public.quiz_questions (id, correct_index, contest_year, topic, difficulty, question_en, question_el,
                                   options_en, options_el, fact, source, status)
select 96000 + g, 2,
       case e when 0 then 2090 when 1 then 2089 when 2 then 2087 else (case when g % 2 = 0 then 2070 end) end,
       'song', 'medium', 'Q' || g || '?', 'Ε' || g || ';',
       array['a' || g, 'b' || g, 'c' || g, 'd' || g], array['α' || g, 'β' || g, 'γ' || g, 'δ' || g],
       'fact ' || g, 'https://example.test/' || g, 'verified'
  from generate_series(0, 159) g, lateral (select g / 40 as e) x;
insert into public.quiz_questions (id, correct_index, contest_year, topic, difficulty, question_en, question_el,
                                   options_en, options_el, fact, source, status) values
  (96500, 0, 2090, 'song', 'easy', 'Draft?', 'Πρόχειρη;', '{a,b,c,d}', '{α,β,γ,δ}', 'draft fact', null, 'draft'),
  (96501, 0, 2090, 'song', 'easy', 'Retired?', 'Αποσυρμένη;', '{a,b,c,d}', '{α,β,γ,δ}', 'retired fact', 'x', 'retired');

insert into auth.users (id) values
  ('a0000000-0000-4000-8000-000000000099'),
  ('b0000000-0000-4000-8000-000000000099'),
  ('c0000000-0000-4000-8000-000000000099');
insert into public.rooms (id, code, host_id, host_name, phase, password_hash, year) values
  ('10000000-0000-4000-8000-000000000099', 'SRV099', 'a0000000-0000-4000-8000-000000000099', 'Α', 'voting_live', '', 2090);
insert into public.players (id, room_id, user_id, name, is_host) values
  ('aaaaaaaa-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000099', 'a0000000-0000-4000-8000-000000000099', 'Α', true),
  ('bbbbbbbb-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000099', 'b0000000-0000-4000-8000-000000000099', 'Β', false);

create temp table t (k text primary key, v text);
grant all on t to authenticated, anon;

-- ── 1. Quiz: state, serve, no answer in the reply ───────────────────────
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
select pg_temp.expect((public.quiz_state('10000000-0000-4000-8000-000000000099') ->> 'round'), '1', 'starts at round 1');
select pg_temp.expect((public.quiz_state('10000000-0000-4000-8000-000000000099') ->> 'position'), '1', 'at question 1');
select pg_temp.expect_error($q$select public.quiz_next('10000000-0000-4000-8000-000000000099', 2)$q$, 'wrong_round', 'cannot skip to round 2');

insert into t select 's1', public.quiz_next('10000000-0000-4000-8000-000000000099', 1) ->> 'serve_id';
select pg_temp.expect((select (public.quiz_next('10000000-0000-4000-8000-000000000099', 1) ->> 'serve_id') = v from t where k = 's1')::text,
  'true', 'asking again returns the open question, not a new one');
select pg_temp.expect((select (public.quiz_next('10000000-0000-4000-8000-000000000099', 1) -> 'question') ? 'correct_index')::text,
  'false', 'the served question carries no answer');
select pg_temp.expect((select public.quiz_next('10000000-0000-4000-8000-000000000099', 1)::text ~ 'correct')::text,
  'false', 'nothing named correct in the serve');
reset role;

-- ── 2. Scoring by the server clock ──────────────────────────────────────
select pg_temp.age((select v::uuid from t where k = 's1'), 2000);
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
insert into t select 'a1', public.quiz_answer((select v::uuid from t where k = 's1'), 2)::text;
select pg_temp.expect((select v::jsonb ->> 'points_awarded' from t where k = 'a1'), '12', 'right in ~2 s: 12 points');
select pg_temp.expect((select v::jsonb ->> 'correct_index' from t where k = 'a1'), '2', 'the verdict carries the right option');
select pg_temp.expect_error($q$select public.quiz_answer((select v::uuid from t where k = 's1'), 2)$q$, 'already_answered', 'one answer per question');

insert into t select 's2', public.quiz_next('10000000-0000-4000-8000-000000000099', 1) ->> 'serve_id';
reset role;
select pg_temp.age((select v::uuid from t where k = 's2'), 5000);
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
select pg_temp.expect(public.quiz_answer((select v::uuid from t where k = 's2'), 2) ->> 'points_awarded', '8', 'right in ~5 s: 8 points');

insert into t select 's3', public.quiz_next('10000000-0000-4000-8000-000000000099', 1) ->> 'serve_id';
reset role;
select pg_temp.age((select v::uuid from t where k = 's3'), 10000);
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
select pg_temp.expect(public.quiz_answer((select v::uuid from t where k = 's3'), 1) ->> 'points_awarded', '0', 'wrong: 0 points');

-- A forged client time cannot help: the server measures.
insert into t select 's4', public.quiz_next('10000000-0000-4000-8000-000000000099', 1) ->> 'serve_id';
reset role;
select pg_temp.age((select v::uuid from t where k = 's4'), 15500);
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
select pg_temp.expect(public.quiz_answer((select v::uuid from t where k = 's4'), 2) ->> 'timed_out', 'true', 'after the deadline: lost, even if right');
reset role;
select pg_temp.expect((select points_awarded::text from public.quiz_answers a join public.question_serves s on s.question_id = a.question_id
  where s.id = (select v::uuid from t where k = 's4') and a.player_id = s.player_id), '0', 'a late answer is recorded with 0 points');
select pg_temp.expect((select quiz_points::text from public.players where id = 'aaaaaaaa-0000-4000-8000-000000000099'), '20', 'player got 12 + 8');

-- ── 3. Leaving: the time runs, the question is lost, the round goes on ──
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
insert into t select 's5', public.quiz_next('10000000-0000-4000-8000-000000000099', 1) ->> 'serve_id';
reset role;
select pg_temp.age((select v::uuid from t where k = 's5'), 4000);
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
select pg_temp.expect((select (public.quiz_state('10000000-0000-4000-8000-000000000099') -> 'open' ->> 'remaining_ms')::int between 10000 and 11500)::text,
  'true', 'back after 4 s: the open question has about 11 s left');
reset role;
select pg_temp.age((select v::uuid from t where k = 's5'), 20000);
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
select pg_temp.expect((public.quiz_state('10000000-0000-4000-8000-000000000099') -> 'open')::text, 'null', 'back later: no open question');
select pg_temp.expect(public.quiz_state('10000000-0000-4000-8000-000000000099') ->> 'position', '6', 'the lost question counts: next is 6');

-- Finish round 1: the mix of its 10 questions is 3/3/2/2 by era.
do $$ begin
  for i in 6..10 loop
    perform public.quiz_answer((public.quiz_next('10000000-0000-4000-8000-000000000099', 1) ->> 'serve_id')::uuid, 0);
  end loop;
end $$;
select pg_temp.expect(public.quiz_state('10000000-0000-4000-8000-000000000099') ->> 'round', '2', 'round 2 after 10 questions');
reset role;
select pg_temp.expect((select string_agg(era || '=' || n, ',' order by era) from (
  select public.question_era(q.contest_year, 2090) era, count(*) n from public.question_serves s join public.quiz_questions q on q.id = s.question_id
   where s.player_id = 'aaaaaaaa-0000-4000-8000-000000000099' and s.round_number = 1 group by 1) x),
  'classic=2,current=3,previous=3,recent=2', 'round 1 follows the 30/30/20/20 mix');
select pg_temp.expect((select count(*)::text from public.question_serves where question_id in (96500, 96501)), '0', 'drafts and retired never served');

-- ── 4. Another player's question, anon ──────────────────────────────────
set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000099');
select pg_temp.expect_error($q$select public.quiz_answer((select v::uuid from t where k = 's5'), 2)$q$, 'not_your_question', 'cannot answer another player''s question');
select pg_temp.expect((select count(*)::text from public.question_serves), '0', 'a player sees only their own serves');
select pg_temp.as_user('c0000000-0000-4000-8000-000000000099');
select pg_temp.expect_error($q$select public.quiz_state('10000000-0000-4000-8000-000000000099')$q$, 'not_in_room', 'outsider refused');
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.quiz_next('10000000-0000-4000-8000-000000000099', 1)$q$, 'permission denied', 'anon cannot be served');
reset role;

-- ── 5. Duels: no questions until accepted, then three unseen by both ────
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
insert into public.duels (id, room_id, challenger_id, challenged_id, question_ids, question_id)
values ('d0000000-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000099',
        'aaaaaaaa-0000-4000-8000-000000000099', 'bbbbbbbb-0000-4000-8000-000000000099', '{96000,96001,96002}', 96000);
reset role;
select pg_temp.expect((select cardinality(question_ids)::text from public.duels where id = 'd0000000-0000-4000-8000-000000000099'), '0',
  'a client cannot pick the duel questions; none before acceptance');

set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000099');
update public.duels set status = 'accepted', accepted_at = now() where id = 'd0000000-0000-4000-8000-000000000099';
reset role;
select pg_temp.expect((select cardinality(question_ids)::text from public.duels where id = 'd0000000-0000-4000-8000-000000000099'), '3', 'accept draws three');
select pg_temp.expect(((select string_agg(public.question_era(q.contest_year, 2090), ',' order by u.o)
  from public.duels d, unnest(d.question_ids) with ordinality u(qid, o) join public.quiz_questions q on q.id = u.qid
  where d.id = 'd0000000-0000-4000-8000-000000000099') ~ '^current,previous,(recent|classic)$')::text, 'true',
  'duel mix: this year, last year, older');
select pg_temp.expect((select count(*)::text from public.duels d, unnest(d.question_ids) u(qid)
  where d.id = 'd0000000-0000-4000-8000-000000000099'
    and u.qid in (select question_id from public.question_serves where player_id = 'aaaaaaaa-0000-4000-8000-000000000099')), '0',
  'no duel question was already shown to the challenger');

-- Both players get the same questions, scored by the server clock.
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
do $$ declare s jsonb; begin
  for i in 1..3 loop
    s := public.duel_next('d0000000-0000-4000-8000-000000000099');
    perform public.duel_answer((s ->> 'serve_id')::uuid, 2);
  end loop;
end $$;
select pg_temp.expect(public.duel_next('d0000000-0000-4000-8000-000000000099') ->> 'finished', 'true', 'challenger done');
select pg_temp.as_user('b0000000-0000-4000-8000-000000000099');
do $$ declare s jsonb; begin
  for i in 1..3 loop
    s := public.duel_next('d0000000-0000-4000-8000-000000000099');
    perform public.duel_answer((s ->> 'serve_id')::uuid, 0);
  end loop;
end $$;
reset role;
select pg_temp.expect((select status || ' ' || (winner_id = 'aaaaaaaa-0000-4000-8000-000000000099')::text || ' ' || challenger_score || ' ' || challenged_score
  from public.duels where id = 'd0000000-0000-4000-8000-000000000099'), 'completed true 36 0', 'duel decided on the server');
select pg_temp.expect((select count(distinct question_id)::text from public.question_serves where duel_id = 'd0000000-0000-4000-8000-000000000099'), '3',
  'both players got the same three questions');
select pg_temp.expect((select challenger_answers -> 0 ->> 'correct' from public.duels where id = 'd0000000-0000-4000-8000-000000000099'), 'true',
  'stored answers say right or wrong (results need no answer key)');

-- A question shown in the duel is burnt for the quiz too.
select pg_temp.expect_error($q$insert into public.question_serves (room_id, player_id, kind, round_number, position, question_id, deadline)
  select room_id, 'bbbbbbbb-0000-4000-8000-000000000099', 'quiz', 1, 1, question_ids[1], now() from public.duels where id = 'd0000000-0000-4000-8000-000000000099'$q$,
  'question_serves_burnt', 'the same question twice to one player in a room is refused');

-- ── 6. Sudden death: server questions, answer only after closing ────────
insert into public.winners (room_id, category, player_id, metric_value) values
  ('10000000-0000-4000-8000-000000000099', 'champion', 'aaaaaaaa-0000-4000-8000-000000000099', 50),
  ('10000000-0000-4000-8000-000000000099', 'champion', 'bbbbbbbb-0000-4000-8000-000000000099', 50);
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000099');
select public.open_sudden_death_match('10000000-0000-4000-8000-000000000099', 'champion', '{96500,96501,96500}');
reset role;
select pg_temp.expect((select count(*)::text from public.sudden_death_rounds where room_id = '10000000-0000-4000-8000-000000000099'
  and question_id in (96500, 96501)), '0', 'the client''s sudden-death ids (a draft, a retired one) are ignored');
select pg_temp.expect((select count(*)::text from public.sudden_death_rounds r where r.room_id = '10000000-0000-4000-8000-000000000099'
  and r.question_id in (select question_id from public.question_serves)), '0', 'sudden-death questions unseen by the tied players');
set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000099');
select pg_temp.expect((select public.sudden_death_question(id) ->> 'correct_index' from public.sudden_death_rounds
  where room_id = '10000000-0000-4000-8000-000000000099' and question_index = 0), null, 'no answer while open');
reset role;
insert into t select 'sd0', id from public.sudden_death_rounds where room_id = '10000000-0000-4000-8000-000000000099' and question_index = 0;
update public.sudden_death_rounds set closes_at = now() - interval '1 second' where room_id = '10000000-0000-4000-8000-000000000099' and question_index = 0;
set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000099');
select pg_temp.expect((select public.sudden_death_question(id) ->> 'correct_index' from public.sudden_death_rounds
  where room_id = '10000000-0000-4000-8000-000000000099' and question_index = 0), '2', 'answer shown once closed');
select pg_temp.as_user('c0000000-0000-4000-8000-000000000099');
select pg_temp.expect_error($q$select public.sudden_death_question((select v::uuid from t where k = 'sd0'))$q$, 'not_in_room', 'outsider refused');
reset role;

rollback;
