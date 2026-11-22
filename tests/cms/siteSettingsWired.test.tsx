// @vitest-environment node
// CMS P6: every field of site-settings reaches the site (it was saved but
// not read before). With the committed values the pages are unchanged (the
// pagesUnchanged capture proves the bytes); with other values the head and
// the JSON-LD follow them.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const overrides = vi.hoisted(() => ({ docs: new Map<string, unknown>() }));
vi.mock('../../src/lib/seo/contentData', async (importActual) => {
  const actual = await importActual<typeof import('../../src/lib/seo/contentData')>();
  return { ...actual, bundledContent: (p: string) => (overrides.docs.has(p) ? overrides.docs.get(p) : actual.bundledContent(p)) };
});

const committed = JSON.parse(readFileSync(resolve(__dirname, '../../content/pages/site-settings.json'), 'utf8'));
const other = {
  siteName: 'Euro Party Games',
  defaultOgImage: 'https://cdn.example.org/share.png',
  organization: { name: 'Party Org', logo: 'https://cdn.example.org/square.png' },
  socialProfiles: [{ label: 'Instagram', href: 'https://instagram.com/europarty' }],
  contactEmail: 'team@example.org',
};

type Ld = Record<string, unknown> & { '@type': string };

async function page(url: string) {
  const { render } = await import('../../src/entry-server');
  const r = await render(url);
  const { headTagsHtml } = await import('../../src/lib/seo/headTags');
  const head = headTagsHtml(r.head!);
  const jsonLd = [...head.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const v = JSON.parse(m[1]) as Ld | Ld[];
    return Array.isArray(v) ? v : [v];
  });
  return { html: r.html, head, jsonLd };
}

describe('site settings are read by the site', { timeout: 60_000 }, () => {
  it('the committed values are the ones the pages always rendered', () => {
    expect(committed.en).toMatchObject({
      siteName: 'Eurovision Games',
      defaultOgImage: 'https://eurovision.games/logo.png',
      organization: { name: 'Eurovision Games', logo: 'https://eurovision.games/icon-512.png' },
      socialProfiles: [],
    });
  });

  it('other values flow into og:image, the Article publisher and author, the About Organization and the logo label', async () => {
    overrides.docs.set('pages/site-settings.json', { en: other, el: other });
    try {
      const about = await page('/en/about');
      expect(about.head).toContain('<meta property="og:image" content="https://cdn.example.org/share.png"');
      const org = about.jsonLd.find((j) => j['@type'] === 'Organization')!;
      expect(org).toMatchObject({ name: 'Party Org', sameAs: ['https://instagram.com/europarty'], logo: 'https://cdn.example.org/share.png' });
      expect(about.html).toContain('aria-label="Euro Party Games — home"');
      expect(about.html).not.toContain('Eurovision Games — home');

      const faq = await page('/en/faq');
      const article = faq.jsonLd.find((j) => j['@type'] === 'Article')!;
      expect(article).toMatchObject({
        image: 'https://cdn.example.org/share.png',
        author: { name: 'Party Org' },
        publisher: { name: 'Party Org', logo: { url: 'https://cdn.example.org/share.png' } },
      });
    } finally {
      overrides.docs.clear();
    }
  });

  it('the site-wide Organization and WebSite schema builders read them too', async () => {
    overrides.docs.set('pages/site-settings.json', { en: other, el: other });
    try {
      const { buildOrganization, buildWebSite } = await import('../../src/lib/seo/schema');
      expect(buildOrganization()).toMatchObject({ name: 'Party Org', logo: 'https://cdn.example.org/square.png', sameAs: ['https://instagram.com/europarty'] });
      expect(buildWebSite()).toMatchObject({ name: 'Euro Party Games' });
    } finally {
      overrides.docs.clear();
    }
  });
});
