// P4 preview bridge: the postMessage port (origin, source and version
// checks), the iframe host (src, the draft sent live, viewport toggles
// remembered per person), cmsAttrs outside the preview, and the text mapping.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { windowPort, PREVIEW_NS, PREVIEW_PROTOCOL, memoryPorts, type HostMessage, type FrameMessage } from '../../src/admin/preview/protocol';
import PreviewPane, { PREVIEW_SEND_MS, viewportKey } from '../../src/admin/modules/pages/PreviewPane';
import { PreviewTransportContext, previewSrc } from '../../src/admin/preview/transport';
import { AdminUserContext } from '../../src/admin/cms/docChannel';
import { useCmsAttrs, CmsDocContext, parseCmsPath } from '../../src/lib/cms/cmsAttrs';
import { PreviewModeContext } from '../../src/lib/seo/PreviewMode';
import { LocaleProvider } from '../../src/lib/seo/LocaleContext';
import { autoTag, plainText, textChunks } from '../../src/admin/preview/autoTag';
import { parsePreviewPath } from '../../src/admin/preview/AdminPreviewRoute';
import { bundledContent } from '../../src/lib/seo/contentData';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('windowPort', () => {
  let frame: HTMLIFrameElement;
  beforeEach(() => {
    frame = document.createElement('iframe');
    document.body.appendChild(frame);
  });
  afterEach(() => frame.remove());

  const send = (data: unknown, source: Window | null, origin = window.location.origin) =>
    window.dispatchEvent(new MessageEvent('message', { data, source, origin }));

  it('accepts only our origin, the expected window and this protocol version', () => {
    const port = windowPort<FrameMessage, HostMessage>(window, () => frame.contentWindow);
    const got: FrameMessage[] = [];
    const off = port.listen((m) => got.push(m));
    const ok = { ns: PREVIEW_NS, v: PREVIEW_PROTOCOL, type: 'focus', target: 'faq:en:hero.title' };
    send(ok, frame.contentWindow);
    send(ok, frame.contentWindow, 'https://evil.example');
    send(ok, window);
    send({ ...ok, v: PREVIEW_PROTOCOL + 1 }, frame.contentWindow);
    send({ ...ok, ns: 'other' }, frame.contentWindow);
    send('focus', frame.contentWindow);
    off();
    send(ok, frame.contentWindow);
    expect(got).toEqual([{ type: 'focus', target: 'faq:en:hero.title' }]);
  });

  it('posts to our own origin only, with the namespace and version', () => {
    const spy = vi.spyOn(frame.contentWindow!, 'postMessage');
    windowPort<FrameMessage, HostMessage>(window, () => frame.contentWindow).post({ type: 'highlight', target: null });
    expect(spy).toHaveBeenCalledWith({ ns: PREVIEW_NS, v: PREVIEW_PROTOCOL, type: 'highlight', target: null }, window.location.origin);
  });

  it('memory ports deliver copies, asynchronously, each way', async () => {
    const { host, frame: f } = memoryPorts();
    const atFrame: HostMessage[] = [];
    f.listen((m) => atFrame.push(m));
    const msg: HostMessage = { type: 'highlight', target: 'x:en:a' };
    host.post(msg);
    expect(atFrame).toEqual([]);
    await Promise.resolve();
    expect(atFrame).toEqual([msg]);
    expect(atFrame[0]).not.toBe(msg);
  });
});

