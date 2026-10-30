// @vitest-environment node
// Final-review I2: the live hub must be reachable through crawlable links
// (plain <a href>) from the site's main pages, not only from the nav menu.
import { describe, it, expect } from 'vitest';
import { render } from '@/entry-server';

const HUB = (l: string) => `href="/${l}/eurovision-2026"`;

describe('crawlable links to the live hub', () => {
  it.each([
    '/en', '/el',
    '/en/eurovision-night', '/el/eurovision-night',
    '/en/past-contests', '/el/past-contests',
    '/en/eurovision-predictions', '/el/eurovision-predictions',
  ])('%s links to the hub', async (url) => {
    const r = await render(url);
    expect(r.status).toBe(200);
    expect(r.html).toContain(HUB(url.slice(1, 3)));
  });

  it.each([
    ['en', 'Eurovision 2026'],
    ['el', 'Eurovision 2026'],
  ])('%s footer has a "Eurovision {year}" link in its Eurovision column', async (l, label) => {
    const r = await render(`/${l}/about`);
    const footer = /<footer[\s\S]*<\/footer>/.exec(r.html)?.[0] ?? '';
    expect(footer).toMatch(new RegExp(`<a[^>]*${HUB(l)}[^>]*>${label}</a>`));
  });

  it.each([
    ['en', '/en/past-contests', /href="\/en\/eurovision-2026"[\s\S]*?<table/],
    ['el', '/el/past-contests', /href="\/el\/eurovision-2026"[\s\S]*?<table/],
  ])('%s past contests links the live hub above the table', async (_l, url, re) => {
    expect((await render(url)).html).toMatch(re);
  });

  it.each(['en', 'el'])('%s predictions line-up block links the hub', async (l) => {
    const html = (await render(`/${l}/eurovision-predictions`)).html;
    const lineup = /<section[^>]*id="lineup"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(lineup).toContain(HUB(l));
  });
});
