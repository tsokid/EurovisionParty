-- 034_arm_parse_job.sql
-- "Start on Schedule" was calling hard_stop_parse_job() which sets
-- stopped_at = now(). Migration 033 added a cron guard that blocks
-- re-triggering when stopped_at >= scheduled_start_at. The two were
-- fighting: arming a job for the next scheduled run immediately poisoned
-- it against the cron.
--
-- Fix: a dedicated arm_parse_job() that resets to idle with
-- stopped_at = NULL so the 033 guard always passes on the next tick.
-- Hard Stop keeps stopped_at = now() (its whole purpose is to prevent
-- the cron from re-firing after an explicit stop).

begin;

create or replace function public.arm_parse_job(p_year int, p_kind text)
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
    raise exception 'cannot arm a finalized job';
  end if;

  update public.parse_jobs
     set status       = 'idle',
         started_at   = null,
         stopped_at   = null,     -- must be null so the 033 cron guard passes
         last_poll_at = null,
         poll_count   = 0
   where year = p_year and kind = p_kind;
end;
$fn$;

grant execute on function public.arm_parse_job(int, text) to authenticated;

commit;
