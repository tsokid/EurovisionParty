import SchemaHead from './SchemaHead';
import { getPage, type PageId } from '../../lib/seo/registry';
import { buildHreflangLinks } from '../../lib/seo/hreflang';
import { localizePath, type Locale } from '../../lib/seo/locale';
import type { HeadInput } from '../../lib/seo/headTags';

const SITE = 'https://eurovision.games';

// canonical, hreflang and og:locale(s) are derived from the registry + locale;
// everything else passes straight through to SchemaHead.
type Props = Omit<HeadInput, 'canonical' | 'hreflang' | 'ogLocale' | 'ogLocaleAlternate'> & {
  pageId: PageId;
  locale: Locale;
};

export default function PageSeo({ pageId, locale, ...rest }: Props) {
  const page = getPage(pageId);
  if (!page) {
    if (import.meta.env.DEV) console.warn(`PageSeo: unknown pageId "${pageId}"`);
    return null;
  }
  const enPath = localizePath('en', page.slugByLocale.en);
  const elPath = localizePath('el', page.slugByLocale.el);
  const enUrl = page.greekExclusive ? undefined : `${SITE}${enPath}`;
  const elUrl = page.englishExclusive ? undefined : `${SITE}${elPath}`;
  const canonical = locale === 'en' ? (enUrl ?? elUrl!) : (elUrl ?? enUrl!);
  const hreflang = buildHreflangLinks({ enUrl, elUrl });
  return (
    <SchemaHead
      {...rest}
      canonical={canonical}
      hreflang={hreflang}
      ogLocale={locale === 'en' ? 'en_US' : 'el_GR'}
      ogLocaleAlternate={locale === 'en' ? ['el_GR'] : ['en_US']}
    />
  );
}
