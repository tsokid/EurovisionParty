-- 095: joining a room is decided on the server (security pack 2, item 2).
-- EXPAND step: adds join_room and the guards; the old direct insert still
-- works for clients that haven't reloaded yet. 096 (contract) later removes
-- the guests' direct insert.
--
-- Before: the room password was checked in the browser only (anyone with a
-- room id could insert a player row), any member could insert a second row
-- marked is_host, and verify_room_password sent the whole room row,
-- password hash included, to the browser.
--
-- After:
--   * join_room(code, password, name, emoji, avatar_id): checks the password
--     on the server, caps capacity, one row per user per room (a returning
--     player gets their row back), returns the room without password_hash.
--   * Failed attempts are recorded and limited: 5 per user per 10 minutes,
--     30 per room code per 10 minutes. Errors come back as {error: …}
--     (not raised), so the failure record is kept.
--   * players.is_host is always set by the server from rooms.host_id.
--   * Unique (room_id, user_id).

begin;

create table if not exists public.room_join_failures (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  code       text not null,
  failed_at  timestamptz not null default now()
);
create index if not exists room_join_failures_user_idx on public.room_join_failures (user_id, failed_at);
create index if not exists room_join_failures_code_idx on public.room_join_failures (code, failed_at);
alter table public.room_join_failures enable row level security;
revoke all on public.room_join_failures from anon, authenticated;

create unique index if not exists players_room_user_key on public.players (room_id, user_id);

-- is_host comes from the room, whatever the client sends.
create or replace function public.players_guard_client_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- player_secrets_select trusts joined_at to tell a member from a late
    -- joiner; a client must not be able to backdate it.
    new.joined_at    := now();
    new.quiz_points  := 0;
    new.pred_points  := 0;
    new.duel_points  := 0;
    new.points_spent := 0;
    new.is_host      := exists (select 1 from rooms r where r.id = new.room_id and r.host_id = new.user_id);
    return new;
  end if;

  -- UPDATE: column privileges (051) already exclude these; refuse loudly
  -- here too so a future broad GRANT cannot reopen them.
  if new.joined_at is distinct from old.joined_at
     or new.user_id is distinct from old.user_id
     or new.room_id is distinct from old.room_id
     or new.is_host is distinct from old.is_host then
    raise exception 'joined_at, user_id, room_id and is_host cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.join_room(
  p_code text, p_password text, p_name text, p_emoji text, p_avatar_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text := upper(trim(coalesce(p_code, '')));
  v_room   rooms;
  v_player players;
  v_count  int;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if (select count(*) from room_join_failures
       where user_id = v_uid and failed_at > now() - interval '10 minutes') >= 5
     or (select count(*) from room_join_failures
          where code = v_code and failed_at > now() - interval '10 minutes') >= 30 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  select * into v_room from rooms where code = v_code;
  if not found then
    insert into room_join_failures (user_id, code) values (v_uid, v_code);
    return jsonb_build_object('error', 'room_not_found');
  end if;

  if coalesce(v_room.password_hash, '') <> ''
     and v_room.password_hash <> crypt(coalesce(p_password, ''), v_room.password_hash) then
    insert into room_join_failures (user_id, code) values (v_uid, v_code);
    return jsonb_build_object('error', 'wrong_password');
  end if;

  -- A returning player gets their own row back.
  select * into v_player from players where room_id = v_room.id and user_id = v_uid;
  if found then
    if not v_player.is_active then
      update players set is_active = true, status = 'active', left_at = null
       where id = v_player.id
       returning * into v_player;
    end if;
  else
    select count(*) into v_count from players where room_id = v_room.id and is_active;
    if v_count >= coalesce(v_room.max_players, 20) then
      return jsonb_build_object('error', 'room_full');
    end if;
    begin
      insert into players (room_id, user_id, name, avatar_emoji, avatar_id, is_host)
      values (v_room.id, v_uid, trim(p_name), p_emoji, p_avatar_id, v_room.host_id = v_uid)
      returning * into v_player;
    exception
      when unique_violation then
        return jsonb_build_object('error', 'name_taken');
      when others then
        -- trg_unique_name_ci / trg_max_players raise their own messages.
        if sqlerrm ilike '%taken%' then return jsonb_build_object('error', 'name_taken'); end if;
        if sqlerrm ilike '%full%' or sqlerrm ilike '%max%' then return jsonb_build_object('error', 'room_full'); end if;
        raise;
    end;
  end if;

  return jsonb_build_object(
    'room',   to_jsonb(v_room) - 'password_hash',
    'player', to_jsonb(v_player));
end;
$$;

revoke execute on function public.join_room(text, text, text, text, text) from public, anon;
grant execute on function public.join_room(text, text, text, text, text) to authenticated, service_role;

commit;
