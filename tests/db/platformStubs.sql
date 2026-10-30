-- Minimal stand-ins for the Supabase platform objects that migrations in
-- supabase/migrations/ reference. Applied by tests/db/harness.ts before 001.
-- Only shapes are emulated; nothing here schedules jobs or makes HTTP calls.

-- ── auth ────────────────────────────────────────────────────────────────
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}',
  created_at timestamptz default now()
);

-- The harness sets test.uid via asUser(); unset or '' means anonymous.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$ select '{}'::jsonb $$;

create or replace function auth.role() returns text
language sql stable as $$ select 'authenticated'::text $$;

-- ── roles ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase puts extensions in this schema; 005 targets it explicitly.
create schema if not exists extensions;

-- ── cron (pg_cron) ──────────────────────────────────────────────────────
create schema if not exists cron;

create or replace function cron.schedule(job_name text, schedule text, command text)
returns bigint language sql as $$ select 0::bigint $$;

create or replace function cron.unschedule(job_name text)
returns boolean language sql as $$ select true $$;

create or replace function cron.unschedule(job_id bigint)
returns boolean language sql as $$ select true $$;

create table if not exists cron.job_run_details (end_time timestamptz);

-- ── vault ───────────────────────────────────────────────────────────────
create schema if not exists vault;

create table if not exists vault.secrets (name text, secret text);

create or replace view vault.decrypted_secrets as
  select name, secret as decrypted_secret from vault.secrets;

-- ── net (pg_net) ────────────────────────────────────────────────────────
create schema if not exists net;

create or replace function net.http_post(
  url text,
  body jsonb default '{}',
  headers jsonb default '{}',
  params jsonb default '{}',
  timeout_milliseconds int default 5000
) returns bigint language sql as $$ select 0::bigint $$;

-- ── realtime publication ────────────────────────────────────────────────
-- PGlite is Postgres 18, which refuses UPDATE on a REPLICA IDENTITY FULL table
-- in a publication when that table has unpublished generated columns (013
-- sets FULL on players/predictions, which have generated columns). Supabase
-- runs an older Postgres without that check; publishing stored generated
-- columns restores the old outcome without touching any migration.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime with (publish_generated_columns = stored);
  end if;
end $$;
