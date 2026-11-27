-- 101_question_review_status.sql
-- Owner, 27 Nov: four question states in /admin: Ενεργή (verified, the only
-- one served), Για έλεγχο (review: waits for a human check), Πρόχειρη
-- (draft), Αποσυρμένη (retired). The lyric questions waiting for a lyric
-- check move to review.

alter table public.quiz_questions drop constraint if exists quiz_questions_status_check;
alter table public.quiz_questions
  add constraint quiz_questions_status_check check (status in ('draft', 'review', 'verified', 'retired'));

update public.quiz_questions set status = 'review' where status = 'draft' and lyric_check;
