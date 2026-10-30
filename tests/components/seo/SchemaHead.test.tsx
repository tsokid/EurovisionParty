import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import SchemaHead from '@/components/seo/SchemaHead';
import { HeadProvider, createHeadCollector } from '@/lib/seo/HeadContext';

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
