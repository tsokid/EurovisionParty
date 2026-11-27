-- 098_question_bank.test.sql
-- Proof for migration 098 (question bank). Runs on a database that carries
-- production's broad table grants (tests/db/questionBank098.test.ts), so
-- every refusal below is 098's doing. Every failed check raises; the
-- transaction is rolled back.

begin;

create function pg_temp.expect(got text, want text, label text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: expected %, got %', label, coalesce(want, 'NULL'), coalesce(got, 'NULL');
  end if;
end $$;

create function pg_temp.expect_error(q text, pattern text, label text) returns void
language plpgsql as $$
declare msg text;
begin
  begin
    execute q;
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg !~* pattern then
      raise exception 'FAIL %: raised "%" instead of /%/', label, msg, pattern;
    end if;
    return;
  end;
  raise exception 'FAIL %: statement did not raise', label;
end $$;

create function pg_temp.as_user(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
$$;

-- ── Fixtures ────────────────────────────────────────────────────────────
-- A live contest year of 2090 (with 2089, 2087 and 2080 before it).
update public.contests set stage = 'archived' where stage in ('current', 'finalized');
insert into public.contests (year, city, city_slug, stage) values
  (2080, 'Q', 'q', 'archived'), (2087, 'Q', 'q', 'archived'),
  (2089, 'Q', 'q', 'archived'), (2090, 'Q', 'q', 'current');
insert into public.countries (iso, name_en, name_el, slug)
  values ('QQ', 'Qland', 'Κιουλάνδη', 'qland') on conflict (iso) do nothing;

-- U is an admin; P is a player.
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000098', 'bank98@example.test', now()),
  ('b0000000-0000-4000-8000-000000000098', null, null);
insert into public.super_admin_emails (email) values ('bank98@example.test') on conflict do nothing;
insert into public.super_admins (user_id, email)
  values ('a0000000-0000-4000-8000-000000000098', 'bank98@example.test') on conflict do nothing;

insert into public.quiz_questions (id, correct_index, contest_year, iso, topic, difficulty,
  question_en, question_el, options_en, options_el, fact, source, status) values
  (90001, 2, 2090, 'QQ', 'winner', 'easy', 'Who won 2090?', 'Ποιος κέρδισε το 2090;',
   '{A,B,C,D}', '{Α,Β,Γ,Δ}', '2090 winner: Qland', 'https://example.test/2090', 'verified');

-- ── 1. A complete question is required ──────────────────────────────────
select pg_temp.expect_error($q$insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact)
  values (0, 'winner', 'easy', 'Q?', 'Ε;', '{A,B,C}', '{Α,Β,Γ,Δ}', 'f1')$q$,
  'complete_check', 'three options refused');
select pg_temp.expect_error($q$insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact)
  values (0, 'winner', 'easy', 'Q?', 'Ε;', '{A,B,b ,D}', '{Α,Β,Γ,Δ}', 'f2')$q$,
  'complete_check', 'repeated option refused');
select pg_temp.expect_error($q$insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact)
  values (0, 'winner', 'easy', 'Q?', null, '{A,B,C,D}', '{Α,Β,Γ,Δ}', 'f3')$q$,
  'complete_check', 'missing Greek refused');
select pg_temp.expect_error($q$insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact)
  values (4, 'winner', 'easy', 'Q?', 'Ε;', '{A,B,C,D}', '{Α,Β,Γ,Δ}', 'f4')$q$,
  'correct_check', 'flag outside the options refused');
select pg_temp.expect_error($q$insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact)
  values (0, 'gossip', 'easy', 'Q?', 'Ε;', '{A,B,C,D}', '{Α,Β,Γ,Δ}', 'f5')$q$,
  'topic_check', 'unknown topic refused');
select pg_temp.expect_error($q$insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact, status)
  values (0, 'winner', 'easy', 'Q?', 'Ε;', '{A,B,C,D}', '{Α,Β,Γ,Δ}', 'f6', 'verified')$q$,
  'verified_check', 'verified without a source refused');

-- ── 2. One live question per fact ───────────────────────────────────────
select pg_temp.expect_error($q$insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact)
  values (1, 'winner', 'hard', 'Which country won in 2090?', 'Ποια χώρα;', '{W,X,Y,Z}', '{Ω,Χ,Ψ,Ζ}', ' 2090 WINNER: Qland ')$q$,
  'fact_uniq', 'same fact, other wording refused');
update public.quiz_questions set status = 'retired' where id = 90001;
insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact)
  values (1, 'winner', 'hard', 'Which country won in 2090?', 'Ποια χώρα;', '{W,X,Y,Z}', '{Ω,Χ,Ψ,Ζ}', '2090 winner: Qland');
select pg_temp.expect((select count(*)::text from public.quiz_questions where fact ilike '2090 winner%'), '2',
  'a retired question frees its fact');
select pg_temp.expect((select (id > (select max(id) from public.quiz_questions where id < 90000 and fact is null))::text from public.quiz_questions where fact = '2090 winner: Qland' and status = 'draft'),
  'true', 'new ids come after the existing ones');

