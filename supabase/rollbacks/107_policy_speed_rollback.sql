-- Rollback of 107. The policy rewrite changes no rule (only when auth.uid()
-- is evaluated), so undoing it is optional; this puts the bare form back in
-- the policies 107 touched on 28 Nov 2026 and restores the indexes.
begin;

drop index if exists public.idx_players_user;
create index if not exists idx_rooms_code on public.rooms (code);

do $$
declare
  p record;
  v_sql text;
  touched text[] := array[
    'notifications.notifications_select', 'notifications.notifications_update',
    'player_secrets.player_secrets_insert', 'player_secrets.player_secrets_select',
    'player_secrets.player_secrets_update', 'players.players_insert',
    'players.players_update', 'rooms.rooms_insert',
    'rooms.rooms_select', 'rooms.rooms_update', 'sudden_death_answers.sd_answers_read',
    'sudden_death_rounds.sd_rounds_read', 'super_admins.super_admins_read_self',
    'tie_vote_choices.tie_vote_choices_read', 'tie_votes.tie_votes_read',
    'winners.winners_read'];
begin
  for p in
    select tablename, policyname, qual, with_check from pg_policies
     where schemaname = 'public' and (tablename || '.' || policyname) = any (touched)
  loop
    v_sql := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if p.qual is not null then
      v_sql := v_sql || format(' using (%s)', replace(p.qual, '( SELECT auth.uid() AS uid)', 'auth.uid()'));
    end if;
    if p.with_check is not null then
      v_sql := v_sql || format(' with check (%s)', replace(p.with_check, '( SELECT auth.uid() AS uid)', 'auth.uid()'));
    end if;
    execute v_sql;
  end loop;
end $$;

commit;
