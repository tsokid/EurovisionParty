-- ============================================================
-- 030: Unified parser state transitions
-- ------------------------------------------------------------
-- The admin UI is collapsing to 5 buttons:
--   Start on Schedule | Start Now | Pause | Resume | Hard Stop
--
-- Existing RPCs cover most of it (start_parse_job,
-- hard_stop_parse_job, stop_parse_job for results) but Pause for
-- participants and a kind-aware Resume don't exist yet. This adds:
--
--   pause_parse_job(year, kind)      running → stopped
--   resume_parse_job(year, kind)     stopped → running (results)
--                                    stopped → idle    (participants)
--
-- The legacy 1-arg stop_parse_job(year) and resume_parse_job(year)
-- are kept (results-only callers), but the new 2-arg overloads
-- become the canonical path.
-- ============================================================

create or replace function public.pause_parse_job(p_year int, p_kind text)
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
  if v_status <> 'running' then
    raise exception 'pause only allowed from running, was %', v_status;
  end if;
  update public.parse_jobs
     set status     = 'stopped',
         stopped_at = now()
   where year = p_year and kind = p_kind;
end;
$fn$;

revoke all on function public.pause_parse_job(int, text) from public;
grant execute on function public.pause_parse_job(int, text) to authenticated;


create or replace function public.resume_parse_job(p_year int, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_status text; v_target text;
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
  if v_status <> 'stopped' then
    raise exception 'resume only allowed from stopped, was %', v_status;
  end if;
  -- Participants resumes back into the queue (cron re-fires on
  -- schedule). Results resumes the polling immediately.
  v_target := case when p_kind = 'participants' then 'idle' else 'running' end;
  update public.parse_jobs
     set status     = v_target,
         started_at = case when v_target = 'running' then now() else started_at end,
         stopped_at = null
   where year = p_year and kind = p_kind;
end;
$fn$;

revoke all on function public.resume_parse_job(int, text) from public;
grant execute on function public.resume_parse_job(int, text) to authenticated;
