// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  blocks, blockVariants, fieldMeta, fieldPaths, group, image, mediaRef, richText, video,
} from '../../supabase/functions/_shared/cms/fields';
import { walkSchema } from '../../supabase/functions/_shared/cms/walk';
import { emptyValue } from '../../supabase/functions/_shared/cms/emptyValue';
import { documentSchema, sharedMismatches } from '../../supabase/functions/_shared/cms/validate';

const UUID = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const DRAFT = `cms-media/${UUID}`;
const PUBLISHED = '/media/0123456789ab';
const img = (media = DRAFT, alt = 'A stage') => ({ media, alt });

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('mediaRef', () => {
  it('accepts a draft reference and a published one of the right extension', () => {
    expect(ok(mediaRef('image'), DRAFT)).toBe(true);
    expect(ok(mediaRef('image'), `${PUBLISHED}.webp`)).toBe(true);
    expect(ok(mediaRef('video'), `${PUBLISHED}.mp4`)).toBe(true);
    expect(ok(mediaRef('captions'), `${PUBLISHED}.vtt`)).toBe(true);
  });

  it.each([
    ['uppercase uuid', DRAFT.toUpperCase()],
    ['uppercase prefix', `CMS-MEDIA/${UUID}`],
    ['short uuid', 'cms-media/abc'],
    ['sha too short', '/media/0123456789a.webp'],
    ['sha uppercase', '/media/0123456789AB.webp'],
    ['unknown extension', '/media/0123456789ab.png'],
    ['external url', 'https://x.org/a.webp'],
    ['empty', ''],
    ['trailing text', `${DRAFT}x`],
  ])('rejects %s', (_n, v) => {
    expect(ok(mediaRef('image'), v)).toBe(false);
  });

  it('rejects a published ref whose extension is another kind', () => {
    expect(ok(mediaRef('image'), `${PUBLISHED}.mp4`)).toBe(false);
    expect(ok(mediaRef('video'), `${PUBLISHED}.webp`)).toBe(false);
    expect(ok(mediaRef('captions'), `${PUBLISHED}.webp`)).toBe(false);
  });

  it('is locale-shared and carries its media kind', () => {
    expect(fieldMeta(mediaRef('video'))).toMatchObject({ kind: 'mediaRef', mediaKind: 'video', shared: true, required: true });
  });
});

describe('image()', () => {
  it('is a strict group of a shared media ref and a required alt', () => {
    const f = image();
    expect(fieldMeta(f)).toMatchObject({ kind: 'image' });
    expect(ok(f, img())).toBe(true);
    expect(ok(f, img(DRAFT, '  '))).toBe(false);
    expect(ok(f, { ...img(), extra: 1 })).toBe(false);
    const metas: Record<string, unknown> = {};
    walkSchema(f, (n) => { metas[n.path] = [n.meta.kind, !!n.meta.shared]; });
    expect(metas).toEqual({
      '': ['image', false], media: ['mediaRef', true], alt: ['text', false],
      width: ['dimension', true], height: ['dimension', true],
    });
  });

  it('accepts the width and height publish writes in (positive integers, optional), so a published doc validates as an editor base', () => {
    const f = image();
    expect(ok(f, { ...img(`${PUBLISHED}.webp`), width: 1600, height: 900 })).toBe(true);
    expect(ok(f, { ...img(), width: 1600 })).toBe(true);
    for (const bad of [0, -1, 1.5, '1600', null]) {
      expect(ok(f, { ...img(), width: bad }), String(bad)).toBe(false);
      expect(ok(f, { ...img(), height: bad }), String(bad)).toBe(false);
    }
  });

  it('marks width and height as derived (set by publish, not edited) and locale-shared', () => {
    const metas: Record<string, unknown> = {};
    // The optional() wrapper is visited first, then its inner field at the same path: keep the wrapper.
    walkSchema(image(), (n) => { metas[n.path] ??= n.meta; });
    expect(metas.width).toMatchObject({ kind: 'dimension', derived: true, shared: true, optional: true });
    expect(metas.height).toMatchObject({ kind: 'dimension', derived: true, shared: true, optional: true });
  });

  it('empties to blank strings', () => {
    expect(emptyValue(image())).toEqual({ media: '', alt: '' });
  });
});

