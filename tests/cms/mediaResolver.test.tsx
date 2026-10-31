// The preview-only media resolver: CmsImage, VideoPlayer and Blocks resolve a
// draft `cms-media/<uuid>` reference only under a MediaResolverContext
// provider (the admin preview). Without one (the public site) a draft renders
// nothing, exactly as before.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import CmsImage from '@/components/cms/CmsImage';
import VideoPlayer from '@/components/cms/VideoPlayer';
import Blocks from '@/components/cms/Blocks';
import { MediaResolverContext, isDraftMedia, type MediaResolver } from '@/components/cms/MediaResolver';
import type { CmsBlock, CmsImageValue, CmsVideoValue } from '@/components/cms/mediaTypes';

const IMG_ID = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const VID_ID = '1b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const POSTER_ID = '2b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const DRAFT_IMG = `cms-media/${IMG_ID}`;

const resolver: MediaResolver = {
  image: vi.fn((ref: string) =>
    ref === DRAFT_IMG ? { src: 'https://signed/main.webp', src800: 'https://signed/800.webp', width: 1600, height: 900 } : null),
  video: vi.fn((v) =>
    v.media === `cms-media/${VID_ID}`
      ? { src: 'https://signed/v.mp4', poster: 'https://signed/p.webp', width: 1280, height: 720, captions: 'https://signed/c.vtt' }
      : null),
};

const withResolver = (node: ReactNode, r: MediaResolver | null = resolver) => (
  <MemoryRouter><MediaResolverContext.Provider value={r}>{node}</MediaResolverContext.Provider></MemoryRouter>
);

// Draft values have no width/height (publish writes them in).
const draftImage = { media: DRAFT_IMG, alt: 'Draft stage' } as unknown as CmsImageValue;
const draftVideo = { media: `cms-media/${VID_ID}`, poster: `cms-media/${POSTER_ID}`, autoplay: false } as unknown as CmsVideoValue;

afterEach(cleanup);

describe('isDraftMedia', () => {
  it('matches cms-media/<uuid> only', () => {
    expect(isDraftMedia(DRAFT_IMG)).toBe(true);
    expect(isDraftMedia('/media/0123456789ab.webp')).toBe(false);
    expect(isDraftMedia(`CMS-MEDIA/${IMG_ID}`)).toBe(false);
    expect(isDraftMedia(`cms-media/${IMG_ID}x`)).toBe(false);
    expect(isDraftMedia(undefined)).toBe(false);
  });
});

describe('CmsImage with a resolver', () => {
  it('renders a draft through the resolver, with dimensions and the 800 w variant', () => {
    render(withResolver(<CmsImage value={draftImage} />));
    const img = screen.getByRole('img', { name: 'Draft stage' });
    expect(img).toHaveAttribute('src', 'https://signed/main.webp');
    expect(img).toHaveAttribute('srcset', 'https://signed/800.webp 800w, https://signed/main.webp 1600w');
    expect(img).toHaveAttribute('width', '1600');
    expect(img).toHaveAttribute('height', '900');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('renders nothing for a draft without a provider (the public site)', () => {
    const { container } = render(<MemoryRouter><CmsImage value={draftImage} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the resolver does not know the reference', () => {
    const { container } = render(withResolver(<CmsImage value={{ ...draftImage, media: `cms-media/${VID_ID}` }} />));
    expect(container.innerHTML).toBe('');
  });

  it('never consults the resolver for a published reference or a foreign url', () => {
    (resolver.image as ReturnType<typeof vi.fn>).mockClear();
    render(withResolver(<CmsImage value={{ media: '/media/0123456789ab.webp', alt: 'P', width: 10, height: 10 }} />));
    render(withResolver(<CmsImage value={{ media: 'https://evil.example/x.webp', alt: 'E', width: 10, height: 10 }} />));
    expect(resolver.image).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'P' })).toHaveAttribute('src', '/media/0123456789ab.webp');
    expect(screen.queryByRole('img', { name: 'E' })).toBeNull();
  });
});

describe('VideoPlayer with a resolver', () => {
  it('renders a draft with the resolved poster and reserves its space; no src before play', () => {
    const { container } = render(withResolver(<VideoPlayer value={draftVideo} />));
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('poster', 'https://signed/p.webp');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).not.toHaveAttribute('src');
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe('1280 / 720');
  });

  it('renders nothing for a draft without a provider', () => {
    const { container } = render(<MemoryRouter><VideoPlayer value={draftVideo} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the resolver cannot resolve it', () => {
    const { container } = render(withResolver(<VideoPlayer value={{ ...draftVideo, media: `cms-media/${IMG_ID}` }} />));
    expect(container.innerHTML).toBe('');
  });
});

describe('Blocks with a resolver', () => {
  const blocks = [
    { type: 'image', image: draftImage },
    { type: 'video', video: draftVideo },
  ] as CmsBlock[];

  it('renders draft image and video blocks in the preview', () => {
    const { container } = render(withResolver(<Blocks value={blocks} />));
    expect(screen.getByRole('img', { name: 'Draft stage' })).toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeNull();
  });

  it('skips them on the public site', () => {
    const { container } = render(<MemoryRouter><Blocks value={blocks} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });
});
