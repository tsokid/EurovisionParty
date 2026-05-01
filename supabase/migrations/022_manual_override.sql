-- 022_manual_override.sql
-- Adds a manual override mechanism for the Results parser. When admins flip
-- the toggle ON, the cron + edge-function paths skip and admins can enter
-- the final scoreboard by hand via drag-drop. A "Finalize Manual Rankings"
-- action atomically writes 26 rows to eurovision_2026_results and pins the
-- results job to 'finalized'. A "Reset Rankings" action clears those rows
-- and un-finalizes the job — for testing.
--
-- Spec / decisions:
--   - Rank-only entry; total auto-computed = (27 - rank) * 10 so prediction
--     scoring still works without manual point input.
--   - Toggle scoped to the results job only; participants parser unaffected.
--   - All-or-nothing: commit_manual_results requires exactly one ISO per
--     position from 1 to N, and N must equal the number of rows in
--     eurovision_2026_participants.

begin;

-- ---------------------------------------------------------------------------
-- 1. Add manual_override flag to parse_jobs
-- ---------------------------------------------------------------------------
alter table public.parse_jobs
  add column if not exists manual_override boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. set_manual_override(p_year, p_active) — toggle the flag
-- ---------------------------------------------------------------------------
create or replace function public.set_manual_override(p_year int, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  update public.parse_jobs
    set manual_override = p_active
    where year = p_year and kind = 'results';
  if not found then
    raise exception 'no results job for year %', p_year;
  end if;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. commit_manual_results(p_year, p_isos) — atomic write + finalize
--    p_isos is an ordered text[] where p_isos[1] is the winner (rank 1)
--    and p_isos[N] is last place. Auto-computes total_points = (N+1-rank)*10
--    and splits half/half between jury and televote so prediction scoring
--    still produces integer point totals.
-- ---------------------------------------------------------------------------
create or replace function public.commit_manual_results(p_year int, p_isos text[])
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count int;
  v_expected int;
  i int;
  v_iso text;
  v_total int;
  v_jury int;
  v_tele int;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  -- Sanity: must be in manual override mode
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

  -- Expected count = number of grand-finalists already loaded by
  -- the participants parser (or seeded manually).
  select count(*) into v_expected
    from public.eurovision_2026_participants;
  if v_expected = 0 then
    raise exception 'no participants found — run participants parser first';
  end if;
  if v_count <> v_expected then
    raise exception 'expected % rankings (one per finalist), got %', v_expected, v_count;
  end if;

  -- Validate every ISO exists as a participant (FK guard before delete)
  perform 1
    from unnest(p_isos) iso(code)
    where not exists (
      select 1 from public.eurovision_2026_participants p where p.iso = iso.code
    )
    limit 1;
  if found then
    raise exception 'one or more ISOs are not in eurovision_2026_participants';
  end if;

  -- Wipe existing scoreboard rows
  delete from public.eurovision_2026_results;

  -- Insert N rows. Total = (N+1 - rank) * 10 so the winner gets N*10 points,
  -- last place gets 10. Jury/televote are even split (jury gets the ceiling
  -- when total is odd, but with *10 it's always even).
  for i in 1 .. v_count loop
    v_iso := p_isos[i];
    v_total := (v_count + 1 - i) * 10;
    v_jury := v_total / 2;
    v_tele := v_total - v_jury;
    insert into public.eurovision_2026_results
      (iso, ranking, total_points, jury_points, televote_points, source)
    values
      (v_iso, i, v_total, v_jury, v_tele, 'manual');
  end loop;

  -- Finalize the results job
  update public.parse_jobs
    set status = 'finalized', stopped_at = now()
    where year = p_year and kind = 'results';

  return v_count;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. reset_manual_results(p_year) — testing escape hatch
--    Clears the scoreboard, un-finalizes the job (back to 'idle' so admin
--    can either re-run the parser or re-enter manually). Leaves
--    manual_override flag as-is so admin can iterate without re-toggling.
-- ---------------------------------------------------------------------------
create or replace function public.reset_manual_results(p_year int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  delete from public.eurovision_2026_results;

  update public.parse_jobs
    set status = 'idle',
        stopped_at = null,
        last_poll_at = null,
        poll_count = 0,
        started_at = null,
        started_by = null
    where year = p_year and kind = 'results';
end;
$fn$;

grant execute on function public.set_manual_override(int, boolean)  to authenticated;
grant execute on function public.commit_manual_results(int, text[]) to authenticated;
grant execute on function public.reset_manual_results(int)          to authenticated;

commit;
