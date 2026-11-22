// gallery/AdminGallery.tsx — the admin shell with a faked admin session
// (CMS P0). ?screen=admin&path=/admin/contests/2026 opens that admin URL in
// the real route table; every Supabase call resolves from the fixtures below
// (gallery/fakeSupabase.ts). The fake session's user is in super_admins, so
// useAdminAuth signs in without a real login. Dev only.
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../src/routeConfig';
import { FAKE_USER, setFakeDb, setFakeFunctions } from './fakeSupabase';
import { IMAGE_AVATARS } from '../src/components/stage/avatars/images.generated';
import { CmsRealtimeContext, type DocChannelFactory, type DocChannelHandlers } from '../src/admin/cms/docChannel';
import rulesDoc from '../content/pages/rules.json';
import faqDoc from '../content/pages/faq.json';
import headerDoc from '../content/pages/site-header.json';
import footerDoc from '../content/pages/site-footer.json';
import aboutDoc from '../content/pages/about.json';
import termsDoc from '../content/pages/terms.json';
import privacyDoc from '../content/pages/privacy.json';
import { PreviewTransportContext, previewSrc, type PreviewTransport } from '../src/admin/preview/transport';

// The editor's preview iframe loads the gallery too (same fake session and fixtures).
const galleryPreview: PreviewTransport = {
  kind: 'iframe',
  src: (docId, locale) => `/?screen=admin&path=${encodeURIComponent(previewSrc(docId, locale))}`,
};

// CMS drafts (P3): a stateful cms_get / cms_save with the real optimistic
// concurrency, a short history, and a fake second editor ("elena") on every
// doc. window.__cmsRemoteSave(docId, mutate) makes elena save, so the
// gallery can show the auto-rebase toast and the conflict dialog.
type DraftRow = { doc_id: string; doc_type: string; data: unknown; updated_at: string };
const drafts: Record<string, DraftRow> = {};
let stamp = 0;
const nextStamp = () => `2026-11-22T10:${String(10 + (stamp++ % 49)).padStart(2, '0')}:00.${String(stamp).padStart(3, '0')}Z`;
const channels = new Map<string, DocChannelHandlers>();
const ELENA = { key: 'tab-elena', userId: 'u-elena', email: 'elena@example.com' };
const galleryChannel: DocChannelFactory = (docId, _me, handlers) => {
  channels.set(docId, handlers);
  handlers.onStatus?.(true);
  setTimeout(() => handlers.onPeers([{ ...ELENA, field: 'el.hero.title', fieldLabel: 'Hero › Title (EL)' }]), 300);
  return { focus() {}, announceSaved() {}, close() { channels.delete(docId); } };
};
function seedDraft(docId: string) {
  const data = JSON.parse(JSON.stringify(rulesDoc));
  drafts[docId] = { doc_id: docId, doc_type: docId, data, updated_at: '2026-11-22T09:58:00.000Z' };
}
(window as unknown as Record<string, unknown>).__cmsRemoteSave = (docId: string, mutate: (d: { en: Record<string, unknown>; el: Record<string, unknown> }) => void, notify = true) => {
  const row = drafts[docId];
  if (!row) return;
  const data = JSON.parse(JSON.stringify(row.data));
  mutate(data);
  drafts[docId] = { ...row, data, updated_at: nextStamp() };
  if (notify) channels.get(docId)?.onRemoteSave({ updatedAt: drafts[docId].updated_at, by: 'elena@example.com' });
};
const HISTORY = [
  { id: 31, kind: 'checkpoint', author: 'user-me', author_email: 'owner@example.com', created_at: '2026-11-22T09:40:00Z', updated_at: '2026-11-22T09:58:00Z', run_id: null, commit_sha: null, restored_from: null },
  { id: 27, kind: 'restored', author: 'u-elena', author_email: 'elena@example.com', created_at: '2026-11-21T19:12:00Z', updated_at: '2026-11-21T19:12:00Z', run_id: null, commit_sha: null, restored_from: 19 },
  { id: 24, kind: 'published', author: 'u-elena', author_email: 'elena@example.com', created_at: '2026-11-21T18:02:00Z', updated_at: '2026-11-21T18:02:00Z', run_id: 41, commit_sha: '3e1f0a9c55e1', restored_from: null },
  { id: 19, kind: 'checkpoint', author: 'u-elena', author_email: 'elena@example.com', created_at: '2026-11-21T17:30:00Z', updated_at: '2026-11-21T17:51:00Z', run_id: null, commit_sha: null, restored_from: null },
  { id: 4, kind: 'seed', author: null, author_email: null, created_at: '2026-11-20T09:00:00Z', updated_at: '2026-11-20T09:00:00Z', run_id: null, commit_sha: null, restored_from: null },
];
function revisionData(id: number) {
  const data = JSON.parse(JSON.stringify(rulesDoc));
  if (id === 19 && data.en?.hero) {
    data.en.hero.title = 'Rules: the complete Eurovision Games rule book';
    data.el.hero.lede = 'Όλα όσα χρειάζεται ο host ή ένας παίκτης για να λυθεί μια διαφωνία την ώρα του σόου.';
  }
  return data;
}

