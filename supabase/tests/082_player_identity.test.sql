-- 082_player_identity.test.sql
-- RLS proof for player_secrets (migration 082). Plain SQL, no pgTAP:
-- every check raises an exception when it fails, and the whole script runs
-- in one transaction that is rolled back, so it leaves nothing behind.
--
-- Run it as a superuser on a database that has every migration applied:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/082_player_identity.test.sql
-- tests/db/playerIdentity082.test.ts runs this same file in PGlite.
--
-- Callers are simulated the way PostgREST does it: `set local role
-- authenticated` plus request.jwt.claims carrying the auth uid in "sub".
--
-- Cast:
--   A  host of room R1                                  (player pA)
--   B  other member of R1                               (player pB)
--   C  non-member of R1, host of R2 (already final)     (player pC)
--   D  joins R1 only after it reached 'final'           (player pD)

begin;

-- Supabase grants table privileges to `authenticated` by default; a bare
-- Postgres does not. Rolled back with the rest.
grant select on public.players, public.rooms to authenticated;

-- expect_rows(sql, n, label): the query, run as the current role, must
-- return exactly n rows.
create function pg_temp.expect_rows(q text, n int, label text) returns void
language plpgsql as $$
declare got int;
begin
  execute format('select count(*) from (%s) t', q) into got;
  if got <> n then
    raise exception 'FAIL %: expected % row(s), got %', label, n, got;
  end if;
end $$;

-- expect_denied(sql, label): the statement must fail with an RLS or
-- privilege error (SQLSTATE 42501).
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

-- ── Fixtures (as superuser) ─────────────────────────────────────────────
insert into auth.users (id) values
  ('a0000000-0000-4000-8000-00000000000a'),
  ('b0000000-0000-4000-8000-00000000000b'),
  ('c0000000-0000-4000-8000-00000000000c'),
  ('d0000000-0000-4000-8000-00000000000d');

insert into public.rooms (id, code, host_id, host_name, phase, phase_updated_at) values
  ('10000000-0000-4000-8000-000000000001', 'RLS082', 'a0000000-0000-4000-8000-00000000000a', 'Ντίσκο', 'predictions_open', now() - interval '3 hours'),
  ('20000000-0000-4000-8000-000000000002', 'RLS083', 'c0000000-0000-4000-8000-00000000000c', 'Άλλο',   'final',            now() - interval '3 hours');

insert into public.players (id, room_id, user_id, name, is_host, joined_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'Ντίσκο', true,  now() - interval '2 hours'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', 'Πούλια', false, now() - interval '2 hours'),
  ('cccccccc-0000-4000-8000-00000000000c', '20000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000c', 'Άλλο',   true,  now() - interval '4 hours');

-- ── Writes: only the owner of the player row ────────────────────────────
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a"}', true);
insert into public.player_secrets (player_id, real_name) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'Real A');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b"}', true);
insert into public.player_secrets (player_id, real_name) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'Real B');
select pg_temp.expect_denied(
  $q$insert into public.player_secrets (player_id, real_name) values ('cccccccc-0000-4000-8000-00000000000c', 'forged')$q$,
  'B writes the secret of a player that is not B');

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-00000000000c"}', true);
insert into public.player_secrets (player_id, real_name) values ('cccccccc-0000-4000-8000-00000000000c', 'Real C');

-- ── Before 'final' ──────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b"}', true);
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id = 'bbbbbbbb-0000-4000-8000-00000000000b'$q$, 1,
  'B reads own secret before final');
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id = 'aaaaaaaa-0000-4000-8000-00000000000a'$q$, 0,
  'B (member) reads A before final');
select pg_temp.expect_rows($q$select 1 from public.player_secrets$q$, 1,
  'B sees only own secret before final');
-- An UPDATE of a row hidden by RLS affects 0 rows instead of erroring.
update public.player_secrets set real_name = 'rewritten' where player_id = 'aaaaaaaa-0000-4000-8000-00000000000a';

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a"}', true);
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id = 'aaaaaaaa-0000-4000-8000-00000000000a' and real_name = 'Real A'$q$, 1,
  'B could not rewrite A');
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id = 'bbbbbbbb-0000-4000-8000-00000000000b'$q$, 0,
  'host A reads B before final');

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-00000000000c"}', true);
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id in ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b')$q$, 0,
  'non-member C reads R1 before final');

-- ── R1 reaches 'final' (as finalize does: phase + phase_updated_at) ─────
reset role;
update public.rooms set phase = 'final', phase_updated_at = now() - interval '1 hour'
 where id = '10000000-0000-4000-8000-000000000001';
-- D joins after the end, with the code and password.
insert into public.players (id, room_id, user_id, name, joined_at) values
  ('dddddddd-0000-4000-8000-00000000000d', '10000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000d', 'Αργά', now());
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b"}', true);
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id = 'aaaaaaaa-0000-4000-8000-00000000000a' and real_name = 'Real A'$q$, 1,
  'B (member) reads A at final');
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id = 'cccccccc-0000-4000-8000-00000000000c'$q$, 0,
  'B reads a player of another final room');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a"}', true);
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id = 'bbbbbbbb-0000-4000-8000-00000000000b'$q$, 1,
  'host A reads B at final');

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-00000000000c"}', true);
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id in ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b')$q$, 0,
  'non-member C reads R1 at final');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-00000000000d"}', true);
select pg_temp.expect_rows($q$select 1 from public.player_secrets where player_id in ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b')$q$, 0,
  'late joiner D reads R1 at final');

-- ── anon has no access at all ───────────────────────────────────────────
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.expect_denied($q$select 1 from public.player_secrets$q$, 'anon reads player_secrets');

reset role;
rollback;
