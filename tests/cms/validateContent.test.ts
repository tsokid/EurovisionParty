// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { text, group, list } from '../../supabase/functions/_shared/cms/fields';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { CONTENT_DIR, draftMediaRefs, liveContestFacts, mediaRefReport, PUBLIC_MEDIA_DIR, validateContentDir } from '../../scripts/cms/validate-content';
import { cityName } from '../../src/pages/contest/content/hubCopy';

describe('validateContentDir', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cms-validate-'));
    CMS_DOC_TYPES['__vc-ok'] = { schema: group({ title: text() }), label: 'T', group: 'site' };
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete CMS_DOC_TYPES['__vc-ok'];
  });

  it('passes with 0 documents when the folder is missing', () => {
    expect(validateContentDir(join(dir, 'nope'))).toEqual({ count: 0, errors: [], warnings: [] });
  });

  it('passes with 0 documents when the folder is empty', () => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    expect(validateContentDir(empty)).toEqual({ count: 0, errors: [], warnings: [] });
  });

  it('validates each file against its doc type and reports failures by file', () => {
    const pages = join(dir, 'pages');
    mkdirSync(pages);
    writeFileSync(join(pages, '__vc-ok.json'), JSON.stringify({ en: { title: 'A' }, el: { title: 'Α' } }));
    const r1 = validateContentDir(pages);
    expect(r1).toEqual({ count: 1, errors: [], warnings: [] });

    writeFileSync(join(pages, '__vc-ok.json'), JSON.stringify({ en: { title: 'A' }, el: { title: '' } }));
    writeFileSync(join(pages, 'orphan.json'), '{}');
    writeFileSync(join(pages, 'broken.json'), '{not json');
    const r2 = validateContentDir(pages);
    expect(r2.count).toBe(3);
    const lines = r2.errors.join('\n');
    expect(lines).toMatch(/__vc-ok\.json.*el.*title/);
    expect(lines).toMatch(/orphan\.json.*unknown doc type/i);
    // Document-level errors carry no locale: printed as [doc], never [en].
    expect(r2.errors).toContain('orphan.json: [doc] (root): Unknown doc type "orphan"');
    expect(lines).toMatch(/__vc-ok\.json: \[el\] title: /);
    expect(lines).toMatch(/broken\.json.*JSON/);
  });
});

describe('hardcoded live-contest year/city (warning, never an error)', () => {
  let dir: string;
  const FACTS = { year: 2031, cities: ['Turin', 'Τορίνο'] };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cms-facts-'));
    CMS_DOC_TYPES['__vc-facts'] = {
      schema: group({ title: text(), steps: list(group({ body: text() })), note: text({ placeholders: ['year'] }) }),
      label: 'T',
      group: 'site',
    };
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete CMS_DOC_TYPES['__vc-facts'];
  });

  it('warns at file [locale] path for each string naming the live year or city', () => {
    writeFileSync(join(dir, '__vc-facts.json'), JSON.stringify({
      en: { title: 'Eurovision 2031', steps: [{ body: 'Plan ahead' }, { body: 'Off to Turin' }], note: 'In {year}' },
      el: { title: 'Eurovision', steps: [{ body: 'Σχέδιο' }, { body: 'Στο Τορίνο το 20310' }], note: 'Το {year}' },
    }));
    const r = validateContentDir(dir, FACTS);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([
      '__vc-facts.json: [en] title: Possible hardcoded year/city: use the contest placeholders',
      '__vc-facts.json: [en] steps.1.body: Possible hardcoded year/city: use the contest placeholders',
      '__vc-facts.json: [el] steps.1.body: Possible hardcoded year/city: use the contest placeholders',
    ]);
  });

  it('does not warn for other years, placeholders, or a year inside a longer number', () => {
    writeFileSync(join(dir, '__vc-facts.json'), JSON.stringify({
      en: { title: 'Since 1956, 2030 and 20311', steps: [], note: '{year} again' },
      el: { title: 'Από το 1956', steps: [], note: '{year}' },
    }));
    expect(validateContentDir(dir, FACTS).warnings).toEqual([]);
  });

  it('defaults to the live contest in content/site.json, not a pinned year', () => {
    const site = JSON.parse(readFileSync(join(__dirname, '../../content/site.json'), 'utf8')) as {
      current: { year: number; city: string; city_slug: string };
    };
    const facts = liveContestFacts();
    expect(facts.year).toBe(site.current.year);
    expect(facts.cities).toContain(site.current.city);
    // en and el names (one when the city has no Greek form): not tied to a CITY_EL entry.
    const { city, city_slug } = site.current;
    expect(facts.cities).toEqual([...new Set([city, cityName('el', city_slug, city).name])]);
  });

  it('works for a host city with no Greek form (one name)', () => {
    mkdirSync(join(dir, 'site'));
    const site = join(dir, 'site', 'site.json');
    writeFileSync(site, JSON.stringify({ current: { year: 2040, city: 'Nowhereville', city_slug: 'nowhereville' } }));
    expect(liveContestFacts(site)).toEqual({ year: 2040, cities: ['Nowhereville'] });
  });

  it('reports every validateDocument warning (soft length too), never as an error', () => {
    CMS_DOC_TYPES['__vc-soft'] = { schema: group({ title: text({ softMaxLength: 5 }) }), label: 'T', group: 'site' };
    const soft = join(dir, 'soft');
    mkdirSync(soft);
    writeFileSync(join(soft, '__vc-soft.json'), JSON.stringify({ en: { title: 'Too long' }, el: { title: 'Ok' } }));
    const r = validateContentDir(soft, FACTS);
    delete CMS_DOC_TYPES['__vc-soft'];
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['__vc-soft.json: [en] title: Longer than recommended: 8 characters, recommended max 5']);
  });
});

