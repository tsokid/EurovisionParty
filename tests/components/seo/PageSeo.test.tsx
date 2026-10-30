import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import PageSeo from '@/components/seo/PageSeo';
import { HeadProvider, createHeadCollector } from '@/lib/seo/HeadContext';

function collect(el: React.ReactElement) {
  const c = createHeadCollector();
  renderToString(<HeadProvider collector={c}>{el}</HeadProvider>);
  return c.head;
}

describe('PageSeo', () => {
  it('builds a locale-prefixed canonical, hreflang and og locale', () => {
    const head = collect(<PageSeo pageId="faq" locale="el" title="T" description="D" />);
    expect(head?.canonical).toBe('https://eurovision.games/el/faq');
    expect(head?.ogLocale).toBe('el_GR');
    expect(head?.ogLocaleAlternate).toEqual(['en_US']);
    expect(head?.hreflang?.map((l) => l.href)).toEqual([
      'https://eurovision.games/en/faq',
      'https://eurovision.games/el/faq',
      'https://eurovision.games/en/faq',
    ]);
  });

  it('home canonical is the bare locale root', () => {
    expect(collect(<PageSeo pageId="home" locale="en" title="T" description="D" />)?.canonical)
      .toBe('https://eurovision.games/en');
  });

  it('passes through the remaining SchemaHead props', () => {
    const head = collect(
      <PageSeo
        pageId="eurovision-duels"
        locale="en"
        title="T"
        description="D"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        keywords={['a', 'b']}
        articlePublishedTime="2026-01-01"
        articleModifiedTime="2026-02-01"
        twitterTitle="TT"
        twitterDescription="TD"
        jsonLd={{ '@type': 'Thing' }}
      />,
    );
    expect(head).toMatchObject({
      canonical: 'https://eurovision.games/en/duels',
      ogType: 'article',
      ogImage: 'https://eurovision.games/logo.png',
      keywords: ['a', 'b'],
      articlePublishedTime: '2026-01-01',
      articleModifiedTime: '2026-02-01',
      twitterTitle: 'TT',
      twitterDescription: 'TD',
      jsonLd: { '@type': 'Thing' },
    });
  });

  it('builds canonical and hreflang from a dynamic path', () => {
    const head = collect(
      <PageSeo path="/eurovision-2026/songs" locale="el" title="T" description="D" robots="noindex" />,
    );
    expect(head?.canonical).toBe('https://eurovision.games/el/eurovision-2026/songs');
    expect(head?.robots).toBe('noindex');
    expect(head?.ogLocale).toBe('el_GR');
    expect(head?.hreflang).toEqual([
      { hreflang: 'en', href: 'https://eurovision.games/en/eurovision-2026/songs' },
      { hreflang: 'el', href: 'https://eurovision.games/el/eurovision-2026/songs' },
      { hreflang: 'x-default', href: 'https://eurovision.games/en/eurovision-2026/songs' },
    ]);
  });
});
