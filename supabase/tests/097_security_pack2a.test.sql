-- 097_security_pack2a.test.sql
-- Proof for migration 097. Runs after 097 on a database that also carries
-- production's broad table grants (tests/db/securityPack2a097.test.ts sets
-- them up before applying 097), so every "refused" below is 097's doing.
-- Plain SQL; every failed check raises; the transaction is rolled back.

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

-- ── Fixtures ────────────────────────────────────────────────────────────
-- A hosts room R1 (B and C play in it); F hosts R2; A also hosts R3.
insert into auth.users (id) values
  ('a0000000-0000-4000-8000-0000000000a7'),
  ('b0000000-0000-4000-8000-0000000000b7'),
  ('c0000000-0000-4000-8000-0000000000c7'),
  ('f0000000-0000-4000-8000-0000000000f7');

insert into public.rooms (id, code, host_id, host_name, phase, password_hash) values
  ('10000000-0000-4000-8000-000000000097', 'SEC097', 'a0000000-0000-4000-8000-0000000000a7', 'Α', 'predictions_open', ''),
  ('20000000-0000-4000-8000-000000000097', 'SEC098', 'f0000000-0000-4000-8000-0000000000f7', 'Φ', 'lobby', ''),
  ('30000000-0000-4000-8000-000000000097', 'SEC099', 'a0000000-0000-4000-8000-0000000000a7', 'Α', 'lobby', '');

insert into public.players (id, room_id, user_id, name, is_host) values
  ('aaaaaaaa-0000-4000-8000-0000000000a7', '10000000-0000-4000-8000-000000000097', 'a0000000-0000-4000-8000-0000000000a7', 'Α', true),
  ('bbbbbbbb-0000-4000-8000-0000000000b7', '10000000-0000-4000-8000-000000000097', 'b0000000-0000-4000-8000-0000000000b7', 'Β', false),
  ('cccccccc-0000-4000-8000-0000000000c7', '10000000-0000-4000-8000-000000000097', 'c0000000-0000-4000-8000-0000000000c7', 'Γ', false),
  ('ffffffff-0000-4000-8000-0000000000f7', '20000000-0000-4000-8000-000000000097', 'f0000000-0000-4000-8000-0000000000f7', 'Φ', true);

-- Two pending duels A → B.
insert into public.duels (id, room_id, challenger_id, challenged_id, status, question_ids) values
  ('d1000000-0000-4000-8000-000000000097', '10000000-0000-4000-8000-000000000097', 'aaaaaaaa-0000-4000-8000-0000000000a7', 'bbbbbbbb-0000-4000-8000-0000000000b7', 'pending', '{1,2,3}'),
  ('d2000000-0000-4000-8000-000000000097', '10000000-0000-4000-8000-000000000097', 'aaaaaaaa-0000-4000-8000-0000000000a7', 'bbbbbbbb-0000-4000-8000-0000000000b7', 'pending', '{4,5,6}');

-- A tie for champion between A and B; one vote still open, one past its deadline.
insert into public.winners (room_id, category, player_id, metric_value) values
  ('10000000-0000-4000-8000-000000000097', 'champion', 'aaaaaaaa-0000-4000-8000-0000000000a7', 50),
  ('10000000-0000-4000-8000-000000000097', 'champion', 'bbbbbbbb-0000-4000-8000-0000000000b7', 50);
insert into public.tie_votes (id, room_id, category, closes_at, status) values
  ('e1000000-0000-4000-8000-000000000097', '10000000-0000-4000-8000-000000000097', 'champion', now() + interval '20 seconds', 'active'),
  ('e2000000-0000-4000-8000-000000000097', '10000000-0000-4000-8000-000000000097', 'duelist', now() - interval '1 second', 'active');

-- Sudden death: an open match (3 rounds) and a closed one (3 rounds).
create temp table q97 as
  select id, correct_index from public.quiz_questions order by id limit 3;
grant select on q97 to authenticated;
insert into public.sudden_death_rounds (id, room_id, category, question_id, match_id, question_index, opened_at, closes_at)
select ('5' || i || '000000-0000-4000-8000-000000000097')::uuid, '10000000-0000-4000-8000-000000000097', 'champion',
       (select id from q97 order by id offset i limit 1),
       '5a000000-0000-4000-8000-000000000097', i, now(), now() + interval '15 seconds' * (i + 1)
  from generate_series(0, 2) i;
insert into public.sudden_death_rounds (id, room_id, category, question_id, match_id, question_index, opened_at, closes_at)
select ('6' || i || '000000-0000-4000-8000-000000000097')::uuid, '10000000-0000-4000-8000-000000000097', 'champion',
       (select id from q97 order by id offset i limit 1),
       '6a000000-0000-4000-8000-000000000097', i, now() - interval '60 seconds', now() - interval '10 seconds'
  from generate_series(0, 2) i;

