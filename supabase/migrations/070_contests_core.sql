-- ============================================================
-- 070: Year-agnostic contest data (sub-project 2a, spec §5)
-- ------------------------------------------------------------
-- * contest_stage enum; contests, countries, contest_entries.
-- * At most one contest is live (stage current or finalized).
-- * Views current_entries (every entry of the live year) and
--   current_participants (grand finalists only), both with country
--   names, both security_invoker so RLS of the caller applies.
-- * live_contest_year(): the live year, else the latest non-archived
--   year, else the calendar year. rooms.year now defaults to it.
-- * RLS: public read on all three tables. No write policies; writes go
--   through super-admin RPCs (later migrations).
-- * Seeds every country that has taken part in Eurovision 1956-2026
--   (52, including the historical YU, CS and MA), which also covers
--   every ISO the parser's COUNTRY_TO_ISO can emit.
-- * Copies 2026 from eurovision_2026_participants/_results, then adds
--   the 2026 entries that did not reach the final (from COUNTRIES_2026
--   in src/lib/countries2026.ts, hardcoded below).
--
-- The old 2026 tables are left in place; nothing reads the new ones yet.
-- Idempotent: safe to run twice.
-- ============================================================

begin;

-- ── Types ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'contest_stage') then
    create type public.contest_stage as enum ('upcoming', 'current', 'finalized', 'archived');
  end if;
end $$;

-- ── Tables ──────────────────────────────────────────────────────────────
create table if not exists public.countries (
  iso          text primary key,               -- ISO 3166-1 alpha-2, plus historical YU, CS
  name_en      text not null,
  name_el      text not null,
  slug         text not null unique check (slug ~ '^[a-z]+(-[a-z]+)*$'),
  related_iso  text[] not null default '{}'    -- predecessor/successor states ("see also")
);

create table if not exists public.contests (
  year          int primary key,
  host_iso      text references public.countries(iso),
  city          text not null,
  city_slug     text not null,
  semi1_date    date,
  semi2_date    date,
  final_date    date,
  stage         public.contest_stage not null default 'upcoming',
  indexable     boolean not null default false,
  finalized_at  timestamptz,
  archived_at   timestamptz,
  published_at  timestamptz,
  updated_at    timestamptz not null default now()
);

-- At most one contest in ('current','finalized').
create unique index if not exists one_live_contest
  on public.contests ((true)) where stage in ('current', 'finalized');

create table if not exists public.contest_entries (
  year                int  not null references public.contests(year) on delete cascade,
  iso                 text not null references public.countries(iso),
  artist              text,
  song                text,
  language            text,
  semi                smallint check (semi in (1, 2)),  -- null: auto-qualifier or no semis
  semi_running_order  smallint,
  semi_place          smallint,
  semi_points         int,
  qualified           boolean,                          -- null when no semis that year
  final_running_order smallint,
  final_place         smallint,
  total_points        int,
  jury_points         int,
  televote_points     int,
  source              text,                             -- 'parser' | 'import:<dataset>' | 'manual'
  updated_at          timestamptz not null default now(),
  primary key (year, iso)
);

create index if not exists contest_entries_iso_idx on public.contest_entries (iso);

-- ── RLS: public read, no direct writes ──────────────────────────────────
alter table public.contests        enable row level security;
alter table public.countries       enable row level security;
alter table public.contest_entries enable row level security;

drop policy if exists contests_read        on public.contests;
drop policy if exists countries_read       on public.countries;
drop policy if exists contest_entries_read on public.contest_entries;

create policy contests_read        on public.contests        for select to anon, authenticated using (true);
create policy countries_read       on public.countries       for select to anon, authenticated using (true);
create policy contest_entries_read on public.contest_entries for select to anon, authenticated using (true);

grant select on public.contests, public.countries, public.contest_entries to anon, authenticated;

-- ── Views ───────────────────────────────────────────────────────────────
-- Every entry of the live year (hub, songs, semifinal pages).
create or replace view public.current_entries with (security_invoker = true) as
  select e.*, co.name_en, co.name_el
    from public.contest_entries e
    join public.contests  c  on c.year = e.year and c.stage in ('current', 'finalized')
    join public.countries co on co.iso = e.iso;

-- The game's lineup: grand-final entries only.
create or replace view public.current_participants with (security_invoker = true) as
  select * from public.current_entries where final_running_order is not null;

grant select on public.current_entries, public.current_participants to anon, authenticated;

-- ── live_contest_year() ─────────────────────────────────────────────────
create or replace function public.live_contest_year()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select year from public.contests where stage in ('current', 'finalized')),
    (select max(year) from public.contests where stage <> 'archived'),
    extract(year from now())::int
  )
