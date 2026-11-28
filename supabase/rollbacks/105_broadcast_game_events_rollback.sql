-- Rollback of 105: back to Postgres Changes. Deploy the client from before
-- 105 together with this (it listens to Postgres Changes again).
begin;

do $$
declare t text;
begin
  foreach t in array array['rooms','players','duels','notifications','tie_votes','tie_vote_choices',
                           'sudden_death_rounds','sudden_death_answers','cms_documents'] loop
    execute format('drop trigger if exists rt_push on public.%I', t);
  end loop;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['rooms','players','notifications','duels','tie_votes','tie_vote_choices',
                             'sudden_death_rounds','sudden_death_answers','cms_documents'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;

  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists game_room_channel_read on realtime.messages';
    execute 'drop policy if exists game_player_channel_read on realtime.messages';
  end if;
end $$;

drop function if exists public.rt_room_change();
drop function if exists public.rt_notification();
drop function if exists public.rt_cms_saved();
drop function if exists public.rt_row(text, jsonb);
drop function if exists public.rt_push(text, text, jsonb);

commit;
