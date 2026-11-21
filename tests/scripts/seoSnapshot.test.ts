import { describe, it, expect } from 'vitest';
import { extractPage, routeForFile, type PageSnapshot, type Snapshot } from '../../scripts/seo/snapshot';
import { diffSnapshots } from '../../scripts/seo/snapshot-diff';

const html = `<!doctype html><html><head>
<title>  Eurovision
 Party </title>
<meta name="description" content="Desc">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://eurovision.games/en/faq">
<link rel="alternate" hreflang="el" href="https://eurovision.games/el/faq">
<link rel="alternate" hreflang="en" href="https://eurovision.games/en/faq">
<meta property="og:title" content="OG T"><meta property="og:description" content="OG D">
<script type="application/ld+json">{"b":1,"a":{"z":1,"y":2}}</script>
</head><body><a href="/nav-only">nav</a><main>
<h1>Hello
   world</h1><h2>a</h2><h2>b</h2>
<a href="/en/b">b</a><a href="/en/a">a</a><a href="/en/a">dup</a><a href="https://x.com">ext</a>
<a href="https://eurovision.games/en/c">abs</a>
</main></body></html>`;

describe('extractPage', () => {
  const p = extractPage(html, '/en/faq');
  it('extracts head fields', () => {
    expect(p.title).toBe('Eurovision Party');
    expect(p.description).toBe('Desc');
    expect(p.robots).toBe('index,follow');
    expect(p.canonical).toBe('https://eurovision.games/en/faq');
    expect(p.ogTitle).toBe('OG T');
    expect(p.ogDescription).toBe('OG D');
    expect(p.hreflang).toEqual(['el https://eurovision.games/el/faq', 'en https://eurovision.games/en/faq']);
  });
  it('extracts headings, sorted JSON-LD and main-scoped sorted links', () => {
    expect(p.h1).toEqual(['Hello world']);
    expect(p.h2Count).toBe(2);
    expect(p.jsonLd).toEqual(['{"a":{"y":2,"z":1},"b":1}']);
    expect(p.internalLinks).toEqual(['/en/a', '/en/b', '/en/c']);
  });
  it('falls back to body without main', () => {
    expect(extractPage('<body><a href="/x">x</a></body>', '/x').internalLinks).toEqual(['/x']);
  });
});

describe('routeForFile', () => {
  it('maps files to routes and skips shell, 404, admin', () => {
    expect(routeForFile('/d', '/d/en/faq.html')).toBe('/en/faq');
    expect(routeForFile('/d', '/d/index.html')).toBeNull();
    expect(routeForFile('/d', '/d/404.html')).toBeNull();
    expect(routeForFile('/d', '/d/admin/users.html')).toBeNull();
    expect(routeForFile('/d', '/d/mockup-predictions.html')).toBeNull();
    expect(routeForFile('/d', '/d/en.html')).toBe('/en');
  });
});

describe('diffSnapshots', () => {
  const base = (): Snapshot => ({ '/en/faq': extractPage(html, '/en/faq') });
  const mod = (fn: (p: PageSnapshot) => void): Snapshot => {
    const s = base();
    fn(s['/en/faq']);
    return s;
  };
  it('identical -> exit 0', () => expect(diffSnapshots(base(), base()).exitCode).toBe(0));
  it('removed route -> exit 1', () => expect(diffSnapshots(base(), {}).exitCode).toBe(1));
  it('added route -> exit 0', () => {
    const r = diffSnapshots({}, base());
    expect(r.exitCode).toBe(0);
    expect(r.added).toEqual(['/en/faq']);
  });
  it.each([
    ['title', (p: PageSnapshot) => { p.title = 'X'; }],
    ['description', (p: PageSnapshot) => { p.description = 'X'; }],
    ['robots', (p: PageSnapshot) => { p.robots = 'noindex'; }],
    ['canonical', (p: PageSnapshot) => { p.canonical = 'X'; }],
    ['hreflang', (p: PageSnapshot) => { p.hreflang = []; }],
    ['h1', (p: PageSnapshot) => { p.h1 = ['X']; }],
    ['jsonLd', (p: PageSnapshot) => { p.jsonLd = []; }],
  ])('%s change -> exit 1', (_n, fn) => {
    expect(diffSnapshots(base(), mod(fn)).exitCode).toBe(1);
  });
  it('link and h2 changes -> warnings only', () => {
    const r = diffSnapshots(base(), mod((p) => { p.internalLinks = ['/new']; p.h2Count = 9; }));
    expect(r.exitCode).toBe(0);
    expect(r.warnings.join('\n')).toMatch(/removed \[.*\] added \[\/new\]/);
    expect(r.warnings.join('\n')).toMatch(/h2Count: 2 -> 9/);
  });
});
