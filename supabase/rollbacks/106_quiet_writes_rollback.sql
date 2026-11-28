-- Rollback of 106: back to one room write per answer, one push per phase
-- notification and the name check on every player update.
begin;

create or replace function public.touch_room_activity()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update rooms set last_activity_at = now() where id = new.room_id;
  return new;
end $$;
revoke execute on function public.touch_room_activity() from public, anon, authenticated;

create or replace function public.rt_notification()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.rt_push('player:' || new.player_id, 'notifications',
    jsonb_build_object('table', 'notifications', 'op', 'INSERT', 'new', to_jsonb(new), 'old', null));
  return null;
end $$;
revoke execute on function public.rt_notification() from public, anon, authenticated;

-- rt_room_change without the bulk mute: re-run its definition from
-- supabase/migrations/105_broadcast_game_events.sql (the bulk guard is
-- harmless when nothing sets app.rt_bulk, so this step is optional).

drop trigger if exists trg_unique_name_ci on public.players;
create trigger trg_unique_name_ci
  before insert or update on public.players
  for each row execute function public.check_unique_name_ci();

commit;
