// @vitest-environment node
// publish-content: CMS media. Drafts reference uploads as cms-media/<uuid>;
// publish downloads each (Storage mocked), checks its sha256, commits it to
// public/media/<sha12>.<ext> as a binary blob and rewrites the reference to
// /media/<sha12>.<ext> (images and video posters get width and height).
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { blocks, group, image, mediaRef, optional, text } from '../../supabase/functions/_shared/cms/fields';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import {
  collectMediaRefs, collectRegisteredPaths, MEDIA_MAX_NEW_BYTES, MediaError, publishMedia, sweepStorage, SWEEP_MIN_AGE_MS, type MediaRow,
} from '../../supabase/functions/publish-content/media';
import { runPublish, type PublishDeps } from '../../supabase/functions/publish-content/run';
import { commitFiles as realCommitFiles, gitBlobSha, type FileTransforms } from '../../supabase/functions/publish-content/github';
import { stableJson, type CmsDocumentRow, type SnapshotInput } from '../../supabase/functions/publish-content/snapshot';
import { generatedRedirects, mergeVercelRedirects } from '../../supabase/functions/publish-content/redirects';
import { isPublishedMedia } from '../../src/components/cms/mediaTypes';
import type { ContestRow } from '../../src/content/contests/types';

const DOC = 'zz-media-test';
const schema = group({
  hero: image(),
  zone: blocks(),
  thumb: optional(mediaRef('image')),
  note: optional(text()),
});

beforeAll(() => {
  CMS_DOC_TYPES[DOC] = { schema, label: 'Media test', group: 'site' };
});
afterAll(() => {
  delete CMS_DOC_TYPES[DOC];
});

const fixture = (name: string) => new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/functions/fixtures', name)));
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

const IMG = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const IMG_V = '0b7c1f3e-5a4d-4c2e-9f10-0000000000aa';
const POSTER = '1b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const POSTER_V = '1b7c1f3e-5a4d-4c2e-9f10-0000000000bb';
const VID = '2b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const VTT = '3b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const MISSING = 'ffffffff-5a4d-4c2e-9f10-1234567890ab';

/** Storage: object name → bytes. */
const storage: Record<string, Uint8Array> = {
  [`${IMG}.webp`]: fixture('pixel.webp'),
  [`${IMG}-800.webp`]: fixture('pixel.png'),
  [`${POSTER}.webp`]: new TextEncoder().encode('poster-1600'),
  [`${POSTER}-800.webp`]: new TextEncoder().encode('poster-800'),
  [`${VID}.mp4`]: new TextEncoder().encode('mp4 bytes'),
  [`${VTT}.vtt`]: new TextEncoder().encode('WEBVTT\n'),
};

function mrow(id: string, kind: MediaRow['kind'], storage_path: string, extra: Partial<MediaRow> = {}): MediaRow {
  const bytes = storage[storage_path];
  return {
    id, kind, storage_path, variant_of: null,
    mime: kind === 'image' ? 'image/webp' : kind === 'video' ? 'video/mp4' : 'text/vtt',
    bytes: bytes.byteLength, sha256: sha256(bytes), published_path: null,
    width: kind === 'image' ? 1600 : null, height: kind === 'image' ? 900 : null,
    ...extra,
  };
}

const rows: MediaRow[] = [
  mrow(IMG, 'image', `${IMG}.webp`),
  mrow(IMG_V, 'image', `${IMG}-800.webp`, { variant_of: IMG, width: 800, height: 450 }),
  mrow(POSTER, 'image', `${POSTER}.webp`, { width: 1280, height: 720 }),
  mrow(POSTER_V, 'image', `${POSTER}-800.webp`, { variant_of: POSTER, width: 800, height: 450 }),
  mrow(VID, 'video', `${VID}.mp4`),
  mrow(VTT, 'captions', `${VTT}.vtt`),
];

const sha12 = (path: string) => sha256(storage[path]).slice(0, 12);
const IMG_SHA = sha12(`${IMG}.webp`);
const POSTER_SHA = sha12(`${POSTER}.webp`);
const VID_SHA = sha12(`${VID}.mp4`);
const VTT_SHA = sha12(`${VTT}.vtt`);

const ref = (id: string) => `cms-media/${id}`;

function locale(alt: string) {
  return {
    hero: { media: ref(IMG), alt },
    zone: [
      { type: 'text', body: 'Hello' },
      { type: 'video', video: { media: ref(VID), poster: ref(POSTER), captions: ref(VTT), autoplay: true } },
      { type: 'image', image: { media: ref(IMG), alt } },
    ],
    thumb: ref(POSTER),
  };
}

