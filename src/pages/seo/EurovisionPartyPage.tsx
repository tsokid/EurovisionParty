import LocaleLink from '../../components/seo/LocaleLink';
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
import type { EurovisionPartyContent } from '../../../supabase/functions/_shared/cms/schemas/eurovision-party';
import { PageContentFallback } from './PageContentFallback';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';
import { contestTexts } from './content/contestText';
import { useCurrentContest } from '../../lib/currentContest';
import { useSiteSettings } from '../../lib/cms/siteSettings';

export default function EurovisionPartyPage() {
  const locale = useLocale();
  const settings = useSiteSettings();
  const cc = useCurrentContest();
  const content = usePageContent<EurovisionPartyContent>('eurovision-party');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;
  const t = contestTexts(cc)[locale];
  const vars = { year: t.year, finalDayShort: t.finalDayShort };

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/eurovision-party' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = pageModified('eurovision-party'); // the page's last change, from git (sitemap lastmod)

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: interpolate(c.meta.headline, vars),
    description: interpolate(c.meta.articleDescription, vars),
    image: settings.defaultOgImage,
    author: { '@type': 'Organization', name: settings.organization.name, url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: settings.organization.name,
      logo: { '@type': 'ImageObject', url: settings.organization.logo },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('eurovision-party', locale) },
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
  // No Event markup: a watch party is not a scheduled public
  // event under Google's event policy; Article + FAQ describe the page.
  return (
    <>
      <PageSeo
        pageId="eurovision-party"
        locale={locale}
        title={interpolate(c.meta.title, vars)}
        description={interpolate(c.meta.description, vars)}
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
        actions={{ primary: { label: c.cta.primary, href: '/?action=create' }, secondary: { label: c.cta.secondary, href: '/eurovision-night' } }}
      >

        {pageSections(c.layout, {
            what: () => (
              <Section cms="sections.what.title" title={c.sections.what.title}>
                <p>
                  {c.sections.what.intro}
                  <strong>{c.sections.what.b1}</strong>
                  {c.sections.what.b1Suffix}
                  <strong>{c.sections.what.b2}</strong>
                  {c.sections.what.b2Suffix}
                  <strong>{c.sections.what.b3}</strong>
                  {c.sections.what.outro}
                </p>
              </Section>
            ),
            headcount: () => (
              <Section cms="sections.headcount.title" title={c.sections.headcount.title}>
                <ul className="legal-list">
                  {c.sections.headcount.bullets.map((b) => (
                    <li key={b.strong}>
                      <strong>{b.strong}</strong>
                      {b.rest}
                      {b.link && (
                        <>
                          <LocaleLink
                            to="/dashboard"
                     
                          >
                            {b.link.label}
                          </LocaleLink>
                          {b.link.after}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            theme: () => (
              <Section cms="sections.theme.title" title={c.sections.theme.title}>
                <ul className="legal-list">
                  {c.sections.theme.bullets.map((b) => (
                    <li key={b.strong}>
                      <strong>{b.strong}</strong>
                      {b.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            food: () => (
              <Section cms="sections.food.title" title={c.sections.food.title}>
                <p>{c.sections.food.intro}</p>
                <ul className="legal-list">
                  {c.sections.food.bullets.map((b) => (
                    <li key={b.strong}>
                      <strong>{b.strong}</strong>
                      {b.rest}
                    </li>
                  ))}
                </ul>
                <p>{c.sections.food.drinks}</p>
              </Section>
            ),
            runOfShow: () => (
              <Section cms="sections.runOfShow.title" title={c.sections.runOfShow.title}>
                <p>{c.sections.runOfShow.intro}</p>
                <DataTable
                  headers={c.sections.runOfShow.tableHeaders}
                  align={['left', 'left', 'left']}
                  rows={c.sections.runOfShow.rows.map((r) => [r[0], r[1], r[2]])}
                />
              </Section>
            ),
            games: () => (
              <Section cms="sections.games.title" title={c.sections.games.title}>
                <p>
                  {c.sections.games.introBefore}
                  <LocaleLink
                    to="/eurovision-games"
             
                  >
                    {c.sections.games.introLink}
                  </LocaleLink>
                  {c.sections.games.introAfter}
                </p>
                <ul className="legal-list">
                  {c.sections.games.bullets.map((b) => (
                    <li key={b.href}>
                      <strong>
                        <LocaleLink to={b.href}>
                          {b.label}
                        </LocaleLink>
                      </strong>
                      {b.rest}
                    </li>
                  ))}
                </ul>
              </Section>
            ),
            timezone: () => (
              <Section cms="sections.timezone.title" title={c.sections.timezone.title}>
                <p>{c.sections.timezone.body}</p>
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
          secondary={{ label: c.cta.secondary, href: '/eurovision-night' }}
        />

        <RelatedCards heading={c.related.heading} items={c.related.items} />
      </ArticleFrame>
      <SiteFooter />
    </>
  );
}
