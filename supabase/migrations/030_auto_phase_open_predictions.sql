-- ============================================================
-- 030: Auto-open predictions when participants parser succeeds
-- ------------------------------------------------------------
-- Decision: predictions_open is system-driven, not host-driven.
-- The host's only manual phase transition is lobby → pre_night.
-- Everything after that follows the global parser state:
--   • participants parser status='done' (lineup published)
--       → every room currently in 'pre_night' auto-flips to
--         'predictions_open', and every active player gets a
--         'predictions_open' notification so they see the banner.
--
-- An admin escape hatch (admin_advance_all_rooms) is also added
-- so a super-admin can bulk-flip rooms to a target phase if the
-- automation misfires or needs to be done manually.
-- ============================================================

-- 1. Notification type column already accepts arbitrary text per
--    table definition; no schema change required. We use the type
--    'predictions_open' so the UI can dispatch a banner / panel.

create or replace function public._open_predictions_for_pre_night_rooms()
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_count int := 0;
begin
  -- Flip every pre_night room to predictions_open.
  with flipped as (
    update public.rooms
       set phase            = 'predictions_open',
           phase_updated_at = now()
     where phase = 'pre_night'
    returning id
  )
  select count(*) into v_count from flipped;

  -- Notify every active player in flipped rooms (one row per player).
  insert into public.notifications (room_id, player_id, type, payload, is_read)
  select p.room_id, p.id, 'predictions_open',
         jsonb_build_object('reason','participants_published'),
         false
    from public.rooms r
    join public.players p on p.room_id = r.id and p.is_active = true
   where r.phase = 'predictions_open'
     and r.phase_updated_at >= now() - interval '5 seconds';

  raise notice 'auto-opened predictions in % room(s)', v_count;
end;
$fn$;

-- 2. Trigger on parse_jobs: when participants flips idle/running/error → done,
--    auto-open predictions for every pre_night room.
create or replace function public._tg_participants_done_open_predictions()
returns trigger language plpgsql security definer as $$
begin
  if new.kind = 'participants'
     and new.status = 'done'
     and (old.status is distinct from 'done') then
    perform public._open_predictions_for_pre_night_rooms();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_participants_done_open_predictions on public.parse_jobs;
create trigger trg_participants_done_open_predictions
  after update of status on public.parse_jobs
  for each row execute function public._tg_participants_done_open_predictions();

-- 3. Admin escape hatch: bulk-advance every room currently in p_from
--    to p_to, plus notify everyone. Idempotent.
create or replace function public.admin_advance_all_rooms(p_from text, p_to text)
returns int
language plpgsql security definer set search_path = public
as $fn$
declare
  v_count int := 0;
  v_phases text[] := array['lobby','pre_night','predictions_open','voting_live','final'];
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if not (p_from = any(v_phases)) then
    raise exception 'invalid from phase: %', p_from;
  end if;
  if not (p_to = any(v_phases)) then
    raise exception 'invalid to phase: %', p_to;
  end if;
  with flipped as (
    update public.rooms
       set phase            = p_to,
           phase_updated_at = now()
     where phase = p_from
    returning id
  )
  select count(*) into v_count from flipped;

  -- Best-effort notification — only meaningful for forward transitions
  -- the players care about. We always emit one of type 'phase_changed'
  -- with the new phase in the payload so the client can decide how to
  -- present it (banner, toast, etc.).
  insert into public.notifications (room_id, player_id, type, payload, is_read)
  select p.room_id, p.id, 'phase_changed',
         jsonb_build_object('to', p_to, 'reason', 'admin_override'),
         false
    from public.rooms r
    join public.players p on p.room_id = r.id and p.is_active = true
   where r.phase = p_to
     and r.phase_updated_at >= now() - interval '5 seconds';

  return v_count;
end;
$fn$;

revoke all on function public.admin_advance_all_rooms(text, text) from public;
grant execute on function public.admin_advance_all_rooms(text, text) to authenticated;