const draft = (data: unknown = { en: locale('Stage'), el: locale('Σκηνή') }): CmsDocumentRow =>
  ({ doc_id: DOC, doc_type: DOC, data: data as CmsDocumentRow['data'] });

const download = vi.fn(async (path: string) => {
  const b = storage[path];
  if (!b) throw new Error(`Object not found: ${path}`);
  return b;
});

async function thrown(p: Promise<unknown>): Promise<MediaError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(MediaError);
    return e as MediaError;
  }
  throw new Error('expected a MediaError');
}

describe('collectMediaRefs', () => {
  it('finds every cms-media/<uuid> of a draft by schema walk, with its doc_id, path and field kind (only the block variant each value names)', () => {
    expect(collectMediaRefs([draft()])).toEqual([
      { doc_id: DOC, path: 'hero.media', id: IMG, kind: 'image' },
      { doc_id: DOC, path: 'zone.1.video.media', id: VID, kind: 'video' },
      { doc_id: DOC, path: 'zone.1.video.poster', id: POSTER, kind: 'image' },
      { doc_id: DOC, path: 'zone.1.video.captions', id: VTT, kind: 'captions' },
      { doc_id: DOC, path: 'zone.2.image.media', id: IMG, kind: 'image' },
      { doc_id: DOC, path: 'thumb', id: POSTER, kind: 'image' },
    ]);
  });

  it('ignores published /media/ references and strings outside mediaRef fields', () => {
    const d = { en: locale('A'), el: locale('B') };
    for (const l of [d.en, d.el]) {
      l.hero.media = `/media/${IMG_SHA}.webp`;
      l.zone = [{ type: 'text', body: ref(IMG) } as never];
      delete (l as { thumb?: string }).thumb;
    }
    expect(collectMediaRefs([draft(d)])).toEqual([]);
  });
});