$$;

grant execute on function public.live_contest_year() to anon, authenticated;

-- ── rooms.year follows the live contest ─────────────────────────────────
alter table public.rooms alter column year set default public.live_contest_year();

-- ── Countries seed ──────────────────────────────────────────────────────
-- Every Eurovision participant 1956-2026. Germany includes West Germany;
-- North Macedonia includes its entries as "FYR Macedonia".
insert into public.countries (iso, name_en, name_el, slug, related_iso) values
  ('AD', 'Andorra',                'Ανδόρα',                  'andorra',                '{}'),
  ('AL', 'Albania',                'Αλβανία',                 'albania',                '{}'),
  ('AM', 'Armenia',                'Αρμενία',                 'armenia',                '{}'),
  ('AT', 'Austria',                'Αυστρία',                 'austria',                '{}'),
  ('AU', 'Australia',              'Αυστραλία',               'australia',              '{}'),
  ('AZ', 'Azerbaijan',             'Αζερμπαϊτζάν',            'azerbaijan',             '{}'),
  ('BA', 'Bosnia and Herzegovina', 'Βοσνία-Ερζεγοβίνη',       'bosnia-and-herzegovina', '{YU}'),
  ('BE', 'Belgium',                'Βέλγιο',                  'belgium',                '{}'),
  ('BG', 'Bulgaria',               'Βουλγαρία',               'bulgaria',               '{}'),
  ('BY', 'Belarus',                'Λευκορωσία',              'belarus',                '{}'),
  ('CH', 'Switzerland',            'Ελβετία',                 'switzerland',            '{}'),
  ('CS', 'Serbia and Montenegro',  'Σερβία και Μαυροβούνιο',  'serbia-and-montenegro',  '{YU,RS,ME}'),
  ('CY', 'Cyprus',                 'Κύπρος',                  'cyprus',                 '{}'),
  ('CZ', 'Czechia',                'Τσεχία',                  'czechia',                '{}'),
  ('DE', 'Germany',                'Γερμανία',                'germany',                '{}'),
  ('DK', 'Denmark',                'Δανία',                   'denmark',                '{}'),
  ('EE', 'Estonia',                'Εσθονία',                 'estonia',                '{}'),
  ('ES', 'Spain',                  'Ισπανία',                 'spain',                  '{}'),
  ('FI', 'Finland',                'Φινλανδία',               'finland',                '{}'),
  ('FR', 'France',                 'Γαλλία',                  'france',                 '{}'),
  ('GB', 'United Kingdom',         'Ηνωμένο Βασίλειο',        'united-kingdom',         '{}'),
  ('GE', 'Georgia',                'Γεωργία',                 'georgia',                '{}'),
  ('GR', 'Greece',                 'Ελλάδα',                  'greece',                 '{}'),
  ('HR', 'Croatia',                'Κροατία',                 'croatia',                '{YU}'),
  ('HU', 'Hungary',                'Ουγγαρία',                'hungary',                '{}'),
  ('IE', 'Ireland',                'Ιρλανδία',                'ireland',                '{}'),
  ('IL', 'Israel',                 'Ισραήλ',                  'israel',                 '{}'),
  ('IS', 'Iceland',                'Ισλανδία',                'iceland',                '{}'),
  ('IT', 'Italy',                  'Ιταλία',                  'italy',                  '{}'),
  ('LT', 'Lithuania',              'Λιθουανία',               'lithuania',              '{}'),
  ('LU', 'Luxembourg',             'Λουξεμβούργο',            'luxembourg',             '{}'),
  ('LV', 'Latvia',                 'Λετονία',                 'latvia',                 '{}'),
  ('MA', 'Morocco',                'Μαρόκο',                  'morocco',                '{}'),
  ('MC', 'Monaco',                 'Μονακό',                  'monaco',                 '{}'),
  ('MD', 'Moldova',                'Μολδαβία',                'moldova',                '{}'),
  ('ME', 'Montenegro',             'Μαυροβούνιο',             'montenegro',             '{YU,CS}'),
  ('MK', 'North Macedonia',        'Βόρεια Μακεδονία',        'north-macedonia',        '{YU}'),
  ('MT', 'Malta',                  'Μάλτα',                   'malta',                  '{}'),
  ('NL', 'Netherlands',            'Ολλανδία',                'netherlands',            '{}'),
  ('NO', 'Norway',                 'Νορβηγία',                'norway',                 '{}'),
  ('PL', 'Poland',                 'Πολωνία',                 'poland',                 '{}'),
  ('PT', 'Portugal',               'Πορτογαλία',              'portugal',               '{}'),
  ('RO', 'Romania',                'Ρουμανία',                'romania',                '{}'),
  ('RS', 'Serbia',                 'Σερβία',                  'serbia',                 '{YU,CS}'),
  ('RU', 'Russia',                 'Ρωσία',                   'russia',                 '{}'),
  ('SE', 'Sweden',                 'Σουηδία',                 'sweden',                 '{}'),
  ('SI', 'Slovenia',               'Σλοβενία',                'slovenia',               '{YU}'),
  ('SK', 'Slovakia',               'Σλοβακία',                'slovakia',               '{}'),
  ('SM', 'San Marino',             'Άγιος Μαρίνος',           'san-marino',             '{}'),
  ('TR', 'Turkey',                 'Τουρκία',                 'turkey',                 '{}'),
  ('UA', 'Ukraine',                'Ουκρανία',                'ukraine',                '{}'),
  ('YU', 'Yugoslavia',             'Γιουγκοσλαβία',           'yugoslavia',             '{CS,RS,ME,MK,BA,HR,SI}')
