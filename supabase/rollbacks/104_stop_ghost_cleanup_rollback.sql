-- Rollback for 104: back to 103 (hourly ghost cleanup, also from the daily room cleanup).
create or replace function public.cleanup_inactive_rooms() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  perform cleanup_ghost_players();
  delete from rooms
   where last_activity_at < now() - interval '20 days'
     and year is distinct from live_contest_year();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.cleanup_inactive_rooms() from public, anon, authenticated;
select cron.schedule('cleanup-ghost-players', '17 * * * *', $$select public.cleanup_ghost_players()$$);