describe('video()', () => {
  const v = { media: `${PUBLISHED}.mp4`, poster: `${PUBLISHED}.webp`, autoplay: false };
  it('needs media and poster; captions are optional', () => {
    const f = video();
    expect(fieldMeta(f)).toMatchObject({ kind: 'video' });
    expect(ok(f, v)).toBe(true);
    expect(ok(f, { ...v, captions: `${PUBLISHED}.vtt` })).toBe(true);
    expect(ok(f, { ...v, captions: `${PUBLISHED}.webp` })).toBe(false);
    expect(ok(f, { media: v.media, autoplay: false })).toBe(false);
  });

  it('refuses an empty poster (the poster is required, also at publish)', () => {
    const r = video().safeParse({ ...v, poster: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path)).toEqual([['poster']]);
    expect(ok(video(), { ...v, poster: '   ' })).toBe(false);
  });

  it('accepts the poster dimensions publish writes in', () => {
    expect(ok(video(), { ...v, width: 1280, height: 720 })).toBe(true);
    expect(ok(video(), { ...v, width: 0, height: 720 })).toBe(false);
  });

  it('empties without captions', () => {
    expect(emptyValue(video())).toEqual({ media: '', poster: '', autoplay: false });
  });
});

describe('richText()', () => {
  it('reports unsupported syntax with the line number', () => {
    const r = richText().safeParse('fine\n<b>x</b>');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toEqual([expect.stringMatching(/^Line 2: Raw HTML/)]);
  });

  it('rejects an unsafe link and accepts a valid document', () => {
    expect(ok(richText(), '[x](javascript:alert)')).toBe(false);
    expect(ok(richText(), '### Hi\n\nSome **bold** and [a page](/faq).\n\n- one\n- two')).toBe(true);
  });

  it('has a hard length cap of 20,000 characters', () => {
    expect(ok(richText(), 'a'.repeat(20_000))).toBe(true);
    expect(ok(richText(), 'a'.repeat(20_001))).toBe(false);
  });

  it('still honours placeholders and required', () => {
    expect(ok(richText({ placeholders: ['year'] }), 'In {year}')).toBe(true);
    expect(ok(richText(), '   ')).toBe(false);
  });
});

