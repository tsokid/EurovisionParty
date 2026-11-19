-- 081: Game data and public data are separate (owner, 19 Nov 2026;
-- docs/superpowers/roadmap/2026-11-18-roadmap.md, "Game data and public data
-- are separate").
--
-- * game_entries: the game's grand-final line-up and ranking, per year. The
--   participants and results parsers write only here, and may run many times
--   while testing. Rooms, manual ranking, Finalize and the game year read
--   only here.
-- * contest_entries stays the public data (CMS: the Contests editor, the
--   semi-finals button, Claude on command; shipped by Publish). The parser's
--   participants and results kinds no longer write it.
-- * copy_game_to_public(year): "Copy to public", once the year is finalized:
--   the game's final line-up and ranking go into contest_entries; the owner
--   reviews them in Contests, then Publishes.
-- * Backfill: every grand finalist already in contest_entries is copied, so
--   rooms of every year (tests on 2025 and 2026 included) keep their line-up.
--   Finalists without artist and song (the 2027 participants parse of
--   19 Nov 2026, the full entry list) are not copied.
-- * The game views (entries_with_names, current_entries,
--   current_participants) now read game_entries; the live year is
--   live_contest_year().

begin;

-- ── game_entries ────────────────────────────────────────────────────────
create table if not exists public.game_entries (
  year                int  not null references public.contests(year) on delete cascade,
  iso                 text not null references public.countries(iso),
  artist              text,
  song                text,
  in_final            boolean not null default true,
  final_running_order smallint,
  final_place         smallint,
  total_points        int,
  jury_points         int,
  televote_points     int,
  source              text,
  updated_at          timestamptz not null default now(),
  primary key (year, iso)
);

alter table public.game_entries enable row level security;
drop policy if exists game_entries_read on public.game_entries;
create policy game_entries_read on public.game_entries for select to anon, authenticated using (true);
revoke all on public.game_entries from anon, authenticated;
grant select on public.game_entries to anon, authenticated, service_role;

-- The parser guard of 071 (finalized and archived years refuse parser writes).
drop trigger if exists game_entries_parser_guard on public.game_entries;
create trigger game_entries_parser_guard
  before insert or update or delete on public.game_entries
  for each row execute function public.contest_entries_parser_guard();

insert into public.game_entries
  (year, iso, artist, song, in_final, final_running_order, final_place,
   total_points, jury_points, televote_points, source, updated_at)
select year, iso, artist, song, true, final_running_order, final_place,
       total_points, jury_points, televote_points, source, updated_at
  from public.contest_entries
 where in_final
   and (coalesce(btrim(artist), '') <> '' or coalesce(btrim(song), '') <> '')
on conflict (year, iso) do nothing;

-- ── Game views ──────────────────────────────────────────────────────────
drop view if exists public.current_participants;
drop view if exists public.current_entries;
drop view if exists public.entries_with_names;

-- Every game entry of every year, with country names. Rooms read their own
-- year (rooms.year).
create view public.entries_with_names with (security_invoker = true) as
  select e.*, co.name_en, co.name_el
    from public.game_entries e
    join public.countries co on co.iso = e.iso;

-- The game entries of the game year (new rooms' year).
create view public.current_entries with (security_invoker = true) as
  select * from public.entries_with_names where year = public.live_contest_year();

-- The game's line-up: grand finalists of the game year.
create view public.current_participants with (security_invoker = true) as
  select * from public.current_entries where in_final;

revoke all on public.current_entries, public.current_participants, public.entries_with_names from anon, authenticated;
grant select on public.current_entries, public.current_participants, public.entries_with_names
  to anon, authenticated, service_role;

-- ── live_contest_year: as 078, on game_entries ──────────────────────────
create or replace function public.live_contest_year()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max(c.year) from public.contests c
      where exists (select 1 from public.game_entries e where e.year = c.year and e.in_final)
        and not exists (
          select 1 from public.game_entries e
           where e.year = c.year and e.in_final
             and (coalesce(btrim(e.artist), '') = '' or coalesce(btrim(e.song), '') = ''))),
    (select year from public.contests where stage in ('current', 'finalized')),
    (select max(year) from public.contests where stage <> 'archived'),
    extract(year from now())::int
  )
$$;

grant execute on function public.live_contest_year() to anon, authenticated;

-- ── finalize_results: ranking from game_entries ─────────────────────────
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

  select array_agg(iso order by final_place) into v_ranking_arr
    from public.game_entries
   where year = p_year and in_final and final_place is not null;

  if v_ranking_arr is null or array_length(v_ranking_arr, 1) is null then
    return 0;
  end if;

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

