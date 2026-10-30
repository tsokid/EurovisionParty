-- ============================================================
-- 071: RPCs on contest_entries (sub-project 2a)
-- ------------------------------------------------------------
-- Section A (Task 3): the four existing result RPCs read and
--   write contest_entries instead of eurovision_2026_*, and every
--   effect on results / predictions / players / rooms is limited
--   to rooms of p_year (rooms.year). Signatures, return types,
--   security definer, search_path and the is_super_admin() gate
--   are unchanged.
--     * finalize_results(int)            (was 038)
--     * commit_manual_results(int, text[]) (was 027)
--     * reset_manual_results(int)        (was 043)
--     * reset_contest(int, bool, bool, bool) (was 042); the legacy
--       1-argument overload from 039/040 is dropped.
-- Section B (Task 4): contest lifecycle and entry RPCs, and the
--   parser write guard on contest_entries.
-- Section C (Task 5): parser_upsert_entries, the parser's write path.
-- Later sections are appended by later tasks.
--
-- predictions.total_points and players.total_points are generated
-- columns and are never written here.
-- ============================================================

begin;

-- ════════════════════════════════════════════════════════════
-- Section A: result RPCs on contest_entries, year-scoped
-- ════════════════════════════════════════════════════════════

-- ── A1. finalize_results ────────────────────────────────────
-- Ranking now comes from contest_entries (final_place of p_year).
-- Propagation is limited to rooms of p_year; before, every room
-- with predictions and no results got the ranking, whatever its year.
create or replace function public.finalize_results(p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status        text;
  v_ranking_arr   text[];
  v_room_id       uuid;
  v_host_id       uuid;
  v_scored_count  int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  -- 1. Flip parse_jobs.results status if not already finalized
  select status into v_status
    from public.parse_jobs
   where year = p_year and kind = 'results';
  if v_status is null then
    raise exception 'no results job for year %', p_year;
  end if;
  if v_status <> 'finalized' then
    update public.parse_jobs
       set status = 'finalized', stopped_at = now()
     where year = p_year and kind = 'results';
  end if;

  -- 2. Build the ordered ISO array from the year's final places
  select array_agg(iso order by final_place) into v_ranking_arr
    from public.contest_entries
   where year = p_year and final_place is not null;

  if v_ranking_arr is null or array_length(v_ranking_arr, 1) is null then
    return 0;
  end if;

  -- 3. Propagate to every room of p_year with predictions and no results yet.
  for v_room_id in
    select distinct p.room_id
      from public.predictions p
      join public.rooms ro on ro.id = p.room_id
     where ro.year = p_year
       and not exists (
         select 1 from public.results r where r.room_id = p.room_id
       )
  loop
    select id into v_host_id
      from public.players
     where room_id = v_room_id
       and (is_host = true or status <> 'exited')
     order by is_host desc nulls last, joined_at asc
     limit 1;

    if v_host_id is not null then
      insert into public.results (room_id, final_ranking, confirmed_by)
      values (v_room_id, to_jsonb(v_ranking_arr), v_host_id)
      on conflict (room_id) do nothing;

      perform public.score_all_predictions(v_room_id);
      v_scored_count := v_scored_count + 1;
    end if;
  end loop;

  return v_scored_count;
end;
$fn$;

revoke execute on function public.finalize_results(int) from public, anon;
grant execute on function public.finalize_results(int) to authenticated;

-- ── A2. commit_manual_results ───────────────────────────────
-- p_isos is the full final ranking, winner first. It must name every
-- grand finalist of p_year (final_running_order is not null) exactly once.
-- Clears the year's result columns, then sets final_place = position and
-- source = 'manual'. Points stay null: the old synthetic points
-- ((n + 1 - i) * 10) are no longer invented. Other years are untouched.
-- Refused once p_year is finalized or archived (its results are final and,
-- for archived years, the only copy lives in contest_entries).
create or replace function public.commit_manual_results(p_year int, p_isos text[])
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count    int;
  v_expected int;
  v_stage    public.contest_stage;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year;
  if v_stage in ('finalized', 'archived') then
    raise exception 'contest % is %; manual results refused', p_year, v_stage;
  end if;

  if not exists (
    select 1 from public.parse_jobs
     where year = p_year and kind = 'results' and manual_override = true
  ) then
    raise exception 'manual_override is not active for year %', p_year;
  end if;

  v_count := array_length(p_isos, 1);
  if v_count is null or v_count = 0 then
    raise exception 'p_isos must contain at least one ISO';
  end if;

  select count(*) into v_expected
    from public.contest_entries
   where year = p_year and final_running_order is not null;
  if v_expected = 0 then
    raise exception 'no finalists found for % — set the final lineup first', p_year;
  end if;
  if v_count <> v_expected then
    raise exception 'expected % rankings (one per finalist), got %', v_expected, v_count;
  end if;

  perform 1
    from unnest(p_isos) iso(code)
   where not exists (
     select 1 from public.contest_entries e
      where e.year = p_year and e.iso = iso.code and e.final_running_order is not null
   )
   limit 1;
  if found then
    raise exception 'one or more ISOs are not finalists of %', p_year;
  end if;

  if (select count(distinct code) from unnest(p_isos) iso(code)) <> v_count then
    raise exception 'p_isos contains duplicate ISOs';
  end if;

  update public.contest_entries
     set final_place     = null,
         total_points    = null,
         jury_points     = null,
         televote_points = null,
         updated_at      = now()
   where year = p_year;

  update public.contest_entries e
     set final_place = r.pos,
         source      = 'manual',
         updated_at  = now()
    from unnest(p_isos) with ordinality as r(code, pos)
   where e.year = p_year and e.iso = r.code;

  -- Flip status + propagate to the year's rooms via finalize_results
  perform public.finalize_results(p_year);

  return v_count;
end;
$fn$;

revoke execute on function public.commit_manual_results(int, text[]) from public, anon;
grant execute on function public.commit_manual_results(int, text[]) to authenticated;

-- ── A3. reset_manual_results ────────────────────────────────
-- Clears p_year's result columns and un-scores rooms of p_year so a
-- re-finalize re-propagates. Before, it cleared every room.
-- Refused once p_year is finalized or archived, like reset_contest.
create or replace function public.reset_manual_results(p_year int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year;
  if v_stage in ('finalized', 'archived') then
    raise exception 'contest % is %; manual results refused', p_year, v_stage;
  end if;

  update public.contest_entries
     set final_place     = null,
         total_points    = null,
         jury_points     = null,
         televote_points = null,
         updated_at      = now()
   where year = p_year;

  delete from public.results
   where room_id in (select id from public.rooms where year = p_year);

  update public.predictions
     set top5_points   = null,
         worst5_points = null,
         scored_at     = null,
         is_locked     = false
   where room_id in (select id from public.rooms where year = p_year);

  -- total_points is a generated column — only zero pred_points
  update public.players
     set pred_points = 0
   where room_id in (select id from public.rooms where year = p_year);

  update public.parse_jobs
     set status       = 'idle',
         stopped_at   = null,
         last_poll_at = null,
         poll_count   = 0,
         started_at   = null,
         started_by   = null
   where year = p_year and kind = 'results';
end;
$fn$;

revoke execute on function public.reset_manual_results(int) from public, anon;
grant execute on function public.reset_manual_results(int) to authenticated;

-- ── A4. reset_contest ───────────────────────────────────────
-- Clears p_year's lineup and results (final_running_order, qualified and
-- the result columns); entry rows and semi data stay. Refused once the
-- contest is finalized or archived. Room effects are limited to rooms of
-- p_year. Before, it deleted every participant and every room's results.
drop function if exists public.reset_contest(int);

create or replace function public.reset_contest(
  p_year                 int,
  p_delete_predictions   bool default false,
  p_reset_points         bool default false,
  p_delete_rooms         bool default false
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year;
  if v_stage in ('finalized', 'archived') then
    raise exception 'contest % is %; reset refused', p_year, v_stage;
  end if;

  -- Core: always runs
  update public.contest_entries
     set final_running_order = null,
         final_place         = null,
         total_points        = null,
         jury_points         = null,
         televote_points     = null,
         qualified           = null,
         updated_at          = now()
   where year = p_year;

  delete from public.results
   where room_id in (select id from public.rooms where year = p_year);

  if not p_delete_rooms then
    update public.predictions
       set top5_points   = null,
           worst5_points = null,
           scored_at     = null,
           is_locked     = false
     where room_id in (select id from public.rooms where year = p_year);

    -- total_points is generated; only zero pred_points
    update public.players
       set pred_points = 0
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  update public.parse_jobs
     set status       = 'idle',
         started_at   = null,
         stopped_at   = null,
         last_poll_at = null,
         poll_count   = 0
   where year = p_year;

  -- Optional A
  if p_delete_predictions and not p_delete_rooms then
    delete from public.predictions
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  -- Optional B — zero source columns; total_points regenerates automatically
  if p_reset_points and not p_delete_rooms then
    update public.players
       set quiz_points = 0,
           duel_points = 0,
           pred_points = 0
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  -- Optional C
  if p_delete_rooms then
    delete from public.rooms where year = p_year;
  end if;
end;
$fn$;

revoke execute on function public.reset_contest(int, bool, bool, bool) from public, anon;
grant execute on function public.reset_contest(int, bool, bool, bool) to authenticated;

-- ════════════════════════════════════════════════════════════
-- Section B: contest lifecycle and entry RPCs (spec §2 D2-D4, §6)
-- ------------------------------------------------------------
-- Stages: upcoming -> current -> finalized -> archived. At most one
-- contest is current or finalized (one_live_contest), so every flip
-- that moves the live year demotes the old one before promoting the
-- new one. All RPCs: security definer, search_path = public,
-- is_super_admin() gate, execute for authenticated only.
-- ════════════════════════════════════════════════════════════

-- ── B1. create_contest ──────────────────────────────────────
-- New year as upcoming, plus its two parse jobs pointing at the
-- eurovision.com grand-final page derived from the city slug.
-- Existing parse_jobs rows are left as they are.
create or replace function public.create_contest(
  p_year      int,
  p_city      text,
  p_city_slug text,
  p_host_iso  text,
  p_semi1     date,
  p_semi2     date,
  p_final     date
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_url text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  insert into public.contests
    (year, city, city_slug, host_iso, semi1_date, semi2_date, final_date, stage)
  values
    (p_year, p_city, p_city_slug, p_host_iso, p_semi1, p_semi2, p_final, 'upcoming');

  v_url := 'https://www.eurovision.com/eurovision-song-contest/'
        || p_city_slug || '-' || p_year || '/'
        || p_city_slug || '-' || p_year || '-grand-final/';

  insert into public.parse_jobs (year, kind, source_url)
  values (p_year, 'participants', v_url),
         (p_year, 'results',      v_url)
  on conflict (year, kind) do nothing;
end;
$fn$;

revoke execute on function public.create_contest(int, text, text, text, date, date, date) from public, anon;
grant execute on function public.create_contest(int, text, text, text, date, date, date) to authenticated;

-- ── B2. update_contest ──────────────────────────────────────
-- Partial update from a jsonb object. Keys outside the allow-list
-- raise; stage and timestamps only move through the lifecycle RPCs.
-- A key present with JSON null sets the column to null.
create or replace function public.update_contest(p_year int, p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_key text;
  v_row public.contests;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  for v_key in select jsonb_object_keys(p_fields) loop
    if v_key not in ('city', 'city_slug', 'host_iso', 'semi1_date', 'semi2_date', 'final_date', 'indexable') then
      raise exception 'unknown field %', v_key;
    end if;
  end loop;

  select * into v_row from public.contests where year = p_year for update;
  if not found then
    raise exception 'contest % not found', p_year;
  end if;

  v_row := jsonb_populate_record(v_row, p_fields);

  update public.contests
     set city       = v_row.city,
         city_slug  = v_row.city_slug,
         host_iso   = v_row.host_iso,
         semi1_date = v_row.semi1_date,
         semi2_date = v_row.semi2_date,
         final_date = v_row.final_date,
         indexable  = v_row.indexable,
         updated_at = now()
   where year = p_year;
end;
$fn$;

revoke execute on function public.update_contest(int, jsonb) from public, anon;
grant execute on function public.update_contest(int, jsonb) to authenticated;

-- ── B3. upsert_contest_entry ────────────────────────────────
-- Insert or partially update one entry. Allowed keys: every entry
-- column except year, iso and updated_at (set here). A key present
-- with JSON null sets the column to null. Refused on an archived
-- year; corrections there go through Edit + Republish (sub-project
-- 2b, separate RPC).
create or replace function public.upsert_contest_entry(p_year int, p_iso text, p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_key   text;
  v_stage public.contest_stage;
  v_row   public.contest_entries;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  for v_key in select jsonb_object_keys(p_fields) loop
    if v_key not in ('artist', 'song', 'language', 'semi', 'semi_running_order', 'semi_place',
                     'semi_points', 'qualified', 'final_running_order', 'final_place',
                     'total_points', 'jury_points', 'televote_points', 'source') then
      raise exception 'unknown field %', v_key;
    end if;
  end loop;

  select stage into v_stage from public.contests where year = p_year;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage = 'archived' then
    raise exception 'contest % is archived; use Edit + Republish', p_year;
  end if;

  select * into v_row from public.contest_entries
   where year = p_year and iso = p_iso for update;
  if not found then
    v_row.year := p_year;
    v_row.iso  := p_iso;
  end if;

  v_row := jsonb_populate_record(v_row, p_fields);

  insert into public.contest_entries as e
    (year, iso, artist, song, language, semi, semi_running_order, semi_place, semi_points,
     qualified, final_running_order, final_place, total_points, jury_points, televote_points,
     source, updated_at)
  values
    (v_row.year, v_row.iso, v_row.artist, v_row.song, v_row.language, v_row.semi,
     v_row.semi_running_order, v_row.semi_place, v_row.semi_points, v_row.qualified,
     v_row.final_running_order, v_row.final_place, v_row.total_points, v_row.jury_points,
     v_row.televote_points, v_row.source, now())
  on conflict (year, iso) do update
     set artist              = excluded.artist,
         song                = excluded.song,
         language            = excluded.language,
         semi                = excluded.semi,
         semi_running_order  = excluded.semi_running_order,
         semi_place          = excluded.semi_place,
         semi_points         = excluded.semi_points,
         qualified           = excluded.qualified,
         final_running_order = excluded.final_running_order,
         final_place         = excluded.final_place,
         total_points        = excluded.total_points,
         jury_points         = excluded.jury_points,
         televote_points     = excluded.televote_points,
         source              = excluded.source,
         updated_at          = excluded.updated_at;
end;
$fn$;

revoke execute on function public.upsert_contest_entry(int, text, jsonb) from public, anon;
grant execute on function public.upsert_contest_entry(int, text, jsonb) to authenticated;

-- ── B4. delete_contest_entry ────────────────────────────────
-- Same archived refusal as upsert_contest_entry.
create or replace function public.delete_contest_entry(p_year int, p_iso text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage = 'archived' then
    raise exception 'contest % is archived; use Edit + Republish', p_year;
  end if;

  delete from public.contest_entries where year = p_year and iso = p_iso;
end;
$fn$;

revoke execute on function public.delete_contest_entry(int, text) from public, anon;
grant execute on function public.delete_contest_entry(int, text) to authenticated;

-- ── B5. start_contest ───────────────────────────────────────
-- upcoming -> current, only while no contest is live. In the normal
-- cycle the next year becomes current through archive_contest (D4);
-- this covers the case where nothing is live.
create or replace function public.start_contest(p_year int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
  v_live  record;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year for update;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage <> 'upcoming' then
    raise exception 'contest % is %; start requires upcoming', p_year, v_stage;
  end if;

  select year, stage into v_live
    from public.contests where stage in ('current', 'finalized') limit 1;
  if found then
    raise exception 'contest % is %; start of % refused', v_live.year, v_live.stage, p_year;
  end if;

  update public.contests
     set stage = 'current', updated_at = now()
   where year = p_year;
end;
$fn$;

revoke execute on function public.start_contest(int) from public, anon;
grant execute on function public.start_contest(int) to authenticated;

-- ── B6. finalize_contest ────────────────────────────────────
-- current -> finalized, only once p_year has results (at least one
-- final_place, from the parser or a manual ranking): finalizing is a
-- one-way door, since manual results are refused afterwards.
-- Wraps finalize_results (flips parse_jobs and
-- scores the year's rooms), then computes winners for every room of
-- p_year that has none yet. Returns that number of rooms.
create or replace function public.finalize_contest(p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
  v_room  uuid;
  v_count int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year for update;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage <> 'current' then
    raise exception 'contest % is %; finalize requires current', p_year, v_stage;
  end if;
  -- Spec §6: results parse done or manual ranking entered.
  if not exists (
    select 1 from public.contest_entries where year = p_year and final_place is not null
  ) then
    raise exception 'contest % has no results; finalize refused', p_year;
  end if;

  perform public.finalize_results(p_year);

  update public.contests
     set stage = 'finalized', finalized_at = now(), updated_at = now()
   where year = p_year;

  for v_room in
    select r.id
      from public.rooms r
     where r.year = p_year
       and not exists (select 1 from public.winners w where w.room_id = r.id)
     order by r.id
  loop
    perform public.compute_winners(v_room);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

revoke execute on function public.finalize_contest(int) from public, anon;
grant execute on function public.finalize_contest(int) to authenticated;

-- ── B7. archive_contest ─────────────────────────────────────
-- Y finalized -> archived, Y+1 -> current, in one transaction (D4:
-- only once Y+1 has at least one entry). Y is demoted first so
-- one_live_contest holds at every row.
create or replace function public.archive_contest(p_year int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
  v_next  public.contest_stage;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year for update;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage <> 'finalized' then
    raise exception 'contest % is %; archive requires finalized', p_year, v_stage;
  end if;

  select stage into v_next from public.contests where year = p_year + 1 for update;
  if v_next is null then
    raise exception 'contest % not found; create it before archiving %', p_year + 1, p_year;
  end if;
  if not exists (select 1 from public.contest_entries where year = p_year + 1) then
    raise exception 'no entries for %; archive of % refused', p_year + 1, p_year;
  end if;

  update public.contests
     set stage = 'archived', archived_at = now(), updated_at = now()
   where year = p_year;

  update public.contests
     set stage = 'current', updated_at = now()
   where year = p_year + 1;
end;
$fn$;

revoke execute on function public.archive_contest(int) from public, anon;
grant execute on function public.archive_contest(int) to authenticated;

-- ── B8. unarchive_contest ───────────────────────────────────
-- Full undo of archive_contest: Y archived -> finalized, Y+1 current ->
-- upcoming. Only for the latest archived year, and only while no room
-- of Y+1 exists. Entries of Y+1 are kept. Y+1 is demoted first so
-- one_live_contest holds at every row.
create or replace function public.unarchive_contest(p_year int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
  v_next  public.contest_stage;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year for update;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage <> 'archived' then
    raise exception 'contest % is %; un-archive requires archived', p_year, v_stage;
  end if;
  if p_year <> (select max(year) from public.contests where stage = 'archived') then
    raise exception 'contest % is not the latest archived year; un-archive refused', p_year;
  end if;

  select stage into v_next from public.contests where year = p_year + 1 for update;
  if v_next is distinct from 'current' then
    raise exception 'contest % is %; un-archive of % requires it current',
      p_year + 1, coalesce(v_next::text, 'missing'), p_year;
  end if;

  if exists (select 1 from public.rooms where year = p_year + 1) then
    raise exception 'rooms exist for %; un-archive refused', p_year + 1;
  end if;

  update public.contests
     set stage = 'upcoming', updated_at = now()
   where year = p_year + 1;

  update public.contests
     set stage = 'finalized', archived_at = null, updated_at = now()
   where year = p_year;
end;
$fn$;

revoke execute on function public.unarchive_contest(int) from public, anon;
grant execute on function public.unarchive_contest(int) to authenticated;

-- ── B9. Parser write guard ──────────────────────────────────
-- The parser edge function sets app.writer = 'parser' (Task 5,
-- transaction-local). Its inserts, updates and deletes touching a
-- finalized or archived year are refused, checking both the new year
-- and, on update/delete, the old one (so a row cannot be moved out of
-- a locked year). Other writers (admin RPCs, imports) are not
-- affected. Not an RPC: trigger only.
create or replace function public.contest_entries_parser_guard()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_year  int;
  v_stage public.contest_stage;
begin
  if current_setting('app.writer', true) = 'parser' then
    for v_year in
      select y from (values
        (case when tg_op in ('INSERT', 'UPDATE') then new.year end),
        (case when tg_op in ('UPDATE', 'DELETE') then old.year end)
      ) as t(y)
      where y is not null
    loop
      select stage into v_stage from public.contests where year = v_year;
      if v_stage in ('finalized', 'archived') then
        raise exception 'contest % is %; parser writes refused', v_year, v_stage;
      end if;
    end loop;
  end if;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists contest_entries_parser_guard on public.contest_entries;
create trigger contest_entries_parser_guard
  before insert or update or delete on public.contest_entries
  for each row execute function public.contest_entries_parser_guard();

-- ════════════════════════════════════════════════════════════
-- Section C (Task 5): parser writes to contest_entries
-- ════════════════════════════════════════════════════════════

-- ── C1. parser_upsert_entries ───────────────────────────────
-- The only write path of the eurovision-parse edge function. Sets
-- app.writer = 'parser' for the current transaction, so the B9 guard
-- refuses writes to a finalized or archived year. p_rows is a json
-- array built by supabase/functions/eurovision-parse/rows.ts; a row's
-- year, when present, must equal p_year. Every iso must exist in
-- countries ('unknown country %' rather than an FK error). Duplicate
-- isos in p_rows: the first one wins.
--   participants: upserts artist, song, final_running_order, source.
--     Rows of p_year whose iso is not in p_rows get
--     final_running_order = null; nothing is deleted.
--   results: writes final_place, total_points, jury_points,
--     televote_points, source, only for finalists of p_year
--     (final_running_order is not null). Other rows are skipped.
-- Returns the number of rows upserted (the null-outs are not counted).
-- service_role only: no is_super_admin() gate, no authenticated grant.
-- Task 9 adds p_kind 'semis'.
create or replace function public.parser_upsert_entries(p_year int, p_rows jsonb, p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bad   text;
  v_count int;
begin
  if p_kind is null or p_kind not in ('participants', 'results') then
    raise exception 'unknown kind %', p_kind;
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a json array';
  end if;
  if not exists (select 1 from public.contests where year = p_year) then
    raise exception 'contest % not found', p_year;
  end if;

  select r->>'year' into v_bad
    from jsonb_array_elements(p_rows) as t(r)
   where r ? 'year' and (r->>'year') is distinct from p_year::text
   limit 1;
  if found then
    raise exception 'row year % does not match %', v_bad, p_year;
  end if;

  select coalesce(r->>'iso', '<null>') into v_bad
    from jsonb_array_elements(p_rows) as t(r)
   where not exists (select 1 from public.countries c where c.iso = r->>'iso')
   limit 1;
  if found then
    raise exception 'unknown country %', v_bad;
  end if;

  perform set_config('app.writer', 'parser', true);

  if p_kind = 'participants' then
    insert into public.contest_entries as e
      (year, iso, artist, song, final_running_order, source, updated_at)
    select distinct on (x.iso)
           p_year, x.iso, x.artist, x.song, x.final_running_order, x.source, now()
      from jsonb_array_elements(p_rows) with ordinality as t(r, n),
           jsonb_to_record(t.r) as x(iso text, artist text, song text,
                                     final_running_order smallint, source text)
     order by x.iso, t.n
    on conflict (year, iso) do update
       set artist              = excluded.artist,
           song                = excluded.song,
           final_running_order = excluded.final_running_order,
           source              = excluded.source,
           updated_at          = excluded.updated_at;
    get diagnostics v_count = row_count;

    update public.contest_entries
       set final_running_order = null, updated_at = now()
     where year = p_year
       and final_running_order is not null
       and iso not in (select r->>'iso' from jsonb_array_elements(p_rows) as t(r));
  else
    insert into public.contest_entries as e
      (year, iso, final_place, total_points, jury_points, televote_points, source, updated_at)
    select distinct on (x.iso)
           p_year, x.iso, x.final_place, x.total_points, x.jury_points, x.televote_points,
           x.source, now()
      from jsonb_array_elements(p_rows) with ordinality as t(r, n),
           jsonb_to_record(t.r) as x(iso text, final_place smallint, total_points int,
                                     jury_points int, televote_points int, source text)
      join public.contest_entries f
        on f.year = p_year and f.iso = x.iso and f.final_running_order is not null
     order by x.iso, t.n
    on conflict (year, iso) do update
       set final_place     = excluded.final_place,
           total_points    = excluded.total_points,
           jury_points     = excluded.jury_points,
           televote_points = excluded.televote_points,
           source          = excluded.source,
           updated_at      = excluded.updated_at;
    get diagnostics v_count = row_count;
  end if;

  return v_count;
end;
$fn$;

revoke execute on function public.parser_upsert_entries(int, jsonb, text) from public, anon, authenticated;
grant execute on function public.parser_upsert_entries(int, jsonb, text) to service_role;

commit;
