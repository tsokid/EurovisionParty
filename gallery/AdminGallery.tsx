// gallery/AdminGallery.tsx — the admin shell with a faked admin session
// (CMS P0). ?screen=admin&path=/admin/contests/2026 opens that admin URL in
// the real route table; every Supabase call resolves from the fixtures below
// (gallery/fakeSupabase.ts). The fake session's user is in super_admins, so
// useAdminAuth signs in without a real login. Dev only.
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../src/routeConfig';
import { FAKE_USER, setFakeDb } from './fakeSupabase';
import { IMAGE_AVATARS } from '../src/components/stage/avatars/images.generated';
import { CmsRealtimeContext, type DocChannelFactory, type DocChannelHandlers } from '../src/admin/cms/docChannel';
import rulesDoc from '../content/pages/rules.json';

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
(window as unknown as Record<string, unknown>).__cmsRemoteSave = (docId: string, mutate: (d: { en: Record<string, unknown>; el: Record<string, unknown> }) => void) => {
  const row = drafts[docId];
  if (!row) return;
  const data = JSON.parse(JSON.stringify(row.data));
  mutate(data);
  drafts[docId] = { ...row, data, updated_at: nextStamp() };
  channels.get(docId)?.onRemoteSave({ updatedAt: drafts[docId].updated_at, by: 'elena@example.com' });
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

function seedAdmin() {
  seedDraft('rules');
  (FAKE_USER as Record<string, unknown>).email = 'owner@example.com';
  setFakeDb(
    {
      super_admins: [{ user_id: FAKE_USER.id }],
      super_admin_emails: [{ email: 'owner@example.com' }, { email: 'editor@example.com' }],
      contests: CONTESTS.map((c) => ({ ...c, semi1_date: null, semi2_date: null })),
      countries: COUNTRIES,
      contest_entries: [
        entry(2025, 'AT', 'JJ', 'Wasted Love', 1),
        entry(2025, 'GR', 'Klavdia', 'Asteromata', 6),
        entry(2025, 'SE', 'KAJ', 'Bara bada bastu', 4),
        entry(2025, 'UA', 'Ziferblat', 'Bird of Pray', 9),
      ],
      rooms: [],
      players: [],
      winners: [],
      parse_jobs: [],
      parse_runs: [],
      avatars: AVATAR_ROWS,
    },
    {
      contest_summaries: () => CONTESTS,
      cms_list: () => [{ doc_id: 'faq', doc_type: 'faq', updated_at: '2026-11-20T10:00:00Z', published: false }],
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
      avatars_reorder: () => null,
      avatar_purge: () => [],
      unpublished_summary: () => ({ changed_years: [2026], changed_docs: ['faq'], since: '2026-11-18T09:00:00Z' }),
      last_publish_run: () => ({ id: 41, status: 'ok', commit_sha: '3e1f0a9c', finished_at: '2026-11-18T09:02:00Z', files_changed: 3, error: null }),
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
      <RouterProvider router={router} />
    </CmsRealtimeContext.Provider>
  );
}
