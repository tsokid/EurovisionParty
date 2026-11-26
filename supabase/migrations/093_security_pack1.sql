-- 093: security pack 1 (26 Nov 2026). Lock-down only: no client code calls
-- anything below.
--
-- 1. Twelve legacy SECURITY DEFINER functions (001/008/010/012 era) kept
--    EXECUTE for PUBLIC, anon and authenticated, with no caller check. They
--    are now callable only by their owner (postgres: finalize_results and
--    cleanup_inactive_rooms call some of them internally) and service_role
--    (edge functions: eurovision-parse calls increment_poll_count).
-- 2. Fixed search_path on the same functions.
-- 3. Room results are written only by finalize (definer): players lose the
--    INSERT/UPDATE policies on results. SELECT stays.
-- 4. Players don't need TRUNCATE, TRIGGER or REFERENCES on any table.
-- 5. The 2026 cron job 'open-predictions-show-night' (19:00 UTC on 16 May,
--    every year) moved every pre_night room to predictions_open. Phases are
--    driven by the owner since 079, so it goes.
--
-- Rollback: supabase/rollbacks/093_security_pack1_rollback.sql

begin;

do $$
declare
  fn text;
  fns text[] := array[
    'public.increment_quiz_points(uuid, integer)',
    'public.increment_pred_points(uuid, integer)',
    'public.resolve_duel_points(uuid, uuid, integer)',
    'public.spend_points(uuid, integer)',
    'public.spend_intel_points(uuid, integer)',
    'public.save_results(uuid, uuid, jsonb)',
    'public.score_all_predictions(uuid)',
    'public.send_notification(uuid, uuid, text, jsonb)',
    'public.cleanup_ghost_players()',
    'public.cleanup_inactive_rooms()',
    'public.increment_poll_count(integer, text)',
    'public.resolve_sudden_death(uuid)'
  ];
begin
  foreach fn in array fns loop
    if to_regprocedure(fn) is null then
      raise notice '093: % not found, skipped', fn;
      continue;
    end if;
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
    execute format('alter function %s set search_path = public, pg_temp', fn);
  end loop;
end $$;

drop policy if exists results_insert on public.results;
drop policy if exists results_update on public.results;

revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

do $$
begin
  perform cron.unschedule('open-predictions-show-night');
exception when others then
  null; -- not scheduled (fresh databases, tests)
end $$;

commit;
