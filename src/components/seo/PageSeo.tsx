import SchemaHead from './SchemaHead';
import { absoluteUrl, getPage, pageUrl, type PageId } from '../../lib/seo/registry';
import { buildHreflangLinks } from '../../lib/seo/hreflang';
import type { Locale } from '../../lib/seo/locale';
import type { HeadInput } from '../../lib/seo/headTags';

// canonical, hreflang and og:locale(s) are derived from the page target +
// locale; everything else passes straight through to SchemaHead.
// Target: a registry `pageId` (static pages), or an unprefixed `path` for the
// data-driven pages (e.g. `/eurovision-2026/songs`), which exist in both locales.
type Target = { pageId: PageId; path?: never } | { path: string; pageId?: never };

type Props = Omit<HeadInput, 'canonical' | 'hreflang' | 'ogLocale' | 'ogLocaleAlternate'> & Target & {
  locale: Locale;
};

function resolveUrls(target: Target, locale: Locale): { canonical: string; enUrl?: string; elUrl?: string } | null {
  if (target.path !== undefined) {
    const enUrl = absoluteUrl('en', target.path);
    const elUrl = absoluteUrl('el', target.path);
    return { canonical: locale === 'en' ? enUrl : elUrl, enUrl, elUrl };
  }
  const page = getPage(target.pageId);
  if (!page) {
    if (import.meta.env.DEV) console.warn(`PageSeo: unknown pageId "${target.pageId}"`);
    return null;
  }
  return {
    canonical: pageUrl(target.pageId, locale),
    enUrl: page.greekExclusive ? undefined : absoluteUrl('en', page.slugByLocale.en),
    elUrl: page.englishExclusive ? undefined : absoluteUrl('el', page.slugByLocale.el),
  };
}

export default function PageSeo({ pageId, path, locale, ...rest }: Props) {
  const urls = resolveUrls(path !== undefined ? { path } : { pageId: pageId! }, locale);
  if (!urls) return null;
  return (
    <SchemaHead
      {...rest}
      canonical={urls.canonical}
      hreflang={buildHreflangLinks({ enUrl: urls.enUrl, elUrl: urls.elUrl })}
      ogLocale={locale === 'en' ? 'en_US' : 'el_GR'}
      ogLocaleAlternate={locale === 'en' ? ['el_GR'] : ['en_US']}
    />
  );
}
