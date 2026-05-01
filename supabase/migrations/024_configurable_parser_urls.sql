-- 024_configurable_parser_urls.sql
-- Make the production URLs configurable per (year, kind) via a new
-- parse_jobs.source_url column + a super-admin RPC. Lets admins point
-- the parser at vienna-2026 today, oslo-2027 next year, etc., without
-- redeploying the edge function.

begin;

-- ---------------------------------------------------------------------------
-- 1. Add source_url column. Nullable so existing rows aren't broken; the
--    edge function falls back to a hardcoded constant if it's null.
-- ---------------------------------------------------------------------------
alter table public.parse_jobs
  add column if not exists source_url text;

-- Seed current 2026 URL on existing rows
update public.parse_jobs
   set source_url = 'https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/'
 where year = 2026
   and source_url is null;

-- ---------------------------------------------------------------------------
-- 2. set_parse_job_url(year, kind, url) — admin RPC
--    Validates URL is http/https, kind is participants|results, year row
--    exists. Stores trimmed value.
-- ---------------------------------------------------------------------------
create or replace function public.set_parse_job_url(p_year int, p_kind text, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_clean text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('participants', 'results') then
    raise exception 'invalid kind: %', p_kind;
  end if;
  v_clean := trim(coalesce(p_url, ''));
  if v_clean = '' then
    raise exception 'url is required';
  end if;
  if v_clean !~ '^https?://[^[:space:]]+$' then
    raise exception 'url must be http(s) and have no whitespace: %', v_clean;
  end if;

  update public.parse_jobs
    set source_url = v_clean
    where year = p_year and kind = p_kind;
  if not found then
    raise exception 'no parse_jobs row for year=% kind=%', p_year, p_kind;
  end if;
end;
$fn$;

grant execute on function public.set_parse_job_url(int, text, text) to authenticated;

commit;
