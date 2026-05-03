-- ============================================================
-- 050: Drop legacy unique(room_id, category) on sudden_death_rounds
-- ------------------------------------------------------------
-- Migration 019 created the table back when Sudden Death was a single
-- question per (room, category). The implicit Postgres-named unique
-- index `sudden_death_rounds_room_id_category_key` was fine then.
--
-- Migration 031 introduced 3-question matches by adding match_id and
-- question_index columns, BUT it didn't drop the old unique constraint.
-- The new natural key is (match_id, question_index) — three rows per
-- match share the same (room_id, category). open_sudden_death_match
-- inserts those three rows in a loop, which trips the legacy unique
-- index on the second insert ("duplicate key value violates unique
-- constraint sudden_death_rounds_room_id_category_key").
--
-- This migration drops the old constraint. The new natural key is
-- enforced implicitly by the application (one match at a time per
-- room+category, three rows distinguished by question_index). Adding
-- a formal unique(match_id, question_index) is also safe and worth it.
-- ============================================================

begin;

alter table public.sudden_death_rounds
  drop constraint if exists sudden_death_rounds_room_id_category_key;

-- Belt-and-braces: enforce the new natural key.
do $idx$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename  = 'sudden_death_rounds'
       and indexname  = 'sudden_death_rounds_match_question_key'
  ) then
    create unique index sudden_death_rounds_match_question_key
       on public.sudden_death_rounds(match_id, question_index);
  end if;
end$idx$;

commit;
