// buildSnapshotFiles: the pure snapshot builder shared by the publish-content
// edge function and scripts/snapshot/build-local.ts.
import { describe, it, expect } from 'vitest';
import { buildSnapshotFiles } from '../../supabase/functions/publish-content/snapshot';
import type {
  ContestRow,
  CountryRow,
  EntryRow,
  ContestSnapshot,
  CountrySnapshot,
  SiteSnapshot,
  ContestIndex,
  CountryIndex,
} from '../../src/content/contests/types';
import { parseCountriesSeed, readCountriesSeed } from '../../scripts/snapshot/countriesSeed';
import { load2026, localInput } from '../../scripts/snapshot/build-local';
import { COUNTRIES_2026 } from '../../src/lib/countries2026';
import { isCountryIndexable } from '../../src/lib/seo/dynamicPages';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GENERATED_AT = '2026-11-01T12:00:00Z';

const countries: CountryRow[] = [
  { iso: 'GR', name_en: 'Greece', name_el: 'Ελλάδα', slug: 'greece', related_iso: [] },
  { iso: 'SE', name_en: 'Sweden', name_el: 'Σουηδία', slug: 'sweden', related_iso: [] },
  { iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία', slug: 'austria', related_iso: [] },
  { iso: 'MA', name_en: 'Morocco', name_el: 'Μαρόκο', slug: 'morocco', related_iso: [] },
];

function contest(year: number, city: string, host: string, stage: ContestRow['stage']): ContestRow {
  return {
    year,
    city,
    city_slug: city.toLowerCase(),
    host_iso: host,
    semi1_date: `${year}-05-10`,
    semi2_date: `${year}-05-12`,
    final_date: `${year}-05-14`,
    stage,
    indexable: stage !== 'archived',
    cancelled: false,
  };
}

const contests: ContestRow[] = [
  { ...contest(2020, 'Rotterdam', 'NL', 'archived'), cancelled: true },
  contest(2024, 'Malmo', 'SE', 'archived'),
  contest(2025, 'Basel', 'AT', 'archived'),
  contest(2026, 'Vienna', 'AT', 'finalized'),
];

function entry(year: number, iso: string, over: Partial<EntryRow> = {}): EntryRow {
  return {
    year,
    iso,
    artist: `${iso} artist ${year}`,
    song: `${iso} song ${year}`,
    language: null,
    semi: null,
    semi_running_order: null,
    semi_place: null,
    semi_points: null,
    qualified: null,
    in_final: true,
    final_running_order: null,
    final_place: null,
    total_points: null,
    jury_points: null,
    televote_points: null,
    source: 'manual',
    ...over,
  };
}

const entries: EntryRow[] = [
  entry(2020, 'GR', { semi: 1, in_final: false }),
  entry(2024, 'GR', { semi: 2, semi_place: 3, semi_points: 120, qualified: true, final_place: 11, total_points: 126 }),
  entry(2024, 'SE', { final_place: 9, total_points: 174 }),
  entry(2025, 'GR', { semi: 1, semi_place: 4, semi_points: 98, qualified: true, final_place: 6, total_points: 231 }),
  entry(2025, 'AT', { semi: 2, semi_place: 5, semi_points: 104, qualified: true, final_place: 1, total_points: 436 }),
  entry(2025, 'SE', { final_place: 4, total_points: 321 }),
  entry(2026, 'GR', { semi: 2, in_final: false, qualified: null }),
  entry(2026, 'AT', { semi: null }),
];

const input = () => ({ contests, countries, entries, generated_at: GENERATED_AT });

/** A fixed reordering: every other element first, then the rest. */
function shuffled<T>(xs: T[]): T[] {
  return [...xs.filter((_, i) => i % 2 === 1), ...xs.filter((_, i) => i % 2 === 0)];
}

describe('buildSnapshotFiles', () => {
  it('deterministic output', () => {
    const a = buildSnapshotFiles(input());
    const b = buildSnapshotFiles({
      contests: [...contests].reverse(),
      countries: [...countries].reverse(),
      entries: shuffled(entries),
      generated_at: GENERATED_AT,
    });
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) expect(b[k]).toBe(a[k]);
    expect(Object.keys(a).sort()).toEqual([
      'content/contests/2020.json',
      'content/contests/2024.json',
      'content/contests/2025.json',
      'content/contests/2026.json',
      'content/contests/index.json',
      'content/countries/AT.json',
      'content/countries/GR.json',
      'content/countries/MA.json',
      'content/countries/SE.json',
      'content/countries/index.json',
      'content/site.json',
    ]);
    // Sorted keys, 2-space indent, trailing newline.
    const site = a['content/site.json'];
    expect(site.endsWith('}\n')).toBe(true);
    expect(site.startsWith('{\n  "current": {\n    "city": "Vienna",\n')).toBe(true);
    expect(site).toContain('\n  "current_year": 2026,\n  "generated_at": "2026-11-01T12:00:00Z",\n  "live_stage": "finalized"\n}\n');
    const keys = Object.keys(JSON.parse(a['content/contests/2025.json']));
    expect(keys).toEqual([...keys].sort());
  });

  it('country participations aggregate across years', () => {
    const files = buildSnapshotFiles(input());
    const gr = JSON.parse(files['content/countries/GR.json']) as CountrySnapshot;
    expect(gr).toMatchObject({ iso: 'GR', slug: 'greece', name_en: 'Greece', name_el: 'Ελλάδα', related_iso: [] });
    expect(gr.participations.map((p) => p.year)).toEqual([2020, 2024, 2025, 2026]);
    expect(gr.participations[0]).toMatchObject({ year: 2020, city_slug: 'rotterdam', cancelled: true, points: null });
    expect(gr.participations[1]).toEqual({
      year: 2024,
      city_slug: 'malmo',
      cancelled: false,
      final_place: 11,
      semi: 2,
      semi_place: 3,
      semi_points: 120,
      qualified: true,
      artist: 'GR artist 2024',
      song: 'GR song 2024',
      points: 126,
    });
    expect(gr.participations[3]).toMatchObject({ year: 2026, city_slug: 'vienna', cancelled: false, final_place: null, points: null });
    // A country with no entries still gets a file.
    const ma = JSON.parse(files['content/countries/MA.json']) as CountrySnapshot;
    expect(ma.participations).toEqual([]);
  });

  it('site.json current_year is the live contest', () => {
    const files = buildSnapshotFiles(input());
    const site = JSON.parse(files['content/site.json']) as SiteSnapshot;
    expect(site).toEqual({
      current_year: 2026,
      live_stage: 'finalized',
      generated_at: GENERATED_AT,
      current: {
        year: 2026,
        city: 'Vienna',
        city_slug: 'vienna',
        dates: { semi1: '2026-05-10', semi2: '2026-05-12', final: '2026-05-14' },
        stage: 'finalized',
        host: { iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία' },
        entry_count: 2,
        finalist_count: 1,
      },
    });

    // 'current' counts as live too, even when it is not the latest year.
    const current = buildSnapshotFiles({
      ...input(),
      contests: [contest(2025, 'Basel', 'AT', 'current'), contest(2026, 'Vienna', 'AT', 'upcoming'), ...contests.filter((c) => c.year < 2025)],
    });
    expect(JSON.parse(current['content/site.json'])).toMatchObject({
      current_year: 2025,
      live_stage: 'current',
      current: { year: 2025, city: 'Basel', stage: 'current', entry_count: 3, finalist_count: 3 },
    });

    // Two live contests break the one_live_contest invariant.
    expect(() =>
      buildSnapshotFiles({
        ...input(),
        contests: [contest(2025, 'Basel', 'AT', 'current'), contest(2026, 'Vienna', 'AT', 'finalized'), ...contests.filter((c) => c.year < 2025)],
      }),
    ).toThrow(/live/);
  });

  it('entries carry Greek names', () => {
    const files = buildSnapshotFiles(input());
    const c = JSON.parse(files['content/contests/2026.json']) as ContestSnapshot;
    expect(c).toMatchObject({
      year: 2026,
      city: 'Vienna',
      city_slug: 'vienna',
      host_iso: 'AT',
      dates: { semi1: '2026-05-10', semi2: '2026-05-12', final: '2026-05-14' },
      stage: 'finalized',
      indexable: true,
      cancelled: false,
    });
    const gr = c.entries.find((e) => e.iso === 'GR')!;
    expect(gr).toMatchObject({ name_en: 'Greece', name_el: 'Ελλάδα', country_slug: 'greece', in_final: false });
    expect(c.entries.map((e) => e.iso)).toEqual(['AT', 'GR']);
  });

  it('contests/index.json: one row per year with the winner', () => {
    const files = buildSnapshotFiles(input());
    const index = JSON.parse(files['content/contests/index.json']) as ContestIndex;
    expect(Object.keys(index)).toEqual(['2020', '2024', '2025', '2026']);
    expect(index['2025']).toEqual({
      city: 'Basel',
      city_slug: 'basel',
      host_iso: 'AT',
      stage: 'archived',
      indexable: false,
      cancelled: false,
      final_date: '2025-05-14',
      winner: { iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία', artist: 'AT artist 2025', song: 'AT song 2025', points: 436 },
      co_winners: [],
    });
    // Cancelled: no winner. No place 1 yet: no winner.
    expect(index['2020']).toMatchObject({ cancelled: true, winner: null, co_winners: [] });
    expect(index['2024'].winner).toBeNull();
  });

  it('contests/index.json: a shared first place (1969) keeps every winner', () => {
    const files = buildSnapshotFiles({
      ...input(),
      entries: [
        ...entries,
        entry(2024, 'AT', { final_place: 1, total_points: 200 }),
        entry(2024, 'MA', { final_place: 1, total_points: 200 }),
      ],
    });
    const index = JSON.parse(files['content/contests/index.json']) as ContestIndex;
    expect(index['2024'].winner?.iso).toBe('AT');
    expect(index['2024'].co_winners.map((w) => w.iso)).toEqual(['MA']);
  });

  it('countries/index.json: keyed by slug, counts and indexability', () => {
    const files = buildSnapshotFiles(input());
    const index = JSON.parse(files['content/countries/index.json']) as CountryIndex;
    // Countries with no participation have no page, so no index row.
    expect(Object.keys(index)).toEqual(['austria', 'greece', 'sweden']);
    // 2020 was cancelled: it is not counted.
    expect(index.greece).toEqual({
      iso: 'GR', name_en: 'Greece', name_el: 'Ελλάδα', participations: 3, wins: 0, best_place: 6, indexable: true,
    });
    expect(index.austria).toMatchObject({ participations: 2, wins: 1, best_place: 1, indexable: false });
    expect(index.sweden).toMatchObject({ participations: 2, wins: 0, best_place: 4 });
  });

  it('countries/index.json: wins and best place count completed contests (finalized or archived)', () => {
    const atWins2026 = entries.map((e) => (e.year === 2026 && e.iso === 'AT' ? { ...e, final_place: 1, total_points: 500 } : e));
    const grSecond2026 = entries.map((e) => (e.year === 2026 && e.iso === 'GR' ? { ...e, in_final: true, final_place: 2, total_points: 400 } : e));
    const countryIndex = (files: Record<string, string>) => JSON.parse(files['content/countries/index.json']) as CountryIndex;

    // 2026 is finalized: its result counts.
    expect(countryIndex(buildSnapshotFiles({ ...input(), entries: atWins2026 })).austria).toMatchObject({ participations: 2, wins: 2, best_place: 1 });
    expect(countryIndex(buildSnapshotFiles({ ...input(), entries: grSecond2026 })).greece.best_place).toBe(2);

    // A contest still in progress (current) does not count yet.
    const live = contests.map((c) => (c.year === 2026 ? { ...c, stage: 'current' as const } : c));
    expect(countryIndex(buildSnapshotFiles({ ...input(), contests: live, entries: atWins2026 })).austria.wins).toBe(1);
    expect(countryIndex(buildSnapshotFiles({ ...input(), contests: live, entries: grSecond2026 })).greece.best_place).toBe(6);
  });

  it('rejects a completed contest from 2004 on with entries but no semi-final assignments (C1)', () => {
    const noSemis = entries.map((e) => (e.year === 2026 ? { ...e, semi: null, semi_place: null, semi_points: null, qualified: null } : e));
    expect(() => buildSnapshotFiles({ ...input(), entries: noSemis })).toThrow(/2026 \(finalized\) has 2 entries but no semi-final assignments/);
    // Archived years too.
    const noSemis2025 = entries.map((e) => (e.year === 2025 ? { ...e, semi: null } : e));
    expect(() => buildSnapshotFiles({ ...input(), entries: noSemis2025 })).toThrow(/2025 \(archived\)/);
    // Cancelled 2020 and a current (not yet completed) year are exempt; so are years before 2004.
    const noSemis2020 = entries.map((e) => (e.year === 2020 ? { ...e, semi: null } : e));
    expect(() => buildSnapshotFiles({ ...input(), entries: noSemis2020 })).not.toThrow();
    const current = contests.map((c) => (c.year === 2026 ? { ...c, stage: 'current' as const } : c));
    expect(() => buildSnapshotFiles({ ...input(), contests: current, entries: noSemis })).not.toThrow();
    const old = [...contests, contest(2003, 'Riga', 'SE', 'archived')];
    expect(() => buildSnapshotFiles({ ...input(), contests: old, entries: [...entries, entry(2003, 'SE')] })).not.toThrow();
  });

  it('rejects an entry whose country or year is unknown', () => {
    expect(() => buildSnapshotFiles({ ...input(), entries: [entry(2025, 'XX')] })).toThrow(/XX/);
    expect(() => buildSnapshotFiles({ ...input(), entries: [entry(1999, 'GR')] })).toThrow(/1999/);
  });
});

describe('countries seed (070)', () => {
  it('parses the 52 seeded countries from migration 070', () => {
    const rows = readCountriesSeed();
    expect(rows).toHaveLength(52);
    expect(rows.find((r) => r.iso === 'GR')).toEqual({
      iso: 'GR',
      name_en: 'Greece',
      name_el: 'Ελλάδα',
      slug: 'greece',
      related_iso: [],
    });
    expect(rows.find((r) => r.iso === 'YU')!.related_iso).toEqual(['CS', 'RS', 'ME', 'MK', 'BA', 'HR', 'SI']);
    expect(new Set(rows.map((r) => r.iso)).size).toBe(52);
  });

  it('unescapes doubled quotes and refuses a missing VALUES block', () => {
    const sql = `insert into public.countries (iso, name_en, name_el, slug, related_iso) values
  ('XX', 'Côte d''Ivoire', 'Ακτή', 'cote-d-ivoire', '{}')
on conflict (iso) do nothing;`;
    expect(parseCountriesSeed(sql)).toEqual([
      { iso: 'XX', name_en: "Côte d'Ivoire", name_el: 'Ακτή', slug: 'cote-d-ivoire', related_iso: [] },
    ]);
    expect(() => parseCountriesSeed('select 1;')).toThrow();
  });
});

describe('build-local', () => {
  it('takes 2026 from data/history/2026.json with real results, as the 070 seed row', () => {
    const y = load2026();
    expect(y).not.toBeNull();
    expect(y!.contest).toEqual({
      year: 2026,
      host_iso: 'AT',
      city: 'Vienna',
      city_slug: 'vienna',
      semi1_date: '2026-05-12',
      semi2_date: '2026-05-14',
      final_date: '2026-05-16',
      stage: 'finalized',
      indexable: false,
      cancelled: false,
    });
    expect(y!.entries).toHaveLength(35);
    const finalists = y!.entries.filter((e) => e.in_final);
    expect(finalists).toHaveLength(25);
    expect(finalists.every((e) => e.final_place !== null && e.total_points !== null)).toBe(true);
    // Same lineup as COUNTRIES_2026.
    expect(y!.entries.map((e) => e.iso).sort()).toEqual(COUNTRIES_2026.map((c) => c.id).sort());
  });

  it('builds a snapshot with 71 contests and every seeded country', () => {
    const files = buildSnapshotFiles(localInput());
    const paths = Object.keys(files);
    expect(paths.filter((p) => /^content\/contests\/\d{4}\.json$/.test(p))).toHaveLength(71);
    expect(paths.filter((p) => /^content\/countries\/[A-Z]{2}\.json$/.test(p))).toHaveLength(52);
    expect(paths).toContain('content/contests/index.json');
    expect(paths).toContain('content/countries/index.json');
    expect(JSON.parse(files['content/site.json'])).toMatchObject({
      current_year: 2026,
      live_stage: 'finalized',
      generated_at: '1970-01-01T00:00:00Z',
      current: {
        year: 2026,
        city: 'Vienna',
        dates: { semi1: '2026-05-12', semi2: '2026-05-14', final: '2026-05-16' },
        host: { iso: 'AT', name_en: 'Austria', name_el: 'Αυστρία' },
        entry_count: 35,
        finalist_count: 25,
      },
    });
  });

  it('the committed content/ matches a fresh build byte for byte', () => {
    const files = buildSnapshotFiles(localInput());
    for (const [rel, text] of Object.entries(files)) {
      expect(readFileSync(resolve(process.cwd(), rel), 'utf8'), rel).toBe(text);
    }
  });

  it('countries/index.json agrees with dynamicPageUrls (pages and indexability)', () => {
    const files = buildSnapshotFiles(localInput());
    const index = JSON.parse(files['content/countries/index.json']) as CountryIndex;
    const countries = Object.entries(files)
      .filter(([p]) => /^content\/countries\/[A-Z]{2}\.json$/.test(p))
      .map(([, t]) => JSON.parse(t) as CountrySnapshot)
      .filter((c) => c.participations.length > 0);
    expect(Object.keys(index).sort()).toEqual(countries.map((c) => c.slug).sort());
    for (const c of countries) expect(index[c.slug].indexable, c.slug).toBe(isCountryIndexable(c));
  });
});
