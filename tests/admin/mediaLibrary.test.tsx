// CMS P6 (088): the media library and one file's alt editor.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MediaAsset, MediaLibrary, altMissing } from '../../src/admin/modules/media/MediaLibrary';
import { __resetMediaCacheForTests, type MediaRow } from '../../src/admin/modules/pages/media/mediaApi';
import { __resetPublishedPagesForTests } from '../../src/admin/modules/pages/cmsApi';
import { ToastHost } from '../../src/admin/ui/kit';

const A = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const B = '1b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const V = '2b7c1f3e-5a4d-4c2e-9f10-1234567890ab';

const row = (id: string, extra: Partial<MediaRow> = {}): MediaRow => ({
  id, kind: 'image', storage_path: `${id}.webp`, variant_of: null, mime: 'image/webp', bytes: 2048, width: 1600, height: 900,
  sha256: 'a'.repeat(64), published_path: null, created_at: '2026-11-20T10:00:00Z', alt: {}, title: null, ...extra,
});

const h = vi.hoisted(() => ({ rows: [] as unknown[], rpc: vi.fn(), usage: [] as string[] }));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      h.rpc(name, args);
      if (name === 'media_list') return Promise.resolve({ data: h.rows, error: null });
      if (name === 'media_usage') return Promise.resolve({ data: h.usage, error: null });
      if (name === 'media_set_meta') {
        const r = (h.rows as MediaRow[]).find((x) => x.id === args.p_id)!;
        const alt = Object.fromEntries(Object.entries(args.p_alt as Record<string, string>).filter(([, v]) => v.trim()));
        Object.assign(r, { alt, title: (args.p_title as string) || null });
        return Promise.resolve({ data: { ...r }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[]) => Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${p}`, error: null })), error: null }),
      }),
    },
  },
}));

beforeEach(() => {
  __resetMediaCacheForTests();
  __resetPublishedPagesForTests();
  h.rpc.mockClear();
  h.usage = [];
  h.rows = [
    row(A, { alt: { en: 'The stage', el: 'Η σκηνή' }, title: 'Stage' }),
    row(B, { alt: { en: 'Crowd' } }),
    row(`${B.slice(0, 8)}-0000-4000-8000-000000000000`, { variant_of: B, storage_path: `${B}-800.webp`, width: 800, height: 450 }),
    row(V, { kind: 'video', storage_path: `${V}.mp4`, mime: 'video/mp4', width: null, height: null }),
  ];
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
});

const at = (path: string, el: React.ReactNode) => render(
  <MemoryRouter initialEntries={[path]}>
    <ToastHost>
      <Routes>
        <Route path="/admin/media" element={el} />
        <Route path="/admin/media/:id" element={el} />
      </Routes>
    </ToastHost>
  </MemoryRouter>,
);

describe('media library', () => {
  it('lists files (not the 800 w copies) with their alt state; «Χωρίς alt» filters to the images missing one', async () => {
    at('/admin/media', <MediaLibrary />);
    const grid = await screen.findByTestId('media-grid');
    expect(within(grid).getAllByRole('link')).toHaveLength(3);
    expect(within(grid).getByText('Stage')).toBeTruthy();
    expect(within(grid).getByText('Alt EN · EL')).toBeTruthy();
    expect(within(grid).getByText('Λείπει alt EL')).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('Μία εικόνα δεν έχει alt');
    fireEvent.click(screen.getByRole('button', { name: 'Χωρίς alt (1)' }));
    expect(within(screen.getByTestId('media-grid')).getAllByRole('link')).toHaveLength(1);
  });

  it('altMissing: images only, per language', () => {
    expect(altMissing({ kind: 'image', alt: { en: 'x', el: ' ' } })).toEqual(['el']);
    expect(altMissing({ kind: 'image', alt: null })).toEqual(['en', 'el']);
    expect(altMissing({ kind: 'video', alt: {} })).toEqual([]);
  });
});

describe('a file: the alt editor', () => {
  it('edits the alt in both languages side by side and the title; Save calls media_set_meta', async () => {
    at(`/admin/media/${B}`, <MediaAsset id={B} />);
    const el = await screen.findByLabelText('Alt (EL)');
    expect(screen.getByLabelText('Alt (EN)')).toHaveValue('Crowd');
    expect(screen.getAllByTestId('missing-dot')).toHaveLength(1);
    expect(screen.getByText(/Λείπει στα EL/)).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Αποθήκευση' });
    expect(save).toBeDisabled();
    fireEvent.change(el, { target: { value: 'Το κοινό' } });
    fireEvent.change(screen.getByLabelText('Τίτλος στη βιβλιοθήκη'), { target: { value: 'Crowd shot' } });
    fireEvent.click(save);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('media_set_meta', { p_id: B, p_alt: { en: 'Crowd', el: 'Το κοινό' }, p_title: 'Crowd shot' }));
    await waitFor(() => expect(screen.queryAllByTestId('missing-dot')).toHaveLength(0));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Crowd shot');
  });

  it('shows where it is used: saved drafts by media_usage', async () => {
    h.usage = ['about'];
    at(`/admin/media/${A}`, <MediaAsset id={A} />);
    const usage = await screen.findByTestId('media-usage');
    expect(within(usage).getByRole('link', { name: 'Σχετικά' })).toHaveAttribute('href', '/admin/pages/about');
    expect(within(usage).getByText('Πρόχειρο')).toBeTruthy();
  });

  it('an unknown id says so', async () => {
    at(`/admin/media/${'f'.repeat(8)}-0000-4000-8000-000000000000`, <MediaAsset id={`${'f'.repeat(8)}-0000-4000-8000-000000000000`} />);
    expect(await screen.findByText('Δεν υπάρχει αυτό το αρχείο στη βιβλιοθήκη.')).toBeTruthy();
  });
});
