-- ============================================================
-- 110: the database size on the admin overview (backlog, 28 Nov 2026)
-- ------------------------------------------------------------
-- The Free plan allows 500 MB of database (Pro: 8 GB). The admin overview
-- shows the current size once when it opens, so the owner sees it coming
-- before Supabase warns. Super admins only; read once, never polled.
-- ============================================================
begin;

create or replace function public.admin_db_size()
returns bigint
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return pg_database_size(current_database());
end $$;

revoke execute on function public.admin_db_size() from public, anon;
grant execute on function public.admin_db_size() to authenticated;

commit;
