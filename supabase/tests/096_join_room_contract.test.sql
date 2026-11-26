-- 096_join_room_contract.test.sql
-- Proof for migration 096: a guest cannot insert a players row directly,
-- the host still can (own room only), and join_room still admits guests.
-- Rolled back at the end. tests/db/joinRoomContract096.test.ts runs it.

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

insert into auth.users (id) values
  ('a0000000-0000-4000-8000-0000000000a6'),  -- host of R1
  ('b0000000-0000-4000-8000-0000000000b6'),  -- guest
  ('f0000000-0000-4000-8000-0000000000f6');  -- host of R2

insert into public.rooms (id, code, host_id, host_name, phase, password_hash) values
  ('10000000-0000-4000-8000-000000000096', 'JRC096', 'a0000000-0000-4000-8000-0000000000a6', 'Host', 'lobby', ''),
  ('20000000-0000-4000-8000-000000000096', 'JRC097', 'f0000000-0000-4000-8000-0000000000f6', 'Other', 'lobby', '');

set local role authenticated;

-- Host inserts their own row in their own room: allowed, is_host true.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a6');
insert into public.players (room_id, user_id, name, is_host)
values ('10000000-0000-4000-8000-000000000096', 'a0000000-0000-4000-8000-0000000000a6', 'Host', true);
reset role;
select pg_temp.expect((select is_host::text from public.players where user_id = 'a0000000-0000-4000-8000-0000000000a6'), 'true', 'host row');
set local role authenticated;

-- Host of R2 inserts a row into R1: refused.
select pg_temp.as_user('f0000000-0000-4000-8000-0000000000f6');
select pg_temp.expect_denied($q$
  insert into public.players (room_id, user_id, name)
  values ('10000000-0000-4000-8000-000000000096', 'f0000000-0000-4000-8000-0000000000f6', 'Other')
$q$, 'another room''s host inserts into R1');

-- Guest inserts directly: refused. join_room: admitted.
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b6');
select pg_temp.expect_denied($q$
  insert into public.players (room_id, user_id, name)
  values ('10000000-0000-4000-8000-000000000096', 'b0000000-0000-4000-8000-0000000000b6', 'Guest')
$q$, 'guest direct insert');
select pg_temp.expect(public.join_room('JRC096', '', 'Guest', '🎤')->'player'->>'is_host', 'false', 'guest via join_room');

reset role;
select pg_temp.expect((select count(*)::text from public.players where room_id = '10000000-0000-4000-8000-000000000096'), '2', 'host + guest');

rollback;
