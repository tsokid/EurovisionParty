// Client-side media upload (spec §7 "Media upload"): resize to WebP in the
// browser, SHA-256, Storage upload, media_register — with canvas,
// createImageBitmap, crypto.subtle and Supabase mocked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  calls: [] as string[],
  rpc: vi.fn(),
  upload: vi.fn(),
  failUpload: null as string | null,
  failRpc: null as string | null,
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      h.calls.push(`rpc:${name}:${String(args.p_storage_path ?? '')}`);
      h.rpc(name, args);
      if (h.failRpc && String(args.p_storage_path).includes(h.failRpc)) {
        return Promise.resolve({ data: null, error: { message: 'media x already registered' } });
      }
      return Promise.resolve({ data: (args.p_id as string | null) ?? 'generated-variant-id', error: null });
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, body: Blob, opts: unknown) => {
          h.calls.push(`upload:${bucket}/${path}`);
          h.upload(path, body, opts);
          if (h.failUpload && path.includes(h.failUpload)) return Promise.resolve({ data: null, error: { message: 'storage down' } });
          return Promise.resolve({ data: { path }, error: null });
        },
      }),
    },
  },
}));

import { encodeWebp, sha256Hex, WEBP_QUALITY } from '../../src/admin/modules/pages/media/imageResize';
import {
  IMAGE_INPUT_MAX_BYTES, IMAGE_OUTPUT_MAX_BYTES, VIDEO_MAX_BYTES, uploadCaptions, uploadImage, uploadVideo,
} from '../../src/admin/modules/pages/media/upload';

const UUID = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const HASH = 'ab'.repeat(32);

let source = { width: 3000, height: 2000 };
let outputType = 'image/webp';
/** Bytes of each encoded blob: by default its width (so sizes are checkable). */
let outputBytes = (w: number) => w;
const toBlobArgs: Array<{ type?: string; quality?: unknown; width: number; height: number }> = [];
const drawn: Array<[number, number]> = [];
const closed = vi.fn();

beforeEach(() => {
  h.calls.length = 0;
  h.rpc.mockReset();
  h.upload.mockReset();
  h.failUpload = null;
  h.failRpc = null;
  source = { width: 3000, height: 2000 };
  outputType = 'image/webp';
  outputBytes = (w) => w;
  toBlobArgs.length = 0;
  drawn.length = 0;
  closed.mockReset();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ ...source, close: closed })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ drawImage: (_b: unknown, _x: number, _y: number, w: number, hh: number) => drawn.push([w, hh]), imageSmoothingQuality: 'low' }) as never,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback, type?: string, quality?: unknown) {
    toBlobArgs.push({ type, quality, width: this.width, height: this.height });
    cb(new Blob([new Uint8Array(outputBytes(this.width))], { type: outputType }));
  });
  vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const png = (bytes = 1000, type = 'image/png', name = 'stage.png') => new File([new Uint8Array(bytes)], name, { type });

describe('encodeWebp (resize)', () => {
  it('scales to the target width keeping the aspect ratio, WebP at quality 0.82', async () => {
    const bitmap = await createImageBitmap(new Blob());
    const out = await encodeWebp(bitmap, 1600);
    expect(out).toMatchObject({ width: 1600, height: 1067 });
    expect(out.blob.type).toBe('image/webp');
    expect(toBlobArgs[0]).toEqual({ type: 'image/webp', quality: WEBP_QUALITY, width: 1600, height: 1067 });
    expect(WEBP_QUALITY).toBe(0.82);
    expect(drawn[0]).toEqual([1600, 1067]);
  });

  it('never upscales: a narrower source keeps its own size', async () => {
    source = { width: 640, height: 480 };
    const bitmap = await createImageBitmap(new Blob());
    expect(await encodeWebp(bitmap, 1600)).toMatchObject({ width: 640, height: 480 });
    expect(await encodeWebp(bitmap, 800)).toMatchObject({ width: 640, height: 480 });
  });

  it('refuses a browser that cannot encode WebP (toBlob falls back to PNG)', async () => {
    outputType = 'image/png';
    const bitmap = await createImageBitmap(new Blob());
    await expect(encodeWebp(bitmap, 800)).rejects.toThrow(/WebP/);
  });
});

describe('sha256Hex', () => {
  it('hex-encodes crypto.subtle SHA-256 of the bytes', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    expect(await sha256Hex(blob)).toBe(HASH);
    expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.anything());
  });
});

