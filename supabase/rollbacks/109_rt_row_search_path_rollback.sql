-- Rollback of 109.
begin;
alter function public.rt_row(text, jsonb) reset search_path;
commit;
