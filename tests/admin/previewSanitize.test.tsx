// I1: the admin preview renders the draft as edited, which may not validate.
// A rawHtml field is rendered with dangerouslySetInnerHTML and an href goes
// into <a href>, so PreviewPane sanitizes a copy first: rawHtml that fails the
// allowlist is shown as escaped text, an unsafe href becomes "#".
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PreviewPane from '../../src/admin/modules/pages/PreviewPane';
import { sanitizePreviewDoc, sanitizeSchemaDoc } from '../../src/admin/modules/pages/sanitizePreview';
import { blocks, group, image, richText } from '../../supabase/functions/_shared/cms/fields';
import { bundledContent } from '../../src/lib/seo/contentData';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

type Item = Record<string, string>;
type Rules = { duels: { items: Item[] }; related: { items: Item[] } };
type Doc = { en: Rules; el: Rules };

const XSS_HTML = '<img src=x onerror=alert(1)> and <a href="javascript:alert(1)">click</a>';
const XSS_HREF = 'javascript:alert(1)';

function hostileRules(): Doc {
  const doc = JSON.parse(JSON.stringify(bundledContent('pages/rules.json'))) as Doc;
  for (const locale of ['en', 'el'] as const) {
    doc[locale].duels.items[0].rest = XSS_HTML;
    doc[locale].related.items[0].href = XSS_HREF;
  }
  return doc;
}

function inAdmin(ui: React.ReactNode) {
  const router = createMemoryRouter([{ path: '/admin', element: <div>{ui}</div> }], { initialEntries: ['/admin'] });
  return render(<RouterProvider router={router} />);
}

describe('preview sanitization (I1)', () => {
  it('renders no <img>, no onerror attribute and no javascript: href from a hostile draft', () => {
    const doc = hostileRules();
    inAdmin(<PreviewPane docId="rules" doc={doc} />);
    const pane = screen.getByTestId('preview-pane');
    expect(pane.querySelector('img')).toBeNull();
    expect(pane.querySelector('[onerror]')).toBeNull();
    for (const a of pane.querySelectorAll('a')) {
      expect((a.getAttribute('href') ?? '').toLowerCase()).not.toContain('javascript:');
    }
    // The bad HTML is shown as text, so the editor sees what they typed.
    expect(pane.textContent).toContain('<img src=x onerror=alert(1)>');
    // The draft object itself is untouched (the editor still holds it).
    expect(doc.en.duels.items[0].rest).toBe(XSS_HTML);
    expect(doc.en.related.items[0].href).toBe(XSS_HREF);
  });

  it('keeps allowed rawHtml and safe hrefs as they are', () => {
    const doc = JSON.parse(JSON.stringify(bundledContent('pages/rules.json'))) as Doc;
    expect(sanitizePreviewDoc('rules', doc)).toEqual(doc);
  });

  it('escapes a non-string value at a rawHtml path and replaces a non-string href', () => {
    const doc = hostileRules() as unknown as { en: { duels: { items: Record<string, unknown>[] }; related: { items: Record<string, unknown>[] } } };
    doc.en.duels.items[0].rest = ['<img src=x onerror=alert(1)>'];
    doc.en.related.items[0].href = [XSS_HREF];
    const out = sanitizePreviewDoc('rules', doc) as typeof doc;
    expect(out.en.duels.items[0].rest).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(out.en.related.items[0].href).toBe('#');
  });

  it('passes a document it cannot walk through unchanged (the page shows its own error)', () => {
    expect(sanitizePreviewDoc('rules', null)).toBeNull();
    expect(sanitizePreviewDoc('nope', { en: {}, el: {} })).toEqual({ en: {}, el: {} });
  });
});

describe('preview sanitization: media references and rich text (CMS 3c)', () => {
  const UUID = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
  const schema = group({ hero: image(), zone: blocks(), story: richText() });
  const doc = (media: unknown, story: unknown = 'Ok') => ({
    en: { hero: { media, alt: 'A' }, zone: [{ type: 'video', video: { media, poster: media, autoplay: false } }], story },
    el: { hero: { media, alt: 'Α' }, zone: [], story: 'Ok' },
  });

  it('keeps draft and published references of the right kind', () => {
    const d = doc(`cms-media/${UUID}`);
    expect(sanitizeSchemaDoc(schema, d)).toEqual(d);
    const published = { en: { hero: { media: '/media/0123456789ab.webp', alt: 'A' }, zone: [], story: '' }, el: { hero: { media: '/media/0123456789ab.webp', alt: 'A' }, zone: [], story: '' } };
    expect(sanitizeSchemaDoc(schema, published)).toEqual(published);
  });

  it.each([
    ['a foreign url', 'https://evil.example/x.webp'],
    ['a javascript: url', 'javascript:alert(1)'],
    ['a published ref of another kind', '/media/0123456789ab.mp4'],
    ['a non-string', { src: 'x' }],
  ])('empties %s, also inside a block', (_n, bad) => {
    const out = sanitizeSchemaDoc(schema, doc(bad)) as ReturnType<typeof doc>;
    expect(out.en.hero.media).toBe('');
    expect(out.el.hero.media).toBe('');
    const video = (out.en.zone[0] as { video: { media: unknown; poster: unknown } }).video;
    expect(video.media).toBe(bad === '/media/0123456789ab.mp4' ? bad : '');
    expect(video.poster).toBe('');
  });

  it('a non-string rich text becomes empty (RichText parses strings only)', () => {
    const out = sanitizeSchemaDoc(schema, doc(`cms-media/${UUID}`, ['**x**'])) as ReturnType<typeof doc>;
    expect(out.en.story).toBe('');
  });
});
