-- ============================================================
-- 032: Auto-advance to voting_live and final
-- ------------------------------------------------------------
-- Mirrors the participants-done → predictions_open trigger
-- from migration 030, but for the results parser:
--
--   • results status flips to 'running' (any prior state)
--       → every room currently in 'predictions_open' moves to
--         'voting_live'. Players get a 'voting_live' notification
--         so the client can flip into wait-for-results UI.
--
--   • results status flips to 'finalized' (via finalize_results
--     RPC or the manual-override commit)
--       → every room not yet in 'final' is moved to 'final'.
--         finalize_results already scores predictions per-room;
--         this trigger handles the room.phase column itself.
--
-- Combined with migrations 027 + 030, the host's only manual
-- transition is now lobby → pre_night. Everything else cascades
-- from parser state.
-- ============================================================

create or replace function public._open_voting_for_predictions_rooms()
returns void language plpgsql security definer set search_path = public as $fn$
begin
  with flipped as (
    update public.rooms
       set phase = 'voting_live', phase_updated_at = now()
     where phase = 'predictions_open'
    returning id
  )
  insert into public.notifications (room_id, player_id, type, payload, is_read)
  select p.room_id, p.id, 'voting_live',
         jsonb_build_object('reason','results_parser_started'),
         false
    from public.rooms r
    join public.players p on p.room_id = r.id and p.is_active = true
   where r.id in (select id from flipped);
end;
$fn$;

create or replace function public._move_all_to_final()
returns void language plpgsql security definer set search_path = public as $fn$
begin
  with flipped as (
    update public.rooms
       set phase = 'final', phase_updated_at = now()
     where phase <> 'final'
    returning id
  )
  insert into public.notifications (room_id, player_id, type, payload, is_read)
  select p.room_id, p.id, 'phase_changed',
         jsonb_build_object('to','final','reason','results_finalized'),
         false
    from public.rooms r
    join public.players p on p.room_id = r.id and p.is_active = true
   where r.id in (select id from flipped);
end;
$fn$;

create or replace function public._tg_results_status_advance()
returns trigger language plpgsql security definer as $$
begin
  if new.kind = 'results' then
    if new.status = 'running' and (old.status is distinct from 'running') then
      perform public._open_voting_for_predictions_rooms();
    end if;
    if new.status = 'finalized' and (old.status is distinct from 'finalized') then
      perform public._move_all_to_final();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_results_status_advance on public.parse_jobs;
create trigger trg_results_status_advance
  after update of status on public.parse_jobs
  for each row execute function public._tg_results_status_advance();