describe('publishMedia', () => {
  it('commits each file at public/media/<sha12 of its bytes>.<ext>; the 800 w variant beside its image as <sha12 of the image>-800.webp', async () => {
    const out = await publishMedia([draft()], rows, download);
    expect(Object.keys(out.files).sort()).toEqual([
      `public/media/${IMG_SHA}-800.webp`,
      `public/media/${IMG_SHA}.webp`,
      `public/media/${POSTER_SHA}-800.webp`,
      `public/media/${POSTER_SHA}.webp`,
      `public/media/${VID_SHA}.mp4`,
      `public/media/${VTT_SHA}.vtt`,
    ].sort());
    // The committed bytes are the Storage bytes.
    expect(out.files[`public/media/${IMG_SHA}.webp`]).toEqual(storage[`${IMG}.webp`]);
    expect(out.files[`public/media/${IMG_SHA}-800.webp`]).toEqual(storage[`${IMG}-800.webp`]);
    expect(await gitBlobSha(out.files[`public/media/${IMG_SHA}.webp`])).toBe('5e2d3e068991c8bf84b6952d9041b3891e73fe1e');
    // Each object is downloaded once, however often it is referenced.
    expect(download.mock.calls.map((c) => c[0]).sort()).toEqual(Object.keys(storage).sort());
  });

  it('rewrites every reference to /media/<sha12>.<ext>, writes image width/height from the row and video width/height from the poster', async () => {
    const out = await publishMedia([draft()], rows, download);
    const data = out.drafts[0].data as { en: ReturnType<typeof locale>; el: ReturnType<typeof locale> };
    expect(data.en.hero).toEqual({ media: `/media/${IMG_SHA}.webp`, alt: 'Stage', width: 1600, height: 900 });
    expect(data.el.hero).toEqual({ media: `/media/${IMG_SHA}.webp`, alt: 'Σκηνή', width: 1600, height: 900 });
    expect(data.en.zone[1]).toEqual({
      type: 'video',
      video: {
        media: `/media/${VID_SHA}.mp4`, poster: `/media/${POSTER_SHA}.webp`, captions: `/media/${VTT_SHA}.vtt`,
        autoplay: true, width: 1280, height: 720,
      },
    });
    expect(data.el.zone[2]).toEqual({ type: 'image', image: { media: `/media/${IMG_SHA}.webp`, alt: 'Σκηνή', width: 1600, height: 900 } });
    expect(data.en.thumb).toBe(`/media/${POSTER_SHA}.webp`);
    // The shapes the public components accept.
    expect(isPublishedMedia(data.en.hero.media, 'webp')).toBe(true);
    const v = (data.en.zone[1] as unknown as { video: Record<string, string> }).video;
    expect(isPublishedMedia(v.media, 'mp4')).toBe(true);
    expect(isPublishedMedia(v.poster, 'webp')).toBe(true);
    expect(isPublishedMedia(v.captions, 'vtt')).toBe(true);
    expect(JSON.stringify(out.drafts)).not.toContain('cms-media/');
    // The input drafts are not mutated.
    expect((draft().data as { en: { hero: { media: string } } }).en.hero.media).toBe(ref(IMG));
  });

  it('recomputes stale dimensions from the rows', async () => {
    const d = { en: locale('A'), el: locale('B') };
    for (const l of [d.en, d.el]) Object.assign(l.hero, { width: 1, height: 1 });
    const out = await publishMedia([draft(d)], rows, download);
    expect((out.drafts[0].data as { en: { hero: unknown } }).en.hero).toMatchObject({ width: 1600, height: 900 });
  });

  it('lists the rows to mark published: every main row and variant written, with its /media/ path', async () => {
    const out = await publishMedia([draft()], rows, download);
    expect([...out.marks].sort((a, b) => (a.id < b.id ? -1 : 1))).toEqual([
      { id: IMG_V, path: `/media/${IMG_SHA}-800.webp` },
      { id: IMG, path: `/media/${IMG_SHA}.webp` },
      { id: POSTER_V, path: `/media/${POSTER_SHA}-800.webp` },
      { id: POSTER, path: `/media/${POSTER_SHA}.webp` },
      { id: VID, path: `/media/${VID_SHA}.mp4` },
      { id: VTT, path: `/media/${VTT_SHA}.vtt` },
    ].sort((a, b) => (a.id < b.id ? -1 : 1)));
    for (const m of out.marks) expect(m.path).toMatch(/^\/media\/[0-9a-f]{12}(-800)?\.(webp|mp4|vtt)$/);
  });

  it('no drafts or no references: nothing downloaded, drafts unchanged', async () => {
    download.mockClear();
    expect(await publishMedia([], rows, download)).toEqual({ files: {}, drafts: [], rewritten: false, marks: [] });
    const plain = { en: { hero: { media: `/media/${IMG_SHA}.webp`, alt: 'A', width: 1600, height: 900 }, zone: [] }, el: { hero: { media: `/media/${IMG_SHA}.webp`, alt: 'B', width: 1600, height: 900 }, zone: [] } };
    const out = await publishMedia([draft(plain)], rows, download);
    expect(out.files).toEqual({});
    expect(out.drafts[0].data).toEqual(plain);
    expect(download).not.toHaveBeenCalled();
  });

  it('a reference to a missing row refuses the publish, naming doc_id and path (and downloads nothing)', async () => {
    download.mockClear();
    const d = { en: locale('A'), el: locale('B') };
    d.en.hero.media = d.el.hero.media = ref(MISSING);
    const e = await thrown(publishMedia([draft(d)], rows, download));
    expect(e.message).toBe(`Media check failed: 1 error\n${DOC} hero.media: media ${MISSING} not found`);
    expect(download).not.toHaveBeenCalled();
  });

  it('a row of the wrong kind refuses the publish (a video in an image field)', async () => {
    const d = { en: locale('A'), el: locale('B') };
    d.en.hero.media = d.el.hero.media = ref(VID);
    const e = await thrown(publishMedia([draft(d)], rows, download));
    expect(e.message).toContain(`${DOC} hero.media: media ${VID} is a video, expected an image`);
  });

  it('a reference to an 800 w variant row refuses the publish', async () => {
    const d = { en: locale('A'), el: locale('B') };
    d.en.hero.media = d.el.hero.media = ref(IMG_V);
    const e = await thrown(publishMedia([draft(d)], rows, download));
    expect(e.message).toContain(`${DOC} hero.media: media ${IMG_V} is an 800 w variant, not an upload: pick the image itself`);
  });

  it('an image without its 800 w variant row refuses the publish: the upload is incomplete', async () => {
    const e = await thrown(publishMedia([draft()], rows.filter((r) => r.id !== IMG_V), download));
    expect(e.message).toBe([
      'Media check failed: 2 errors',
      `${DOC} hero.media: image ${IMG} has no 800 w variant: the upload is incomplete, re-upload it`,
      `${DOC} zone.2.image.media: image ${IMG} has no 800 w variant: the upload is incomplete, re-upload it`,
    ].join('\n'));
  });

  it('bytes whose sha256 differs from the row refuse the publish (main file or variant)', async () => {
    const tampered = vi.fn(async (path: string) => (path === `${IMG}-800.webp` ? new Uint8Array([1, 2, 3]) : download(path)));
    const e = await thrown(publishMedia([draft()], rows, tampered));
    expect(e.message).toMatch(new RegExp(`^Media check failed: 1 error\\nmedia ${IMG_V} \\(${IMG}-800\\.webp\\): sha256 mismatch: Storage has [0-9a-f]{64}, the row says ${rows[1].sha256}$`));
  });

  it('an already-published row whose files are in the branch is not downloaded again; dimensions still come from the rows', async () => {
    const tree = new Set([`public/media/${IMG_SHA}.webp`, `public/media/${IMG_SHA}-800.webp`, `public/media/${VID_SHA}.mp4`]);
    const published = rows.map((r) => (r.id === IMG ? { ...r, published_path: `/media/${IMG_SHA}.webp` } : r.id === VID ? { ...r, published_path: `/media/${VID_SHA}.mp4` } : r));
    const dl = vi.fn(async (p: string) => download(p));
    const publishedPaths = vi.fn(async () => tree);
    const out = await publishMedia([draft()], published, dl, publishedPaths);
    expect(publishedPaths).toHaveBeenCalledTimes(1);
    const fetched = dl.mock.calls.map((c) => c[0]);
    expect(fetched).not.toContain(`${IMG}.webp`);
    expect(fetched).not.toContain(`${IMG}-800.webp`);
    expect(fetched).not.toContain(`${VID}.mp4`);
    expect(fetched.sort()).toEqual([`${POSTER}-800.webp`, `${POSTER}.webp`, `${VTT}.vtt`].sort());
    expect(Object.keys(out.files)).not.toContain(`public/media/${IMG_SHA}.webp`);
    expect(out.marks.map((m) => m.id).sort()).toEqual([POSTER, POSTER_V, VTT].sort());
    const data = out.drafts[0].data as { en: ReturnType<typeof locale> };
    expect(data.en.hero).toEqual({ media: `/media/${IMG_SHA}.webp`, alt: 'Stage', width: 1600, height: 900 });
    expect((data.en.zone[1] as unknown as { video: { media: string } }).video.media).toBe(`/media/${VID_SHA}.mp4`);
  });

  it('a published row whose file (or variant) is gone from the branch is downloaded and committed again', async () => {
    const published = rows.map((r) => (r.id === IMG ? { ...r, published_path: `/media/${IMG_SHA}.webp` } : r));
    const dl = vi.fn(async (p: string) => download(p));
    const out = await publishMedia([draft()], published, dl, async () => new Set([`public/media/${IMG_SHA}.webp`]));
    expect(dl.mock.calls.map((c) => c[0])).toContain(`${IMG}.webp`);
    expect(out.files[`public/media/${IMG_SHA}-800.webp`]).toEqual(storage[`${IMG}-800.webp`]);
  });

  it('never reads the branch when no referenced row is published', async () => {
    const publishedPaths = vi.fn(async () => new Set<string>());
    await publishMedia([draft()], rows, download, publishedPaths);
    expect(publishedPaths).not.toHaveBeenCalled();
  });

  it('an image or video group already on /media/ without width/height refuses the publish', async () => {
    const d = { en: locale('A'), el: locale('B') };
    for (const l of [d.en, d.el]) {
      l.hero.media = `/media/${IMG_SHA}.webp`;
      (l.zone[1] as unknown as { video: Record<string, unknown> }).video.poster = `/media/${POSTER_SHA}.webp`;
      Object.assign((l.zone[1] as unknown as { video: Record<string, unknown> }).video, { width: 1280 });
    }
    const e = await thrown(publishMedia([draft(d)], rows, download));
    expect(e.errors).toEqual([
      `${DOC} hero: published image /media/${IMG_SHA}.webp has no width/height: pick the media again`,
      `${DOC} zone.1.video: published video poster /media/${POSTER_SHA}.webp has no width/height: pick the media again`,
    ]);
  });

  describe('new-media cap (memory: nothing over MEDIA_MAX_NEW_BYTES is downloaded)', () => {
    const TOO_BIG = /^Publish would add (\d+) bytes of new media \(max 52428800\); publish fewer media at a time$/;
    const bigVideo = (extra: Partial<MediaRow> = {}) =>
      rows.map((r) => (r.id === VID ? { ...r, bytes: MEDIA_MAX_NEW_BYTES, ...extra } : r));

    it('refuses from the row sizes (variants included) before any download', async () => {
      const dl = vi.fn(async (p: string) => download(p));
      const e = await thrown(publishMedia([draft()], bigVideo(), dl));
      expect(e.errors).toHaveLength(1);
      const added = Number(TOO_BIG.exec(e.errors[0])![1]);
      const want = rows.filter((r) => r.id !== VID).reduce((n, r) => n + r.bytes, MEDIA_MAX_NEW_BYTES);
      expect(added).toBe(want);
      expect(dl).not.toHaveBeenCalled();
    });

    it('exactly at the cap is allowed', async () => {
      const rest = rows.filter((r) => r.id !== VID).reduce((n, r) => n + r.bytes, 0);
      const out = await publishMedia([draft()], bigVideo({ bytes: MEDIA_MAX_NEW_BYTES - rest }), download);
      expect(out.files[`public/media/${VID_SHA}.mp4`]).toBeDefined();
    });

    it('a reused (published, in the branch) row does not count and is not downloaded', async () => {
      const tree = new Set([`public/media/${VID_SHA}.mp4`]);
      const dl = vi.fn(async (p: string) => download(p));
      await publishMedia([draft()], bigVideo({ published_path: `/media/${VID_SHA}.mp4` }), dl, async () => tree);
      expect(dl.mock.calls.map((c) => c[0])).not.toContain(`${VID}.mp4`);
    });

    it('over the cap, a file already in the branch under its content name is not downloaded and does not count; it is marked published', async () => {
      const tree = new Set([`public/media/${VID_SHA}.mp4`]);
      const dl = vi.fn(async (p: string) => download(p));
      const publishedPaths = vi.fn(async () => tree);
      const out = await publishMedia([draft()], bigVideo(), dl, publishedPaths);
      expect(publishedPaths).toHaveBeenCalledTimes(1);
      expect(dl.mock.calls.map((c) => c[0])).not.toContain(`${VID}.mp4`);
      expect(Object.keys(out.files)).not.toContain(`public/media/${VID_SHA}.mp4`);
      expect(out.marks).toContainEqual({ id: VID, path: `/media/${VID_SHA}.mp4` });
      const data = out.drafts[0].data as { en: ReturnType<typeof locale> };
      expect((data.en.zone[1] as unknown as { video: { media: string } }).video.media).toBe(`/media/${VID_SHA}.mp4`);
    });
  });

  it('a failed download refuses the publish', async () => {
    const e = await thrown(publishMedia([draft()], rows.map((r) => (r.id === VTT ? { ...r, storage_path: `${MISSING}.vtt` } : r)), download));
    expect(e.message).toContain(`media ${VTT} (${MISSING}.vtt): download failed: Object not found: ${MISSING}.vtt`);
  });
});

