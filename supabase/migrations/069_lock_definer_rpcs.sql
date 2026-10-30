-- ============================================================
-- 069: Close two SECURITY DEFINER holes
-- ------------------------------------------------------------
-- * compute_winners was callable by any signed-in user for any room,
--   wiping and rewriting that room's winners. Now: super admin, or the
--   active host of that room (WinnersScreen calls it as host).
-- * queue_email let any signed-in user send arbitrary mail from
--   noreply@eurovision.games. Nothing in the app calls it, so execute is
--   revoked from client roles; service_role keeps it.
--
-- super_admin_emails / super_admins are not touched.
-- ============================================================

begin;

create or replace function public.compute_winners(p_room_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  inserted int := 0;
  step_count int := 0;
begin
  if not (
    public.is_super_admin()
    or exists (select 1 from public.rooms where id = p_room_id and host_id = auth.uid())
    or exists (select 1 from public.players
                where room_id = p_room_id and user_id = auth.uid() and is_host and is_active)
  ) then
    raise exception 'forbidden';
  end if;

  delete from public.winners where room_id = p_room_id and is_sudden_death_winner = false;

  insert into public.winners(room_id, category, player_id, metric_value)
  select p_room_id, 'champion', p.id, p.total_points
  from public.players p
  where p.room_id = p_room_id and p.status <> 'exited'
    and p.total_points = (select max(total_points) from public.players where room_id = p_room_id and status <> 'exited');
  get diagnostics step_count = row_count; inserted := inserted + step_count;

  insert into public.winners(room_id, category, player_id, metric_value)
  with stolen as (
    select winner_id as pid, coalesce(sum(points_transferred),0) as v
    from public.duels
    where room_id = p_room_id and status='completed' and winner_decision='steal' and winner_id is not null
    group by winner_id
  ), top as (select max(v) as m from stolen where v > 0)
  select p_room_id, 'thief', s.pid, s.v
  from stolen s, top
  where s.v = top.m and top.m > 0;
  get diagnostics step_count = row_count; inserted := inserted + step_count;

  insert into public.winners(room_id, category, player_id, metric_value)
  with wins as (
    select winner_id as pid, count(*)::numeric as v
    from public.duels where room_id = p_room_id and status='completed' and winner_id is not null
    group by winner_id
  ), top as (select max(v) as m from wins where v > 0)
  select p_room_id, 'duelist', w.pid, w.v
  from wins w, top
  where w.v = top.m and top.m > 0;
  get diagnostics step_count = row_count; inserted := inserted + step_count;

  insert into public.winners(room_id, category, player_id, metric_value)
  with pp as (
    select player_id as pid, coalesce(sum(total_points),0) as v
    from public.predictions where room_id = p_room_id
    group by player_id
  ), top as (select max(v) as m from pp where v > 0)
  select p_room_id, 'oracle', pp.pid, pp.v
  from pp, top
  where pp.v = top.m and top.m > 0;
  get diagnostics step_count = row_count; inserted := inserted + step_count;

  insert into public.winners(room_id, category, player_id, metric_value)
  with qq as (
    select player_id as pid, count(*)::numeric as v
    from public.quiz_answers where room_id = p_room_id and is_correct = true
    group by player_id
  ), top as (select max(v) as m from qq where v > 0)
  select p_room_id, 'guru', qq.pid, qq.v
  from qq, top
  where qq.v = top.m and top.m > 0;
  get diagnostics step_count = row_count; inserted := inserted + step_count;

  return inserted;
end;
$$;

revoke execute on function public.queue_email(text, text, text, jsonb) from public, anon, authenticated;

commit;
