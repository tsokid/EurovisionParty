-- Rollback for 101: review questions become drafts again.
update public.quiz_questions set status = 'draft' where status = 'review';
alter table public.quiz_questions drop constraint if exists quiz_questions_status_check;
alter table public.quiz_questions
  add constraint quiz_questions_status_check check (status in ('draft', 'verified', 'retired'));
