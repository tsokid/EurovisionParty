// CMS P6 (088): an image block whose own alt is empty shows the media
// library's alt of the page's language in the admin preview; its own alt
// always wins; the public site (no resolver) renders the block's alt as is.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CmsImage from '../../src/components/cms/CmsImage';
import { MediaResolverContext, type MediaResolver } from '../../src/components/cms/MediaResolver';
import { LocaleProvider } from '../../src/lib/seo/LocaleContext';

const DRAFT = 'cms-media/0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const resolver: MediaResolver = {
  image: () => ({ src: 'https://signed.test/a.webp', width: 1600, height: 900, alt: { en: 'The stage', el: 'Η σκηνή' } }),
  video: () => null,
};

const shown = (alt: string, locale: 'en' | 'el', withResolver = true) => {
  render(
    <LocaleProvider locale={locale}>
      <MediaResolverContext.Provider value={withResolver ? resolver : null}>
        <CmsImage value={{ media: DRAFT, alt, width: 0, height: 0 }} />
      </MediaResolverContext.Provider>
    </LocaleProvider>,
  );
  return screen.queryByRole('img') ?? screen.queryByRole('presentation');
};

describe('CmsImage alt from the library', () => {
  it('empty block alt: the library alt of the page language', () => {
    expect(shown('', 'el')).toHaveAttribute('alt', 'Η σκηνή');
  });
  it('the block alt wins', () => {
    expect(shown('Own words', 'en')).toHaveAttribute('alt', 'Own words');
  });
  it('a published image on the site keeps its committed alt', () => {
    render(
      <LocaleProvider locale="en">
        <CmsImage value={{ media: '/media/abcdef123456.webp', alt: 'Committed', width: 1600, height: 900 }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Committed');
  });
});
