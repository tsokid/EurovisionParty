-- 089_avatars_library.test.sql
-- RLS proof for the avatars library (migration 089). Plain SQL, no pgTAP:
-- every check raises an exception when it fails, and the whole script runs
-- in one transaction that is rolled back, so it leaves nothing behind.
--
-- Run it as a superuser on a database that has every migration applied:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/089_avatars_library.test.sql
-- tests/db/avatarsLibrary089.test.ts runs this same file in PGlite.
--
-- Callers are simulated the way PostgREST does it: `set local role anon` or
-- `authenticated`, plus request.jwt.claims carrying the auth uid in "sub".
--
-- Cast:
--   anon  a visitor (the avatar picker before sign-in)
--   U     a signed-in player, not an admin
--   A     a super admin

begin;

create function pg_temp.expect_rows(q text, n int, label text) returns void
language plpgsql as $$
declare got int;
begin
  execute format('select count(*) from (%s) t', q) into got;
  if got <> n then
    raise exception 'FAIL %: expected % row(s), got %', label, n, got;
  end if;
end $$;

-- The statement must fail with an RLS or privilege error (SQLSTATE 42501).
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

-- The statement must change exactly n rows (RLS filters silently on update/delete).
create function pg_temp.expect_changed(q text, n int, label text) returns void
language plpgsql as $$
declare got int;
begin
  execute q;
  get diagnostics got = row_count;
  if got <> n then
    raise exception 'FAIL %: expected % changed row(s), got %', label, n, got;
  end if;
end $$;

-- ── Fixtures (as superuser) ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('a0890000-0000-4000-8000-00000000000a', 'admin089@example.test'),
  ('b0890000-0000-4000-8000-00000000000b', 'player089@example.test');
insert into public.super_admins (user_id, email) values
  ('a0890000-0000-4000-8000-00000000000a', 'admin089@example.test');

insert into public.avatars (id, title_en, thumb_path, full_path, status, sort, deleted_at) values
  ('t089-pub',     'Published',   't089-pub-96.webp',     't089-pub-512.webp',     'published',   1, null),
  ('t089-unpub',   'Unpublished', 't089-unpub-96.webp',   't089-unpub-512.webp',   'unpublished', 2, null),
  ('t089-deleted', 'Deleted',     't089-deleted-96.webp', 't089-deleted-512.webp', 'published',   3, now() - interval '1 day');

insert into public.rooms (id, code, host_id, host_name, phase, phase_updated_at) values
  ('10890000-0000-4000-8000-000000000001', 'AV089A', 'b0890000-0000-4000-8000-00000000000b', 'Πούλια', 'predictions_open', now());
insert into public.players (id, room_id, user_id, name, is_host, avatar_id) values
  ('aa890000-0000-4000-8000-00000000000a', '10890000-0000-4000-8000-000000000001', 'b0890000-0000-4000-8000-00000000000b', 'Πούλια', true, 't089-deleted');

-- ── The seed: 53 shipped avatars, static paths ──────────────────────────
select pg_temp.expect_rows($q$select 1 from public.avatars where id like 'img-%' and thumb_path like '/avatars/%' and status = 'published'$q$, 53, 'seed: 53 published static avatars');

-- ── anon: published, non-deleted rows only; no writes ───────────────────
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.expect_rows($q$select 1 from public.avatars where id like 't089-%'$q$, 1, 'anon sees only the published, non-deleted avatar');
select pg_temp.expect_rows($q$select 1 from public.avatars where id = 't089-pub'$q$, 1, 'anon sees t089-pub');
select pg_temp.expect_denied($q$insert into public.avatars (id, title_en, thumb_path, full_path) values ('t089-x', 'X', 't089-x-96.webp', 't089-x-512.webp')$q$, 'anon inserts');
select pg_temp.expect_denied($q$update public.avatars set status = 'unpublished' where id = 't089-pub'$q$, 'anon updates');
select pg_temp.expect_denied($q$select * from public.avatar_usage()$q$, 'anon reads usage');
select pg_temp.expect_denied($q$select public.avatar_purge('t089-deleted')$q$, 'anon purges');
-- A chosen but unpublished avatar still renders; a deleted one does not.
select pg_temp.expect_rows($q$select 1 from public.avatar_entries(array['t089-unpub', 't089-deleted', 'nope'])$q$, 1, 'avatar_entries: non-deleted rows of any status');
reset role;

