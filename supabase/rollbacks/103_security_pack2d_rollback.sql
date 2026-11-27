-- Rollback for 103.
select cron.unschedule(jobid) from cron.job where jobname in ('cleanup-ghost-players', 'cleanup-inactive-rooms');
create or replace function public.cleanup_inactive_rooms() returns integer
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  perform cleanup_ghost_players();
  delete from rooms where last_activity_at < now() - interval '20 days';
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.cleanup_inactive_rooms() from public, anon, authenticated;
grant select on public.rooms to anon, authenticated;
grant insert, update, delete on public.rooms to anon;
grant execute on function public.touch_room_activity(), public._tg_results_status_advance(),
  public.link_super_admin(), public.duels_server_questions(), public.quiz_questions_delete_guard()
  to public;
