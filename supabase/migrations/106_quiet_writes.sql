-- ============================================================
-- 106: fewer writes and pushes per answer and per phase change (F3)
-- ------------------------------------------------------------
-- 28 Nov 2026. On the night there are about 5,000 players. Before this:
--   * every quiz answer and every prediction save also rewrote the room
--     row (rooms.last_activity_at), so one room row took about one write
--     per answer, from every phone in the room;
--   * a phase change wrote one notification per player AND pushed each one
--     to that player's channel: about 5,000 Realtime messages in a second,
--     on top of the one room message that already carries the new phase;
--   * every score update re-ran the case-insensitive name check, a scan of
--     the room's players, though the name had not changed.
--
-- After this:
--   * last_activity_at is written at most once every 5 minutes per room.
--     It is read only by the 20-day cleanup and the home page's room list.
--   * Phase notifications are still stored (the bell shows them, and they
--     stay read or unread), but they are not pushed one by one: the room
--     push already reaches every phone, and the app adds the bell entry
--     from it (useNotifications).
--   * The name check runs only when the name or the player's status changes.
--   * A bulk job (Finalize, 108) can mute the per-row push of player rows
--     for its own transaction (set local app.rt_bulk = 'on') and send one
--     'refresh' message per room instead.
-- ============================================================
begin;

-- ── room activity: at most one write per room every 5 minutes ──
create or replace function public.touch_room_activity()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update rooms
     set last_activity_at = now()
   where id = new.room_id
     and (last_activity_at is null or last_activity_at < now() - interval '5 minutes');
  return new;
end $$;
revoke execute on function public.touch_room_activity() from public, anon, authenticated;

-- ── phase notifications: stored, not pushed one by one ──────────
create or replace function public.rt_notification()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- set_game_phase and _move_all_to_final write these for every player of
  -- every room; the room's own push already carries the phase.
  if new.type in ('phase_changed', 'predictions_open', 'voting_live') then
    return null;
  end if;
  perform public.rt_push('player:' || new.player_id, 'notifications',
    jsonb_build_object('table', 'notifications', 'op', 'INSERT', 'new', to_jsonb(new), 'old', null));
  return null;
end $$;
revoke execute on function public.rt_notification() from public, anon, authenticated;

-- ── room pushes: a bulk job may mute player rows ───────────────
create or replace function public.rt_room_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_room uuid;
  v_noise text;
begin
  -- Finalize scores every player of the year in one transaction and sends
  -- one 'refresh' per room itself (108).
  if tg_table_name = 'players' and current_setting('app.rt_bulk', true) = 'on' then
    return null;
  end if;

  -- An update that changes only a field nobody watches is not pushed.
  if tg_op = 'UPDATE' then
    v_noise := case tg_table_name when 'rooms' then 'last_activity_at'
                                  when 'players' then 'last_seen_at' end;
    if v_noise is not null and (v_new - v_noise) = (v_old - v_noise) then
      return null;
    end if;
    if v_new = v_old then return null; end if;
  end if;

  v_room := case tg_table_name
    when 'rooms' then coalesce(v_new, v_old)->>'id'
    when 'tie_vote_choices' then
      (select room_id::text from tie_votes where id = (coalesce(v_new, v_old)->>'vote_id')::uuid)
    when 'sudden_death_answers' then
      (select room_id::text from sudden_death_rounds where id = (coalesce(v_new, v_old)->>'round_id')::uuid)
    else coalesce(v_new, v_old)->>'room_id'
  end::uuid;
  if v_room is null then return null; end if;

  perform public.rt_push(
    'room:' || v_room,
    tg_table_name,
    jsonb_build_object(
      'table', tg_table_name,
      'op', tg_op,
      'new', public.rt_row(tg_table_name, v_new),
      'old', case when v_old is null then null
                  else jsonb_strip_nulls(jsonb_build_object(
                    'id', v_old->'id', 'vote_id', v_old->'vote_id',
                    'round_id', v_old->'round_id', 'player_id', v_old->'player_id')) end
    ));
  return null;
end $$;
revoke execute on function public.rt_room_change() from public, anon, authenticated;

-- ── the name check only when the name or the status changes ────
-- (trg_sync_player_is_active runs first and derives is_active from status.)
drop trigger if exists trg_unique_name_ci on public.players;
create trigger trg_unique_name_ci
  before insert or update of name, status, is_active on public.players
  for each row execute function public.check_unique_name_ci();

commit;
