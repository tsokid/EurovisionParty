-- 085_087_cms_revisions.test.sql
-- Proof for the CMS history (migration 085) and the editors' read access
-- (087). Plain SQL, no pgTAP: every check raises when it fails, and the
-- script runs in one transaction that is rolled back.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/085_087_cms_revisions.test.sql
-- tests/db/cmsRevisions085.test.ts runs this same file in PGlite.
--
-- Cast:
--   anon  a visitor
--   U     a signed-in player, not an admin
--   A, B  the two super admins (the two editors)

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

-- The statement must raise an error whose message contains `needle`.
create function pg_temp.expect_error(q text, needle text, label text) returns void
language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if strpos(sqlerrm, needle) > 0 then return; end if;
    raise exception 'FAIL %: wrong error: %', label, sqlerrm;
  end;
  raise exception 'FAIL %: statement was allowed', label;
end $$;

create function pg_temp.as_user(uid text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid)::text end, true);
end $$;

-- ── Fixtures (as superuser) ─────────────────────────────────────────────
insert into auth.users (id, email) values
  ('a0850000-0000-4000-8000-00000000000a', 'a085@example.test'),
  ('b0850000-0000-4000-8000-00000000000b', 'b085@example.test'),
  ('c0850000-0000-4000-8000-00000000000c', 'player085@example.test');
insert into public.super_admins (user_id, email) values
  ('a0850000-0000-4000-8000-00000000000a', 'a085@example.test'),
  ('b0850000-0000-4000-8000-00000000000b', 'b085@example.test');

create temp table t085 (k text primary key, v timestamptz);
grant all on t085 to authenticated;

-- ── A saves twice: one open checkpoint, updated in place ─────────────────
set local role authenticated;
select pg_temp.as_user('a0850000-0000-4000-8000-00000000000a');
insert into t085 values ('a1', public.cms_save('t085-faq', 'faq', '{"en":{"t":"one"},"el":{"t":"ένα"}}', null));
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq') where kind = 'checkpoint'$q$, 1, 'first save opens a checkpoint');
insert into t085 values ('a2', public.cms_save('t085-faq', 'faq', '{"en":{"t":"two"},"el":{"t":"δύο"}}', (select v from t085 where k = 'a1')));
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq')$q$, 1, 'a second save within 10 min updates the same checkpoint');
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq') h join public.cms_revisions r using (id) where r.data->'en'->>'t' = 'two'$q$, 1, 'the checkpoint holds the latest state');
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq') where author_email = 'a085@example.test'$q$, 1, 'history names the author');
reset role;

-- ── B saves: a new checkpoint (another author) ──────────────────────────
set local role authenticated;
select pg_temp.as_user('b0850000-0000-4000-8000-00000000000b');
insert into t085 values ('b1', public.cms_save('t085-faq', 'faq', '{"en":{"t":"three"},"el":{"t":"τρία"}}', (select v from t085 where k = 'a2')));
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq') where kind = 'checkpoint'$q$, 2, 'another author opens their own checkpoint');
-- A stale save is refused exactly as in 076, and records nothing.
select pg_temp.expect_error($q$select public.cms_save('t085-faq', 'faq', '{"en":{},"el":{}}', (select v from t085 where k = 'a1'))$q$, 'changed by someone else', 'stale save refused');
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq')$q$, 2, 'a refused save records no revision');
reset role;

-- ── A pause of over 10 minutes opens a new session ──────────────────────
update public.cms_revisions set updated_at = now() - interval '11 minutes' where doc_id = 't085-faq';
set local role authenticated;
select pg_temp.as_user('b0850000-0000-4000-8000-00000000000b');
insert into t085 values ('b2', public.cms_save('t085-faq', 'faq', '{"en":{"t":"four"},"el":{"t":"τέσσερα"}}', (select v from t085 where k = 'b1')));
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq') where kind = 'checkpoint'$q$, 3, 'after 10 minutes a new checkpoint');
reset role;

-- ── Prune: checkpoints over 90 days go, published ones stay ──────────────
insert into public.cms_revisions (doc_id, doc_type, data, kind, created_at, updated_at) values
  ('t085-old', 'faq', '{"en":{},"el":{}}', 'checkpoint', now() - interval '91 days', now() - interval '91 days'),
  ('t085-old', 'faq', '{"en":{},"el":{}}', 'published', now() - interval '400 days', now() - interval '400 days'),
  ('t085-old', 'faq', '{"en":{},"el":{}}', 'checkpoint', now() - interval '89 days', now() - interval '89 days');
set local role authenticated;
select pg_temp.as_user('a0850000-0000-4000-8000-00000000000a');
insert into t085 values ('a3', public.cms_save('t085-faq', 'faq', '{"en":{"t":"five"},"el":{"t":"πέντε"}}', (select v from t085 where k = 'b2')));
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-old')$q$, 2, 'the 91-day checkpoint is pruned; the 89-day one and the published one stay');
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-old') where kind = 'published'$q$, 1, 'published revisions are kept forever');
reset role;

-- ── Restore: a new draft and a new revision; history only grows ──────────
set local role authenticated;
select pg_temp.as_user('a0850000-0000-4000-8000-00000000000a');
select pg_temp.expect_error(
  $q$select public.cms_restore('t085-faq', (select min(id) from public.cms_revisions where doc_id = 't085-faq'), (select v from t085 where k = 'a2'))$q$,
  'changed by someone else', 'restore against a stale timestamp is refused');