describe('draft media references (cms-media/) in published content', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cms-media-refs-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('finds a cms-media/ reference in any file at any depth under content/, case-insensitively', () => {
    mkdirSync(join(dir, 'pages'));
    mkdirSync(join(dir, 'contests'));
    writeFileSync(join(dir, 'pages', 'about.json'), JSON.stringify({ en: { hero: { media: 'cms-media/0b7c1f3e-5a4d-4c2e-9f10-1234567890ab' } } }));
    writeFileSync(join(dir, 'contests', '2027.json'), '{"x": "CMS-MEDIA/abc"}');
    writeFileSync(join(dir, 'site.json'), JSON.stringify({ img: '/media/0123456789ab.webp' }));
    expect(draftMediaRefs(dir)).toEqual([
      'contests/2027.json: draft media reference (cms-media/) in published content: publish it through the CMS',
      'pages/about.json: draft media reference (cms-media/) in published content: publish it through the CMS',
    ]);
  });

  it('a published /media/ reference and a missing folder pass', () => {
    expect(draftMediaRefs(join(dir, 'nope'))).toEqual([]);
    const ok = join(dir, 'ok');
    mkdirSync(ok);
    writeFileSync(join(ok, 'a.json'), JSON.stringify({ img: '/media/0123456789ab.webp' }));
    expect(draftMediaRefs(ok)).toEqual([]);
  });

  it('the committed content/ holds none', () => {
    expect(CONTENT_DIR).toBe(join(__dirname, '../../content'));
    expect(draftMediaRefs(CONTENT_DIR)).toEqual([]);
  });
});

describe('npm run build', () => {
  // Invalid content must fail the build before any bundling or prerendering.
  it('runs validate-content right after typecheck:shared, before vite build', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { scripts: Record<string, string> };
    const steps = pkg.scripts.build.split('&&').map((s) => s.trim());
    const at = (step: string) => steps.findIndex((s) => s === step);
    const typecheck = at('npm run typecheck:shared');
    const validate = at('tsx scripts/cms/validate-content.ts');
    expect(typecheck).toBeGreaterThanOrEqual(0);
    expect(validate).toBe(typecheck + 1);
    expect(validate).toBeLessThan(steps.findIndex((s) => s.startsWith('vite build')));
    expect(steps.filter((s) => s.includes('validate-content'))).toHaveLength(1);
  });
});

describe('content/pages/index.json (editorial index) is consistent with the files', () => {
  let dir: string;
  const editorial = JSON.stringify({ en: { intro: 'Kyiv.', blocks: [] }, el: { intro: 'Κίεβο.', blocks: [] } });
  const write = (name: string, files: Record<string, string>) => {
    const d = join(dir, name);
    mkdirSync(d);
    for (const [f, text] of Object.entries(files)) writeFileSync(join(d, f), text);
    return d;
  };
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'cms-index-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('the index is not a document; listing exactly the editorial docs passes', () => {
    const d = write('ok', {
      'archive-2005.json': editorial,
      'country-gr.json': editorial,
      'index.json': '{\n  "editorial": [\n    "archive-2005",\n    "country-gr"\n  ]\n}\n',
    });
    expect(validateContentDir(d)).toEqual({ count: 2, errors: [], warnings: [] });
  });

  it('an empty index with no editorial docs passes; no index and no editorial docs passes', () => {
    expect(validateContentDir(write('empty-index', { 'index.json': '{"editorial":[]}' })).errors).toEqual([]);
    expect(validateContentDir(write('no-index', {})).errors).toEqual([]);
  });

  it('an editorial doc missing from the index, or an index id without a file, is an error', () => {
    const d = write('drift', { 'archive-2005.json': editorial, 'index.json': '{"editorial":["hub-2026"]}' });
    expect(validateContentDir(d).errors).toEqual([
      'index.json: lists "hub-2026", but content/pages/hub-2026.json does not exist',
      'index.json: does not list "archive-2005" (content/pages/archive-2005.json exists)',
    ]);
  });

  it('an editorial doc without an index is an error', () => {
    expect(validateContentDir(write('missing', { 'hub-2026.json': editorial })).errors).toEqual([
      'index.json: missing, but editorial documents exist (hub-2026): publish writes it',
    ]);
  });

  it('a malformed, unsorted or non-editorial index is an error', () => {
    expect(validateContentDir(write('bad', { 'index.json': '{"editorial":"x"}' })).errors).toEqual([
      'index.json: must be { "editorial": [doc ids] }',
    ]);
    expect(validateContentDir(write('broken', { 'index.json': '{oops' })).errors[0]).toMatch(/^index\.json: invalid JSON/);
    const d = write('unsorted', {
      'archive-2005.json': editorial, 'country-gr.json': editorial, 'index.json': '{"editorial":["country-gr","archive-2005","faq"]}',
    });
    expect(validateContentDir(d).errors).toEqual([
      'index.json: lists "faq", which is not an editorial doc id',
      'index.json: ids must be sorted and unique',
    ]);
  });

  it('the committed content/pages passes (its index matches its files)', () => {
    expect(validateContentDir(join(CONTENT_DIR, 'pages')).errors).toEqual([]);
  });
});

