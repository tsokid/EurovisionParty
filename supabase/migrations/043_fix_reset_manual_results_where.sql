-- 043_fix_reset_manual_results_where.sql
-- Supabase requires WHERE clauses on DELETE statements.
-- Also drop total_points from UPDATE (it is a generated column).

begin;

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

  delete from public.eurovision_2026_results where true;
  delete from public.results where true;

  update public.predictions
     set top5_points   = null,
         worst5_points = null,
         scored_at     = null,
         is_locked     = false
   where true;

  -- total_points is a generated column — only zero pred_points
  update public.players
     set pred_points = 0
   where true;

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

grant execute on function public.reset_manual_results(int) to authenticated;

commit;
