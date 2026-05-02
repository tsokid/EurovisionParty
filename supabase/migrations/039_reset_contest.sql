-- 039_reset_contest.sql
-- Full contest reset: clears all parsed data, unscores predictions, and
-- returns both parse_jobs to idle. Use between contests / years.
-- Tighter than reset_manual_results (results-only) — this nukes participants too.

begin;

create or replace function public.reset_contest(p_year int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  -- 1. Parsed data (participants cascade-deletes results rows)
  delete from public.eurovision_2026_participants;

  -- 2. Per-room final rankings
  delete from public.results;

  -- 3. Un-score predictions and unlock them so players can re-submit
  update public.predictions
     set top5_points   = null,
         worst5_points = null,
         scored_at     = null,
         is_locked     = false;

  -- 4. Reset player prediction scores; recalculate total_points without pred
  update public.players
     set pred_points   = 0,
         total_points  = quiz_points + duel_points;

  -- 5. Reset both parse jobs to idle
  update public.parse_jobs
     set status        = 'idle',
         started_at    = null,
         stopped_at    = null,
         last_poll_at  = null,
         poll_count    = 0
   where year = p_year;

end;
$fn$;

grant execute on function public.reset_contest(int) to authenticated;

commit;