describe('blocks()', () => {
  const b = blocks();
  const all = [
    { type: 'text', body: 'Hello' },
    { type: 'image', image: img(), caption: 'Cap' },
    { type: 'image', image: img() },
    { type: 'video', video: { media: `${PUBLISHED}.mp4`, poster: DRAFT, autoplay: true } },
    { type: 'callout', tone: 'warn', body: 'Careful' },
    { type: 'faq', items: [{ q: 'Why?', a: 'Because **it is**.' }] },
    { type: 'cta', title: 'Join', body: 'Come along', label: 'Go', href: '/faq' },
  ];

  it('is a list of exactly six block types', () => {
    expect(fieldMeta(b)).toMatchObject({ kind: 'blocks', discriminator: 'type', variants: ['text', 'image', 'video', 'callout', 'faq', 'cta'] });
    expect(Object.keys(blockVariants(b))).toEqual(['text', 'image', 'video', 'callout', 'faq', 'cta']);
  });

  it('accepts one of each block', () => {
    expect(ok(b, all)).toBe(true);
    expect(ok(b, [])).toBe(true);
  });

  it.each([
    ['unknown type', [{ type: 'steps', items: [] }]],
    ['missing type', [{ body: 'x' }]],
    ['extra key', [{ type: 'text', body: 'x', more: 1 }]],
    ['bad tone', [{ type: 'callout', tone: 'danger', body: 'x' }]],
    ['bad cta href', [{ type: 'cta', title: 'a', body: 'b', label: 'c', href: 'javascript:x' }]],
    ['bad rich text', [{ type: 'text', body: '<i>x</i>' }]],
    ['image without alt', [{ type: 'image', image: { media: DRAFT, alt: '' } }]],
    ['keys of another variant', [{ type: 'text', image: img() }]],
  ])('rejects %s', (_n, v) => {
    expect(ok(b, v)).toBe(false);
  });

  it('a cta href written with the locale (/en/..., /el/..., /en, /el) is refused: LocaleLink adds it', () => {
    const cta = (href: string) => [{ type: 'cta', title: 'a', body: 'b', label: 'c', href }];
    const msg = 'Write the path without /en or /el — the language is added automatically';
    for (const href of ['/en/faq', '/el/faq', '/en', '/el', '/el?x=1', '/en#top']) {
      const r = b.safeParse(cta(href));
      expect(r.success, href).toBe(false);
      expect(r.error!.issues.map((i) => i.message), href).toContain(msg);
    }
    for (const href of ['/faq', '/english', '/elements', 'https://example.com/en/x']) expect(ok(b, cta(href)), href).toBe(true);
  });

  it('reports errors at the block path', () => {
    const r = b.safeParse([{ type: 'text', body: 'ok' }, { type: 'callout', tone: 'info', body: '<i>' }]);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual([1, 'body']);
  });

  it('starts empty, and each variant has an empty value of its own', () => {
    expect(emptyValue(b)).toEqual([]);
    const v = blockVariants(b);
    expect(emptyValue(v.text)).toEqual({ type: 'text', body: '' });
    expect(emptyValue(v.callout)).toEqual({ type: 'callout', tone: 'info', body: '' });
    expect(emptyValue(v.image)).toEqual({ type: 'image', image: { media: '', alt: '' } });
    expect(emptyValue(v.faq)).toEqual({ type: 'faq', items: [] });
  });

  it('walks the schema once per variant at the same path', () => {
    const seen: string[] = [];
    walkSchema(b, (n) => { seen.push(`${n.path}:${n.meta.kind}`); });
    expect(seen.slice(0, 3)).toEqual([':blocks', '*:union', '*:group']);
    expect(fieldPaths(b, (m) => m.kind === 'mediaRef')).toEqual(['*.image.media', '*.video.media', '*.video.poster', '*.video.captions']);
  });

  it('with values, walks only the variant each block has', () => {
    const doc = { en: all.slice(0, 2), el: all.slice(0, 2) };
    const paths: string[] = [];
    walkSchema(b, (n) => { paths.push(n.path); }, [doc.en, doc.el]);
    expect(paths).toContain('1.image.media');
    expect(paths).toContain('1.caption');
    expect(paths).not.toContain('0.image');
    expect(paths).toContain('0.body');
  });
});

describe('blocks in a document', () => {
  const schema = group({ zone: blocks() });
  const en = { zone: [{ type: 'image', image: img(DRAFT, 'Stage') }, { type: 'cta', title: 'A', body: 'B', label: 'C', href: '/faq' }] };

  it('requires locale-shared parts to match en, including the block type and media', () => {
    const el = structuredClone(en);
    el.zone[0].image!.alt = 'Σκηνή';
    expect(sharedMismatches(schema, en, el)).toEqual([]);
    expect(documentSchema(schema).safeParse({ en, el }).success).toBe(true);

    el.zone[0].image!.media = `cms-media/${UUID.replace('0b7c', 'ffff')}`;
    expect(sharedMismatches(schema, en, el)).toEqual([{ path: 'zone.0.image.media', message: expect.any(String) }]);

    const swapped = { zone: [en.zone[1], en.zone[0]] };
    expect(sharedMismatches(schema, en, swapped).map((m) => m.path)).toEqual(['zone.0.type', 'zone.1.type']);

    expect(sharedMismatches(schema, en, { zone: [en.zone[0]] }).map((m) => m.path)).toEqual(['zone']);
  });
});
