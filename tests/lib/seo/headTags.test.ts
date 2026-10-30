import { describe, it, expect } from 'vitest';
import { headTagsHtml } from '@/lib/seo/headTags';

const base = { title: 'T', description: 'D', canonical: 'https://eurovision.games/en/x' };

describe('headTagsHtml', () => {
  it('escapes attribute values', () => {
    const html = headTagsHtml({ ...base, title: 'Tom & "Jerry" <b>' });
    expect(html).toContain('<title>Tom &amp; &quot;Jerry&quot; &lt;b&gt;</title>');
    expect(html).toContain('content="Tom &amp; &quot;Jerry&quot; &lt;b&gt;"');
  });

  it('keeps Greek text intact', () => {
    expect(headTagsHtml({ ...base, title: 'Οδηγός Eurovision' })).toContain('Οδηγός Eurovision');
  });

  it('neutralises script close in JSON-LD', () => {
    const html = headTagsHtml({ ...base, jsonLd: { name: '</script><x>' } });
    expect(html).toContain('</script');
    expect(html).not.toContain('</script><x>');
  });

  it('defaults og:type and og:image', () => {
    const html = headTagsHtml(base);
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:image" content="https://eurovision.games/logo.png">');
    expect(html).toContain('<meta name="twitter:image" content="https://eurovision.games/logo.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<link rel="canonical" href="https://eurovision.games/en/x">');
  });

  it('emits one alternate link per hreflang entry', () => {
    const html = headTagsHtml({
      ...base,
      hreflang: [
        { hreflang: 'en', href: 'https://eurovision.games/en/x' },
        { hreflang: 'el', href: 'https://eurovision.games/el/x' },
        { hreflang: 'x-default', href: 'https://eurovision.games/en/x' },
      ],
    });
    expect(html.match(/<link rel="alternate"/g)).toHaveLength(3);
    expect(html).toContain('hreflang="el"');
  });

  it('emits locale alternates, keywords and article times', () => {
    const html = headTagsHtml({
      ...base, ogType: 'article', ogLocale: 'en_US', ogLocaleAlternate: ['el_GR'],
      keywords: ['a', 'b'], articlePublishedTime: '2026-01-01T00:00:00Z', articleModifiedTime: '2026-02-01T00:00:00Z',
    });
    expect(html).toContain('property="og:locale" content="en_US"');
    expect(html).toContain('property="og:locale:alternate" content="el_GR"');
    expect(html).toContain('name="keywords" content="a, b"');
    expect(html).toContain('property="article:published_time"');
    expect(html).toContain('property="article:modified_time"');
  });
});
