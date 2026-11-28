-- ============================================================
-- 105: game updates as server-pushed Broadcast, not Postgres Changes
-- ------------------------------------------------------------
-- 28 Nov 2026. Supabase warned that the project was running out of its
-- Disk IO budget. The main reader was Realtime "Postgres Changes": while
-- any phone had the game open, Realtime read the write-ahead log about ten
-- times a second (realtime.list_changes, about 1.1M calls), whether or not
-- anything had changed.
--
-- Now each real change pushes one message, from a trigger, to a private
-- Realtime channel:
--   room:{room_id}     rooms, players, duels, tie_votes, tie_vote_choices,
--                      sudden_death_rounds, sudden_death_answers
--   player:{player_id} notifications (only that player)
--   cms:doc:{doc_id}   cms_documents saves (event 'saved', as the editors
--                      already send each other)
-- Payload: { table, op, new, old } (old carries only the id fields).
--
-- Not pushed: rooms.password_hash; an update that only touches
-- rooms.last_activity_at or players.last_seen_at (no one sees those).
--
-- Who may listen (realtime.messages RLS, checked once when joining):
--   room:{id}   a player of that room, or a super admin
--   player:{id} the signed-in user who owns that player row
-- Clients cannot send on these topics.
--
-- The tables leave the supabase_realtime publication, so nothing reads
-- the write-ahead log for them any more.
--
-- realtime.send is skipped where the realtime schema does not exist (local
-- test databases) and a push that fails never fails the game write.
-- Idempotent. Rollback: supabase/rollbacks/105_broadcast_game_events_rollback.sql
-- ============================================================

begin;

-- ── one push ────────────────────────────────────────────────
create or replace function public.rt_push(p_topic text, p_event text, p_payload jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    return;
  end if;
  execute 'select realtime.send($1, $2, $3, true)' using p_payload, p_event, p_topic;
exception when others then
  raise warning 'rt_push % %: %', p_topic, p_event, sqlerrm;
end $$;
revoke execute on function public.rt_push(text, text, jsonb) from public, anon, authenticated;

-- ── the row as pushed ───────────────────────────────────────
create or replace function public.rt_row(p_table text, p_row jsonb)
returns jsonb language sql immutable as $$
  select case p_table
    when 'rooms' then p_row - 'password_hash'
    else p_row
  end
$$;

-- ── room-scoped tables ──────────────────────────────────────
create or replace function public.rt_room_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_room uuid;
  v_noise text;
begin
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

do $$
declare t text;
begin
  foreach t in array array['rooms','players','duels','tie_votes','tie_vote_choices',
                           'sudden_death_rounds','sudden_death_answers'] loop
    execute format('drop trigger if exists rt_push on public.%I', t);
    execute format(
      'create trigger rt_push after %s on public.%I for each row execute function public.rt_room_change()',
      case when t = 'rooms' then 'update' else 'insert or update or delete' end, t);
  end loop;
end $$;

-- ── a player's own notifications ────────────────────────────
create or replace function public.rt_notification()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.rt_push('player:' || new.player_id, 'notifications',
    jsonb_build_object('table', 'notifications', 'op', 'INSERT', 'new', to_jsonb(new), 'old', null));
  return null;
end $$;
revoke execute on function public.rt_notification() from public, anon, authenticated;

drop trigger if exists rt_push on public.notifications;
create trigger rt_push after insert on public.notifications
  for each row execute function public.rt_notification();

-- ── CMS saves (the editors' channel already exists, 087) ─────
create or replace function public.rt_cms_saved()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.rt_push('cms:doc:' || new.doc_id, 'saved',
    jsonb_build_object('updatedAt', new.updated_at, 'by', null));
  return null;
end $$;
revoke execute on function public.rt_cms_saved() from public, anon, authenticated;

drop trigger if exists rt_push on public.cms_documents;
create trigger rt_push after insert or update on public.cms_documents
  for each row execute function public.rt_cms_saved();

-- ── who may listen ──────────────────────────────────────────
do $$
begin
  if to_regclass('realtime.messages') is null then
    return;
  end if;

  execute 'drop policy if exists game_room_channel_read on realtime.messages';
  execute $p$
    create policy game_room_channel_read on realtime.messages
      for select to authenticated
      using (
        realtime.topic() like 'room:%'
        and (
          exists (select 1 from public.players p
                   where p.room_id::text = substr(realtime.topic(), 6)
                     and p.user_id = (select auth.uid()))
          or public.is_super_admin()
        )
      )
  $p$;

  execute 'drop policy if exists game_player_channel_read on realtime.messages';
  execute $p$
    create policy game_player_channel_read on realtime.messages
      for select to authenticated
      using (
        realtime.topic() like 'player:%'
        and exists (select 1 from public.players p
                     where p.id::text = substr(realtime.topic(), 8)
                       and p.user_id = (select auth.uid()))
      )
  $p$;
end $$;

-- ── stop reading the write-ahead log for these tables ───────
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['rooms','players','notifications','duels','tie_votes','tie_vote_choices',
                           'sudden_death_rounds','sudden_death_answers','cms_documents'] loop
    if exists (select 1 from pg_publication_tables
                where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;

commit;
