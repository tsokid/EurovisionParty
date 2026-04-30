-- 023_admin_rpcs.sql
-- Admin-only access policies + RPCs for the /admin UI.
-- Reads/writes on super_admin_emails, winners, sudden_death_rounds, and rooms
-- are gated behind is_super_admin().

-- ─── super_admin_emails: full CRUD for super admins ────────────────────────
alter table public.super_admin_emails enable row level security;

drop policy if exists super_admin_emails_select on public.super_admin_emails;
create policy super_admin_emails_select on public.super_admin_emails
  for select using (public.is_super_admin());

drop policy if exists super_admin_emails_insert on public.super_admin_emails;
create policy super_admin_emails_insert on public.super_admin_emails
  for insert with check (public.is_super_admin());

drop policy if exists super_admin_emails_delete on public.super_admin_emails;
create policy super_admin_emails_delete on public.super_admin_emails
  for delete using (public.is_super_admin());

-- ─── super_admins: super admins can read all rows (for status display) ────
drop policy if exists super_admins_read_all_for_admins on public.super_admins;
create policy super_admins_read_all_for_admins on public.super_admins
  for select using (public.is_super_admin());

-- ─── winners: admin override capability ───────────────────────────────────
drop policy if exists winners_admin_insert on public.winners;
create policy winners_admin_insert on public.winners
  for insert with check (public.is_super_admin());

drop policy if exists winners_admin_update on public.winners;
create policy winners_admin_update on public.winners
  for update using (public.is_super_admin());

drop policy if exists winners_admin_delete on public.winners;
create policy winners_admin_delete on public.winners
  for delete using (public.is_super_admin());

drop policy if exists winners_admin_read_all on public.winners;
create policy winners_admin_read_all on public.winners
  for select using (public.is_super_admin());

-- ─── rooms: super admins read everything ──────────────────────────────────
drop policy if exists rooms_admin_read on public.rooms;
create policy rooms_admin_read on public.rooms
  for select using (public.is_super_admin());

-- ─── players: super admins read everything (winners need player names) ────
drop policy if exists players_admin_read on public.players;
create policy players_admin_read on public.players
  for select using (public.is_super_admin());

-- ─── sudden-death rounds: admin read all ─────────────────────────────────
drop policy if exists sd_rounds_admin_read on public.sudden_death_rounds;
create policy sd_rounds_admin_read on public.sudden_death_rounds
  for select using (public.is_super_admin());

-- ─── RPC: set/clear winner override ──────────────────────────────────────
create or replace function public.admin_set_winner(
  p_room_id uuid, p_category winner_category, p_player_id uuid, p_metric numeric default 0
) returns void language plpgsql security definer as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.winners where room_id = p_room_id and category = p_category;
  insert into public.winners(room_id, category, player_id, metric_value)
  values (p_room_id, p_category, p_player_id, p_metric);
end;
$$;

create or replace function public.admin_clear_winners(p_room_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.winners where room_id = p_room_id;
end;
$$;

grant execute on function public.admin_set_winner(uuid, winner_category, uuid, numeric) to authenticated;
grant execute on function public.admin_clear_winners(uuid) to authenticated;
grant execute on function public.compute_winners(uuid) to authenticated;