insert into public.quiz_answers (room_id, player_id, round_number, question_id, answer_index, is_correct, question_opened_at, answered_at, response_seconds, points_awarded)
values ('10000000-0000-4000-8000-000000000097', 'bbbbbbbb-0000-4000-8000-0000000000b7', 1, (select id from q97 order by id limit 1), 0, true, now(), now(), 2, 12);
insert into public.predictions (room_id, player_id, top5, worst5)
values ('10000000-0000-4000-8000-000000000097', 'bbbbbbbb-0000-4000-8000-0000000000b7', '{SE,FR,IT,UA,GB}', '{ES,DE,NO,FI,GR}');

-- ── 1. The old password check is closed ─────────────────────────────────
select pg_temp.expect(has_function_privilege('anon', 'public.verify_room_password(character varying, text)', 'EXECUTE')::text, 'false', 'verify_room_password anon');
select pg_temp.expect(has_function_privilege('authenticated', 'public.verify_room_password(character varying, text)', 'EXECUTE')::text, 'false', 'verify_room_password authenticated');

-- ── 9. Nothing game- or admin-related for anon ──────────────────────────
select pg_temp.expect(
  (select count(*)::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('tally_tie_vote', 'resolve_sudden_death_match', 'submit_sudden_death_answer',
                        'decline_duel', 'admin_set_winner', 'start_parse_job', 'compute_winners', 'delete_room')
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  '0', 'anon executes none of the game/admin functions');
select pg_temp.expect(has_function_privilege('authenticated', 'public.tally_tie_vote(uuid)', 'EXECUTE')::text, 'true', 'players can still close a vote');
select pg_temp.expect(
  (select count(*)::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('admin_clear_winners', 'admin_set_winner', 'is_super_admin', 'open_sudden_death',
                        'submit_sudden_death_answer', 'link_super_admin')
      and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
  '0', 'fixed search_path');

set local role authenticated;

-- ── 2. Duels ────────────────────────────────────────────────────────────
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c7');
select pg_temp.expect_error($q$ select public.decline_duel('d1000000-0000-4000-8000-000000000097', 'bbbbbbbb-0000-4000-8000-0000000000b7') $q$,
  'does not belong', 'C declines B''s duel');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a7');
select pg_temp.expect_denied($q$ update public.duels set status = 'declined' where id = 'd1000000-0000-4000-8000-000000000097' $q$,
  'challenger sets declined directly');

select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b7');
select pg_temp.expect_denied($q$ update public.duels set status = 'declined' where id = 'd1000000-0000-4000-8000-000000000097' $q$,
  'challenged sets declined directly (skips the quota)');
select public.decline_duel('d1000000-0000-4000-8000-000000000097', 'bbbbbbbb-0000-4000-8000-0000000000b7');
update public.duels set status = 'accepted', accepted_at = now() where id = 'd2000000-0000-4000-8000-000000000097';

-- ── 3. Sudden death: the server decides right or wrong ──────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b7');
select public.submit_sudden_death_answer('50000000-0000-4000-8000-000000000097',
  ((select correct_index from q97 order by id limit 1) + 1) % 4, true);   -- wrong answer, claims "correct"
select pg_temp.expect_error($q$ select public.submit_sudden_death_answer('60000000-0000-4000-8000-000000000097', 0, true) $q$,
  'round_closed', 'answer after the deadline');
select pg_temp.as_user('f0000000-0000-4000-8000-0000000000f7');
select pg_temp.expect_error($q$ select public.submit_sudden_death_answer('50000000-0000-4000-8000-000000000097', 0, true) $q$,
  'not_in_room', 'outsider answers');

-- ── 4. Votes and matches close at the deadline, by a member ─────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b7');
select pg_temp.expect_error($q$ select public.tally_tie_vote('e1000000-0000-4000-8000-000000000097') $q$,
  'too_early', 'tally before the deadline');
select pg_temp.expect_error($q$ select public.resolve_sudden_death_match('5a000000-0000-4000-8000-000000000097') $q$,
  'too_early', 'resolve before the deadline');
select pg_temp.as_user('f0000000-0000-4000-8000-0000000000f7');
select pg_temp.expect_error($q$ select public.tally_tie_vote('e2000000-0000-4000-8000-000000000097') $q$,
  'not a member', 'outsider tallies');
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c7');
select pg_temp.expect(public.tally_tie_vote('e2000000-0000-4000-8000-000000000097'), 'accept', 'member tallies after the deadline');

-- ── 5. Quiz answers: RPC only, own rows only ────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b7');
select pg_temp.expect_denied($q$
  insert into public.quiz_answers (room_id, player_id, round_number, question_id, answer_index, is_correct, question_opened_at, points_awarded)
  values ('10000000-0000-4000-8000-000000000097', 'bbbbbbbb-0000-4000-8000-0000000000b7', 2, 999, 0, true, now(), 12) $q$,
  'fake correct answer inserted directly');
select pg_temp.expect((select count(*)::text from public.quiz_answers), '1', 'B sees own answer');
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a7');
select pg_temp.expect((select count(*)::text from public.quiz_answers), '0', 'host does not see B''s answers');

-- ── 6. Shared quiz state ────────────────────────────────────────────────
select pg_temp.expect_denied($q$
  insert into public.quiz_rounds (room_id, round_number, question_ids, status)
  values ('10000000-0000-4000-8000-000000000097', 1, '{1}', 'active') $q$, 'member writes quiz_rounds');
select pg_temp.expect_denied($q$
  insert into public.question_assignments (room_id, round_number, question_id, position)
  values ('10000000-0000-4000-8000-000000000097', 1, 1, 0) $q$, 'member writes question_assignments');

-- ── 7. Notifications ────────────────────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b7');
insert into public.notifications (room_id, player_id, type, payload)
values ('10000000-0000-4000-8000-000000000097', 'cccccccc-0000-4000-8000-0000000000c7', 'duel_challenge', '{}');
select pg_temp.expect_denied($q$
  insert into public.notifications (room_id, player_id, type, payload)
  values ('10000000-0000-4000-8000-000000000097', 'cccccccc-0000-4000-8000-0000000000c7', 'phase_changed', '{}') $q$,
  'fake phase notification');
select pg_temp.expect_denied($q$
  insert into public.notifications (room_id, player_id, type, payload)
  values ('10000000-0000-4000-8000-000000000097', 'ffffffff-0000-4000-8000-0000000000f7', 'duel_challenge', '{}') $q$,
  'notification to a player of another room');

-- ── 10. Predictions: the host sees only their own ───────────────────────
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a7');
select pg_temp.expect((select count(*)::text from public.predictions), '0', 'host does not see B''s picks');
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b7');
select pg_temp.expect((select count(*)::text from public.predictions), '1', 'B sees own picks');

-- ── 11. Delete room: the host only ──────────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b7');
select pg_temp.expect_denied($q$ select public.delete_room('30000000-0000-4000-8000-000000000097') $q$, 'guest deletes a room');
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a7');
select public.delete_room('30000000-0000-4000-8000-000000000097');

reset role;

select pg_temp.expect((select status from public.duels where id = 'd1000000-0000-4000-8000-000000000097'), 'declined', 'B''s own decline worked');
select pg_temp.expect((select decline_count::text from public.players where id = 'bbbbbbbb-0000-4000-8000-0000000000b7'), '1', 'decline counted');
select pg_temp.expect((select status from public.duels where id = 'd2000000-0000-4000-8000-000000000097'), 'accepted', 'B accepts directly');
select pg_temp.expect((select is_correct::text from public.sudden_death_answers where round_id = '50000000-0000-4000-8000-000000000097'), 'false', 'claimed "correct" is ignored');
select pg_temp.expect((select count(*)::text from public.rooms where id = '30000000-0000-4000-8000-000000000097'), '0', 'host deleted own room');

-- The closed match resolves once, to the player with more right answers.
insert into public.sudden_death_answers (round_id, player_id, answer_index, is_correct, response_ms) values
  ('60000000-0000-4000-8000-000000000097', 'bbbbbbbb-0000-4000-8000-0000000000b7', 0, true, 2000),
  ('60000000-0000-4000-8000-000000000097', 'aaaaaaaa-0000-4000-8000-0000000000a7', 0, false, 1000);
set local role authenticated;
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c7');
select pg_temp.expect(public.resolve_sudden_death_match('6a000000-0000-4000-8000-000000000097')::text, 'bbbbbbbb-0000-4000-8000-0000000000b7', 'match resolves');
select pg_temp.expect(public.resolve_sudden_death_match('6a000000-0000-4000-8000-000000000097')::text, 'bbbbbbbb-0000-4000-8000-0000000000b7', 'a second call returns the same winner');
reset role;

-- ── 8. Admin allowlist: only a confirmed email is promoted ──────────────
insert into public.super_admin_emails (email) values ('pack2a@example.test');
insert into auth.users (id, email) values ('e0000000-0000-4000-8000-0000000000e7', 'pack2a@example.test');
select pg_temp.expect((select count(*)::text from public.super_admins where user_id = 'e0000000-0000-4000-8000-0000000000e7'), '0', 'unconfirmed sign-up is not admin');
update auth.users set email_confirmed_at = now() where id = 'e0000000-0000-4000-8000-0000000000e7';
select pg_temp.expect((select count(*)::text from public.super_admins where user_id = 'e0000000-0000-4000-8000-0000000000e7'), '1', 'promoted once confirmed');

rollback;
