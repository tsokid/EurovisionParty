-- Rollback for 098_question_bank.sql. quiz_questions goes back to id +
-- correct_index (the question columns and their data are dropped; take a
-- dump first), quiz_settings and the era functions are removed.

revoke all on public.quiz_questions from anon, authenticated;
drop policy if exists quiz_questions_admin_all on public.quiz_questions;

drop trigger if exists quiz_questions_touch on public.quiz_questions;
drop function if exists public.quiz_questions_touch();

drop index if exists public.quiz_questions_fact_uniq;
drop index if exists public.quiz_questions_pick_idx;

alter table public.quiz_questions alter column id drop default;
drop sequence if exists public.quiz_questions_id_seq;

alter table public.quiz_questions
  drop constraint if exists quiz_questions_topic_check,
  drop constraint if exists quiz_questions_difficulty_check,
  drop constraint if exists quiz_questions_status_check,
  drop constraint if exists quiz_questions_correct_check,
  drop constraint if exists quiz_questions_complete_check,
  drop constraint if exists quiz_questions_verified_check;

alter table public.quiz_questions
  drop column if exists contest_year,
  drop column if exists iso,
  drop column if exists topic,
  drop column if exists difficulty,
  drop column if exists question_en,
  drop column if exists question_el,
  drop column if exists options_en,
  drop column if exists options_el,
  drop column if exists fact,
  drop column if exists source,
  drop column if exists note,
  drop column if exists lyric_check,
  drop column if exists time_sensitive,
  drop column if exists status,
  drop column if exists verified_at,
  drop column if exists created_at,
  drop column if exists updated_at;

drop function if exists public.options_valid(text[]);
drop function if exists public.quiz_round_mix(int);
drop function if exists public.question_era(int, int);
drop table if exists public.quiz_settings;
drop function if exists public.quiz_settings_touch();