describe('the iframe host', () => {
  beforeEach(() => localStorage.clear());

  const iframeHost = (ui: React.ReactNode, userId = 'u-1') => render(
    <MemoryRouter>
      <AdminUserContext.Provider value={{ userId, email: 'owner@example.com' }}>
        <PreviewTransportContext.Provider value={{ kind: 'iframe', src: previewSrc }}>{ui}</PreviewTransportContext.Provider>
      </AdminUserContext.Provider>
    </MemoryRouter>,
  );

  it('loads /admin/preview/:docId/:locale and sends the draft over postMessage, debounced', async () => {
    vi.useFakeTimers();
    try {
      const doc = bundledContent('pages/rules.json');
      const { rerender } = iframeHost(<PreviewPane docId="rules" doc={doc} />);
      const iframe = screen.getByTitle('Προεπισκόπηση της σελίδας') as HTMLIFrameElement;
      expect(iframe.getAttribute('src')).toBe('/admin/preview/rules/en');
      const spy = vi.spyOn(iframe.contentWindow!, 'postMessage');
      const next = JSON.parse(JSON.stringify(doc));
      next.en.hero.title = 'Typed';
      rerender(
        <MemoryRouter>
          <AdminUserContext.Provider value={{ userId: 'u-1', email: 'owner@example.com' }}>
            <PreviewTransportContext.Provider value={{ kind: 'iframe', src: previewSrc }}><PreviewPane docId="rules" doc={next} /></PreviewTransportContext.Provider>
          </AdminUserContext.Provider>
        </MemoryRouter>,
      );
      expect(spy.mock.calls.some(([m]) => (m as { doc?: { en: { hero: { title: string } } } }).doc?.en.hero.title === 'Typed')).toBe(false);
      await act(async () => { vi.advanceTimersByTime(PREVIEW_SEND_MS + 10); });
      const state = spy.mock.calls.map(([m]) => m as Record<string, unknown>).filter((m) => m.type === 'state').at(-1)!;
      expect(state).toMatchObject({ ns: PREVIEW_NS, v: PREVIEW_PROTOCOL, docId: 'rules', docType: 'rules', locale: 'en' });
      expect((state.doc as { en: { hero: { title: string } } }).en.hero.title).toBe('Typed');
      expect(spy.mock.calls.every(([, origin]) => origin === window.location.origin)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Κινητό 390 · Tablet 768 · Desktop 1440; the choice is remembered per person', () => {
    const { unmount } = iframeHost(<PreviewPane docId="faq" doc={bundledContent('pages/faq.json')} />);
    const group = screen.getByRole('group', { name: 'Πλάτος προεπισκόπησης' });
    const btn = (name: RegExp) => within(group).getByRole('button', { name });
    for (const [name, width] of [[/Κινητό/, 390], [/Tablet/, 768], [/Desktop/, 1440]] as const) {
      fireEvent.click(btn(name));
      expect(btn(name).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('preview-viewport').getAttribute('data-width')).toBe(String(width));
      expect((screen.getByTitle('Προεπισκόπηση της σελίδας') as HTMLIFrameElement).style.width).toBe(`${width}px`);
    }
    fireEvent.click(btn(/Tablet/));
    expect(localStorage.getItem(viewportKey('u-1'))).toBe('tablet');
    unmount();
    iframeHost(<PreviewPane docId="faq" doc={bundledContent('pages/faq.json')} />);
    expect(screen.getByTestId('preview-viewport').getAttribute('data-viewport')).toBe('tablet');
  });

  it('another person keeps their own choice', () => {
    localStorage.setItem(viewportKey('u-1'), 'mobile');
    localStorage.setItem(viewportKey('u-2'), 'desktop');
    const { unmount } = iframeHost(<PreviewPane docId="faq" doc={bundledContent('pages/faq.json')} />, 'u-2');
    expect(screen.getByTestId('preview-viewport').getAttribute('data-viewport')).toBe('desktop');
    unmount();
    iframeHost(<PreviewPane docId="faq" doc={bundledContent('pages/faq.json')} />, 'u-1');
    expect(screen.getByTestId('preview-viewport').getAttribute('data-viewport')).toBe('mobile');
  });

  it('a field of the other language switches the preview to it', async () => {
    const doc = bundledContent('pages/faq.json');
    const { rerender } = iframeHost(<PreviewPane docId="faq" doc={doc} highlight={null} />);
    const lang = screen.getByRole('group', { name: 'Γλώσσα προεπισκόπησης' });
    expect(within(lang).getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true');
    rerender(
      <MemoryRouter>
        <AdminUserContext.Provider value={{ userId: 'u-1', email: 'owner@example.com' }}>
          <PreviewTransportContext.Provider value={{ kind: 'iframe', src: previewSrc }}><PreviewPane docId="faq" doc={doc} highlight="el.hero.title" /></PreviewTransportContext.Provider>
        </AdminUserContext.Provider>
      </MemoryRouter>,
    );
    await flush();
    expect(within(lang).getByRole('button', { name: 'EL' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('cmsAttrs', () => {
  function Probe() {
    const attrs = useCmsAttrs();
    const header = useCmsAttrs('site-header');
    return <p {...attrs('hero.title')}><span {...header('cta.createRoom')}>x</span></p>;
  }

  it('renders nothing on the site and in the prerender (no preview mode)', () => {
    const html = renderToString(<CmsDocContext.Provider value="faq"><LocaleProvider locale="en"><Probe /></LocaleProvider></CmsDocContext.Provider>);
    expect(html).toBe('<p><span>x</span></p>');
  });

  it('in the preview: docId:locale:path', () => {
    const html = renderToString(
      <PreviewModeContext.Provider value={true}>
        <CmsDocContext.Provider value="faq"><LocaleProvider locale="el"><Probe /></LocaleProvider></CmsDocContext.Provider>
      </PreviewModeContext.Provider>,
    );
    expect(html).toBe('<p data-cms-path="faq:el:hero.title"><span data-cms-path="site-header:el:cta.createRoom">x</span></p>');
    expect(parseCmsPath('faq:el:blocks.3.items.1.a')).toEqual({ docId: 'faq', locale: 'el', path: 'blocks.3.items.1.a' });
    expect(parseCmsPath('nope')).toBeNull();
  });
});

describe('autoTag (text mapping)', () => {
  it('reduces Markdown and inline HTML to the text they render, line by line', () => {
    expect(plainText('**Bold** and [a link](/faq) <em>here</em> &amp; there')).toBe('Bold and a link here & there');
    expect(textChunks('## Title\n\n- one\n- two')).toEqual(expect.arrayContaining(['Title', 'one', 'two']));
  });

  it('tags elements whose own text is a field, placeholders as wildcards; explicit markers win', () => {
    document.body.innerHTML = `<div id="r">
      <h2>Rules for 2026</h2><p>Plain line</p><p data-cms-path="faq:en:hero.lede">Plain line</p>
      <li><strong>Bold</strong> <span>rest of it</span></li><div><span id="none">nothing</span></div></div>`;
    const root = document.getElementById('r')!;
    const n = autoTag(root, 'faq', 'en', { title: 'Rules for {year}', lines: ['Plain line'], item: { strong: 'Bold', rest: 'rest of it' } });
    const at = (sel: string) => root.querySelector(sel)!.getAttribute('data-cms-path');
    expect(at('h2')).toBe('faq:en:title');
    expect(at('p')).toBe('faq:en:lines.0');
    expect(root.querySelectorAll('p')[1].getAttribute('data-cms-path')).toBe('faq:en:hero.lede');
    expect(at('strong')).toBe('faq:en:item.strong');
    expect(at('li span')).toBe('faq:en:item.rest');
    expect(root.querySelector("#none")!.hasAttribute("data-cms-path")).toBe(false);
    expect(n).toBe(4);
    // A new pass clears its own tags first.
    autoTag(root, 'faq', 'en', {});
    expect(root.querySelectorAll('[data-cms-auto]').length).toBe(0);
    expect(root.querySelectorAll('[data-cms-path]').length).toBe(1);
  });
});

describe('/admin/preview/:docId/:locale', () => {
  it('parses the doc id and locale; anything else is refused', () => {
    expect(parsePreviewPath('/admin/preview/faq/el')).toEqual({ docId: 'faq', locale: 'el' });
    expect(parsePreviewPath('/admin/preview/site-header/en/')).toEqual({ docId: 'site-header', locale: 'en' });
    expect(parsePreviewPath('/admin/preview/faq/de')).toBeNull();
    expect(parsePreviewPath('/admin/preview/../x/en')).toBeNull();
    expect(parsePreviewPath('/admin/preview/faq')).toBeNull();
  });
});
