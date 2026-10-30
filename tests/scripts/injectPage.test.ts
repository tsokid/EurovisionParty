import { describe, it, expect } from 'vitest';
import { injectPage, outputPath } from '../../scripts/prerender/injectPage';

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!--seo:start-->
    <title>Default Title</title>
    <meta name="description" content="Default description" />
    <!--seo:end-->
    <script type="application/ld+json">{"@type":"Organization"}</script>
  </head>
  <body>
    <div id="root">
      <!--app:start-->
      <noscript><p>fallback</p></noscript>
      <!--app:end-->
    </div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>`;

const page = {
  html: '<main><h1>Hello</h1></main>',
  headHtml: '<title>Page Title</title>\n<meta name="description" content="Page description">',
  lang: 'en' as const,
};

describe('injectPage', () => {
  it('replaces the seo block with headHtml', () => {
    const out = injectPage(TEMPLATE, page);
    expect(out).toContain('<title>Page Title</title>');
    expect(out).toContain('content="Page description"');
    expect(out).not.toContain('Default Title');
    expect(out).not.toContain('Default description');
    expect(out).not.toContain('seo:start');
  });

  it('keeps tags outside the seo block', () => {
    const out = injectPage(TEMPLATE, page);
    expect(out).toContain('{"@type":"Organization"}');
    expect(out).toContain('<meta charset="UTF-8" />');
    expect(out).toContain('src="/assets/index.js"');
  });

  it('replaces the app block with the rendered html, with no stray whitespace in #root', () => {
    const out = injectPage(TEMPLATE, page);
    expect(out).not.toContain('fallback');
    expect(out).toContain('<div id="root" data-prerendered="true"><main><h1>Hello</h1></main></div>');
  });

  it('sets <html lang> from the page locale', () => {
    expect(injectPage(TEMPLATE, { ...page, lang: 'el' })).toContain('<html lang="el">');
    expect(injectPage(TEMPLATE, page)).toContain('<html lang="en">');
  });

  it('marks #root as prerendered', () => {
    expect(injectPage(TEMPLATE, page)).toContain('data-prerendered="true"');
  });

  it('leaves #root unflagged with prerenderedFlag: false (404.html must not hydrate)', () => {
    const out = injectPage(TEMPLATE, page, { prerenderedFlag: false });
    expect(out).not.toContain('data-prerendered');
    expect(out).toContain('<div id="root"><main><h1>Hello</h1></main></div>');
  });

  it('does not interpret $ patterns in rendered content', () => {
    const out = injectPage(TEMPLATE, { ...page, html: "<p>$& $1 $' cost</p>" });
    expect(out).toContain("<p>$& $1 $' cost</p>");
  });

  it('inlines the content files the page read as escaped JSON before </body>', () => {
    const content = { 'contests/2026.json': { year: 2026, song: '</script><script>alert(1)</script>' } };
    const out = injectPage(TEMPLATE, { ...page, content });
    const m = /<script type="application\/json" id="__content__">([\s\S]*?)<\/script>\s*<\/body>/.exec(out);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain('<');
    expect(JSON.parse(m![1])).toEqual(content);
  });

  it('emits no content script when the page read no content', () => {
    expect(injectPage(TEMPLATE, page)).not.toContain('__content__');
    expect(injectPage(TEMPLATE, { ...page, content: {} })).not.toContain('__content__');
  });

  it.each(['<!--seo:start-->', '<!--seo:end-->', '<!--app:start-->', '<!--app:end-->'])(
    'throws missing marker when %s is absent',
    (marker) => {
      expect(() => injectPage(TEMPLATE.replace(marker, ''), page)).toThrow(/missing marker/);
    },
  );
});

describe('outputPath', () => {
  it('maps a locale home to a top-level html file', () => {
    expect(outputPath('/en')).toBe('en.html');
    expect(outputPath('/el')).toBe('el.html');
  });

  it('maps nested paths to nested html files', () => {
    expect(outputPath('/en/how-to-play')).toBe('en/how-to-play.html');
    expect(outputPath('/el/faq')).toBe('el/faq.html');
  });
});
