// scripts/seo/resolveUrl.ts: a small emulation of Vercel routing
// (trailingSlash, redirects with `has`, filesystem with cleanUrls, rewrites).
import { describe, it, expect } from 'vitest';
import { compileSource, resolveUrl, type VercelConfig } from '../../scripts/seo/resolveUrl';

const AL_EL = [{ type: 'header', key: 'accept-language', value: '(?<l>.*\\bel\\b.*)' }];

const cfg: VercelConfig = {
  cleanUrls: true,
  trailingSlash: false,
  redirects: [
    { source: '/', has: AL_EL, destination: '/el', permanent: true },
    { source: '/', destination: '/en', permanent: true },
    { source: '/:slug(faq|rules)', has: AL_EL, destination: '/el/:slug', permanent: true },
    { source: '/:slug(faq|rules)', destination: '/en/:slug', permanent: true },
    { source: '/:locale(en|el)/old', destination: '/:locale/faq', permanent: true },
    { source: '/:locale(en|el)/glossary', destination: '/:locale/faq', permanent: true },
    { source: '/:locale(en|el)/compare/:any*', destination: '/:locale/faq', permanent: true },
    { source: '/:locale(en|el)/chain', destination: '/:locale/old', permanent: true },
    { source: '/loop-a', destination: '/loop-b', permanent: true },
    { source: '/loop-b', destination: '/loop-a', permanent: true },
  ],
  rewrites: [{ source: '/((?!en/|el/|content/).*)', destination: '/' }],
};

const built = new Set(['/', '/en', '/el', '/en/faq', '/el/faq', '/en/rules']);

describe('compileSource', () => {
  it('matches literals exactly', () => {
    const m = compileSource('/a/b');
    expect(m('/a/b')).toEqual({});
    expect(m('/a/bc')).toBeNull();
    expect(m('/a')).toBeNull();
  });

  it('captures :name(alt|alt) params', () => {
    const m = compileSource('/:slug(faq|rules)');
    expect(m('/faq')).toEqual({ slug: 'faq' });
    expect(m('/rules')).toEqual({ slug: 'rules' });
    expect(m('/faqs')).toBeNull();
  });

  it('captures plain :name as one segment', () => {
    const m = compileSource('/x/:id');
    expect(m('/x/42')).toEqual({ id: '42' });
    expect(m('/x/42/43')).toBeNull();
    expect(m('/x/')).toBeNull();
  });

  it(':name* matches zero or more segments, the slash prefix included', () => {
    const m = compileSource('/c/:any*');
    expect(m('/c')).toEqual({ any: '' });
    expect(m('/c/a')).toEqual({ any: 'a' });
    expect(m('/c/a/b')).toEqual({ any: 'a/b' });
    expect(m('/cx')).toBeNull();
  });

  it('supports unnamed groups with nested regex', () => {
    const m = compileSource('/((?!en/|el/).*)');
    expect(m('/room/X')).toEqual({ '0': 'room/X' });
    expect(m('/en/x')).toBeNull();
    expect(m('/en')).toEqual({ '0': 'en' });
  });

  it('escapes regex metacharacters in literals', () => {
    const m = compileSource('/a.b');
    expect(m('/a.b')).toEqual({});
    expect(m('/axb')).toBeNull();
  });
});