describe('uploadImage', () => {
  it('uploads and registers the main file, then the 800 w variant, in that order', async () => {
    const ref = await uploadImage(png());
    expect(ref).toBe(`cms-media/${UUID}`);
    expect(h.calls).toEqual([
      `upload:cms-media/${UUID}.webp`,
      `rpc:media_register:${UUID}.webp`,
      `upload:cms-media/${UUID}-800.webp`,
      `rpc:media_register:${UUID}-800.webp`,
    ]);
    expect(h.upload.mock.calls[0][2]).toEqual({ contentType: 'image/webp', upsert: false });
    expect(h.rpc.mock.calls[0][1]).toEqual({
      p_id: UUID, p_kind: 'image', p_storage_path: `${UUID}.webp`, p_mime: 'image/webp',
      p_bytes: 1600, p_width: 1600, p_height: 1067, p_sha256: HASH, p_variant_of: null,
    });
    expect(h.rpc.mock.calls[1][1]).toEqual({
      p_id: null, p_kind: 'image', p_storage_path: `${UUID}-800.webp`, p_mime: 'image/webp',
      p_bytes: 800, p_width: 800, p_height: 533, p_sha256: HASH, p_variant_of: UUID,
    });
    expect(closed).toHaveBeenCalled();
  });

  it('a small source still gets both files, each at its actual size', async () => {
    source = { width: 500, height: 300 };
    await uploadImage(png());
    expect(h.rpc.mock.calls.map(([, a]) => [a.p_storage_path, a.p_width, a.p_height])).toEqual([
      [`${UUID}.webp`, 500, 300],
      [`${UUID}-800.webp`, 500, 300],
    ]);
  });

  it('refuses a non-image, an input over 15 MB, and an output over 2 MB', async () => {
    await expect(uploadImage(png(10, 'video/mp4', 'x.mp4'))).rejects.toThrow(/not an image/i);
    await expect(uploadImage(png(IMAGE_INPUT_MAX_BYTES + 1))).rejects.toThrow(/15 MB/);
    outputBytes = (w) => (w > 1000 ? IMAGE_OUTPUT_MAX_BYTES + 1 : 10);
    await expect(uploadImage(png())).rejects.toThrow(/2 MB/);
    expect(h.calls).toEqual([]);
  });

  it('an image the browser cannot decode is a clear error', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode failed'); }));
    await expect(uploadImage(png())).rejects.toThrow(/Could not read stage\.png/);
  });

  it.each([
    ['uploading the main image', `${UUID}.webp`, 'upload', 1],
    ['registering the main image', `${UUID}.webp`, 'rpc', 2],
    ['uploading the 800 px copy', `${UUID}-800.webp`, 'upload', 3],
    ['registering the 800 px copy', `${UUID}-800.webp`, 'rpc', 4],
  ])('stops with a clear error when %s fails', async (step, path, kind, steps) => {
    if (kind === 'upload') h.failUpload = path;
    else h.failRpc = path;
    await expect(uploadImage(png())).rejects.toThrow(new RegExp(`stage\\.png.*${step}`));
    expect(h.calls).toHaveLength(steps);
  });
});

describe('uploadVideo', () => {
  const mp4 = (bytes = 1000, type = 'video/mp4', name = 'clip.mp4') => new File([new Uint8Array(bytes)], name, { type });

  it('uploads <uuid>.mp4 and registers it without dimensions', async () => {
    expect(await uploadVideo(mp4())).toBe(`cms-media/${UUID}`);
    expect(h.calls).toEqual([`upload:cms-media/${UUID}.mp4`, `rpc:media_register:${UUID}.mp4`]);
    expect(h.upload.mock.calls[0][2]).toEqual({ contentType: 'video/mp4', upsert: false });
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_id: UUID, p_kind: 'video', p_mime: 'video/mp4', p_bytes: 1000, p_width: null, p_height: null, p_sha256: HASH, p_variant_of: null });
  });

  it('refuses another type and a file over 20 MB', async () => {
    await expect(uploadVideo(mp4(10, 'video/webm', 'clip.webm'))).rejects.toThrow(/MP4/);
    await expect(uploadVideo(mp4(VIDEO_MAX_BYTES + 1))).rejects.toThrow(/20 MB/);
    expect(h.calls).toEqual([]);
  });
});

describe('uploadCaptions', () => {
  const vtt = (text: string, name = 'subs.vtt', type = '') => new File([text], name, { type });

  it('uploads a WebVTT file as text/vtt (browsers often give .vtt no type)', async () => {
    expect(await uploadCaptions(vtt('WEBVTT\n\n00:00.000 --> 00:01.000\nHi'))).toBe(`cms-media/${UUID}`);
    expect(h.upload.mock.calls[0][0]).toBe(`${UUID}.vtt`);
    expect(h.upload.mock.calls[0][2]).toEqual({ contentType: 'text/vtt', upsert: false });
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_kind: 'captions', p_mime: 'text/vtt' });
  });

  it('refuses a file that is not WebVTT', async () => {
    await expect(uploadCaptions(vtt('1\n00:00:00,000 --> 00:00:01,000\nHi', 'subs.srt'))).rejects.toThrow(/WebVTT/);
    await expect(uploadCaptions(vtt('hello', 'subs.vtt'))).rejects.toThrow(/WebVTT/);
  });
});
