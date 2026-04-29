-- 021_security_hardening.sql
-- Post-review hardening: lock down super_admin_emails, accumulate compute_winners
-- row_count, gate sudden-death resolution on active status, scope cron fallback to 2026.

-- ── Allowlist table: deny all reads via PostgREST. is_super_admin() and the
--    auth.users trigger access it via SECURITY DEFINER, which bypasses RLS.
alter table public.super_admin_emails enable row level security;
drop policy if exists super_admin_emails_no_read on public.super_admin_emails;
-- No policies = deny-all for the anon/authenticated roles.
revoke all on public.super_admin_emails from anon, authenticated;

-- ── compute_winners: accumulate row_count across all 5 inserts.
create or replace function public.compute_winners(p_room_id uuid)
returns int language plpgsql security definer as $$
declare
  inserted int := 0;
  step_count int := 0;
begin
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

-- ── resolve_sudden_death: idempotent — only acts on active rounds.
create or replace function public.resolve_sudden_death(p_round_id uuid)
returns uuid language plpgsql security definer as $$
declare v_winner uuid; v_room uuid; v_cat winner_category; v_status text;
begin
  select room_id, category, status into v_room, v_cat, v_status
    from public.sudden_death_rounds where id = p_round_id;
  if v_status is null or v_status <> 'active' then
    return null;
  end if;
  select player_id into v_winner from public.sudden_death_answers
    where round_id = p_round_id and is_correct = true
    order by response_ms asc nulls last limit 1;
  if v_winner is null then return null; end if;

  update public.sudden_death_rounds set status='completed', winner_player_id = v_winner where id = p_round_id;
  delete from public.winners where room_id = v_room and category = v_cat;
  insert into public.winners(room_id, category, player_id, metric_value, is_sudden_death_winner)
    values (v_room, v_cat, v_winner, 0, true);
  return v_winner;
end;
$$;

-- ── Cron fallback: scope strictly to 2026 (and unschedule itself once it fires).
do $outer$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    -- Drop the prior unguarded fallback if present.
    perform cron.unschedule('eurovision-2026-fallback');
    perform cron.schedule(
      'eurovision-2026-fallback',
      '0 0 15 5 *',
      $cron$
      do $body$
      begin
        if extract(year from now())::int = 2026
           and not exists (select 1 from public.parse_jobs where year=2026 and triggered_by_user=true) then
          insert into public.parse_jobs(year, triggered_by_user) values (2026, false);
        end if;
      end;
      $body$;
      $cron$
    );
  end if;
exception when others then null;
end $outer$;
