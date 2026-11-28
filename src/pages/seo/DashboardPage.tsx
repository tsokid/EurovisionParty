import { pageModified } from '../../lib/seo/pageDates';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import { ArticleFrame } from '../../components/seo/LegalFrame';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import { layoutBlocks, pageSections } from '../../components/cms/PageSections';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { DashboardContent } from '../../../supabase/functions/_shared/cms/schemas/dashboard';
import { PageContentFallback } from './PageContentFallback';
import { useSiteSettings } from '../../lib/cms/siteSettings';

export default function DashboardPage() {
  const locale = useLocale();
  const settings = useSiteSettings();
  const content = usePageContent<DashboardContent>('dashboard');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/dashboard' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = pageModified('dashboard'); // the page's last change, from git (sitemap lastmod)

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.headline,
    description: c.meta.articleDescription,
    image: settings.defaultOgImage,
    author: { '@type': 'Organization', name: settings.organization.name, url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: settings.organization.name,
      logo: { '@type': 'ImageObject', url: settings.defaultOgImage },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('dashboard', locale) },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <PageSeo
        pageId="dashboard"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="article"
        ogImage={settings.defaultOgImage}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, faqJsonLd, breadcrumbJsonLd(crumbs, locale)], layoutBlocks(c.layout))}
      />

      <ArticleFrame
        crumbs={crumbs}
        chip={c.hero.chip}
        title={c.hero.title}
        grad="dash"
        lede={c.hero.lede}
        actions={{ primary: { label: c.cta.primary, href: '/?action=create' }, secondary: { label: c.cta.secondary, href: '/how-to-play' } }}
      >

        {pageSections(c.layout, {
            shows: () => (
              <Section cms="sections.shows.title" title={c.sections.shows.title}>
                <p>{c.sections.shows.intro}</p>
                <ul className="legal-list">
                  {c.sections.shows.bullets.map((b) => (
                    <li key={b.strong}>
                      <strong>{b.strong}</strong>
                      {b.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            sources: () => (
              <Section cms="sections.sources.title" title={c.sections.sources.title}>
                <p>{c.sections.sources.intro}</p>
                <DataTable
                  headers={c.sections.sources.tableHeaders}
                  align={['left', 'left', 'right']}
                  rows={c.sections.sources.rows.map((r, i) => [
                    r.source,
                    r.when,
                    r.capIsOpen ? (
                      <span key={`cap-${i}`} className="text-stage-text-2">{r.capLabel}</span>
                    ) : (
                      <strong key={`cap-${i}`} className="num sc-v">{r.capLabel}</strong>
                    ),
                  ])}
                />
                <p>
                  {c.sections.sources.footer.before}
                  <a href="/scoring">
                    {c.sections.sources.footer.linkLabel}
                  </a>
                  {c.sections.sources.footer.after}
                </p>
              </Section>
            ),
            activity: () => (
              <Section cms="sections.activity.title" title={c.sections.activity.title}>
                <ul className="legal-list">
                  {c.sections.activity.bullets.map((b) => (
                    <li key={b.strong}>
                      <strong>{b.strong}</strong>
                      {b.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            notShown: () => (
              <Section cms="sections.notShown.title" title={c.sections.notShown.title}>
                <p>{c.sections.notShown.intro}</p>
                <ul className="legal-list">
                  {c.sections.notShown.bullets.map((b) => (
                    <li key={b.strong}>
                      <strong>{b.strong}</strong>
                      {b.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            hostVsPlayer: () => (
              <Section cms="sections.hostVsPlayer.title" title={c.sections.hostVsPlayer.title}>
                <p>{c.sections.hostVsPlayer.body}</p>
              </Section>
            ),
            faq: () => (
              <Section cms="sections.faq.title" title={c.sections.faq.title}>
                <FaqAccordion items={c.faq} />
              </Section>
            ),
        })}

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards heading={c.related.heading} items={c.related.items} />
      </ArticleFrame>
      <SiteFooter />
    </>
  );
}