describe('collectRegisteredPaths (keyset paging of cms_media)', () => {
  const all = Array.from({ length: 7 }, (_, i) => `${String(i).padStart(2, '0')}.webp`);
  /** A table of `all` served 2 rows per page (storage_path > after), reporting `count`. */
  const pager = (count: number | null) => vi.fn(async (after: string | null) => ({
    paths: all.filter((p) => after === null || p > after).slice(0, 2),
    count,
  }));

  it('collects every path across short pages until an empty page', async () => {
    const page = pager(7);
    expect(await collectRegisteredPaths(page)).toEqual(all);
    expect(page.mock.calls.map((c) => c[0])).toEqual([null, '01.webp', '03.webp', '05.webp', '06.webp']);
  });

  it('throws when the paths read do not match the exact count (or no count): nothing is swept', async () => {
    await expect(collectRegisteredPaths(pager(8))).rejects.toThrow('cms_media: read 7 storage paths, expected 8');
    await expect(collectRegisteredPaths(pager(null))).rejects.toThrow(/expected an unknown count/);
    const removeObjects = vi.fn(async () => {});
    await expect(sweepStorage({
      listObjects: async () => [{ name: `${MISSING}.webp`, created_at: '2026-01-01T00:00:00Z' }],
      registeredPaths: () => collectRegisteredPaths(pager(8)),
      removeObjects,
    }, new Date('2026-11-01T12:00:00Z'))).rejects.toThrow(/expected 8/);
    expect(removeObjects).not.toHaveBeenCalled();
  });
});

