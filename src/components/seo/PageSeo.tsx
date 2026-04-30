import SchemaHead from './SchemaHead';
import { getPage, type PageId } from '../../lib/seo/registry';
import { buildHreflangLinks } from '../../lib/seo/hreflang';
import { localizePath, type Locale } from '../../lib/seo/locale';

const SITE = 'https://eurovision.games';

interface Props {
  pageId: PageId;
  locale: Locale;
  title: string;
  description: string;
  jsonLd?: object | object[];
}

export default function PageSeo({ pageId, locale, title, description, jsonLd }: Props) {
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
      title={title}
      description={description}
      canonical={canonical}
      jsonLd={jsonLd}
      hreflang={hreflang}
      ogLocale={locale === 'en' ? 'en_US' : 'el_GR'}
      ogLocaleAlternate={locale === 'en' ? ['el_GR'] : ['en_US']}
    />
  );
}