describe('resolveUrl', () => {
  it('serves a built page with 0 hops', () => {
    expect(resolveUrl('/en/faq', cfg, built)).toEqual({ final: '/en/faq', hops: 0, status: 200, via: 'file' });
  });

  it('applies the first matching redirect, in order, ignoring `has` without the header', () => {
    expect(resolveUrl('/', cfg, built)).toMatchObject({ final: '/en', hops: 1, status: 200, via: 'file' });
    expect(resolveUrl('/faq', cfg, built)).toMatchObject({ final: '/en/faq', hops: 1, via: 'file' });
  });

  it('honours `has` when accept-language is sent', () => {
    const al = { acceptLanguage: 'el-GR,el;q=0.9' };
    expect(resolveUrl('/', cfg, built, al)).toMatchObject({ final: '/el', hops: 1, via: 'file' });
    expect(resolveUrl('/faq', cfg, built, al)).toMatchObject({ final: '/el/faq', hops: 1, via: 'file' });
    expect(resolveUrl('/faq', cfg, built, { acceptLanguage: 'de-DE' })).toMatchObject({ final: '/en/faq' });
  });

  it('substitutes params and :any* into the destination', () => {
    expect(resolveUrl('/el/old', cfg, built)).toMatchObject({ final: '/el/faq', hops: 1 });
    expect(resolveUrl('/en/compare/a-vs-b', cfg, built)).toMatchObject({ final: '/en/faq', hops: 1 });
  });

  it('counts every hop of a chain', () => {
    expect(resolveUrl('/en/chain', cfg, built)).toMatchObject({ final: '/en/faq', hops: 2, via: 'file' });
  });

  it('counts the trailingSlash 308 as a hop', () => {
    expect(resolveUrl('/en/faq/', cfg, built)).toMatchObject({ final: '/en/faq', hops: 1, via: 'file' });
    expect(resolveUrl('/faq/', cfg, built)).toMatchObject({ final: '/en/faq', hops: 2 });
  });

  it('cleanUrls: .html URLs 308 to the clean path', () => {
    expect(resolveUrl('/en/faq.html', cfg, built)).toMatchObject({ final: '/en/faq', hops: 1, via: 'file' });
  });

  it('falls back to the rewrite (SPA shell) when nothing else matches', () => {
    expect(resolveUrl('/room/ABCD', cfg, built)).toEqual({ final: '/room/ABCD', hops: 0, status: 200, via: 'rewrite' });
  });

  it('404s an unbuilt, unredirected locale path (no soft-404)', () => {
    expect(resolveUrl('/en/no-such-page', cfg, built)).toMatchObject({ status: 404, via: 'none', hops: 0 });
    expect(resolveUrl('/el/rules', cfg, built)).toMatchObject({ status: 404 });
  });

  it('matches case-sensitively, as Vercel does', () => {
    expect(compileSource('/:locale(en|el)/glossary')('/EN/glossary')).toBeNull();
    expect(resolveUrl('/en/glossary', cfg, built)).toMatchObject({ final: '/en/faq', hops: 1 });
    // Not redirected; the rewrite's (?!en/) lookahead is case-sensitive too, so it gets the shell.
    expect(resolveUrl('/EN/glossary', cfg, built)).toEqual({ final: '/EN/glossary', hops: 0, status: 200, via: 'rewrite' });
  });

  it('throws on conditions it does not emulate (non-header `has`, any `missing`)', () => {
    const withRedirect = (r: VercelConfig['redirects']) => ({ ...cfg, redirects: [...r!, ...cfg.redirects!] });
    const query = withRedirect([{ source: '/q', has: [{ type: 'query', key: 'x' }], destination: '/en', permanent: true }]);
    expect(() => resolveUrl('/en/faq', query, built)).toThrow(/Unsupported `has` type "query"/);
    const cookie = withRedirect([{ source: '/c', has: [{ type: 'cookie', key: 'k' }], destination: '/en', permanent: true }]);
    expect(() => resolveUrl('/en/faq', cookie, built)).toThrow(/Unsupported `has` type "cookie"/);
    const missing = withRedirect([
      { source: '/m', missing: [{ type: 'header', key: 'accept-language' }], destination: '/en', permanent: true },
    ]);
    expect(() => resolveUrl('/en/faq', missing, built)).toThrow(/Unsupported `missing`/);
    const rw: VercelConfig = { ...cfg, rewrites: [{ source: '/(.*)', destination: '/', missing: [{ type: 'host', key: 'h' }] }] };
    expect(() => resolveUrl('/en/faq', rw, built)).toThrow(/Unsupported `missing`/);
  });

  it('throws on a redirect loop', () => {
    expect(() => resolveUrl('/loop-a', cfg, built)).toThrow(/loop/i);
  });
});
