import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import SchemaHead from '@/components/seo/SchemaHead';
import { HeadProvider, createHeadCollector } from '@/lib/seo/HeadContext';
import { headTagsHtml } from '@/lib/seo/headTags';

describe('SchemaHead with hreflang', () => {
  beforeEach(() => {
    cleanup();
    document.head.innerHTML = '';
  });

  it('emits hreflang link tags', () => {
    render(
      <SchemaHead
        title="Test"
        description="Desc"
        canonical="https://eurovision.games/en/test"
        hreflang={[
          { hreflang: 'en', href: 'https://eurovision.games/en/test' },
          { hreflang: 'el', href: 'https://eurovision.games/el/test' },
          { hreflang: 'x-default', href: 'https://eurovision.games/en/test' },
        ]}
      />
    );
    const links = document.querySelectorAll('link[rel="alternate"]');
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute('hreflang')).toBe('en');
  });
});

describe('SchemaHead server render', () => {
  it('collects head during server render', () => {
    const c = createHeadCollector();
    renderToString(
      <HeadProvider collector={c}>
        <SchemaHead title="T" description="D" canonical="https://eurovision.games/en/faq" />
      </HeadProvider>
    );
    expect(c.head?.title).toBe('T');
  });
});

describe('SchemaHead adopts server-rendered head tags (C1)', () => {
  beforeEach(() => {
    cleanup();
    document.head.innerHTML = '';
  });

  const pageA = {
    title: 'A',
    description: 'DA',
    canonical: 'https://eurovision.games/en/faq',
    hreflang: [
      { hreflang: 'en', href: 'https://eurovision.games/en/faq' },
      { hreflang: 'el', href: 'https://eurovision.games/el/faq' },
      { hreflang: 'x-default', href: 'https://eurovision.games/en/faq' },
    ],
    ogLocale: 'en_US' as const,
    ogLocaleAlternate: ['el_GR' as const],
    ogType: 'article' as const,
    articlePublishedTime: '2026-01-01T00:00:00Z',
    articleModifiedTime: '2026-02-01T00:00:00Z',
    jsonLd: [{ '@type': 'FAQPage', name: 'A' }, { '@type': 'BreadcrumbList', name: 'A' }],
  };
  const pageB = {
    title: 'B',
    description: 'DB',
    canonical: 'https://eurovision.games/en/rules',
    hreflang: [
      { hreflang: 'en', href: 'https://eurovision.games/en/rules' },
      { hreflang: 'el', href: 'https://eurovision.games/el/rules' },
      { hreflang: 'x-default', href: 'https://eurovision.games/en/rules' },
    ],
    ogLocale: 'en_US' as const,
    ogLocaleAlternate: ['el_GR' as const],
    jsonLd: { '@type': 'Article', name: 'B' },
  };

  const counts = () => ({
    jsonLd: document.head.querySelectorAll('script[type="application/ld+json"]').length,
    hreflang: document.head.querySelectorAll('link[rel="alternate"][hreflang]').length,
    ogAlt: document.head.querySelectorAll('meta[property="og:locale:alternate"]').length,
    article: document.head.querySelectorAll('meta[property^="article:"]').length,
  });

  it('replaces prerendered tags instead of duplicating them, then tracks navigation', () => {
    document.head.innerHTML = headTagsHtml(pageA);
    expect(counts()).toEqual({ jsonLd: 2, hreflang: 3, ogAlt: 1, article: 2 });

    const { rerender } = render(<SchemaHead {...pageA} />);
    expect(counts()).toEqual({ jsonLd: 2, hreflang: 3, ogAlt: 1, article: 2 });

    rerender(<SchemaHead {...pageB} />);
    expect(counts()).toEqual({ jsonLd: 1, hreflang: 3, ogAlt: 1, article: 0 });
    const hrefs = [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.getAttribute('href'));
    expect(hrefs.every((h) => h!.includes('/rules'))).toBe(true);
    expect(document.head.querySelector('script[type="application/ld+json"]')!.textContent).toContain('"B"');
  });
});
