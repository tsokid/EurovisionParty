-- 072: drop the old per-year 2026 tables. Data moved to contest_entries in
-- 070; every reader and writer was switched in 071 and the app/parser code.
drop table if exists public.eurovision_2026_results cascade;
drop table if exists public.eurovision_2026_participants cascade;
