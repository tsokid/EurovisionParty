-- 072: drop the old per-year 2026 tables. Data moved to contest_entries in
-- 070; every reader and writer was switched in 071 and the app/parser code.
--
-- Guard: raises unless the 070 copy still matches the old tables (2026
-- finalists = old participants rows, 2026 final places = old results rows).
-- The drops do not cascade (results first, since it references
-- participants): an unexpected dependent object such as a view or a foreign
-- key makes the migration fail instead of being dropped with the tables.
-- (Function bodies are not tracked as dependencies; dropOld.test.ts checks
-- that none references the old tables.)

begin;

do $$
declare
  v_finalists    int;
  v_participants int;
  v_placed       int;
  v_results      int;
begin
  select count(*) into v_finalists from public.contest_entries where year = 2026 and in_final;
  select count(*) into v_participants from public.eurovision_2026_participants;
  select count(*) into v_placed from public.contest_entries where year = 2026 and final_place is not null;
  select count(*) into v_results from public.eurovision_2026_results;

  if v_finalists <> v_participants then
    raise exception '2026 finalists in contest_entries: %; old participants: %. 072 aborted.',
      v_finalists, v_participants;
  end if;
  if v_placed <> v_results then
    raise exception '2026 results in contest_entries: %; old results: %. 072 aborted.',
      v_placed, v_results;
  end if;
end $$;

drop table if exists public.eurovision_2026_results;
drop table if exists public.eurovision_2026_participants;

commit;