-- ── commit_manual_results: on game_entries ──────────────────────────────
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
    from public.game_entries
   where year = p_year and in_final;
  if v_expected = 0 then
    raise exception 'no finalists found for % — set the final lineup first', p_year;
  end if;
  if v_count <> v_expected then
    raise exception 'expected % rankings (one per finalist), got %', v_expected, v_count;
  end if;

  perform 1
    from unnest(p_isos) iso(code)
   where not exists (
     select 1 from public.game_entries e
      where e.year = p_year and e.iso = iso.code and e.in_final
   )
   limit 1;
  if found then
    raise exception 'one or more ISOs are not finalists of %', p_year;
  end if;

  if (select count(distinct code) from unnest(p_isos) iso(code)) <> v_count then
    raise exception 'p_isos contains duplicate ISOs';
  end if;

  update public.game_entries
     set final_place     = null,
         total_points    = null,
         jury_points     = null,
         televote_points = null,
         updated_at      = now()
   where year = p_year;

  update public.game_entries e
     set final_place = r.pos,
         source      = 'manual',
         updated_at  = now()
    from unnest(p_isos) with ordinality as r(code, pos)
   where e.year = p_year and e.iso = r.code;

  perform public.finalize_results(p_year);

  return v_count;
end;
$fn$;

revoke execute on function public.commit_manual_results(int, text[]) from public, anon;
grant execute on function public.commit_manual_results(int, text[]) to authenticated;

-- ── reset_manual_results: on game_entries ───────────────────────────────
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

  update public.game_entries
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

-- ── reset_contest: clears the game data only (079 otherwise) ────────────
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

  -- The game's line-up and results; the public data is never touched.
  delete from public.game_entries where year = p_year;

  delete from public.results
   where room_id in (select id from public.rooms where year = p_year);

  if not p_delete_rooms then
    update public.predictions
       set top5_points   = null,
           worst5_points = null,
           scored_at     = null,
           is_locked     = false
     where room_id in (select id from public.rooms where year = p_year);

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

  update public.contests set game_phase = 'pre_night', updated_at = now() where year = p_year;

  if p_delete_predictions and not p_delete_rooms then
    delete from public.predictions
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  if p_reset_points and not p_delete_rooms then
    update public.players
       set quiz_points = 0,
           duel_points = 0,
           pred_points = 0
     where room_id in (select id from public.rooms where year = p_year);
  end if;

  if p_delete_rooms then
    delete from public.rooms where year = p_year;
  end if;
end;
$fn$;

revoke execute on function public.reset_contest(int, bool, bool, bool) from public, anon;
grant execute on function public.reset_contest(int, bool, bool, bool) to authenticated;