// CMS P5: drafts with real changes (the publish diff), and the publish runs
// in every deploy state. publish-status echoes the runs; publish-content
// records a new run, building.
type Mut = { en: Record<string, any>; el: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
function seedChanged(docId: string, source: unknown, at: string, mutate: (d: Mut) => void) {
  const data = JSON.parse(JSON.stringify(source)) as Mut;
  mutate(data);
  drafts[docId] = { doc_id: docId, doc_type: docId, data, updated_at: at };
}
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const HEADER_AT = '2026-11-22T09:40:00.000Z';
const FOOTER_AT = '2026-11-22T09:44:00.000Z';
const PUBLISH_RUNS: Array<Record<string, unknown>> = [];
function seedRuns() {
  const run = (r: Record<string, unknown>) => ({
    status: 'ok', cms: true, files_changed: 2, error: null, promoted_from: null, deploy_url: null, deploy_note: null,
    reverted_sha: null, shipped: null, started_at: r.finished_at, ...r,
  });
  PUBLISH_RUNS.splice(0, PUBLISH_RUNS.length,
    run({ id: 64, target: 'preview', doc_ids: ['site-header'], commit_sha: '6a41c09e7d2b', finished_at: ago(3), deploy_state: 'ready',
      deploy_url: 'https://eurovision-git-content-preview-tsokid.vercel.app', shipped: [{ doc_id: 'site-header', updated_at: HEADER_AT }] }),
    run({ id: 63, target: 'preview', doc_ids: ['site-footer'], commit_sha: '5f20aa81c3e4', finished_at: ago(1), deploy_state: 'building',
      shipped: [{ doc_id: 'site-footer', updated_at: FOOTER_AT }] }),
    run({ id: 62, target: 'main', doc_ids: ['about'], commit_sha: '4c9d0b2e11aa', finished_at: ago(26), deploy_state: 'ready', deploy_url: 'https://eurovision.games' }),
    run({ id: 61, target: 'main', doc_ids: ['scoring'], commit_sha: '3b77e1f0c2d9', finished_at: ago(95), deploy_state: 'revert_blocked',
      deploy_note: 'main moved on to 9e01c4d after this publish: not reverting automatically. Fix the content or revert by hand.' }),
    run({ id: 58, target: 'main', doc_ids: ['faq'], commit_sha: 'fa11ed4c2b90', finished_at: ago(240), deploy_state: 'reverted', reverted_sha: 'b4ck0ff1e2d3',
      deploy_url: 'https://vercel.com/tsokid/eurovision/8xq', deploy_note: 'seo:diff: /en/faq title changed without an SEO intent (HARD: title)' }),
    run({ id: 57, target: 'main', doc_ids: null, commit_sha: '2a90f3d4e5b6', finished_at: ago(60 * 26), deploy_state: 'ready', files_changed: 7 }),
  );
}

// The avatars table (089): the shipped set, a few unpublished, one deleted.
const AVATAR_ROWS = IMAGE_AVATARS.map((a, i) => ({
  id: a.id, title_en: a.title.en, title_el: i === 0 ? 'Διοικητής της Ντίσκο' : a.title.el === a.title.en ? '' : a.title.el,
  thumb_path: a.thumb, full_path: a.full, status: i % 9 === 4 ? 'unpublished' : 'published', sort: (i + 1) * 10,
  created_at: '2026-11-22T10:00:00Z', deleted_at: i === 52 ? '2026-11-20T10:00:00Z' : null,
}));
const AVATAR_USAGE = [{ avatar_id: 'img-01', players: 14 }, { avatar_id: 'img-02', players: 3 }, { avatar_id: 'img-05', players: 1 }, { avatar_id: 'img-07', players: 6 }];

const CONTESTS = [
  { year: 2027, city: 'Sofia', city_slug: 'sofia', host_iso: 'BG', stage: 'upcoming', final_date: '2027-05-15', indexable: false, entry_count: 0, finalist_count: 0 },
  { year: 2026, city: 'Vienna', city_slug: 'vienna', host_iso: 'AT', stage: 'current', final_date: '2026-05-16', indexable: true, entry_count: 0, finalist_count: 0 },
  { year: 2025, city: 'Basel', city_slug: 'basel', host_iso: 'CH', stage: 'archived', final_date: '2025-05-17', indexable: true, entry_count: 4, finalist_count: 4 },
  { year: 2024, city: 'Malmö', city_slug: 'malmo', host_iso: 'SE', stage: 'archived', final_date: '2024-05-11', indexable: true, entry_count: 4, finalist_count: 4 },
];

const COUNTRIES = [
  { iso: 'AT', name_en: 'Austria', slug: 'austria' },
  { iso: 'GR', name_en: 'Greece', slug: 'greece' },
  { iso: 'SE', name_en: 'Sweden', slug: 'sweden' },
  { iso: 'UA', name_en: 'Ukraine', slug: 'ukraine' },
];

const entry = (year: number, iso: string, artist: string, song: string, place: number | null) => ({
  year, iso, artist, song, semi: 1, semi_running_order: null, semi_place: null, semi_points: null, qualified: true,
  in_final: true, final_running_order: null, final_place: place, total_points: null,
});

// The night-of parser (P4 screens): both jobs of 2026 and a few runs with their rows (parse report).
const job = (kind: 'participants' | 'results', extra: Record<string, unknown>) => ({
  kind, year: 2026, status: 'idle', poll_count: 0, last_poll_at: null, started_at: null, stopped_at: null,
  triggered_by_user: null, manual_override: false, source_url: null, scheduled_start_at: null, scheduled_end_at: null,
  poll_interval_minutes: 2, respect_schedule: false, ...extra,
});
const PARSE_JOBS = [
  job('participants', {
    status: 'done', last_poll_at: '2026-05-14T20:10:00Z', respect_schedule: true,
    source_url: 'https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/',
    scheduled_start_at: '2026-05-14T20:00:00Z',
  }),
  job('results', {
    status: 'running', poll_count: 37, last_poll_at: '2026-05-16T21:54:00Z', respect_schedule: true,
    source_url: 'https://www.eurovision.com/eurovision-song-contest/vienna-2026/vienna-2026-grand-final/',
    scheduled_start_at: '2026-05-16T21:30:00Z', scheduled_end_at: '2026-05-16T23:30:00Z',
  }),
];
const PARSE_RUNS = [
  { id: 'r3', kind: 'results', year: 2026, finished_at: '2026-05-16T21:54:00Z', http_status: 200, status: 'ok', rows_upserted: 4, error: null,
    source_url: PARSE_JOBS[1].source_url,
    rows: [{ iso: 'AT', name: 'Austria', place: 1, points: 436 }, { iso: 'SE', name: 'Sweden', place: 2, points: 321 }, { iso: 'GR', name: 'Greece', place: 3, points: 230 }, { iso: 'UA', name: 'Ukraine', place: 4, points: 218 }] },
  { id: 'r2', kind: 'results', year: 2026, finished_at: '2026-05-16T21:52:00Z', http_status: 200, status: 'ok', rows_upserted: 4, error: null,
    source_url: PARSE_JOBS[1].source_url,
    rows: [{ iso: 'AT', name: 'Austria', place: 1, points: 401 }, { iso: 'SE', name: 'Sweden', place: 2, points: 321 }, { iso: 'GR', name: 'Greece', place: 3, points: 202 }, { iso: 'UA', name: 'Ukraine', place: 4, points: 199 }] },
  { id: 'p1', kind: 'participants', year: 2026, finished_at: '2026-05-14T20:10:00Z', http_status: 200, status: 'ok', rows_upserted: 4, error: null,
    source_url: PARSE_JOBS[0].source_url,
    rows: [{ iso: 'AT', name: 'Austria', artist: 'JJ', song: 'Wasted Love' }, { iso: 'GR', name: 'Greece', artist: 'Klavdia', song: 'Asteromata' }, { iso: 'SE', name: 'Sweden', artist: 'KAJ', song: '' }, { iso: 'UA', name: 'Ukraine', artist: 'Ziferblat', song: 'Bird of Pray' }] },
];

// CMS P6: the media library (alt per language, one image missing its Greek alt,
// one missing both), page layouts with blocks, missing translations, and a
// page whose SEO checks fail.
const media = (n: number, alt: Record<string, string>, title: string | null, extra: Record<string, unknown> = {}) => {
  const id = `${String(n).padStart(8, '0')}-6a1e-4c2e-9f10-1234567890ab`;
  return {
    id, kind: 'image', storage_path: `${id}.webp`, variant_of: null, mime: 'image/webp', bytes: 180_000 + n * 9_000,
    width: 1600, height: 900, sha256: 'a'.repeat(64), published_path: n === 1 ? '/media/0a1b2c3d4e5f.webp' : null,
    created_at: ago(60 * 24 * n), alt, title, ...extra,
  };
};
const MEDIA = [
  media(1, { en: 'The stage at the Eurovision final, lights on the crowd', el: 'Η σκηνή του τελικού της Eurovision, φώτα πάνω στο κοινό' }, 'Τελικός · σκηνή'),
  media(2, { en: 'Friends holding up score cards on the sofa' }, 'Πάρτι στο σαλόνι'),
  media(3, {}, null),
  media(4, { en: 'A phone showing the live dashboard', el: 'Ένα κινητό με τον ζωντανό πίνακα' }, 'Dashboard σε κινητό'),
  { ...media(5, {}, 'Trailer 2027'), kind: 'video', storage_path: '00000005-6a1e-4c2e-9f10-1234567890ab.mp4', mime: 'video/mp4', width: null, height: null },
];

function seedLayouts() {
  const sections = ['whatIs', 'why', 'whatsIn', 'freeNoAccount', 'ebu', 'builtBy'].map((key) => ({ type: 'section', key }));
  seedChanged('about', aboutDoc, '2026-11-22T10:02:00.000Z', (d) => {
    const blocks = (l: 'en' | 'el') => [
      sections[0],
      { type: 'callout', id: 'b-k3x9q2', tone: 'info', body: l === 'en' ? 'New for 2027: rooms open the moment the running order is out.' : 'Νέο για το 2027: τα δωμάτια ανοίγουν μόλις βγει η σειρά εμφάνισης.' },
      sections[2], sections[1],
      { type: 'text', id: 'b-7mz1pa', body: l === 'en' ? 'Two people built it, for their own Eurovision nights.' : 'Το έφτιαξαν δύο άνθρωποι, για τις δικές τους βραδιές Eurovision.' },
      sections[3], sections[5],
    ];
    d.en.layout = blocks('en');
    d.el.layout = blocks('el');
  });
  // Missing translations: three Greek fields left empty.
  seedChanged('terms', termsDoc, '2026-11-22T10:05:00.000Z', (d) => {
    d.el.hero.lede = '';
    d.el.free.title = '';
    d.el.changes.body = '';
  });
  // SEO: no H1 in English, and a block linking to a page that does not exist.
  seedChanged('privacy', privacyDoc, '2026-11-22T10:07:00.000Z', (d) => {
    d.en.hero.title = '';
    const keys = ['whatCollect', 'notCollect', 'whoHasAccess', 'rights', 'deletion', 'cookies', 'children', 'changes'].map((key) => ({ type: 'section', key }));
    d.en.layout = [...keys, { type: 'text', id: 'b-q8w2er', body: 'Questions? See [the old rules page](/rules-2019).' }];
    d.el.layout = [...keys, { type: 'text', id: 'b-q8w2er', body: 'Ερωτήσεις; Δες [την παλιά σελίδα κανόνων](/rules-2019).' }];
  });
}

function seedAdmin() {
  seedDraft('rules');
  seedLayouts();
  seedChanged('faq', faqDoc, '2026-11-22T09:52:00.000Z', (d) => {
    d.en.hero.title = 'Eurovision Games: your questions, answered';
    d.en.meta.title = 'Eurovision Games FAQ: rooms, scoring and the live show';
    d.el.hero.lede = 'Γρήγορες απαντήσεις στις ερωτήσεις που κάνουν πιο συχνά οι hosts και οι παίκτες. Οι τρεις πιο συχνές, για δημιουργία, συμμετοχή και αποχώρηση, είναι πρώτες.';
  });
  seedChanged('site-header', headerDoc, HEADER_AT, (d) => {
    d.en.cta.createRoom = 'Start a room';
    d.el.cta.createRoom = 'Ξεκίνα δωμάτιο';
  });
  seedChanged('site-footer', footerDoc, FOOTER_AT, (d) => {
    d.en.tagline = 'The party game for Eurovision night, with friends.';
  });
  seedRuns();
  setFakeFunctions({
    'publish-status': (body) => {
      const ids = (body.run_ids as number[]) ?? [];
      return { runs: PUBLISH_RUNS.filter((r) => ids.includes(r.id as number)) };
    },
    'publish-content': (body) => {
      const id = Math.max(...PUBLISH_RUNS.map((r) => r.id as number)) + 1;
      const promote = typeof body.promote === 'number' ? body.promote : null;
      const source = promote ? PUBLISH_RUNS.find((r) => r.id === promote) : null;
      PUBLISH_RUNS.unshift({
        id, status: 'ok', cms: true, files_changed: 2, error: null, started_at: ago(0), finished_at: ago(0),
        commit_sha: `9${id}c0ffee12`, deploy_state: 'building', deploy_url: null, deploy_note: null, reverted_sha: null,
        target: body.target === 'preview' ? 'preview' : 'main', promoted_from: promote,
        doc_ids: source ? source.doc_ids : (body.doc_ids as string[] | undefined) ?? null, shipped: null,
      });
      return { status: 'ok', run_id: id, sha: `9${id}c0ffee12`, files_changed: 2 };
    },
  });
  (FAKE_USER as Record<string, unknown>).email = 'owner@example.com';
  setFakeDb(
    {
      super_admins: [{ user_id: FAKE_USER.id }],
      super_admin_emails: [{ email: 'owner@example.com' }, { email: 'editor@example.com' }],
      contests: CONTESTS.map((c) => ({ ...c, semi1_date: null, semi2_date: null, game_phase: c.year === 2026 ? 'voting_live' : 'pre_night' })),
      countries: COUNTRIES,
      contest_entries: [
        entry(2025, 'AT', 'JJ', 'Wasted Love', 1),
        entry(2025, 'GR', 'Klavdia', 'Asteromata', 6),
        entry(2025, 'SE', 'KAJ', 'Bara bada bastu', 4),
        entry(2025, 'UA', 'Ziferblat', 'Bird of Pray', 9),
      ],
      rooms: [{ id: 'room-1', year: 2026, phase: 'voting_live', code: 'ABCD' }, { id: 'room-2', year: 2026, phase: 'voting_live', code: 'EFGH' }, { id: 'room-3', year: 2026, phase: 'lobby', code: 'IJKL' }],
      players: [],
      winners: [],
      parse_jobs: PARSE_JOBS,
      parse_runs: PARSE_RUNS,
      game_entries: [{ year: 2026, iso: 'AT', in_final: true }, { year: 2026, iso: 'GR', in_final: true }, { year: 2026, iso: 'SE', in_final: true }, { year: 2026, iso: 'UA', in_final: true }],
      avatars: AVATAR_ROWS,
      publish_runs: PUBLISH_RUNS,
    },
    {
      contest_summaries: () => CONTESTS,
      cms_list: () => Object.values(drafts).map((d) => ({ doc_id: d.doc_id, doc_type: d.doc_type, updated_at: d.updated_at, published: false })),
      cms_get: (a) => drafts[String(a.p_doc_id)] ?? null,
      cms_save: (a) => {
        const id = String(a.p_doc_id);
        if ((drafts[id]?.updated_at ?? null) !== (a.p_expected_updated_at ?? null)) throw { message: 'document changed by someone else; reload' };
        drafts[id] = { doc_id: id, doc_type: String(a.p_doc_type), data: a.p_data, updated_at: nextStamp() };
        return drafts[id].updated_at;
      },
      cms_history: () => HISTORY,
      cms_revision: (a) => ({ id: a.p_rev_id, doc_id: 'rules', doc_type: 'rules', kind: 'checkpoint', data: revisionData(Number(a.p_rev_id)), created_at: '', updated_at: '' }),
      cms_restore: () => nextStamp(),
      avatar_usage: () => AVATAR_USAGE,
      media_list: () => MEDIA,
      media_usage: (a) => (String(a.p_id).startsWith('00000001') ? ['about'] : String(a.p_id).startsWith('00000002') ? ['faq'] : []),
      media_set_meta: (a) => {
        const row = MEDIA.find((m) => m.id === a.p_id)!;
        const alt = Object.fromEntries(Object.entries((a.p_alt ?? {}) as Record<string, string>).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
        Object.assign(row, { alt, title: String(a.p_title ?? '').trim() || null });
        return { ...row };
      },
      avatars_reorder: () => null,
      avatar_purge: () => [],
      unpublished_summary: () => ({ changed_years: [2026], changed_docs: ['about', 'faq', 'privacy', 'site-footer', 'site-header', 'terms'], since: '2026-11-18T09:00:00Z' }),
      last_publish_run: () => PUBLISH_RUNS[0] ?? null,
      live_contest_year: () => 2026,
    },
  );
}

export function AdminGallery({ path }: { path: string }) {
  const [router] = useState(() => {
    seedAdmin();
    return createMemoryRouter(routes, { initialEntries: [path] });
  });
  return (
    <CmsRealtimeContext.Provider value={galleryChannel}>
      <PreviewTransportContext.Provider value={galleryPreview}>
        <RouterProvider router={router} />
      </PreviewTransportContext.Provider>
    </CmsRealtimeContext.Provider>
  );
}
