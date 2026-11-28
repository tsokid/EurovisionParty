import { pageModified } from '../../lib/seo/pageDates';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import LocaleLink from '../../components/seo/LocaleLink';
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
import type { EurovisionGamesContent } from '../../../supabase/functions/_shared/cms/schemas/eurovision-games';
import { PageContentFallback } from './PageContentFallback';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';
import { useCurrentContest } from '../../lib/currentContest';
import { useSiteSettings } from '../../lib/cms/siteSettings';

export default function EurovisionGamesPage() {
  const locale = useLocale();
  const settings = useSiteSettings();
  const cc = useCurrentContest();
  const content = usePageContent<EurovisionGamesContent>('eurovision-games');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;
  const vars = { year: cc.year };

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/eurovision-games' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = pageModified('eurovision-games'); // the page's last change, from git (sitemap lastmod)

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: interpolate(c.meta.headline, vars),
    description: c.meta.articleDescription,
    image: settings.defaultOgImage,
    author: { '@type': 'Organization', name: settings.organization.name, url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: settings.organization.name,
      logo: { '@type': 'ImageObject', url: settings.organization.logo },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('eurovision-games', locale) },
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
        pageId="eurovision-games"
        locale={locale}
        title={interpolate(c.meta.title, vars)}
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
            inside: () => (
              <Section cms="sections.inside.title" title={c.sections.inside.title}>
                <p>{c.sections.inside.intro}</p>
                <DataTable
                  headers={c.sections.inside.tableHeaders}
                  align={['left', 'left', 'left']}
                  rows={c.sections.inside.rows.map((r) => [
                    <a
                      key={`g-${r.href}`}
                      href={r.href}
               
                    >
                      <strong>{r.game}</strong>
                    </a>,
                    r.when,
                    r.scoring,
                  ])}
                />
              </Section>
            ),
            predictions: () => (
              <Section cms="sections.predictions.title" title={c.sections.predictions.title}>
                <p>{interpolate(c.sections.predictions.p1, vars)}</p>
                <p>
                  {c.sections.predictions.p2Before}
                  <LocaleLink to="/eurovision-predictions">
                    {c.sections.predictions.p2Link}
                  </LocaleLink>
                  {c.sections.predictions.p2After}
                </p>
              </Section>
            ),
            quiz: () => (
              <Section cms="sections.quiz.title" title={c.sections.quiz.title}>
                <p>{c.sections.quiz.p1}</p>
                <p>
                  {c.sections.quiz.p2Before}
                  <LocaleLink to="/eurovision-trivia">
                    {c.sections.quiz.p2Link}
                  </LocaleLink>
                  {c.sections.quiz.p2After}
                </p>
              </Section>
            ),
            duels: () => (
              <Section cms="sections.duels.title" title={c.sections.duels.title}>
                <p>
                  {c.sections.duels.p1Pre}
                  <strong>{c.sections.duels.steal}</strong>
                  {c.sections.duels.p1Mid}
                  <strong>{c.sections.duels.double}</strong>
                  {c.sections.duels.p1Post}
                </p>
                <p>
                  {c.sections.duels.p2Before}
                  <LocaleLink to="/duels">
                    {c.sections.duels.p2Link}
                  </LocaleLink>
                  {c.sections.duels.p2After}
                </p>
              </Section>
            ),
            dashboard: () => (
              <Section cms="sections.dashboard.title" title={c.sections.dashboard.title}>
                <p>{c.sections.dashboard.p1}</p>
                <p>
                  {c.sections.dashboard.p2Before}
                  <LocaleLink to="/dashboard">
                    {c.sections.dashboard.p2Link}
                  </LocaleLink>
                  {c.sections.dashboard.p2After}
                </p>
              </Section>
            ),
            trophies: () => (
              <Section cms="sections.trophies.title" title={c.sections.trophies.title}>
                <p>{c.sections.trophies.intro}</p>
                <ul className="legal-list">
                  {c.sections.trophies.bullets.map((b) => (
                    <li key={b.strong}>
                      <strong>{b.strong}</strong>
                      {b.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            free: () => (
              <Section cms="sections.free.title" title={c.sections.free.title}>
                <p>{c.sections.free.intro}</p>
                <ul className="legal-list">
                  {c.sections.free.bullets.map((b) => (
                    <li key={b.strong}>
                      <strong>{b.strong}</strong>
                      {b.rest}
                    </li>
                  ))}
                </ul>
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
