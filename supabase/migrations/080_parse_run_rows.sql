-- 080: Parse confirmation report (owner, 19 Nov 2026). Every parse run keeps
-- the rows it found and the page it read, written even when the run was
-- blocked, so the admin can show what was parsed, the diff against the
-- previous run and warnings. Read by super admins through the existing
-- runs_admin_all policy.
alter table public.parse_runs
  add column if not exists rows jsonb,
  add column if not exists source_url text;
