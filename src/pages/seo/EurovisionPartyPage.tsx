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
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { EurovisionPartyContent } from '../../../supabase/functions/_shared/cms/schemas/eurovision-party';
import { PageContentFallback } from './PageContentFallback';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';
import { contestTexts } from './content/contestText';
import { useCurrentContest } from '../../lib/currentContest';

/** `YYYY-MM-DD` + 1 day (UTC). */
function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export default function EurovisionPartyPage() {
  const locale = useLocale();
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
  const MODIFIED = '2026-04-30T00:00:00Z'; // fact: date the page copy was last edited

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: interpolate(c.meta.headline, vars),
    description: interpolate(c.meta.articleDescription, vars),
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
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
  // The watch party runs 20:00–00:30 (CEST) on the live contest's final night.
  const final = cc.finalDate;
  const event = final && {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: interpolate(c.meta.eventName, vars),
    startDate: `${final}T20:00:00+02:00`,
    endDate: `${nextDay(final)}T00:30:00+02:00`,
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    description: interpolate(c.meta.eventDescription, vars),
    location: {
      '@type': 'VirtualLocation',
      url: 'https://eurovision.games',
    },
    organizer: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      url: 'https://eurovision.games',
    },
  };

  return (
    <>
      <PageSeo
        pageId="eurovision-party"
        locale={locale}
        title={interpolate(c.meta.title, vars)}
        description={interpolate(c.meta.description, vars)}
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, faqJsonLd, ...(event ? [event] : []), breadcrumbJsonLd(crumbs, locale)], c.extraBlocks)}
      />

      <ArticleFrame
        crumbs={crumbs}
        chip={c.hero.chip}
        title={c.hero.title}
        grad="dash"
        lede={c.hero.lede}
        actions={{ primary: { label: c.cta.primary, href: '/?action=create' }, secondary: { label: c.cta.secondary, href: '/eurovision-night' } }}
      >

        <Section title={c.sections.what.title}>
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

        <Section title={c.sections.headcount.title}>
          <ul className="legal-list">
            {c.sections.headcount.bullets.map((b) => (
              <li key={b.strong}>
                <strong>{b.strong}</strong>
                {b.rest}
                {b.link && (
                  <>
                    <a
                      href="/dashboard"
                     
                    >
                      {b.link.label}
                    </a>
                    {b.link.after}
                  </>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.theme.title}>
          <ul className="legal-list">
            {c.sections.theme.bullets.map((b) => (
              <li key={b.strong}>
                <strong>{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.food.title}>
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

        <Section title={c.sections.runOfShow.title}>
          <p>{c.sections.runOfShow.intro}</p>
          <DataTable
            headers={c.sections.runOfShow.tableHeaders}
            align={['left', 'left', 'left']}
            rows={c.sections.runOfShow.rows.map((r) => [r[0], r[1], r[2]])}
          />
        </Section>

        <Section title={c.sections.games.title}>
          <p>
            {c.sections.games.introBefore}
            <a
              href="/eurovision-games"
             
            >
              {c.sections.games.introLink}
            </a>
            {c.sections.games.introAfter}
          </p>
          <ul className="legal-list">
            {c.sections.games.bullets.map((b) => (
              <li key={b.href}>
                <strong>
                  <a href={b.href}>
                    {b.label}
                  </a>
                </strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.timezone.title}>
          <p>{c.sections.timezone.body}</p>
        </Section>

        <Section title={c.sections.faq.title}>
          <FaqAccordion items={c.faq} />
        </Section>

        <ExtraBlocks value={c.extraBlocks} />

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
