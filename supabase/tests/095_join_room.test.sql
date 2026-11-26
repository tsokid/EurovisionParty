-- 095_join_room.test.sql
-- Proof for migration 095: the server checks the room password, limits
-- failed attempts, keeps one row per user per room, returns no password
-- hash, and decides is_host from the room. Rolled back at the end.
-- tests/db/joinRoom095.test.ts runs this file in PGlite.

begin;

grant select, insert on public.players to authenticated;
grant select on public.rooms to authenticated;

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

-- ── Fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id) values
  ('a0000000-0000-4000-8000-0000000000a5'),  -- host
  ('b0000000-0000-4000-8000-0000000000b5'),  -- guest
  ('c0000000-0000-4000-8000-0000000000c5'),  -- guesser
  ('d0000000-0000-4000-8000-0000000000d5');  -- latecomer (room full)

insert into public.rooms (id, code, host_id, host_name, phase, password_hash, max_players) values
  ('10000000-0000-4000-8000-000000000095', 'JRM095', 'a0000000-0000-4000-8000-0000000000a5', 'Host', 'lobby',
   crypt('secret1', gen_salt('bf')), 3);

insert into public.players (id, room_id, user_id, name, is_host) values
  ('aaaaaaaa-0000-4000-8000-0000000000a5', '10000000-0000-4000-8000-000000000095', 'a0000000-0000-4000-8000-0000000000a5', 'Host', true);

select pg_temp.expect(
  has_function_privilege('anon', 'public.join_room(text, text, text, text, text)', 'execute')::text,
  'false', 'anon cannot call join_room');

set local role authenticated;

-- ── Guest: wrong password, then right ───────────────────────────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b5');
select pg_temp.expect(public.join_room('jrm095', 'nope', 'Guest', '🎤')->>'error', 'wrong_password', 'wrong password');
select pg_temp.expect(public.join_room('NOPE99', 'secret1', 'Guest', '🎤')->>'error', 'room_not_found', 'unknown code');

select pg_temp.expect(
  (public.join_room('jrm095', 'secret1', 'Guest', '🎤', 'av-1')->'player'->>'is_host'), 'false', 'guest joins, not host');
select pg_temp.expect(
  (public.join_room('JRM095', 'secret1', 'Guest', '🎤')->'room' ? 'password_hash')::text, 'false', 'no password hash returned');

-- Same user again: same row, no duplicate.
select pg_temp.expect(
  (select count(*)::text from public.players where room_id = '10000000-0000-4000-8000-000000000095' and user_id = 'b0000000-0000-4000-8000-0000000000b5'),
  '1', 'one row per user per room');

-- Direct insert of a second row as host: refused by the unique key.
select pg_temp.expect_error($q$
  insert into public.players (room_id, user_id, name, is_host)
  values ('10000000-0000-4000-8000-000000000095', 'b0000000-0000-4000-8000-0000000000b5', 'Boss', true)
$q$, 'duplicate|unique|row-level security', 'second row for the same user');

-- Promote self by update: refused.
select pg_temp.expect_error($q$
  update public.players set is_host = true where user_id = 'b0000000-0000-4000-8000-0000000000b5'
$q$, 'permission denied|cannot be changed', 'guest promotes self');

-- ── Guesser: 5 failures lock even the right password out ───────────────
select pg_temp.as_user('c0000000-0000-4000-8000-0000000000c5');
select public.join_room('JRM095', 'g' || n, 'Guesser', '🎤') from generate_series(1, 5) n;
select pg_temp.expect(public.join_room('JRM095', 'secret1', 'Guesser', '🎤')->>'error', 'too_many_attempts', 'locked after 5 failures');

-- A fresh user can't insert directly any more (096); join_room decides is_host.
select pg_temp.as_user('d0000000-0000-4000-8000-0000000000d5');
select pg_temp.expect_error($q$
  insert into public.players (room_id, user_id, name, is_host)
  values ('10000000-0000-4000-8000-000000000095', 'd0000000-0000-4000-8000-0000000000d5', 'Sneaky', true)
$q$, 'row-level security|permission denied', 'guest direct insert refused');
select public.join_room('JRM095', 'secret1', 'Sneaky', '🎤');
reset role;
select pg_temp.expect(
  (select is_host::text from public.players where user_id = 'd0000000-0000-4000-8000-0000000000d5'),
  'false', 'join_room sets is_host from the room');
select pg_temp.expect(
  (select count(*)::text from public.room_join_failures where user_id = 'c0000000-0000-4000-8000-0000000000c5'),
  '5', 'failures are kept');

-- ── Room full (max 3: host, guest, sneaky) ──────────────────────────────
insert into auth.users (id) values ('e0000000-0000-4000-8000-0000000000e5');
set local role authenticated;
select pg_temp.as_user('e0000000-0000-4000-8000-0000000000e5');
select pg_temp.expect(public.join_room('JRM095', 'secret1', 'Late', '🎤')->>'error', 'room_full', 'room full');

-- ── Left player comes back: same row reactivated ───────────────────────
reset role;
update public.players set is_active = false, status = 'exited', left_at = now()
 where user_id = 'b0000000-0000-4000-8000-0000000000b5';
set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b5');
select pg_temp.expect(
  (public.join_room('JRM095', 'secret1', 'Guest', '🎤')->'player'->>'id'),
  (select id::text from public.players where user_id = 'b0000000-0000-4000-8000-0000000000b5'),
  'returning player gets the same row');
reset role;
select pg_temp.expect(
  (select is_active::text || '/' || status::text from public.players where user_id = 'b0000000-0000-4000-8000-0000000000b5'),
  'true/active', 'returning player is active again');

-- ── Name taken ──────────────────────────────────────────────────────────
update public.players set is_active = false, status = 'exited' where user_id = 'd0000000-0000-4000-8000-0000000000d5';
set local role authenticated;
select pg_temp.as_user('e0000000-0000-4000-8000-0000000000e5');
select pg_temp.expect(public.join_room('JRM095', 'secret1', 'guest', '🎤')->>'error', 'name_taken', 'name taken (any case)');

reset role;
rollback;
