import LocaleLink from '../../components/seo/LocaleLink';
import { pageModified } from '../../lib/seo/pageDates';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import LegalFrame from '../../components/seo/LegalFrame';
import Section from '../../components/seo/Section';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import { layoutBlocks, pageSections } from '../../components/cms/PageSections';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { TermsContent } from '../../../supabase/functions/_shared/cms/schemas/terms';
import { PageContentFallback } from './PageContentFallback';
import { useSiteSettings } from '../../lib/cms/siteSettings';

export default function TermsPage() {
  const locale = useLocale();
  const settings = useSiteSettings();
  const content = usePageContent<TermsContent>('terms');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.breadcrumbs.home, href: '/' },
    { label: c.breadcrumbs.terms, href: '/terms' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = pageModified('terms'); // the page's last change, from git (sitemap lastmod)

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.title,
    description: c.meta.schemaDescription,
    image: settings.defaultOgImage,
    author: { '@type': 'Organization', name: settings.organization.name, url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: settings.organization.name,
      logo: { '@type': 'ImageObject', url: settings.organization.logo },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('terms', locale) },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.meta.title,
    url: pageUrl('terms', locale),
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
        pageId="terms"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="article"
        ogImage={settings.defaultOgImage}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, webPage, breadcrumbJsonLd(crumbs, locale)], layoutBlocks(c.layout))}
      />

      <LegalFrame
        current="terms"
        crumbs={crumbs}
        chip={c.hero.chip}
        title={c.hero.title}
        lede={c.hero.lede}
      >

        {pageSections(c.layout, {
            whoWeAre: () => (
              <Section cms="whoWeAre.title" title={c.whoWeAre.title}>
                <p>{c.whoWeAre.lead}</p>
              </Section>
            ),
            free: () => (
              <Section cms="free.title" title={c.free.title}>
                <p>{c.free.intro}</p>
                <ul className="legal-list">
                  {c.free.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.bold}</strong>{item.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            conduct: () => (
              <Section cms="conduct.title" title={c.conduct.title}>
                <p>{c.conduct.intro}</p>
                <ul className="legal-list">
                  {c.conduct.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.bold}</strong>{item.rest}
                    </li>
                  ))}
                </ul>
                <p>{c.conduct.closer}</p>
              </Section>
            ),
            account: () => (
              <Section cms="account.title" title={c.account.title}>
                <p>{c.account.intro}</p>
                <ul className="legal-list">
                  {c.account.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.bold}</strong>{item.rest}
                    </li>
                  ))}
                  <li>
                    <strong>{c.account.deletionItem.bold}</strong>
                    {c.account.deletionItem.lead}
                    <LocaleLink to="/privacy">
                      {c.account.deletionItem.linkLabel}
                    </LocaleLink>
                    {c.account.deletionItem.tail}
                  </li>
                </ul>
              </Section>
            ),
            userContent: () => (
              <Section cms="userContent.title" title={c.userContent.title}>
                <p>
                  {c.userContent.lead}
                  <LocaleLink to="/privacy">
                    {c.userContent.linkLabel}
                  </LocaleLink>
                  {c.userContent.tail}
                </p>
              </Section>
            ),
            warranties: () => (
              <Section cms="warranties.title" title={c.warranties.title}>
                <p>
                  {c.warranties.lead}
                  <strong>{c.warranties.asIs}</strong>
                  {c.warranties.mid}
                  <strong>{c.warranties.asAvailable}</strong>
                  {c.warranties.tail}
                </p>
              </Section>
            ),
            liability: () => (
              <Section cms="liability.title" title={c.liability.title}>
                <p>{c.liability.body}</p>
              </Section>
            ),
            ebu: () => (
              <Section cms="ebu.title" title={c.ebu.title}>
                <div className="card-hero card-pad legal-card">
                  <h3 className="t-h3">{c.ebu.cardTitle}</h3>
                  <p className="t-small">
                    {c.ebu.body}
                    <strong>{c.ebu.bodyBold}</strong>
                    {c.ebu.bodyTail}
                  </p>
                </div>
              </Section>
            ),
            changes: () => (
              <Section cms="changes.title" title={c.changes.title}>
                <p>{c.changes.body}</p>
              </Section>
            ),
        })}

        <RelatedCards items={c.related} />
      </LegalFrame>
      <SiteFooter />
    </>
  );
}
