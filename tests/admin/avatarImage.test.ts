// The avatar upload pipeline's image logic: the square crop, the preview
// background, panning, the 96/512 WebP rendering (canvas toBlob), titles from
// file names, ids, and when a purge is allowed.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AVATAR_SIZES, AVATAR_WEBP_QUALITY, cropBackground, cropRect, isUpscale, newAvatarId, panCrop, renderAvatarFiles,
  renderSquareWebp, titleFromFilename, avatarObjectNames,
} from '../../src/admin/modules/avatars/avatarImage';
import { canPurge } from '../../src/admin/modules/avatars/avatarsApi';

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }));

describe('cropRect', () => {
  it('takes the largest centred square by default', () => {
    expect(cropRect(900, 600)).toEqual({ x: 150, y: 0, side: 600 });
    expect(cropRect(400, 1000)).toEqual({ x: 0, y: 300, side: 400 });
    expect(cropRect(512, 512)).toEqual({ x: 0, y: 0, side: 512 });
  });

  it('zooms in around the centre and stays inside the image', () => {
    expect(cropRect(1000, 1000, { zoom: 2, cx: 0.5, cy: 0.5 })).toEqual({ x: 250, y: 250, side: 500 });
    // A centre near the edge is pulled back so the square stays inside.
    expect(cropRect(1000, 1000, { zoom: 2, cx: 0.95, cy: 0.02 })).toEqual({ x: 500, y: 0, side: 500 });
    // Zoom is clamped to 1..8.
    expect(cropRect(800, 800, { zoom: 0.2, cx: 0.5, cy: 0.5 }).side).toBe(800);
    expect(cropRect(800, 800, { zoom: 50, cx: 0.5, cy: 0.5 }).side).toBe(100);
  });

  it('refuses an image with no size', () => {
    expect(() => cropRect(0, 10)).toThrow();
  });
});

describe('panCrop', () => {
  it('moves the square opposite to the drag, in source pixels', () => {
    // 1000×1000 at zoom 2 → 500px square shown in a 200px frame: 1 frame px = 2.5 source px.
    const next = panCrop({ zoom: 2, cx: 0.5, cy: 0.5 }, 1000, 1000, 40, -20, 200);
    expect(cropRect(1000, 1000, next)).toEqual({ x: 150, y: 300, side: 500 });
  });

  it('stops at the image edge', () => {
    const next = panCrop({ zoom: 1, cx: 0.5, cy: 0.5 }, 900, 600, -999, 0, 200);
    expect(cropRect(900, 600, next)).toEqual({ x: 300, y: 0, side: 600 });
  });
});

describe('cropBackground', () => {
  it('maps the square onto a CSS background that fills the box', () => {
    expect(cropBackground(900, 600, { x: 150, y: 0, side: 600 })).toEqual({ size: '150% 100%', position: '50% 0%' });
    expect(cropBackground(512, 512, { x: 0, y: 0, side: 512 })).toEqual({ size: '100% 100%', position: '0% 0%' });
  });
});

describe('the 96px and 512px WebP files', () => {
  afterEach(() => vi.restoreAllMocks());

  function fakeCanvas(type = 'image/webp') {
    const drawImage = vi.fn();
    const toBlob = vi.fn((cb: (b: Blob | null) => void, t: string) => cb(new Blob(['x'], { type: type ?? t })));
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, imageSmoothingEnabled: false, imageSmoothingQuality: 'low' }), toBlob };
    const create = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas' ? canvas : document.createElementNS('http://www.w3.org/1999/xhtml', tag))) as never);
    return { canvas, drawImage, toBlob, create };
  }

  it('draws the crop square onto a size×size canvas and encodes WebP at the set quality', async () => {
    const { canvas, drawImage, toBlob } = fakeCanvas();
    const src = {} as CanvasImageSource;
    const blob = await renderSquareWebp(src, { x: 150, y: 0, side: 600 }, 96);
    expect(blob.type).toBe('image/webp');
    expect([canvas.width, canvas.height]).toEqual([96, 96]);
    expect(drawImage).toHaveBeenCalledWith(src, 150, 0, 600, 600, 0, 0, 96, 96);
    expect(toBlob.mock.calls[0].slice(1)).toEqual(['image/webp', AVATAR_WEBP_QUALITY]);
  });

  it('makes both sizes from one crop', async () => {
    const { drawImage } = fakeCanvas();
    const files = await renderAvatarFiles({} as CanvasImageSource, 900, 600, { zoom: 1, cx: 0.5, cy: 0.5 });
    expect(files.thumb.type).toBe('image/webp');
    expect(drawImage.mock.calls.map((c) => c.slice(-2))).toEqual([[AVATAR_SIZES.thumb, AVATAR_SIZES.thumb], [AVATAR_SIZES.full, AVATAR_SIZES.full]]);
  });

  it('refuses a browser that silently encodes PNG instead of WebP', async () => {
    fakeCanvas('image/png');
    await expect(renderSquareWebp({} as CanvasImageSource, { x: 0, y: 0, side: 10 }, 96)).rejects.toThrow(/WebP/);
  });

  it('flags a crop under 512px (the full file would be blown up)', () => {
    expect(isUpscale(400, 300)).toBe(true);
    expect(isUpscale(1200, 900)).toBe(false);
    expect(isUpscale(1200, 900, { zoom: 2, cx: 0.5, cy: 0.5 })).toBe(true);
  });

  it('names the bucket objects after the id', () => {
    expect(avatarObjectNames('up-abc')).toEqual({ thumb: 'up-abc-96.webp', full: 'up-abc-512.webp' });
  });
});

describe('titles and ids', () => {
  it('titles a file by its name', () => {
    expect(titleFromFilename('disco-queen_02.final.PNG')).toBe('Disco Queen 02 Final');
    expect(titleFromFilename('Ντίβα της νύχτας.webp')).toBe('Ντίβα της νύχτας');
    expect(titleFromFilename('.png')).toBe('Νέο avatar');
    expect(titleFromFilename(`${'a'.repeat(80)}.png`)).toHaveLength(60);
  });

  it('makes ids the table accepts', () => {
    const id = newAvatarId(() => '6F1C2A9E-1234-4000-8000-ABCDEF012345');
    expect(id).toBe('up-6f1c2a9e1234');
    expect(id).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
  });
});

describe('purge rule', () => {
  const now = Date.parse('2026-12-31T00:00:00Z');
  it('only for deleted avatars: at once when unused, after 30 days when used', () => {
    expect(canPurge({ deleted_at: null }, 0, now)).toBe(false);
    expect(canPurge({ deleted_at: '2026-12-30T00:00:00Z' }, 0, now)).toBe(true);
    expect(canPurge({ deleted_at: '2026-12-30T00:00:00Z' }, 3, now)).toBe(false);
    expect(canPurge({ deleted_at: '2026-11-30T00:00:00Z' }, 3, now)).toBe(true);
  });
});
