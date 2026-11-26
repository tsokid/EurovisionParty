-- 094_intel_server_side.test.sql
-- Proof for migration 094: intel is bought only for the caller's own player,
-- at the server's price, once, never with points the player doesn't have,
-- and reveals are readable only by a member who bought them.
-- Plain SQL; every failed check raises; the transaction is rolled back.
-- tests/db/intel094.test.ts runs this file in PGlite.

begin;

grant select on public.players, public.rooms to authenticated;

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
  ('a0000000-0000-4000-8000-0000000000a9'),
  ('b0000000-0000-4000-8000-0000000000b9'),
  ('f0000000-0000-4000-8000-0000000000f9');

insert into public.rooms (id, code, host_id, host_name, phase) values
  ('10000000-0000-4000-8000-000000000094', 'INT094', 'a0000000-0000-4000-8000-0000000000a9', 'Α', 'predictions_open'),
  ('20000000-0000-4000-8000-000000000094', 'INT095', 'f0000000-0000-4000-8000-0000000000f9', 'Φ', 'predictions_open');

insert into public.players (id, room_id, user_id, name, is_host, quiz_points) values
  ('aaaaaaaa-0000-4000-8000-0000000000a9', '10000000-0000-4000-8000-000000000094', 'a0000000-0000-4000-8000-0000000000a9', 'Α', true, 200),
  ('bbbbbbbb-0000-4000-8000-0000000000b9', '10000000-0000-4000-8000-000000000094', 'b0000000-0000-4000-8000-0000000000b9', 'Β', false, 40),
  ('ffffffff-0000-4000-8000-0000000000f9', '20000000-0000-4000-8000-000000000094', 'f0000000-0000-4000-8000-0000000000f9', 'Φ', true, 500);

insert into public.results (room_id, final_ranking)
values ('10000000-0000-4000-8000-000000000094', '["SE","FR","IT","UA","GB","ES","DE","NO","FI","GR","CY","AL"]');

-- ── Privileges ──────────────────────────────────────────────────────────
select pg_temp.expect(
  has_function_privilege('anon', 'public.purchase_intel(uuid, uuid, text, integer)', 'execute')::text
  || '/' || has_function_privilege('anon', 'public.get_intel_reveal(uuid, text)', 'execute')::text,
  'false/false', 'anon executes neither');

set local role authenticated;

-- ── A buys top3 with a fake negative cost: the server charges 50 ────────
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a9');
select pg_temp.expect(
  (public.purchase_intel('10000000-0000-4000-8000-000000000094', 'aaaaaaaa-0000-4000-8000-0000000000a9', 'top3', -100000))::text,
  '{"data": ["SE", "FR", "IT"], "available": true}', 'A gets top3');
reset role;
select pg_temp.expect((select points_spent::text from players where id = 'aaaaaaaa-0000-4000-8000-0000000000a9'), '50', 'A charged 50, not the client cost');
select pg_temp.expect((select points_cost::text from intel_reveals where player_id = 'aaaaaaaa-0000-4000-8000-0000000000a9'), '50', 'reveal row records the server cost');
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000a9');

-- Twice: refused.
select pg_temp.expect_error($q$
  select public.purchase_intel('10000000-0000-4000-8000-000000000094', 'aaaaaaaa-0000-4000-8000-0000000000a9', 'top3', 50)
$q$, 'Already purchased', 'A buys top3 twice');

-- A charges B: refused.
select pg_temp.expect_error($q$
  select public.purchase_intel('10000000-0000-4000-8000-000000000094', 'bbbbbbbb-0000-4000-8000-0000000000b9', 'top10', 150)
$q$, 'does not belong to the calling user', 'A buys on B''s account');

-- A reads worst3 without buying it: refused.
select pg_temp.expect_error($q$
  select public.get_intel_reveal('10000000-0000-4000-8000-000000000094', 'worst3')
$q$, 'not purchased', 'A reads unbought worst3');

-- A re-reads the top3 bought: allowed.
select pg_temp.expect(
  (public.get_intel_reveal('10000000-0000-4000-8000-000000000094', 'top3'))::text,
  '{"data": ["SE", "FR", "IT"], "available": true}', 'A re-reads top3');

-- Direct insert of a free reveal: refused.
select pg_temp.expect_error($q$
  insert into public.intel_reveals (room_id, player_id, reveal_type, points_cost)
  values ('10000000-0000-4000-8000-000000000094', 'aaaaaaaa-0000-4000-8000-0000000000a9', 'top10', 0)
$q$, 'permission denied|row-level security', 'A inserts a free reveal');

-- ── B has 40 points: top10 (150) refused, no row, no charge ──────────────
select pg_temp.as_user('b0000000-0000-4000-8000-0000000000b9');
select pg_temp.expect_error($q$
  select public.purchase_intel('10000000-0000-4000-8000-000000000094', 'bbbbbbbb-0000-4000-8000-0000000000b9', 'top10', 0)
$q$, 'Not enough points', 'B cannot afford top10');

-- ── F, member of another room, reads room 1: refused ───────────────────
select pg_temp.as_user('f0000000-0000-4000-8000-0000000000f9');
select pg_temp.expect_error($q$
  select public.get_intel_reveal('10000000-0000-4000-8000-000000000094', 'top3')
$q$, 'Not a member', 'non-member reads room 1');
select pg_temp.expect_error($q$
  select public.purchase_intel('10000000-0000-4000-8000-000000000094', 'ffffffff-0000-4000-8000-0000000000f9', 'top3', 50)
$q$, 'Not a member', 'non-member buys in room 1');

reset role;
select pg_temp.expect((select points_spent::text from players where id = 'bbbbbbbb-0000-4000-8000-0000000000b9'), '0', 'B not charged');
select pg_temp.expect((select count(*)::text from intel_reveals where room_id = '10000000-0000-4000-8000-000000000094'), '1', 'only A''s one reveal exists');

rollback;
