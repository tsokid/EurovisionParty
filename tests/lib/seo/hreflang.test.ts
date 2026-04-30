import { describe, it, expect } from 'vitest';
import { buildHreflangLinks } from '@/lib/seo/hreflang';

describe('hreflang', () => {
  it('emits en, el, x-default for bilingual page', () => {
    const links = buildHreflangLinks({
      enUrl: 'https://eurovision.games/en/eurovision-night',
      elUrl: 'https://eurovision.games/el/eurovision-night',
    });
    expect(links).toContainEqual({ hreflang: 'en', href: 'https://eurovision.games/en/eurovision-night' });
    expect(links).toContainEqual({ hreflang: 'el', href: 'https://eurovision.games/el/eurovision-night' });
    expect(links).toContainEqual({ hreflang: 'x-default', href: 'https://eurovision.games/en/eurovision-night' });
  });

  it('greek-exclusive emits only el + x-default=el', () => {
    const links = buildHreflangLinks({
      elUrl: 'https://eurovision.games/el/eurovision-ellada',
    });
    expect(links).toHaveLength(2);
    expect(links).toContainEqual({ hreflang: 'el', href: 'https://eurovision.games/el/eurovision-ellada' });
    expect(links).toContainEqual({ hreflang: 'x-default', href: 'https://eurovision.games/el/eurovision-ellada' });
  });
});
