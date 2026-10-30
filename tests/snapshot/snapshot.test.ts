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
} from '../../src/content/contests/types';
import { parseCountriesSeed, readCountriesSeed } from '../../scripts/snapshot/countriesSeed';

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
      'content/contests/2024.json',
      'content/contests/2025.json',
      'content/contests/2026.json',
      'content/countries/AT.json',
      'content/countries/GR.json',
      'content/countries/MA.json',
      'content/countries/SE.json',
      'content/site.json',
    ]);
    // Sorted keys, 2-space indent, trailing newline.
    const site = a['content/site.json'];
    expect(site.endsWith('}\n')).toBe(true);
    expect(site).toBe(
      '{\n  "current_year": 2026,\n  "generated_at": "2026-11-01T12:00:00Z",\n  "live_stage": "finalized"\n}\n',
    );
    const keys = Object.keys(JSON.parse(a['content/contests/2025.json']));
    expect(keys).toEqual([...keys].sort());
  });

  it('country participations aggregate across years', () => {
    const files = buildSnapshotFiles(input());
    const gr = JSON.parse(files['content/countries/GR.json']) as CountrySnapshot;
    expect(gr).toMatchObject({ iso: 'GR', slug: 'greece', name_en: 'Greece', name_el: 'Ελλάδα', related_iso: [] });
    expect(gr.participations.map((p) => p.year)).toEqual([2024, 2025, 2026]);
    expect(gr.participations[0]).toEqual({
      year: 2024,
      city_slug: 'malmo',
      final_place: 11,
      semi: 2,
      semi_place: 3,
      qualified: true,
      artist: 'GR artist 2024',
      song: 'GR song 2024',
      points: 126,
    });
    expect(gr.participations[2]).toMatchObject({ year: 2026, city_slug: 'vienna', final_place: null, points: null });
    // A country with no entries still gets a file.
    const ma = JSON.parse(files['content/countries/MA.json']) as CountrySnapshot;
    expect(ma.participations).toEqual([]);
  });

  it('site.json current_year is the live contest', () => {
    const files = buildSnapshotFiles(input());
    const site = JSON.parse(files['content/site.json']) as SiteSnapshot;
    expect(site).toEqual({ current_year: 2026, live_stage: 'finalized', generated_at: GENERATED_AT });

    // 'current' counts as live too, even when it is not the latest year.
    const current = buildSnapshotFiles({
      ...input(),
      contests: [contest(2025, 'Basel', 'AT', 'current'), contest(2026, 'Vienna', 'AT', 'upcoming'), contests[0]],
    });
    expect(JSON.parse(current['content/site.json'])).toMatchObject({ current_year: 2025, live_stage: 'current' });

    // Two live contests break the one_live_contest invariant.
    expect(() =>
      buildSnapshotFiles({
        ...input(),
        contests: [contest(2025, 'Basel', 'AT', 'current'), contest(2026, 'Vienna', 'AT', 'finalized'), contests[0]],
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
