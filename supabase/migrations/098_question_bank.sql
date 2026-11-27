-- 098_question_bank.sql
-- The question bank moves to the server (expand step; the bundle still
-- carries the questions until the server referee ships).
--
-- * quiz_questions gains the full question (EL/EN text and options), what it
--   is about (contest year, country, topic), the single fact it tests (one
--   live question per fact: no duplicates), its source and a status. Only
--   'verified' questions will be served to players.
-- * The era (current / previous / recent / classic) is never stored: it is
--   computed from the contest year against the room's year, so questions
--   move to the right era every year by themselves.
-- * quiz_settings holds the round mix by era, edited in /admin.
-- * Players still cannot read either table: only super admins can, and the
--   scoring functions (SECURITY DEFINER) read quiz_questions as before.
-- The question data is loaded outside git: the repo is public.

-- ── 1. Question columns ──────────────────────────────────────────────────
alter table public.quiz_questions
  add column if not exists contest_year   int  references public.contests(year),
  add column if not exists iso            text references public.countries(iso),
  add column if not exists topic          text,
  add column if not exists difficulty     text,
  add column if not exists question_en    text,
  add column if not exists question_el    text,
  add column if not exists options_en     text[],
  add column if not exists options_el     text[],
  add column if not exists fact           text,
  add column if not exists source         text,
  add column if not exists note           text,
  add column if not exists lyric_check    boolean not null default false,
  add column if not exists time_sensitive boolean not null default false,
  add column if not exists status         text not null default 'draft',
  add column if not exists verified_at    timestamptz,
  add column if not exists created_at     timestamptz not null default now(),
  add column if not exists updated_at     timestamptz not null default now();

-- The bank is filled outside git (the repo is public). Until a row is filled
-- it keeps only id and correct_index, exactly as before, so scoring is not
-- interrupted between this migration and the load.

create or replace function public.options_valid(o text[]) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select o is not null
     and cardinality(o) = 4
     and (select count(distinct lower(btrim(x))) from unnest(o) x where btrim(x) <> '') = 4
$$;

alter table public.quiz_questions
  drop constraint if exists quiz_questions_topic_check,
  drop constraint if exists quiz_questions_difficulty_check,
  drop constraint if exists quiz_questions_status_check,
  drop constraint if exists quiz_questions_correct_check,
  drop constraint if exists quiz_questions_complete_check,
  drop constraint if exists quiz_questions_verified_check;

alter table public.quiz_questions
  add constraint quiz_questions_topic_check check (topic is null or topic in (
    'winner', 'runner_up', 'result', 'performer', 'song', 'songwriter', 'language',
    'staging', 'stage_guest', 'host', 'national_selection', 'participation',
    'rules', 'records', 'lyrics', 'iconic')),
  add constraint quiz_questions_difficulty_check check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  add constraint quiz_questions_status_check check (status in ('draft', 'verified', 'retired')),
  add constraint quiz_questions_correct_check check (correct_index between 0 and 3),
  -- A question with any text is a complete question: both languages,
  -- four distinct options in each, a topic, a difficulty and its fact.
  add constraint quiz_questions_complete_check check (
    question_en is null or (
      btrim(question_en) <> '' and question_el is not null and btrim(question_el) <> ''
      and options_valid(options_en) and options_valid(options_el)
      and topic is not null and difficulty is not null
      and fact is not null and btrim(fact) <> '')),
  -- Only a complete question with a source can be verified.
  add constraint quiz_questions_verified_check check (
    status <> 'verified' or (question_en is not null and source is not null and btrim(source) <> ''));

-- One live question per fact.
create unique index if not exists quiz_questions_fact_uniq
  on public.quiz_questions (lower(btrim(fact))) where status <> 'retired' and fact is not null;
create index if not exists quiz_questions_pick_idx
  on public.quiz_questions (status, contest_year, difficulty);

-- New questions get ids after the existing ones.
create sequence if not exists public.quiz_questions_id_seq owned by public.quiz_questions.id;
select setval('public.quiz_questions_id_seq', greatest((select coalesce(max(id), 0) from public.quiz_questions), 1));
alter table public.quiz_questions alter column id set default nextval('public.quiz_questions_id_seq');