-- ── U (signed in, not an admin): reads like anon, cannot write ──────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0890000-0000-4000-8000-00000000000b"}', true);
select pg_temp.expect_rows($q$select 1 from public.avatars where id like 't089-%'$q$, 1, 'player sees only the published avatar');
select pg_temp.expect_denied($q$insert into public.avatars (id, title_en, thumb_path, full_path) values ('t089-x', 'X', 't089-x-96.webp', 't089-x-512.webp')$q$, 'player inserts');
select pg_temp.expect_changed($q$update public.avatars set status = 'unpublished' where id = 't089-pub'$q$, 0, 'player updates (filtered by RLS)');
select pg_temp.expect_changed($q$delete from public.avatars where id = 't089-pub'$q$, 0, 'player deletes (filtered by RLS)');
select pg_temp.expect_denied($q$select * from public.avatar_usage()$q$, 'player reads usage');
select pg_temp.expect_denied($q$select public.avatars_reorder(array['t089-pub'])$q$, 'player reorders');
select pg_temp.expect_denied($q$select public.avatar_purge('t089-deleted')$q$, 'player purges');
reset role;
select pg_temp.expect_rows($q$select 1 from public.avatars where id = 't089-pub' and status = 'published'$q$, 1, 'the player''s update changed nothing');

-- ── A (super admin): sees and writes everything ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0890000-0000-4000-8000-00000000000a"}', true);
select pg_temp.expect_rows($q$select 1 from public.avatars where id like 't089-%'$q$, 3, 'admin sees every avatar, deleted too');
insert into public.avatars (id, title_en, thumb_path, full_path) values ('t089-new', 'New', 't089-new-96.webp', 't089-new-512.webp');
select pg_temp.expect_changed($q$update public.avatars set status = 'published' where id = 't089-new'$q$, 1, 'admin publishes');
select pg_temp.expect_changed($q$update public.avatars set deleted_at = now() where id = 't089-unpub'$q$, 1, 'admin soft-deletes');
select pg_temp.expect_rows($q$select 1 from public.avatar_usage() where avatar_id = 't089-deleted' and players = 1$q$, 1, 'usage counts the player');
select public.avatars_reorder(array['t089-new', 't089-pub']);
select pg_temp.expect_rows($q$select 1 from public.avatars where id = 't089-new' and sort = 10$q$, 1, 'reorder sets the sort');

-- Purge: refused while not deleted, or used and deleted under 30 days ago.
do $$ begin
  perform public.avatar_purge('t089-pub');
  raise exception 'FAIL purge of a live avatar was allowed';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
do $$ begin
  perform public.avatar_purge('t089-deleted');
  raise exception 'FAIL purge of a used avatar deleted 1 day ago was allowed';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
-- Unused and deleted: purged at once; bucket paths come back.
select pg_temp.expect_rows($q$select 1 from unnest(public.avatar_purge('t089-unpub')) x where x in ('t089-unpub-96.webp', 't089-unpub-512.webp')$q$, 2, 'purge returns the bucket objects');
reset role;
-- Used, but deleted over 30 days ago: purged.
update public.avatars set deleted_at = now() - interval '31 days' where id = 't089-deleted';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0890000-0000-4000-8000-00000000000a"}', true);
select public.avatar_purge('t089-deleted');
reset role;
select pg_temp.expect_rows($q$select 1 from public.avatars where id in ('t089-unpub', 't089-deleted')$q$, 0, 'purged rows are gone');
-- The player row is untouched (loose reference).
select pg_temp.expect_rows($q$select 1 from public.players where avatar_id = 't089-deleted'$q$, 1, 'players keep their avatar_id');

rollback;
