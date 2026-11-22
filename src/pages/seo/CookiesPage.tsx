import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import LegalFrame from '../../components/seo/LegalFrame';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import { layoutBlocks, pageSections } from '../../components/cms/PageSections';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { CookiesContent } from '../../../supabase/functions/_shared/cms/schemas/cookies';
import { PageContentFallback } from './PageContentFallback';

export default function CookiesPage() {
  const locale = useLocale();
  const content = usePageContent<CookiesContent>('cookies');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.breadcrumbs.home, href: '/' },
    { label: c.breadcrumbs.cookies, href: '/cookies' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = '2026-04-30T00:00:00Z'; // fact: date the page copy was last edited

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.title,
    description: c.meta.schemaDescription,
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('cookies', locale) },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.meta.title,
    url: pageUrl('cookies', locale),
    description: c.meta.webPageDescription,
    dateModified: MODIFIED,
    mainEntity: {
      '@type': 'CreativeWork',
      name: c.meta.webPageMainEntityName,
      about: c.meta.webPageMainEntityAbout,
    },
  };

  return (
    <>
      <PageSeo
        pageId="cookies"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, webPage, breadcrumbJsonLd(crumbs, locale)], layoutBlocks(c.layout))}
      />

      <LegalFrame
        current="cookies"
        crumbs={crumbs}
        chip={c.hero.chip}
        title={c.hero.title}
        lede={c.hero.lede}
      >

        {pageSections(c.layout, {
            whatWeUse: () => (
              <Section cms="whatWeUse.title" title={c.whatWeUse.title}>
                <p>{c.whatWeUse.intro}</p>
                <DataTable
                  headers={c.whatWeUse.headers as unknown as string[]}
                  align={['left', 'left', 'left']}
                  rows={c.whatWeUse.rows.map((row, i) => [
                    <strong key={`cat-${i}`}>{row.category}</strong>,
                    row.purpose,
                    <span
                      key={`def-${i}`}
                      className={row.defaultTone === 'pink' ? 'text-stage-pink-2' : 'text-stage-text-3'}
                    >
                      {row.defaultText}
                    </span>,
                  ])}
                />
              </Section>
            ),
            notUsed: () => (
              <Section cms="notUsed.title" title={c.notUsed.title}>
                <ul className="legal-list">
                  {c.notUsed.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.bold}</strong>{item.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            changeConsent: () => (
              <Section cms="changeConsent.title" title={c.changeConsent.title}>
                <p>
                  {c.changeConsent.intro.lead}
                  <em>{c.changeConsent.intro.emphasis}</em>
                  {c.changeConsent.intro.tail}
                </p>
                <div className="card-hero card-pad legal-card">
                  <h3 className="t-h3">{c.changeConsent.cardTitle}</h3>
                  <p className="t-small">
                    {c.changeConsent.cardBody}
                  </p>
                  <button
                    type="button"
                    data-cc="show-preferencesModal"
                    className="btn btn-primary btn-sm"
                  >
                    {c.changeConsent.buttonLabel}
                  </button>
                </div>
              </Section>
            ),
            whereDataLives: () => (
              <Section cms="whereDataLives.title" title={c.whereDataLives.title}>
                <p>
                  {c.whereDataLives.intro.lead}
                  <a href="/privacy">
                    {c.whereDataLives.intro.linkLabel}
                  </a>
                  {c.whereDataLives.intro.tail}
                </p>
                <ul className="legal-list">
                  {c.whereDataLives.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.bold}</strong>{item.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            banner: () => (
              <Section cms="banner.title" title={c.banner.title}>
                <p>
                  {c.banner.intro.lead}
                  <em>{c.banner.intro.accept}</em>
                  {c.banner.intro.mid1}
                  <em>{c.banner.intro.reject}</em>
                  {c.banner.intro.mid2}
                  <em>{c.banner.intro.manage}</em>
                  {c.banner.intro.tail}
                </p>
              </Section>
            ),
        })}

        <RelatedCards items={c.related} />
      </LegalFrame>
      <SiteFooter />
    </>
  );
}
