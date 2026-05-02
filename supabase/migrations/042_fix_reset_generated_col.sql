-- 042_fix_reset_generated_col.sql
-- total_points is a generated column — remove it from UPDATE statements
-- in reset_contest. It recomputes automatically when source columns change.

begin;

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
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  -- Core: always runs
  delete from public.eurovision_2026_participants where true;
  delete from public.results where true;

  if not p_delete_rooms then
    update public.predictions
       set top5_points   = null,
           worst5_points = null,
           scored_at     = null,
           is_locked     = false
     where true;

    -- total_points is generated; only zero pred_points
    update public.players
       set pred_points = 0
     where true;
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
    delete from public.predictions where true;
  end if;

  -- Optional B — zero source columns; total_points regenerates automatically
  if p_reset_points and not p_delete_rooms then
    update public.players
       set quiz_points = 0,
           duel_points = 0,
           pred_points = 0
     where true;
  end if;

  -- Optional C
  if p_delete_rooms then
    delete from public.rooms where true;
  end if;

end;
$fn$;

grant execute on function public.reset_contest(int, bool, bool, bool) to authenticated;

commit;
