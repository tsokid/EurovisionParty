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
import type { PrivacyContent } from '../../../supabase/functions/_shared/cms/schemas/privacy';
import { PageContentFallback } from './PageContentFallback';

export default function PrivacyPage() {
  const locale = useLocale();
  const content = usePageContent<PrivacyContent>('privacy');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.breadcrumbs.home, href: '/' },
    { label: c.breadcrumbs.privacy, href: '/privacy' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('privacy', locale) },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.meta.title,
    url: pageUrl('privacy', locale),
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
        pageId="privacy"
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
        current="privacy"
        crumbs={crumbs}
        chip={c.hero.chip}
        title={c.hero.title}
        lede={c.hero.lede}
        highlights={[3, 1, 2].map((i) => c.notCollect.items[i]).filter(Boolean).map((it, i) => ({
          icon: (['shield', 'x', 'lock'] as const)[i],
          title: it.bold.replace(/\.$/, ''),
          body: it.rest.trim(),
        }))}
      >

        {pageSections(c.layout, {
            whatCollect: () => (
              <Section cms="whatCollect.title" title={c.whatCollect.title}>
                <p>{c.whatCollect.intro}</p>
                <DataTable
                  headers={c.whatCollect.headers as unknown as string[]}
                  align={['left', 'left', 'left']}
                  rows={c.whatCollect.rows.map((row, i) => [
                    <strong key={`type-${i}`}>{row.type}</strong>,
                    row.purpose,
                    row.retention,
                  ])}
                />
              </Section>
            ),
            notCollect: () => (
              <Section cms="notCollect.title" title={c.notCollect.title}>
                <ul className="legal-list">
                  {c.notCollect.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.bold}</strong>{item.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            whoHasAccess: () => (
              <Section cms="whoHasAccess.title" title={c.whoHasAccess.title}>
                <p>{c.whoHasAccess.intro}</p>
                <ul className="legal-list">
                  {c.whoHasAccess.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.bold}</strong>{item.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            rights: () => (
              <Section cms="rights.title" title={c.rights.title}>
                <p>{c.rights.intro}</p>
                <ul className="legal-list">
                  {c.rights.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.bold}</strong>{item.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            deletion: () => (
              <Section cms="deletion.title" title={c.deletion.title}>
                <div className="card-hero card-pad legal-card">
                  <h3 className="t-h3">{c.deletion.cardTitle}</h3>
                  <p className="t-small">
                    {c.deletion.cardBody}
                  </p>
                </div>
                <p>{c.deletion.note}</p>
              </Section>
            ),
            cookies: () => (
              <Section cms="cookies.title" title={c.cookies.title}>
                <p>
                  {c.cookies.lead}
                  <a href="/cookies">
                    {c.cookies.linkLabel}
                  </a>
                  {c.cookies.tail}
                </p>
              </Section>
            ),
            children: () => (
              <Section cms="children.title" title={c.children.title}>
                <p>{c.children.body}</p>
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
