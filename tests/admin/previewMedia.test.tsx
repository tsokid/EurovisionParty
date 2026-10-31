// The admin preview resolves draft media references (cms-media/<uuid>) to
// signed URLs, with the dimensions stored by media_list; the public
// components render them only under this resolver.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactNode } from 'react';
import CmsImage from '../../src/components/cms/CmsImage';
import VideoPlayer from '../../src/components/cms/VideoPlayer';
import { MediaResolverContext } from '../../src/components/cms/MediaResolver';
import type { CmsImageValue, CmsVideoValue } from '../../src/components/cms/mediaTypes';
import { createMediaResolver, usePreviewMediaResolver } from '../../src/admin/modules/pages/media/previewResolver';
import { indexRows } from '../../src/admin/modules/pages/media/useMediaInfo';
import { __resetMediaCacheForTests, type MediaRow } from '../../src/admin/modules/pages/media/mediaApi';
import PreviewPane from '../../src/admin/modules/pages/PreviewPane';
import { bundledContent } from '../../src/lib/seo/contentData';

const IMG = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const VID = '2b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const VTT = '3b7c1f3e-5a4d-4c2e-9f10-1234567890ab';

const row = (id: string, kind: MediaRow['kind'], path: string, extra: Partial<MediaRow> = {}): MediaRow => ({
  id, kind, storage_path: path, variant_of: null, mime: '', bytes: 100, width: null, height: null,
  sha256: 'a'.repeat(64), published_path: null, created_at: '2026-10-31T10:00:00Z', ...extra,
});

const ROWS: MediaRow[] = [
  row(IMG, 'image', `${IMG}.webp`, { width: 1600, height: 900 }),
  row('variant', 'image', `${IMG}-800.webp`, { variant_of: IMG, width: 800, height: 450 }),
  row(VID, 'video', `${VID}.mp4`),
  row(VTT, 'captions', `${VTT}.vtt`),
  row('pub', 'image', 'pub.webp', { width: 640, height: 360, published_path: '/media/0123456789ab.webp' }),
];

const h = vi.hoisted(() => ({ rpc: vi.fn(), signed: vi.fn() }));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: (name: string, args: unknown) => {
      h.rpc(name, args);
      return Promise.resolve({ data: name === 'media_list' ? ROWS : null, error: null });
    },
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[]) => {
          h.signed(paths);
          return Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${p}`, error: null })), error: null });
        },
      }),
    },
  },
}));

beforeEach(() => {
  __resetMediaCacheForTests();
  h.rpc.mockReset();
  h.signed.mockReset();
});

const urls = Object.fromEntries(ROWS.map((r) => [r.storage_path, `https://signed.test/${r.storage_path}`]));
const resolver = createMediaResolver({ ...indexRows(ROWS), urls, error: null, ready: true });

describe('createMediaResolver', () => {
  it('resolves a draft image to its signed URLs and stored size', () => {
    expect(resolver.image(`cms-media/${IMG}`)).toEqual({
      src: `https://signed.test/${IMG}.webp`, src800: `https://signed.test/${IMG}-800.webp`, width: 1600, height: 900,
    });
  });

  it('refuses unknown ids, variants and rows of another kind', () => {
    expect(resolver.image('cms-media/ffffffff-5a4d-4c2e-9f10-1234567890ab')).toBeNull();
    expect(resolver.image(`cms-media/${VID}`)).toBeNull();
  });

  it('resolves a video from its draft files; the poster gives the size', () => {
    expect(resolver.video({ media: `cms-media/${VID}`, poster: `cms-media/${IMG}`, captions: `cms-media/${VTT}` })).toEqual({
      src: `https://signed.test/${VID}.mp4`, poster: `https://signed.test/${IMG}.webp`, width: 1600, height: 900,
      captions: `https://signed.test/${VTT}.vtt`,
    });
  });

  it('a published poster takes its size from the row that published it', () => {
    expect(resolver.video({ media: `cms-media/${VID}`, poster: '/media/0123456789ab.webp' })).toEqual({
      src: `https://signed.test/${VID}.mp4`, poster: '/media/0123456789ab.webp', width: 640, height: 360,
    });
  });

  it('a video without a resolvable poster or file is not shown', () => {
    expect(resolver.video({ media: `cms-media/${VID}`, poster: '' })).toBeNull();
    expect(resolver.video({ media: `cms-media/${IMG}`, poster: `cms-media/${IMG}` })).toBeNull();
  });
});

function Preview({ doc, children }: { doc: unknown; children: ReactNode }) {
  return <MediaResolverContext.Provider value={usePreviewMediaResolver(doc)}>{children}</MediaResolverContext.Provider>;
}

describe('usePreviewMediaResolver', () => {
  it('loads the library and signs the referenced files only, then renders them', async () => {
    const image = { media: `cms-media/${IMG}`, alt: 'Stage' } as unknown as CmsImageValue;
    const video = { media: `cms-media/${VID}`, poster: `cms-media/${IMG}`, autoplay: false } as unknown as CmsVideoValue;
    const { container } = render(
      <Preview doc={{ en: { a: image, b: video }, el: {} }}>
        <CmsImage value={image} />
        <VideoPlayer value={video} />
      </Preview>,
    );
    expect(await screen.findByRole('img', { name: 'Stage' })).toHaveAttribute('src', `https://signed.test/${IMG}.webp`);
    await waitFor(() => expect(container.querySelector('video')).toHaveAttribute('poster', `https://signed.test/${IMG}.webp`));
    expect(h.rpc).toHaveBeenCalledWith('media_list', { p_kind: null });
    expect(h.signed.mock.calls.flat(2).sort()).toEqual([`${IMG}-800.webp`, `${IMG}.webp`, `${VID}.mp4`]);
  });
});

describe('PreviewPane', () => {
  function inAdmin(ui: ReactNode) {
    const router = createMemoryRouter([{ path: '/admin', element: <div>{ui}</div> }], { initialEntries: ['/admin'] });
    return render(<RouterProvider router={router} />);
  }
  const about = () => JSON.parse(JSON.stringify(bundledContent('pages/about.json'))) as { en: Record<string, unknown>; el: Record<string, unknown> };

  it('reads the media library for a draft that references media', async () => {
    const doc = about();
    doc.en.extra = { media: `cms-media/${IMG}` }; // any reference anywhere in the draft
    inAdmin(<PreviewPane docId="about" doc={doc} />);
    await waitFor(() => expect(h.signed).toHaveBeenCalledWith([`${IMG}.webp`, `${IMG}-800.webp`]));
  });

  it('touches neither the library nor Storage for a draft without media', () => {
    inAdmin(<PreviewPane docId="about" doc={about()} />);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.signed).not.toHaveBeenCalled();
  });
});