on conflict (iso) do nothing;

-- ── 2026 ────────────────────────────────────────────────────────────────
-- finalize_results already ran for 2026, so it is migrated as finalized.
insert into public.contests
  (year, host_iso, city, city_slug, semi1_date, semi2_date, final_date, stage, finalized_at)
values
  (2026, 'AT', 'Vienna', 'vienna', '2026-05-12', '2026-05-14', '2026-05-16', 'finalized', now())
on conflict (year) do nothing;

-- Grand finalists, with results where present.
insert into public.contest_entries
  (year, iso, artist, song, final_running_order, final_place,
   total_points, jury_points, televote_points, source)
select 2026, p.iso, p.artist, p.song, p.running_order, r.ranking,
       r.total_points, r.jury_points, r.televote_points, coalesce(r.source, p.source)
  from public.eurovision_2026_participants p
  left join public.eurovision_2026_results r using (iso)
on conflict (year, iso) do nothing;

-- 2026 entries that did not reach the final: every COUNTRIES_2026 entry
-- not already copied above.
insert into public.contest_entries
  (year, iso, artist, song, final_running_order, qualified, source)
select 2026, v.iso, v.artist, v.song, null, false, 'manual'
  from (values
    ('MD', 'Satoshi', 'Viva, Moldova!'),
    ('SE', 'Felicia', 'My System'),
    ('HR', 'Lelek', 'Andromeda'),
    ('PT', 'Bandidos do Cante', 'Rosa'),
    ('GE', 'Bzikebi', 'On Replay'),
    ('FI', 'Linda Lampenius & Pete Parkkonen', 'Liekinheitin'),
    ('ME', 'Tamara Živković', 'Nova zora'),
    ('EE', 'Vanilla Ninja', 'Too Epic to Be True'),
    ('IL', 'Noam Bettan', 'Michelle'),
    ('BE', 'Essyla', 'Dancing on the Ice'),
    ('LT', 'Lion Ceccah', 'Sólo quiero más'),
    ('SM', 'Senhit', 'Superstar'),
    ('PL', 'Alicja', 'Pray'),
    ('RS', 'Lavina', 'Kraj mene'),
    ('AL', 'Alis', 'Nân'),
    ('AU', 'Delta Goodrem', 'Eclipse'),
    ('DK', 'Søren Torpegaard Lund', 'Før vi går hjem'),
    ('NO', 'Jonas Lovv', 'Ya Ya Ya'),
    ('CH', 'Veronica Fusaro', 'Alice'),
    ('BG', 'Dara', 'Bangaranga'),
    ('AZ', 'Jiva', 'Just Go'),
    ('RO', 'Alexandra Căpitănescu', 'Choke Me'),
    ('LU', 'Eva Marija', 'Mother Nature'),
    ('CZ', 'Daniel Zizka', 'Crossroads'),
    ('AM', 'Simón', 'Paloma Rumba'),
    ('CY', 'Antigoni', 'Jalla'),
    ('GR', 'Akylas', 'Ferto'),
    ('LV', 'Atvara', 'Ēnā'),
    ('MT', 'Aidan', 'Bella'),
    ('UA', 'Leléka', 'Ridnym'),
    ('FR', 'Monroe', 'Regarde !'),
    ('DE', 'Sarah Engels', 'Fire'),
    ('IT', 'Sal Da Vinci', 'Per sempre sì'),
    ('GB', 'Look Mum No Computer', 'Eins, Zwei, Drei'),
    ('AT', 'Cosmó', 'Tanzschein')
  ) as v(iso, artist, song)
on conflict (year, iso) do nothing;

commit;
