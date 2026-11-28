-- Rollback of 110.
begin;
drop function if exists public.admin_db_size();
commit;
