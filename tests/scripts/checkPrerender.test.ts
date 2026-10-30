import { describe, it, expect } from 'vitest';
import { checkPrerender } from '../../scripts/seo/checkPrerender';

const page = (url: string, title: string, desc: string, canonical = url) => ({
  url,
  html: `<html><head><title>${title}</title><meta name="description" content="${desc}"><link rel="canonical" href="${canonical}"></head><body></body></html>`,
});
const B = 'https://eurovision.games';
const good = () => [
  page(`${B}/en`, 'Home', 'Home desc'),
  page(`${B}/en/faq`, 'FAQ', 'FAQ desc'),
  page(`${B}/el`, 'Home', 'Home desc'),
];
const locs = [`${B}/en`, `${B}/en/faq`, `${B}/el`];

describe('checkPrerender', () => {
  it('passes when all good (same title across locales is fine)', () => {
    expect(checkPrerender(good(), locs, true)).toEqual([]);
  });
  it('flags sitemap URL without file', () => {
    const errs = checkPrerender(good(), [...locs, `${B}/en/missing`], true);
    expect(errs.some((e) => e.includes(`${B}/en/missing`))).toBe(true);
  });
  it('flags duplicate title within a locale', () => {
    const pages = [...good(), page(`${B}/en/about`, 'FAQ', 'About desc')];
    const errs = checkPrerender(pages, locs, true);
    expect(errs.some((e) => e.includes(`${B}/en/faq`) && e.includes(`${B}/en/about`))).toBe(true);
  });
  it('flags duplicate description within a locale', () => {
    const pages = [...good(), page(`${B}/en/about`, 'About', 'FAQ desc')];
    const errs = checkPrerender(pages, locs, true);
    expect(errs.some((e) => /description/i.test(e) && e.includes(`${B}/en/about`))).toBe(true);
  });
  it('flags canonical not equal to own URL', () => {
    const pages = [page(`${B}/en`, 'Home', 'd', `${B}/en/other`), ...good().slice(1)];
    const errs = checkPrerender(pages, locs, true);
    expect(errs.some((e) => /canonical/i.test(e) && e.includes(`${B}/en`))).toBe(true);
  });
  it('flags missing 404.html', () => {
    expect(checkPrerender(good(), locs, false).some((e) => e.includes('404'))).toBe(true);
  });
});

describe('checkPrerender: non-indexable pages', () => {
  const noindex = (url: string, title: string, desc: string) => ({
    url,
    html: `<html><head><title>${title}</title><meta name="description" content="${desc}"><link rel="canonical" href="${url}"><meta name="robots" content="noindex"></head><body></body></html>`,
  });
  const MA = `${B}/en/countries/morocco`;

  it('passes when a non-indexable page carries robots noindex and is not in the sitemap', () => {
    expect(checkPrerender([...good(), noindex(MA, 'Morocco', 'MA desc')], locs, true, [MA])).toEqual([]);
  });
  it('flags a non-indexable page without robots noindex', () => {
    const errs = checkPrerender([...good(), page(MA, 'Morocco', 'MA desc')], locs, true, [MA]);
    expect(errs.some((e) => /noindex/.test(e) && e.includes(MA))).toBe(true);
  });
  it('flags a non-indexable page listed in the sitemap', () => {
    const errs = checkPrerender([...good(), noindex(MA, 'Morocco', 'MA desc')], [...locs, MA], true, [MA]);
    expect(errs.some((e) => /sitemap/.test(e) && e.includes(MA))).toBe(true);
  });
  it('flags a non-indexable page with no built file', () => {
    const errs = checkPrerender(good(), locs, true, [MA]);
    expect(errs.some((e) => e.includes(MA))).toBe(true);
  });
  it('reads attributes with spaces around =', () => {
    const p = noindex(MA, 'Morocco', 'MA desc');
    p.html = p.html.replace('content="noindex"', 'content = "noindex"');
    expect(checkPrerender([...good(), p], locs, true, [MA])).toEqual([]);
  });
  it('accepts robots values that contain noindex among other directives', () => {
    const p = noindex(MA, 'Morocco', 'MA desc');
    p.html = p.html.replace('content="noindex"', 'content="noindex, follow"');
    expect(checkPrerender([...good(), p], locs, true, [MA])).toEqual([]);
  });
});

describe('checkPrerender: pages built without their content', () => {
  it('flags a page rendered in the ContentPending state (missing contest file)', async () => {
    const { renderToString } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { ContentPending } = await import('../../src/pages/contest/ContentPending');
    for (const retry of [undefined, () => {}]) {
      const body = renderToString(createElement(ContentPending, { locale: 'en', retry, inline: true }));
      const pages = good().map((p) => (p.url.endsWith('/faq') ? { ...p, html: p.html.replace('<body></body>', `<body>${body}</body>`) } : p));
      const errors = checkPrerender(pages, locs, true);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/content state "(pending|error)".*\/en\/faq$/);
    }
  });
});
