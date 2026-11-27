-- 103_security_pack2d.sql
-- Security pack 2d (hygiene), applied after the client that reads rooms
-- with an explicit column list is live.
--
-- 1. Cleanup runs from the server only (cron): ghost players every hour,
--    inactive rooms once a day. The rooms of the live game year are never
--    deleted (a room made in April for a May party has no activity for weeks
--    and must still be there on the night); only earlier years' rooms
--    inactive for 20 days go.
-- 2. The room password hash is no longer readable by players: SELECT on
--    rooms is granted per column, without password_hash. (Realtime row
--    changes follow the same column privileges.)
-- 3. anon (no session at all) cannot write rooms; every player has a
--    session (anonymous sign-in is 'authenticated').

-- ── 1. Cleanup ───────────────────────────────────────────────────────────
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
alter function public.cleanup_ghost_players() set search_path = public, pg_temp;
revoke execute on function public.cleanup_inactive_rooms(), public.cleanup_ghost_players() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('cleanup-ghost-players', 'cleanup-inactive-rooms');
select cron.schedule('cleanup-ghost-players', '17 * * * *', $$select public.cleanup_ghost_players()$$);
select cron.schedule('cleanup-inactive-rooms', '10 4 * * *', $$select public.cleanup_inactive_rooms()$$);

-- ── 2. No password hash for players ──────────────────────────────────────
revoke select on public.rooms from anon, authenticated;
grant select (id, code, host_id, host_name, year, phase, max_players, quiz_rounds, duel_limit, created_at,
              phase_updated_at, quiz_opened_at, predictions_opened_at, predictions_locked_at, results_source,
              results_confirmed, last_activity_at)
  on public.rooms to anon, authenticated;

-- ── 3. anon writes nothing in rooms ──────────────────────────────────────
revoke insert, update, delete on public.rooms from anon;

-- ── 4. A fixed search_path on the last functions without one ─────────────
alter function public.check_duel_rate_limit() set search_path = public, pg_temp;
alter function public.check_max_players() set search_path = public, pg_temp;
alter function public.check_quiz_rate_limit() set search_path = public, pg_temp;
alter function public.check_room_rate_limit() set search_path = public, pg_temp;
alter function public.check_unique_name_ci() set search_path = public, pg_temp;
alter function public.sync_player_is_active() set search_path = public, pg_temp;
alter function public.tg_email_log_updated_at() set search_path = public, pg_temp;

-- ── 5. Trigger functions are not for calling ─────────────────────────────
-- (EXECUTE is checked when a trigger is created, not when it fires, so the
-- triggers keep working.)
revoke execute on function public.touch_room_activity(), public._tg_results_status_advance(),
  public.link_super_admin(), public.duels_server_questions(), public.quiz_questions_delete_guard()
  from public, anon, authenticated;
