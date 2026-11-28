-- ============================================================
-- 109: rt_row gets a fixed search_path (Security Advisor, 28 Nov 2026)
-- ------------------------------------------------------------
-- 105's row cleaner was the one function the linter flagged as
-- "Function Search Path Mutable". It only reshapes JSON, but every
-- function gets a fixed search_path so no caller can redirect a name.
-- ============================================================
begin;
alter function public.rt_row(text, jsonb) set search_path = public, pg_temp;
commit;