select pg_temp.expect_error(
  $q$select public.cms_restore('t085-faq', (select min(id) from public.cms_revisions where doc_id = 't085-old'), (select v from t085 where k = 'a3'))$q$,
  'not found', 'a revision of another doc cannot be restored');
insert into t085 values ('r1', public.cms_restore('t085-faq', (select min(id) from public.cms_revisions where doc_id = 't085-faq'), (select v from t085 where k = 'a3')));
select pg_temp.expect_rows($q$select 1 from public.cms_documents where doc_id = 't085-faq' and data->'en'->>'t' = 'two'$q$, 1, 'restore writes the revision into the draft');
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq') where kind = 'restored' and restored_from is not null$q$, 1, 'restore records a restored revision');
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq')$q$, 5, 'no revision was deleted');
select pg_temp.expect_rows($q$select 1 from t085 where k = 'r1' and v > (select v from t085 where k = 'a3')$q$, 1, 'restore returns a newer updated_at');
-- After a restore, the next save opens a new checkpoint (not the old session).
select public.cms_save('t085-faq', 'faq', '{"en":{"t":"six"},"el":{"t":"έξι"}}', (select v from t085 where k = 'r1'));
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq')$q$, 6, 'a save after a restore is its own checkpoint');
-- Discarding the draft keeps the history; restoring with null expected recreates it.
select public.cms_discard('t085-faq');
select pg_temp.expect_rows($q$select 1 from public.cms_history('t085-faq')$q$, 6, 'discard keeps the history');
select public.cms_restore('t085-faq', (select max(id) from public.cms_revisions where doc_id = 't085-faq' and kind = 'checkpoint'), null);
select pg_temp.expect_rows($q$select 1 from public.cms_documents where doc_id = 't085-faq' and data->'en'->>'t' = 'six'$q$, 1, 'restore of a discarded draft recreates it');
select pg_temp.expect_rows($q$select 1 from (select public.cms_revision((select max(id) from public.cms_revisions where doc_id = 't085-faq')) as r) x where (r->'data'->'en'->>'t') = 'six'$q$, 1, 'cms_revision returns the data');
reset role;

-- ── Published revisions from a successful publish run (end_publish, 086) ──
update public.cms_documents set updated_at = now() - interval '1 minute' where doc_id = 't085-faq';
insert into public.publish_runs (id, started_at, status, cms) values (908501, now(), 'running', true);
select public.end_publish(908501, 'ok', 'abc0850', 1, null);
select pg_temp.expect_rows($q$select 1 from public.cms_revisions where doc_id = 't085-faq' and kind = 'published' and run_id = 908501 and commit_sha = 'abc0850'$q$, 1, 'an ok run records what it shipped');
insert into public.publish_runs (id, started_at, status, cms) values (908502, now(), 'running', true);
select public.end_publish(908502, 'error', null, null, 'boom');
select pg_temp.expect_rows($q$select 1 from public.cms_revisions where run_id = 908502$q$, 0, 'a failed run records nothing');

-- ── 087: who can read ───────────────────────────────────────────────────
set local role anon;
select pg_temp.as_user(null);
select pg_temp.expect_denied($q$select 1 from public.cms_documents$q$, 'anon reads drafts');
select pg_temp.expect_denied($q$select 1 from public.cms_revisions$q$, 'anon reads revisions');
select pg_temp.expect_denied($q$select 1 from public.cms_media$q$, 'anon reads media');
select pg_temp.expect_denied($q$select * from public.cms_history('t085-faq')$q$, 'anon calls cms_history');
reset role;

set local role authenticated;
select pg_temp.as_user('c0850000-0000-4000-8000-00000000000c');
select pg_temp.expect_rows($q$select 1 from public.cms_documents$q$, 0, 'a player sees no drafts');
select pg_temp.expect_rows($q$select 1 from public.cms_revisions$q$, 0, 'a player sees no revisions');
select pg_temp.expect_rows($q$select 1 from public.cms_media$q$, 0, 'a player sees no media');
select pg_temp.expect_error($q$select * from public.cms_history('t085-faq')$q$, 'forbidden', 'a player calls cms_history');
select pg_temp.expect_error($q$select public.cms_restore('t085-faq', 1, null)$q$, 'forbidden', 'a player restores');
reset role;

set local role authenticated;
select pg_temp.as_user('a0850000-0000-4000-8000-00000000000a');
select pg_temp.expect_rows($q$select 1 from public.cms_documents where doc_id = 't085-faq'$q$, 1, 'an admin reads drafts directly');
select pg_temp.expect_rows($q$select 1 from public.cms_revisions where doc_id = 't085-faq'$q$, 8, 'an admin reads revisions directly');
select pg_temp.expect_denied($q$insert into public.cms_documents (doc_id, doc_type, data) values ('t085-x', 'faq', '{"en":{},"el":{}}')$q$, 'an admin inserts a draft directly');
select pg_temp.expect_denied($q$update public.cms_documents set data = '{"en":{},"el":{}}' where doc_id = 't085-faq'$q$, 'an admin updates a draft directly');
select pg_temp.expect_denied($q$delete from public.cms_revisions where doc_id = 't085-faq'$q$, 'an admin deletes history directly');
select pg_temp.expect_denied($q$insert into public.cms_revisions (doc_id, doc_type, data, kind) values ('t085-x', 'faq', '{}', 'seed')$q$, 'an admin inserts a revision directly');
reset role;

select pg_temp.expect_rows($q$select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cms_documents'$q$, 1, 'cms_documents is in the realtime publication');

rollback;
