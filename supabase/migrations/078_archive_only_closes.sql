-- 078: Archive only closes a contest; the game year follows the parser.
-- Owner decisions, 19 Nov 2026 (docs/superpowers/roadmap/2026-11-18-roadmap.md,
-- "What each admin action affects"):
--
-- * archive_contest: finalized -> archived (locked, indexable). It no longer
--   needs the next year to exist or to have entries, and no longer touches
--   the next year. The next contest opens with its own Start (start_contest,
--   unchanged), which works once nothing is current or finalized.
-- * unarchive_contest: archived -> finalized for the latest archived year,
--   refused only while another contest is current or finalized (at most one
--   live contest, one_live_contest).
-- * live_contest_year(): new rooms play the newest contest that has entries,
--   in any stage, so archiving changes nothing for the game. Falls back to the
--   previous rule when no contest has entries.

-- ── live_contest_year() ─────────────────────────────────────────────────
create or replace function public.live_contest_year()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max(e.year) from public.contest_entries e),
    (select year from public.contests where stage in ('current', 'finalized')),
    (select max(year) from public.contests where stage <> 'archived'),
    extract(year from now())::int
  )
$$;

grant execute on function public.live_contest_year() to anon, authenticated;

-- ── archive_contest ─────────────────────────────────────────────────────
create or replace function public.archive_contest(p_year int)
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

  select stage into v_stage from public.contests where year = p_year for update;
  if v_stage is null then
    raise exception 'contest % not found', p_year;
  end if;
  if v_stage <> 'finalized' then
    raise exception 'contest % is %; archive requires finalized', p_year, v_stage;
  end if;

  -- Its archive page (full results) takes over the hub's traffic through
  -- the 301, so it is indexable from the start.
  update public.contests
     set stage = 'archived', archived_at = now(), indexable = true, updated_at = now()
   where year = p_year;
end;
$fn$;

revoke execute on function public.archive_contest(int) from public, anon;
grant execute on function public.archive_contest(int) to authenticated;

-- ── unarchive_contest ───────────────────────────────────────────────────
create or replace function public.unarchive_contest(p_year int)
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
  if v_stage <> 'archived' then
    raise exception 'contest % is %; un-archive requires archived', p_year, v_stage;
  end if;
  if p_year <> (select max(year) from public.contests where stage = 'archived') then
    raise exception 'contest % is not the latest archived year; un-archive refused', p_year;
  end if;

  select year, stage into v_live
    from public.contests where stage in ('current', 'finalized') limit 1;
  if found then
    raise exception 'contest % is %; un-archive of % refused', v_live.year, v_live.stage, p_year;
  end if;

  update public.contests
     set stage = 'finalized', archived_at = null, updated_at = now()
   where year = p_year;
end;
$fn$;

revoke execute on function public.unarchive_contest(int) from public, anon;
grant execute on function public.unarchive_contest(int) to authenticated;