describe('sweepStorage', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const old = new Date(now.getTime() - SWEEP_MIN_AGE_MS - 1000).toISOString();
  const fresh = new Date(now.getTime() - SWEEP_MIN_AGE_MS + 60_000).toISOString();

  it('removes only objects with no cms_media row that are older than 24 h', async () => {
    const removeObjects = vi.fn(async () => {});
    const removed = await sweepStorage({
      listObjects: async () => [
        { name: `${IMG}.webp`, created_at: old },           // registered: kept however old
        { name: `${IMG}-800.webp`, created_at: old },
        { name: `${MISSING}.webp`, created_at: old },       // orphan, old: removed
        { name: `${MISSING}-800.webp`, created_at: old },
        { name: `${VTT}.vtt`, created_at: fresh },          // orphan, fresh (an upload in flight): kept
        { name: 'weird.bin', created_at: null },             // unknown age: kept
      ],
      registeredPaths: async () => [`${IMG}.webp`, `${IMG}-800.webp`.toUpperCase()],
      removeObjects,
    }, now);
    expect(removed).toEqual([`${MISSING}-800.webp`, `${MISSING}.webp`]);
    expect(removeObjects).toHaveBeenCalledWith([`${MISSING}-800.webp`, `${MISSING}.webp`]);
  });

  it('removes nothing (and makes no call) when there are no orphans', async () => {
    const removeObjects = vi.fn(async () => {});
    expect(await sweepStorage({
      listObjects: async () => [{ name: `${IMG}.webp`, created_at: old }],
      registeredPaths: async () => [`${IMG}.webp`],
      removeObjects,
    }, now)).toEqual([]);
    expect(removeObjects).not.toHaveBeenCalled();
  });
});

