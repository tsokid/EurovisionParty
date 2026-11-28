-- ============================================================
-- 107: faster security checks and indexes (F8)
-- ------------------------------------------------------------
-- 28 Nov 2026.
--   * Row security policies that call auth.uid() bare run it once per ROW
--     read. Written as (select auth.uid()) Postgres runs it once per query.
--     Same rule, same result; every game table's policy is rewritten so.
--     Except players_select: rooms_select reads players, and players_insert
--     reads rooms, so players' read policy must stay free of sub-selects or
--     Postgres stops with "infinite recursion detected in policy" (it checks
--     for loops only through policies that contain a sub-select).
--   * players(user_id): "my player rows" is in almost every policy and in
--     the home page's room list; there was no index for it.
--   * idx_rooms_code duplicated the unique index rooms_code_key: one more
--     index to write on every room insert for nothing.
-- ============================================================
begin;

create index if not exists idx_players_user on public.players (user_id);
drop index if exists public.idx_rooms_code;

-- Every public policy whose expression calls auth.uid() bare (not already
-- inside a sub-select) gets the cached form. The expressions are otherwise
-- unchanged.
do $$
declare
  p record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and not (tablename = 'players' and policyname = 'players_select')
       and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )auth\.uid\(\)'
  loop
    v_using := case when p.qual is null then null
                    else regexp_replace(p.qual, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g') end;
    v_check := case when p.with_check is null then null
                    else regexp_replace(p.with_check, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g') end;
    v_sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if v_using is not null then v_sql := v_sql || format(' using (%s)', v_using); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end $$;

commit;
