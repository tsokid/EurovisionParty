import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import CmsImage from '@/components/cms/CmsImage';
import VideoPlayer from '@/components/cms/VideoPlayer';
import Blocks from '@/components/cms/Blocks';
import { faqEntries } from '@/components/cms/faqEntries';
import { LocaleProvider } from '@/lib/seo/LocaleContext';
import type { Locale } from '@/lib/seo/locale';
import type { CmsBlock } from '@/components/cms/mediaTypes';

const at = (node: ReactNode, locale: Locale = 'en') => (
  <MemoryRouter><LocaleProvider locale={locale}>{node}</LocaleProvider></MemoryRouter>
);

const IMG = { media: '/media/0123456789ab.webp', alt: 'A stage', width: 1600, height: 900 };
const VID = {
  media: '/media/aaaaaaaaaaaa.mp4', poster: '/media/bbbbbbbbbbbb.webp', captions: '/media/cccccccccccc.vtt',
  autoplay: false, width: 1280, height: 720,
};

afterEach(cleanup);

describe('CmsImage', () => {
  it('renders dimensions, lazy loading, async decoding and an 800w srcset', () => {
    render(<CmsImage value={IMG} />);
    const img = screen.getByRole('img', { name: 'A stage' });
    expect(img).toHaveAttribute('src', '/media/0123456789ab.webp');
    expect(img).toHaveAttribute('srcset', '/media/0123456789ab-800.webp 800w, /media/0123456789ab.webp 1600w');
    expect(img).toHaveAttribute('sizes');
    expect(img).toHaveAttribute('width', '1600');
    expect(img).toHaveAttribute('height', '900');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).not.toHaveAttribute('fetchpriority');
  });

  it('narrow sources get a single candidate (no duplicate descriptors)', () => {
    for (const width of [500, 800]) {
      const { container } = render(<CmsImage value={{ ...IMG, width }} />);
      const img = container.querySelector('img')!;
      expect(img).not.toHaveAttribute('srcset');
      expect(img).not.toHaveAttribute('sizes');
      expect(img).toHaveAttribute('src', '/media/0123456789ab.webp');
      cleanup();
    }
    const { container } = render(<CmsImage value={{ ...IMG, width: 801 }} />);
    expect(container.querySelector('img')).toHaveAttribute('srcset', '/media/0123456789ab-800.webp 800w, /media/0123456789ab.webp 801w');
  });

  it('hero is eager with high fetch priority', () => {
    render(<CmsImage value={IMG} hero />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  it('renders nothing for a draft reference, a foreign url or a missing size', () => {
    for (const media of ['cms-media/00000000-0000-0000-0000-000000000000', 'https://evil.example/a.webp', '//evil.example/a.webp', '/media/0123456789ab.mp4']) {
      const { container } = render(<CmsImage value={{ ...IMG, media }} />);
      expect(container).toBeEmptyDOMElement();
    }
    const { container } = render(<CmsImage value={{ ...IMG, width: 0 }} />);
    expect(container).toBeEmptyDOMElement();
    const r = render(<CmsImage value={undefined as never} />);
    expect(r.container).toBeEmptyDOMElement();
  });
});

describe('VideoPlayer', () => {
  let play: ReturnType<typeof vi.fn>;
  let pause: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    play = vi.fn(function (this: HTMLVideoElement) { Object.defineProperty(this, 'paused', { configurable: true, value: false }); fireEvent.play(this); return Promise.resolve(); });
    pause = vi.fn(function (this: HTMLVideoElement) { Object.defineProperty(this, 'paused', { configurable: true, value: true }); fireEvent.pause(this); });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
  });
  afterEach(() => vi.unstubAllGlobals());

  const video = (c: HTMLElement) => c.querySelector('video') as HTMLVideoElement;

  it('shows the poster, preload none and requests no media before play', () => {
    const { container } = render(at(<VideoPlayer value={VID} />));
    const v = video(container);
    expect(v).toHaveAttribute('preload', 'none');
    expect(v).toHaveAttribute('poster', '/media/bbbbbbbbbbbb.webp');
    expect(v).not.toHaveAttribute('src');
    expect(container.querySelector('source, track')).toBeNull();
    expect(v).not.toHaveAttribute('autoplay');
    expect(container.firstElementChild).toHaveStyle({ aspectRatio: '1280 / 720' });
  });

  it('loads the source and plays on the play button, then pauses', () => {
    const { container } = render(at(<VideoPlayer value={VID} />));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(video(container)).toHaveAttribute('src', '/media/aaaaaaaaaaaa.mp4');
    expect(container.querySelector('track')).toHaveAttribute('src', '/media/cccccccccccc.vtt');
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('operates from the keyboard (space and k on the player)', () => {
    render(at(<VideoPlayer value={VID} />));
    const group = screen.getByRole('group');
    group.focus();
    fireEvent.keyDown(group, { key: ' ' });
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(group, { key: 'k' });
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('has labelled mute and progress controls, in the page language', () => {
    render(at(<VideoPlayer value={VID} />, 'el'));
    expect(screen.getByRole('button', { name: 'Αναπαραγωγή' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Σίγαση' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Πρόοδος' })).toBeInTheDocument();
  });

  it('mute toggles the element', () => {
    const { container } = render(at(<VideoPlayer value={VID} />));
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(video(container).muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
  });

  it('autoplay waits for visibility, plays muted and pauses when hidden', () => {
    let cb: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(c: IntersectionObserverCallback) { cb = c; }
      observe() {}
      disconnect = disconnect;
    });
    const { container, unmount } = render(at(<VideoPlayer value={{ ...VID, autoplay: true }} />));
    const v = video(container);
    expect(v.muted).toBe(true);
    expect(v).toHaveAttribute('loop');
    expect(v).toHaveAttribute('playsinline');
    expect(v).not.toHaveAttribute('src');
    expect(play).not.toHaveBeenCalled();
    act(() => cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(v).toHaveAttribute('src', '/media/aaaaaaaaaaaa.mp4');
    expect(play).toHaveBeenCalledTimes(1);
    act(() => cb([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(pause).toHaveBeenCalledTimes(1);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('never observes or autoplays without the flag', () => {
    vi.stubGlobal('IntersectionObserver', class { constructor() { throw new Error('should not observe'); } });
    expect(() => render(at(<VideoPlayer value={VID} />))).not.toThrow();
    expect(play).not.toHaveBeenCalled();
  });

  it('does nothing when IntersectionObserver is missing (autoplay stays off)', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(at(<VideoPlayer value={{ ...VID, autoplay: true }} />));
    expect(play).not.toHaveBeenCalled();
  });

  it('renders nothing for draft or foreign references', () => {
    for (const bad of [{ ...VID, media: 'cms-media/x' }, { ...VID, poster: 'cms-media/y' }, { ...VID, media: '/media/aaaaaaaaaaaa.webp' }]) {
      const { container } = render(at(<VideoPlayer value={bad} />));
      expect(container).toBeEmptyDOMElement();
    }
  });

  it('renders nothing without width or height; a bad captions ref renders without a track', () => {
    for (const bad of [{ ...VID, width: undefined }, { ...VID, height: 0 }]) {
      expect(render(at(<VideoPlayer value={bad as never} />)).container).toBeEmptyDOMElement();
      cleanup();
    }
    const { container } = render(at(<VideoPlayer value={{ ...VID, captions: 'cms-media/x' }} />));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(video(container)).toBeTruthy();
    expect(container.querySelector('track')).toBeNull();
  });

  it('renders on the server (no window, no IntersectionObserver needed)', () => {
    const html = renderToString(at(<VideoPlayer value={{ ...VID, autoplay: true }} />));
    expect(html).toContain('preload="none"');
    expect(html).not.toContain('src="/media/aaaaaaaaaaaa.mp4"');
  });
});

const BLOCKS: CmsBlock[] = [
  { type: 'text', body: 'Hello **world**' },
  { type: 'callout', tone: 'warn', body: 'Careful' },
  { type: 'image', image: IMG, caption: 'Stage caption' },
  { type: 'video', video: VID, caption: 'Video caption' },
  { type: 'faq', items: [{ q: 'Why?', a: 'Because [rules](/rules) and **more**.\n\n- one\n- two' }] },
  { type: 'cta', title: 'Join', body: 'Come along', label: 'Go', href: '/play' },
];

describe('Blocks', () => {
  it('renders every block type', () => {
    const { container } = render(at(<Blocks value={BLOCKS} />));
    expect(screen.getByText('world').tagName).toBe('STRONG');
    expect(screen.getByRole('note')).toHaveTextContent('Careful');
    expect(screen.getByRole('img', { name: 'A stage' })).toBeInTheDocument();
    expect(screen.getByText('Stage caption').closest('figure')).toBeTruthy();
    expect(container.querySelector('video')).toBeTruthy();
    expect(screen.getByText('Video caption')).toBeInTheDocument();
    expect(screen.getByText('Why?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Join' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/en/play');
  });

  it('cta external link opens safely; unsafe href renders no link', () => {
    render(at(<Blocks value={[
      { type: 'cta', title: 'T', body: 'B', label: 'Ext', href: 'https://example.com/x' },
      { type: 'cta', title: 'U', body: 'B', label: 'Bad', href: 'javascript:alert(1)' },
    ]} />));
    const ext = screen.getByRole('link', { name: 'Ext' });
    expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
    expect(ext).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('link', { name: 'Bad' })).toBeNull();
  });

  it('draft media renders nothing but keeps the rest', () => {
    const draft = { type: 'image', image: { ...IMG, media: 'cms-media/x' }, caption: 'cap' } as unknown as CmsBlock;
    const { container } = render(at(<Blocks value={[draft, BLOCKS[0]]} />));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText('cap')).toBeNull();
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('skips unknown block types and renders nothing for empty or missing value', () => {
    const { container } = render(at(<Blocks value={[{ type: 'mystery' } as never]} />));
    expect(container).toBeEmptyDOMElement();
    expect(render(at(<Blocks value={undefined as never} />)).container).toBeEmptyDOMElement();
  });

  it('reports FAQ entries as plain text through onFaq', () => {
    const onFaq = vi.fn();
    render(at(<Blocks value={BLOCKS} onFaq={onFaq} />));
    expect(onFaq).toHaveBeenCalledWith([{ q: 'Why?', a: 'Because rules and more. one two' }]);
  });

  it('an inline onFaq that sets state does not loop', () => {
    let renders = 0;
    function Host() {
      const [, setN] = useState(0);
      renders++;
      // Always-changing update: re-notifying on every render would loop forever.
      return <Blocks value={BLOCKS} onFaq={() => setN((n) => n + 1)} />;
    }
    render(at(<Host />));
    expect(renders).toBeLessThan(5);
  });

  it('tolerates null and non-string faq items', () => {
    const bad = { type: 'faq', items: [null, { q: 5, a: 'x' }, { q: 'ok', a: null }] } as unknown as CmsBlock;
    expect(() => render(at(<Blocks value={[bad]} />))).not.toThrow();
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('faqEntries is the pure SSR-safe form and skips empty pairs', () => {
    expect(faqEntries(BLOCKS)).toEqual([{ q: 'Why?', a: 'Because rules and more. one two' }]);
    expect(faqEntries([{ type: 'faq', items: [{ q: '', a: 'x' }, { q: 'q', a: '' }] }])).toEqual([]);
    expect(faqEntries(undefined as never)).toEqual([]);
  });

  it('renders on the server', () => {
    const html = renderToString(at(<Blocks value={BLOCKS} />));
    expect(html).toContain('Stage caption');
    expect(html).toContain('<video');
  });
});