// ── runPublish with media ───────────────────────────────────

function contest(year: number, city_slug: string, stage: ContestRow['stage']): ContestRow {
  return { year, host_iso: null, city: city_slug, city_slug, semi1_date: null, semi2_date: null, final_date: null, stage, indexable: false, cancelled: false };
}

const base: SnapshotInput = {
  contests: [contest(2027, 'burgas', 'current')],
  countries: [],
  entries: [],
  generated_at: '2026-11-01T12:00:00Z',
};
const vercelJson = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8').replace(/\r\n/g, '\n');
/** vercel.json as a publish of `base` leaves it (its archive redirects merged in). */
const vercelMerged = mergeVercelRedirects(vercelJson, generatedRedirects(base.contests));

function deps(input: SnapshotInput, commit?: PublishDeps['commitFiles']) {
  const log: string[] = [];
  const media = {
    download: vi.fn(async (path: string) => download(path)),
    markPublished: vi.fn(async (id: string, path: string) => { log.push(`mark ${id} ${path}`); }),
    listObjects: vi.fn(async () => { log.push('list'); return [{ name: `${MISSING}.webp`, created_at: '2026-01-01T00:00:00Z' }]; }),
    removeObjects: vi.fn(async (names: string[]) => { log.push(`remove ${names.join(',')}`); }),
    registeredPaths: vi.fn(async () => rows.map((r) => r.storage_path)),
    publishedPaths: vi.fn(async () => new Set<string>()),
  };
  const commitFiles = vi.fn(commit ?? (async (files: Record<string, string | Uint8Array>, _m: (p: string[]) => string, t: FileTransforms) => {
    log.push('commit');
    t['vercel.json'](vercelJson);
    return { sha: 'c1', changed: Object.keys(files).length, paths: Object.keys(files) };
  }));
  const d: PublishDeps = {
    rpc: {
      beginPublish: async () => 5,
      publishInput: async () => input,
      endPublish: vi.fn(async () => { log.push('end'); }),
    },
    readCommittedPages: async () => ({}),
    commitFiles,
    media,
    now: () => new Date('2026-11-01T12:00:00Z'),
    log: vi.fn(),
  };
  return { d, log, media, commitFiles };
}

