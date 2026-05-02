-- ============================================================
-- 044: Add tie_votes + tie_vote_choices to the realtime publication
-- ------------------------------------------------------------
-- Without this, only the host (who optimistically updates local state)
-- sees the vote when they click "Open Tie Vote". Other players' postgres
-- _changes subscriptions silently never fire because the tables aren't
-- in supabase_realtime, so the vote UI never appears for them and the
-- tiebreak flow stalls.
--
-- ALTER PUBLICATION ... ADD TABLE is idempotent only when wrapped in
-- a guard — re-running it raises if the table is already a member.
-- We check pg_publication_tables and add only when missing so the
-- migration is safe to apply against environments that may already
-- have these tables published.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tie_votes'
  ) then
    alter publication supabase_realtime add table public.tie_votes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tie_vote_choices'
  ) then
    alter publication supabase_realtime add table public.tie_vote_choices;
  end if;
end$$;
