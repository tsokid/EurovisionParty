-- 041_reset_contest_v2.sql
-- Extend reset_contest with optional deep-clean flags:
--   p_delete_predictions  — wipes all predictions rows
--   p_reset_points        — zeros all player scoring columns
--   p_delete_rooms        — deletes all rooms (cascades to players, predictions,
--                           results, winners, quiz, duels, tie votes, etc.)
--
-- Core reset (parsed data + parse jobs) always runs regardless of flags.

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

  -- ── Core: always runs ────────────────────────────────────────────────────

  -- 1. Parsed data (participants cascade-deletes eurovision_2026_results)
  delete from public.eurovision_2026_participants where true;

  -- 2. Per-room final rankings (propagated by finalize_results)
  delete from public.results where true;

  -- 3. Un-score predictions and unlock them (unless rooms are being deleted)
  if not p_delete_rooms then
    update public.predictions
       set top5_points   = null,
           worst5_points = null,
           scored_at     = null,
           is_locked     = false
     where true;

    -- Reset prediction scores on players; recalculate total without pred
    update public.players
       set pred_points  = 0,
           total_points = quiz_points + duel_points
     where true;
  end if;

  -- 4. Reset both parse jobs to idle
  update public.parse_jobs
     set status       = 'idle',
         started_at   = null,
         stopped_at   = null,
         last_poll_at = null,
         poll_count   = 0
   where year = p_year;

  -- ── Optional A: delete all predictions ───────────────────────────────────
  if p_delete_predictions and not p_delete_rooms then
    delete from public.predictions where true;
  end if;

  -- ── Optional B: reset ALL player points to zero ───────────────────────────
  if p_reset_points and not p_delete_rooms then
    update public.players
       set quiz_points  = 0,
           duel_points  = 0,
           pred_points  = 0,
           total_points = 0
     where true;
  end if;

  -- ── Optional C: delete all rooms (cascades everything) ───────────────────
  if p_delete_rooms then
    delete from public.rooms where true;
  end if;

end;
$fn$;

grant execute on function public.reset_contest(int, bool, bool, bool) to authenticated;

commit;
