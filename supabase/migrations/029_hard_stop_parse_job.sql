-- ============================================================
-- 029: Hard Stop for parser jobs
-- ------------------------------------------------------------
-- The existing reset_parse_job only allows transitions FROM
-- 'error' or 'done' (participants) / 'error' or 'stopped'
-- (results). When a job gets stuck in 'running' — e.g. because
-- the broken cron tick fires net.http_post with a bad vault JWT
-- and the function never executes — there's no admin path back
-- to a clean state from the UI.
--
-- This adds a heavier-handed escape hatch: force ANY non-final
-- job back to 'idle', regardless of current status. Always safe
-- because the underlying tables (eurovision_2026_participants,
-- eurovision_2026_results) are not touched — just the job row.
-- ============================================================

create or replace function public.hard_stop_parse_job(p_year int, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_status text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('participants','results') then
    raise exception 'invalid kind: %', p_kind;
  end if;
  select status into v_status
    from public.parse_jobs where year = p_year and kind = p_kind;
  if v_status is null then
    raise exception 'no job: % %', p_year, p_kind;
  end if;
  if v_status = 'finalized' then
    raise exception 'cannot hard-stop a finalized job';
  end if;
  update public.parse_jobs
     set status            = 'idle',
         started_at        = null,
         stopped_at        = now(),
         last_poll_at      = null,
         poll_count        = 0,
         triggered_by_user = false
   where year = p_year and kind = p_kind;
end;
$fn$;

revoke all on function public.hard_stop_parse_job(int, text) from public;
grant execute on function public.hard_stop_parse_job(int, text) to authenticated;
