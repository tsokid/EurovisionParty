-- 104: players are never marked as left by the server (28 Nov 2026).
--
-- 103 ran cleanup_ghost_players() every hour (and from the daily room
-- cleanup): a player with no heartbeat for 2 hours became 'exited'. The
-- heartbeat only runs while the room tab is open and in front, so a player
-- who minimised the app or closed the window was dropped from the
-- leaderboard, and a host lost the host controls, though they had not left.
-- Players play the semi-finals and the final days apart. A player now
-- leaves only by their own «Έξοδος». (The 15 rows the first run touched were
-- restored by hand on 28 Nov.)
select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-ghost-players';

create or replace function public.cleanup_inactive_rooms() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  delete from rooms
   where last_activity_at < now() - interval '20 days'
     and year is distinct from live_contest_year();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.cleanup_inactive_rooms() from public, anon, authenticated;
