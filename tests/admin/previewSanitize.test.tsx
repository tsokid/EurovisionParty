// I1: the admin preview renders the draft as edited, which may not validate.
// A rawHtml field is rendered with dangerouslySetInnerHTML and an href goes
// into <a href>, so PreviewPane sanitizes a copy first: rawHtml that fails the
// allowlist is shown as escaped text, an unsafe href becomes "#".
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PreviewPane from '../../src/admin/modules/pages/PreviewPane';
import { sanitizePreviewDoc } from '../../src/admin/modules/pages/sanitizePreview';
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
