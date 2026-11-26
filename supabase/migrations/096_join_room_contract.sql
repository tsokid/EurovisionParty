-- 096: contract step of 095. Guests can no longer insert their own players
-- row: join_room (security definer) is the only way in. The host still
-- inserts their own row right after create_room_with_password, so the
-- insert policy narrows to "the room's host".
--
-- Clients deployed before 095 (a029516) inserted guests directly; they are
-- refused from now on with 42501 and must reload. Deployed the same day as
-- 095 on the owner's request (no pendings).

begin;

drop policy if exists players_insert on public.players;
create policy players_insert on public.players
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid())
  );

revoke insert on public.players from anon;

commit;