describe('runPublish with media', () => {
  const withDraft: SnapshotInput = { ...base, cms_documents: [draft()], media: rows };

  it('commits the media files and the rewritten page in one commit, under the 50 MB new-media guard', async () => {
    const { d, commitFiles } = deps(withDraft);
    const out = await runPublish(d);
    expect(out).toMatchObject({ status: 'ok', sha: 'c1' });
    const [files, , , limits] = commitFiles.mock.calls[0] as unknown as [Record<string, string | Uint8Array>, unknown, unknown, { maxNewBinaryBytes: number }];
    expect(limits).toEqual({ maxNewBinaryBytes: MEDIA_MAX_NEW_BYTES });
    expect(MEDIA_MAX_NEW_BYTES).toBe(50 * 1024 * 1024);
    expect(files[`public/media/${IMG_SHA}.webp`]).toEqual(storage[`${IMG}.webp`]);
    const page = files[`content/pages/${DOC}.json`] as string;
    expect(page).not.toContain('cms-media/');
    expect(JSON.parse(page).en.hero).toEqual({ media: `/media/${IMG_SHA}.webp`, alt: 'Stage', width: 1600, height: 900 });
    expect(page).toBe(stableJson(JSON.parse(page)));
  });

  it('marks every written row published only after the commit, then sweeps orphaned Storage objects, then ends the run', async () => {
    const { d, log } = deps(withDraft);
    await runPublish(d);
    expect(log[0]).toBe('commit');
    expect(log.filter((l) => l.startsWith('mark '))).toHaveLength(6);
    expect(log).toContain(`mark ${IMG} /media/${IMG_SHA}.webp`);
    expect(log).toContain(`mark ${IMG_V} /media/${IMG_SHA}-800.webp`);
    expect(log.slice(-3)).toEqual(['list', `remove ${MISSING}.webp`, 'end']);
  });

  it('a refused commit marks nothing and sweeps nothing', async () => {
    const { d, media } = deps(withDraft, async () => { throw new Error('Publish would add 60000000 bytes of new media (max 52428800); publish fewer media at a time'); });
    const out = await runPublish(d);
    expect(out).toMatchObject({ status: 'error', error: expect.stringMatching(/bytes of new media/) });
    expect(media.markPublished).not.toHaveBeenCalled();
    expect(media.listObjects).not.toHaveBeenCalled();
    expect(media.removeObjects).not.toHaveBeenCalled();
  });

  it('a media error refuses the publish before anything is committed', async () => {
    const { d, commitFiles, media } = deps({ ...withDraft, media: rows.filter((r) => r.id !== VTT) });
    const out = await runPublish(d);
    expect(out).toMatchObject({ status: 'error', error: `Media check failed: 1 error\n${DOC} zone.1.video.captions: media ${VTT} not found` });
    expect(commitFiles).not.toHaveBeenCalled();
    expect(media.markPublished).not.toHaveBeenCalled();
  });

  it('a failing sweep is logged and does not fail the publish', async () => {
    const { d, media } = deps(withDraft);
    media.listObjects.mockRejectedValueOnce(new Error('storage down'));
    const out = await runPublish(d);
    expect(out).toMatchObject({ status: 'ok', sha: 'c1' });
    expect(out).not.toHaveProperty('warning');
    expect(d.log).toHaveBeenCalledWith('publish-content: storage sweep failed: storage down');
  });

  it.each([
    ['a text field', (l: ReturnType<typeof locale>) => { (l as Record<string, unknown>).note = `See ${ref(IMG)}`; }, 'note'],
    ['an href field', (l: ReturnType<typeof locale>) => { l.zone.push({ type: 'cta', title: 'T', body: 'B', label: 'L', href: `/${ref(IMG)}` } as never); }, 'zone.3.href'],
  ])('a cms-media/ reference in %s (not rewritten) refuses the publish: nothing committed or marked', async (_n, put, path) => {
    const d = { en: locale('A'), el: locale('B') };
    put(d.en);
    put(d.el);
    const { d: dd, commitFiles, media } = deps({ ...withDraft, cms_documents: [draft(d)] });
    const out = await runPublish(dd);
    expect(out.status).toBe('error');
    const msg = 'draft media reference (cms-media/) outside a media field: pick the file in an image, video or media field instead';
    expect((out as { error: string }).error).toBe(`Media check failed: 2 errors\n${DOC} el.${path}: ${msg}\n${DOC} en.${path}: ${msg}`);
    expect(commitFiles).not.toHaveBeenCalled();
    expect(media.markPublished).not.toHaveBeenCalled();
  });

  it('a failing registeredPaths (e.g. a count mismatch) is logged and deletes nothing', async () => {
    const { d, media } = deps(withDraft);
    media.registeredPaths.mockRejectedValueOnce(new Error('cms_media: read 5 storage paths, expected 6'));
    expect((await runPublish(d)).status).toBe('ok');
    expect(media.removeObjects).not.toHaveBeenCalled();
    expect(d.log).toHaveBeenCalledWith('publish-content: storage sweep failed: cms_media: read 5 storage paths, expected 6');
  });

  it('a failing media_mark_published keeps the commit and comes back as a warning', async () => {
    const { d, media } = deps(withDraft);
    media.markPublished.mockRejectedValueOnce(new Error('rpc down'));
    const out = await runPublish(d);
    expect(out).toMatchObject({ status: 'ok', sha: 'c1', warning: `media_mark_published failed: ${IMG}: rpc down` });
  });

  it('{ cms: false } (contest auto-publish) ships no drafts and no media: nothing downloaded, marked or swept', async () => {
    const { d, commitFiles, media } = deps(withDraft);
    const out = await runPublish(d, { cms: false });
    expect(out.status).toBe('ok');
    const files = commitFiles.mock.calls[0][0];
    expect(Object.keys(files).some((p) => p.startsWith('public/media/') || p.startsWith('content/pages/'))).toBe(false);
    expect(media.download).not.toHaveBeenCalled();
    expect(media.markPublished).not.toHaveBeenCalled();
    expect(media.listObjects).not.toHaveBeenCalled();
  });

  describe('against the real commitFiles (GitHub mocked)', () => {
    const API = 'https://api.github.com';
    const REPO = 'tsokid/EurovisionParty';

    /** A GitHub whose branch head holds `tree` (path → content); records every call. */
    async function github(tree: Record<string, string | Uint8Array>) {
      const calls: string[] = [];
      const entries = await Promise.all(Object.entries(tree).map(async ([path, c]) => ({ path, mode: '100644', type: 'blob', sha: await gitBlobSha(c) })));
      const blobs = new Map(await Promise.all(Object.entries(tree).map(async ([, c]) => [await gitBlobSha(c), c] as const)));
      const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const path = String(input).slice(API.length);
        calls.push(`${method} ${path}`);
        const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
        if (path === `/repos/${REPO}/git/ref/heads/main`) return json({ object: { sha: 'c0' } });
        if (path === `/repos/${REPO}/git/commits/c0`) return json({ tree: { sha: 't0' } });
        if (path === `/repos/${REPO}/git/trees/t0?recursive=1`) return json({ truncated: false, tree: entries });
        const blob = /\/git\/blobs\/([0-9a-f]+)$/.exec(path);
        if (method === 'GET' && blob) return json({ encoding: 'base64', content: Buffer.from(blobs.get(blob[1])!).toString('base64') });
        if (method === 'POST' && path.endsWith('/git/blobs')) return json({ sha: 'b1' });
        if (method === 'POST' && path.endsWith('/git/trees')) return json({ sha: 't1' });
        if (method === 'POST' && path.endsWith('/git/commits')) return json({ sha: 'c1' });
        if (method === 'PATCH') return json({});
        return new Response('{}', { status: 404 });
      }) as typeof globalThis.fetch;
      const commit: PublishDeps['commitFiles'] = (files, message, transforms, limits) =>
        realCommitFiles({ token: 't', repo: REPO, branch: 'main', fetch, files, message, transforms, ...limits });
      const paths = new Set(Object.keys(tree).filter((p) => p.startsWith('public/media/')));
      return { commit, calls, paths };
    }

    it('media already published (published_path set, files in the tree) and the page unchanged: a no-op, no blob uploaded', async () => {
      // First publish, to learn exactly what the branch would hold.
      const first = deps(withDraft);
      await runPublish(first.d);
      const committed = first.commitFiles.mock.calls[0][0] as Record<string, string | Uint8Array>;
      const merged = { ...committed, 'vercel.json': vercelMerged };
      const published = rows.map((r) => ({ ...r, published_path: first.media.markPublished.mock.calls.find((c) => c[0] === r.id)![1] }));
      const { commit, calls, paths } = await github(merged);
      const { d, media } = deps({ ...withDraft, media: published }, commit);
      media.publishedPaths.mockResolvedValue(paths);
      const out = await runPublish(d);
      expect(out).toMatchObject({ status: 'noop', sha: null, files_changed: 0 });
      expect(calls.filter((c) => !c.startsWith('GET'))).toEqual([]);
      // Nothing downloaded or written, so nothing to mark.
      expect(media.download).not.toHaveBeenCalled();
      expect(media.markPublished).not.toHaveBeenCalled();
    });

    it('new media over 50 MB is refused before anything is written; already-committed media does not count', async () => {
      const big = new Uint8Array(MEDIA_MAX_NEW_BYTES - 5);
      const bigRows = rows.map((r) => (r.id === VID ? { ...r, sha256: sha256(big), bytes: big.byteLength } : r));
      const dl = vi.fn(async (p: string) => (p === `${VID}.mp4` ? big : download(p)));
      // Nothing in the tree yet: big video + images > 50 MB.
      const empty = await github({ 'vercel.json': vercelMerged });
      const a = deps({ ...withDraft, media: bigRows }, empty.commit);
      a.d.media.download = dl;
      const refused = await runPublish(a.d);
      // Refused by publishMedia from the row sizes, before any download (commitFiles keeps the same guard).
      expect(refused).toMatchObject({ status: 'error', error: expect.stringMatching(/\nPublish would add \d+ bytes of new media \(max 52428800\)/) });
      expect(dl).not.toHaveBeenCalled();
      expect(empty.calls.filter((c) => !c.startsWith('GET'))).toEqual([]);
      // The big video already committed: only the small files are new, so it passes.
      const bigSha = sha256(big).slice(0, 12);
      const present = await github({ 'vercel.json': vercelMerged, [`public/media/${bigSha}.mp4`]: big });
      const b = deps({ ...withDraft, media: bigRows }, present.commit);
      b.d.media.download = dl;
      b.media.publishedPaths.mockResolvedValue(present.paths);
      dl.mockClear();
      expect(await runPublish(b.d)).toMatchObject({ status: 'ok', sha: 'c1' });
      // The committed video is not downloaded again; its row is marked published.
      expect(dl.mock.calls.map((c) => c[0])).not.toContain(`${VID}.mp4`);
      expect(b.media.markPublished).toHaveBeenCalledWith(VID, `/media/${bigSha}.mp4`);
      expect(present.calls.filter((c) => c === `POST /repos/${REPO}/git/blobs`)).toHaveLength(5);
    }, 30_000);
  });
});
