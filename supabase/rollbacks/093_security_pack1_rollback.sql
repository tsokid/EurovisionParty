-- Rollback for 093_security_pack1.sql. NOT a migration: run by hand only if
-- 093 broke something. It restores the pre-093 grants, policies and cron job.

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
    if to_regprocedure(fn) is null then continue; end if;
    execute format('grant execute on function %s to public, anon, authenticated', fn);
    execute format('alter function %s reset search_path', fn);
  end loop;
end $$;

create policy results_insert on public.results for insert to authenticated
  with check (public.is_room_member(room_id));
create policy results_update on public.results for update to authenticated
  using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));

grant truncate, trigger, references on all tables in schema public to anon, authenticated;

select cron.schedule('open-predictions-show-night', '0 19 16 5 *', $cmd$
    UPDATE rooms
    SET phase = 'predictions_open',
        phase_updated_at = now()
    WHERE phase = 'pre_night'
      AND results_confirmed = false;
  $cmd$);

commit;