describe('published media references (/media/…) against public/media', () => {
  let root: string;
  let content: string;
  let media: string;
  const write = (dir: string, name: string, data: string) => {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), data);
  };
  const image = (sha: string) => ({ media: `/media/${sha}.webp`, alt: 'a', width: 1600, height: 900 });
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cms-media-guard-'));
    content = join(root, 'content');
    media = join(root, 'public', 'media');
    mkdirSync(content, { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('no public/media folder and no references: nothing to report', () => {
    write(content, 'pages/about.json', JSON.stringify({ en: { title: 'x' } }));
    expect(mediaRefReport(content, media)).toEqual({ errors: [], warnings: [] });
  });

  it('a missing content folder is fine too', () => {
    expect(mediaRefReport(join(root, 'nope'), media)).toEqual({ errors: [], warnings: [] });
  });

  it('every reference exists: an image value needs its file and its -800 variant', () => {
    write(content, 'pages/archive-2005.json', JSON.stringify({ en: { blocks: [{ type: 'image', image: image('0123456789ab') }] } }));
    write(media, '0123456789ab.webp', 'x');
    write(media, '0123456789ab-800.webp', 'x');
    expect(mediaRefReport(content, media)).toEqual({ errors: [], warnings: [] });
  });

  it('a missing file fails with the content file and the reference', () => {
    write(content, 'pages/archive-2005.json', JSON.stringify({ en: { intro: 'See [pic](/media/0123456789ab.webp).' } }));
    const r = mediaRefReport(content, media);
    expect(r.errors).toEqual(['pages/archive-2005.json: /media/0123456789ab.webp is referenced but public/media/0123456789ab.webp does not exist']);
  });

  it('an image value without its -800 variant fails naming the variant', () => {
    write(content, 'pages/a.json', JSON.stringify({ en: { hero: image('0123456789ab') } }));
    write(media, '0123456789ab.webp', 'x');
    expect(mediaRefReport(content, media).errors).toEqual([
      'pages/a.json: /media/0123456789ab-800.webp (the 800 w variant of an image) is referenced but public/media/0123456789ab-800.webp does not exist',
    ]);
  });

  it('a video reference needs its file, poster and captions; a poster does not need a variant', () => {
    write(content, 'pages/v.json', JSON.stringify({ en: { video: { media: '/media/aaaaaaaaaaaa.mp4', poster: '/media/bbbbbbbbbbbb.webp', captions: '/media/cccccccccccc.vtt', autoplay: false, width: 1, height: 1 } } }));
    write(media, 'aaaaaaaaaaaa.mp4', 'x');
    write(media, 'bbbbbbbbbbbb.webp', 'x');
    expect(mediaRefReport(content, media).errors).toEqual([
      'pages/v.json: /media/cccccccccccc.vtt is referenced but public/media/cccccccccccc.vtt does not exist',
    ]);
  });

  it('draft refs, other hosts and unrelated strings are not /media/ references', () => {
    write(content, 'pages/x.json', JSON.stringify({ en: { a: 'cms-media/0b7c1f3e', b: 'https://example.com/media/foo.webp', c: '/medias/x', d: 'media/x.webp' } }));
    expect(mediaRefReport(content, media)).toEqual({ errors: [], warnings: [] });
  });

  it('an unreferenced file in public/media is only a warning', () => {
    write(content, 'pages/a.json', JSON.stringify({ en: { hero: image('0123456789ab') } }));
    write(media, '0123456789ab.webp', 'x');
    write(media, '0123456789ab-800.webp', 'x');
    write(media, 'ffffffffffff.webp', 'x');
    expect(mediaRefReport(content, media)).toEqual({
      errors: [],
      warnings: ['public/media/ffffffffffff.webp: not referenced by anything under content/'],
    });
  });

  it('references in files other than content/pages count (contests, site)', () => {
    write(content, 'contests/2027.json', JSON.stringify({ poster: '/media/0123456789ab.webp' }));
    write(media, '0123456789ab.webp', 'x');
    expect(mediaRefReport(content, media)).toEqual({ errors: [], warnings: [] });
  });

  it('the committed repo passes (public/media may not exist yet)', () => {
    const r = mediaRefReport(CONTENT_DIR, PUBLIC_MEDIA_DIR);
    expect(r.errors).toEqual([]);
    expect(PUBLIC_MEDIA_DIR).toBe(join(__dirname, '../../public/media'));
  });
});