-- ── finalize_contest: results from game_entries (071 otherwise) ─────────
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
  if not exists (
    select 1 from public.game_entries where year = p_year and in_final and final_place is not null
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

-- ── parser_upsert_entries: participants and results → game_entries ──────
-- semis (the Contests editor button, owner-driven) still writes the public
-- contest_entries, as in 071.
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
  if p_kind is null or p_kind not in ('participants', 'results', 'semis') then
    raise exception 'unknown kind %', p_kind;
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a json array';
  end if;
  if not exists (select 1 from public.contests where year = p_year) then
    raise exception 'contest % not found', p_year;
  end if;
  if p_kind = 'semis'
     and exists (select 1 from public.contests where year = p_year and stage = 'upcoming') then
    raise exception 'contest % is upcoming; semis refused', p_year;
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
  perform set_config('app.writer_kind', p_kind, true);

  if p_kind = 'participants' then
    insert into public.game_entries as e
      (year, iso, artist, song, in_final, final_running_order, source, updated_at)
    select distinct on (x.iso)
           p_year, x.iso, x.artist, x.song, true, x.final_running_order, x.source, now()
      from jsonb_array_elements(p_rows) with ordinality as t(r, n),
           jsonb_to_record(t.r) as x(iso text, artist text, song text,
                                     final_running_order smallint, source text)
     order by x.iso, t.n
    on conflict (year, iso) do update
       set artist              = excluded.artist,
           song                = excluded.song,
           in_final            = true,
           final_running_order = excluded.final_running_order,
           source              = excluded.source,
           updated_at          = excluded.updated_at;
    get diagnostics v_count = row_count;

    update public.game_entries
       set in_final        = false,
           final_place     = null,
           total_points    = null,
           jury_points     = null,
           televote_points = null,
           updated_at      = now()
     where year = p_year
       and in_final
       and iso not in (select r->>'iso' from jsonb_array_elements(p_rows) as t(r));
  elsif p_kind = 'semis' then
    insert into public.contest_entries as e
      (year, iso, artist, song, semi, semi_running_order, semi_place, semi_points, qualified,
       source, updated_at)
    select distinct on (x.iso)
           p_year, x.iso, x.artist, x.song, x.semi, x.semi_running_order, x.semi_place,
           x.semi_points, x.qualified, x.source, now()
      from jsonb_array_elements(p_rows) with ordinality as t(r, n),
           jsonb_to_record(t.r) as x(iso text, artist text, song text, semi smallint,
                                     semi_running_order smallint, semi_place smallint,
                                     semi_points int, qualified boolean, source text)
     order by x.iso, t.n
    on conflict (year, iso) do update
       set artist             = coalesce(e.artist, excluded.artist),
           song               = coalesce(e.song, excluded.song),
           semi               = excluded.semi,
           semi_running_order = excluded.semi_running_order,
           semi_place         = excluded.semi_place,
           semi_points        = excluded.semi_points,
           qualified          = excluded.qualified,
           source             = coalesce(e.source, excluded.source),
           updated_at         = excluded.updated_at;
    get diagnostics v_count = row_count;
  else
    insert into public.game_entries as e
      (year, iso, final_place, total_points, jury_points, televote_points, source, updated_at)
    select distinct on (x.iso)
           p_year, x.iso, x.final_place, x.total_points, x.jury_points, x.televote_points,
           x.source, now()
      from jsonb_array_elements(p_rows) with ordinality as t(r, n),
           jsonb_to_record(t.r) as x(iso text, final_place smallint, total_points int,
                                     jury_points int, televote_points int, source text)
      join public.game_entries f
        on f.year = p_year and f.iso = x.iso and f.in_final
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

-- ── copy_game_to_public: "Copy to public" ───────────────────────────────
-- Once p_year is finalized, its game grand final (line-up, running order,
-- places, points) is copied into the public contest_entries:
--   * every game finalist becomes a public finalist with the game's
--     results; a missing public row is created; an artist or song the CMS
--     already has is kept (only empty ones are filled);
--   * a public finalist that is not a game finalist stops being one and
--     loses its final results (its semi-final data stays);
--   * semi-final columns, language and other years are never touched.
-- Nothing ships until the owner Publishes. Returns the number of finalists
-- copied.
create or replace function public.copy_game_to_public(p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stage public.contest_stage;
  v_count int;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  select stage into v_stage from public.contests where year = p_year for update;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage <> 'finalized' then
    raise exception 'contest % is %; copy to public requires finalized', p_year, v_stage;
  end if;
  if not exists (
    select 1 from public.game_entries where year = p_year and in_final and final_place is not null
  ) then
    raise exception 'contest % has no game results to copy', p_year;
  end if;

  update public.contest_entries
     set in_final            = false,
         final_running_order = null,
         final_place         = null,
         total_points        = null,
         jury_points         = null,
         televote_points     = null,
         updated_at          = now()
   where year = p_year
     and in_final
     and iso not in (select iso from public.game_entries where year = p_year and in_final);

  insert into public.contest_entries as e
    (year, iso, artist, song, in_final, final_running_order, final_place,
     total_points, jury_points, televote_points, source, updated_at)
  select g.year, g.iso, g.artist, g.song, true, g.final_running_order, g.final_place,
         g.total_points, g.jury_points, g.televote_points, coalesce(g.source, 'game'), now()
    from public.game_entries g
   where g.year = p_year and g.in_final
  on conflict (year, iso) do update
     set artist              = coalesce(nullif(btrim(e.artist), ''), excluded.artist),
         song                = coalesce(nullif(btrim(e.song), ''), excluded.song),
         in_final            = true,
         final_running_order = excluded.final_running_order,
         final_place         = excluded.final_place,
         total_points        = excluded.total_points,
         jury_points         = excluded.jury_points,
         televote_points     = excluded.televote_points,
         source              = coalesce(e.source, excluded.source),
         updated_at          = excluded.updated_at;
  get diagnostics v_count = row_count;

  return v_count;
end;
$fn$;

revoke execute on function public.copy_game_to_public(int) from public, anon;
grant execute on function public.copy_game_to_public(int) to authenticated;

commit;