-- ── 3. verified_at follows the status ───────────────────────────────────
select pg_temp.expect_error($q$update public.quiz_questions set status = 'verified' where id = 90001$q$,
  'fact_uniq', 'reviving a retired question whose fact is live is refused');
update public.quiz_questions set status = 'retired' where fact = '2090 winner: Qland' and id <> 90001;
update public.quiz_questions set status = 'verified' where id = 90001;
select pg_temp.expect((select (verified_at is not null)::text from public.quiz_questions where id = 90001), 'true', 'verified_at set');
update public.quiz_questions set status = 'draft' where id = 90001;
select pg_temp.expect((select (verified_at is null)::text from public.quiz_questions where id = 90001), 'true', 'verified_at cleared');

-- ── 4. Eras ─────────────────────────────────────────────────────────────
select pg_temp.expect(has_function_privilege('anon', 'public.live_contest_year()', 'EXECUTE')::text, 'true', 'the game live year is untouched');
select pg_temp.expect(public.question_era(2090, 2090), 'current', 'this year');
select pg_temp.expect(public.question_era(2089, 2090), 'previous', 'last year');
select pg_temp.expect(public.question_era(2088, 2090), 'recent', '2 years back');
select pg_temp.expect(public.question_era(2085, 2090), 'recent', '5 years back');
select pg_temp.expect(public.question_era(2084, 2090), 'classic', '6 years back');
select pg_temp.expect(public.question_era(null, 2090), 'classic', 'not about one year');

-- ── 5. Round mix ────────────────────────────────────────────────────────
select pg_temp.expect((select string_agg(era || '=' || n, ',' order by era) from public.quiz_round_mix(10)),
  'classic=2,current=3,previous=3,recent=2', '30/30/20/20 is 3/3/2/2');
update public.quiz_settings set era_current = 35, era_previous = 25, era_recent = 20, era_classic = 20;
select pg_temp.expect((select sum(n)::text from public.quiz_round_mix(10)), '10', 'counts add up to 10');
select pg_temp.expect((select string_agg(era || '=' || n, ',' order by era) from public.quiz_round_mix(10)),
  'classic=2,current=4,previous=2,recent=2', '35/25 rounds to the newer era');
select pg_temp.expect((select sum(n)::text from public.quiz_round_mix(3)), '3', 'any size adds up');
select pg_temp.expect_error($q$update public.quiz_settings set era_current = 50$q$, 'quiz_settings_sum', 'mix must add up to 100');
update public.quiz_settings set era_current = 30, era_previous = 30, era_recent = 20, era_classic = 20;

-- ── 6. Players cannot read or write the bank or the mix ─────────────────
set local role anon;
select pg_temp.expect_error($q$select count(*) from public.quiz_questions$q$, 'permission denied', 'anon cannot read the bank');
select pg_temp.expect_error($q$select count(*) from public.quiz_settings$q$, 'permission denied', 'anon cannot read the mix');
select pg_temp.expect_error($q$select public.quiz_round_mix(10)$q$, 'permission denied', 'anon cannot call the mix');
reset role;

set local role authenticated;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000098');
select pg_temp.expect((select count(*)::text from public.quiz_questions), '0', 'a player sees no question');
select pg_temp.expect((select count(*)::text from public.quiz_settings), '0', 'a player sees no mix');
select pg_temp.expect_error($q$insert into public.quiz_questions (correct_index, topic, difficulty,
  question_en, question_el, options_en, options_el, fact)
  values (0, 'winner', 'easy', 'Q?', 'Ε;', '{A,B,C,D}', '{Α,Β,Γ,Δ}', 'player fact')$q$,
  'row-level security', 'a player cannot add a question');
update public.quiz_questions set correct_index = 0 where id = 90001;
update public.quiz_settings set era_current = 40, era_previous = 20;
reset role;
select pg_temp.expect((select correct_index::text from public.quiz_questions where id = 90001), '2', 'a player cannot change a flag');
select pg_temp.expect((select era_current::text from public.quiz_settings), '30', 'a player cannot change the mix');

-- ── 7. An admin reads and edits both ────────────────────────────────────
set local role authenticated;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000098');
select pg_temp.expect((select count(*)::text from public.quiz_questions where id = 90001), '1', 'admin reads the bank');
update public.quiz_questions set note = 'checked' where id = 90001;
update public.quiz_settings set era_current = 40, era_previous = 20;
select pg_temp.expect((select era_current::text from public.quiz_settings), '40', 'admin changes the mix');
select pg_temp.expect((select string_agg(era || '=' || n, ',' order by era) from public.quiz_round_mix(10)),
  'classic=2,current=4,previous=2,recent=2', 'mix follows the admin setting');
reset role;
select pg_temp.expect((select note from public.quiz_questions where id = 90001), 'checked', 'admin edit kept');

-- ── 8. Scoring still reads the flag ─────────────────────────────────────
select pg_temp.expect((select correct_index::text from public.quiz_questions where id = 90001), '2', 'flag intact');

rollback;