create or replace function public.quiz_questions_touch() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if new.status = 'verified' then
    if tg_op = 'INSERT' or old.status is distinct from 'verified' then
      new.verified_at := now();
    end if;
  else
    new.verified_at := null;
  end if;
  return new;
end $$;

drop trigger if exists quiz_questions_touch on public.quiz_questions;
create trigger quiz_questions_touch before insert or update on public.quiz_questions
  for each row execute function public.quiz_questions_touch();

-- ── 2. Eras ──────────────────────────────────────────────────────────────
-- Eras are counted from the room's contest year (rooms.year, which new
-- rooms take from live_contest_year(): the newest contest with a full
-- line-up), so a room always plays its own year as "current".
-- current: this year · previous: last year · recent: 2-5 years back ·
-- classic: more than 5 years back, or not about one year (rules, all-time records).
create or replace function public.question_era(p_contest_year int, p_live_year int)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_contest_year is null then 'classic'
    when p_live_year - p_contest_year <= 0 then 'current'
    when p_live_year - p_contest_year = 1 then 'previous'
    when p_live_year - p_contest_year <= 5 then 'recent'
    else 'classic'
  end
$$;

-- ── 3. Round mix ─────────────────────────────────────────────────────────
create table if not exists public.quiz_settings (
  id           boolean primary key default true check (id),
  era_current  int not null default 30 check (era_current  between 0 and 100),
  era_previous int not null default 30 check (era_previous between 0 and 100),
  era_recent   int not null default 20 check (era_recent   between 0 and 100),
  era_classic  int not null default 20 check (era_classic  between 0 and 100),
  updated_at   timestamptz not null default now(),
  constraint quiz_settings_sum check (era_current + era_previous + era_recent + era_classic = 100)
);
insert into public.quiz_settings (id) values (true) on conflict (id) do nothing;

create or replace function public.quiz_settings_touch() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists quiz_settings_touch on public.quiz_settings;
create trigger quiz_settings_touch before update on public.quiz_settings
  for each row execute function public.quiz_settings_touch();

-- How many questions of a round come from each era (largest remainder, so
-- the counts always add up to the round size; ties go to the newer era).
create or replace function public.quiz_round_mix(p_size int default 10)
returns table (era text, n int)
language sql stable security definer set search_path = public, pg_temp as $$
  with s as (select * from quiz_settings where id),
  w as (
    select v.era, v.pct, v.ord from (values
      ('current',  (select era_current  from s), 1),
      ('previous', (select era_previous from s), 2),
      ('recent',   (select era_recent   from s), 3),
      ('classic',  (select era_classic  from s), 4)) v(era, pct, ord)
  ),
  b as (select era, ord, (pct * p_size) / 100 as base, (pct * p_size) % 100 as rem from w),
  r as (select era, ord, base, row_number() over (order by rem desc, ord) as rk from b)
  select r.era, (r.base + case when r.rk <= p_size - (select sum(base) from b) then 1 else 0 end)::int
  from r order by r.ord
$$;

-- ── 4. Access: super admins only ─────────────────────────────────────────
alter table public.quiz_questions enable row level security;
alter table public.quiz_settings enable row level security;

drop policy if exists quiz_questions_admin_all on public.quiz_questions;
create policy quiz_questions_admin_all on public.quiz_questions
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

drop policy if exists quiz_settings_admin_read on public.quiz_settings;
drop policy if exists quiz_settings_admin_update on public.quiz_settings;
create policy quiz_settings_admin_read on public.quiz_settings
  for select to authenticated using (is_super_admin());
create policy quiz_settings_admin_update on public.quiz_settings
  for update to authenticated using (is_super_admin()) with check (is_super_admin());

revoke all on public.quiz_questions, public.quiz_settings from anon;
revoke all on public.quiz_questions, public.quiz_settings from authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant select on public.quiz_settings to authenticated;
grant update (era_current, era_previous, era_recent, era_classic) on public.quiz_settings to authenticated;
revoke all on sequence public.quiz_questions_id_seq from anon;
grant usage on sequence public.quiz_questions_id_seq to authenticated;

revoke execute on function public.quiz_round_mix(int) from public, anon;
grant execute on function public.quiz_round_mix(int) to authenticated, service_role;
