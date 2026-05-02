-- 040_fix_reset_contest_where.sql
-- Supabase requires a WHERE clause on DELETE statements.
-- Recreate reset_contest with WHERE true on every DELETE.

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
  delete from public.eurovision_2026_participants where true;

  -- 2. Per-room final rankings
  delete from public.results where true;

  -- 3. Un-score predictions and unlock them
  update public.predictions
     set top5_points   = null,
         worst5_points = null,
         scored_at     = null,
         is_locked     = false
   where true;

  -- 4. Reset player prediction scores; recalculate total_points without pred
  update public.players
     set pred_points   = 0,
         total_points  = quiz_points + duel_points
   where true;

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
