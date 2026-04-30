import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/eurovisionPartyCopy';

export default function EurovisionPartyPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/eurovision-party' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.headline,
    description: c.meta.articleDescription,
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-party' },
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
  const event = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: c.meta.eventName,
    startDate: '2026-05-16T20:00:00+02:00',
    endDate: '2026-05-17T00:30:00+02:00',
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    description: c.meta.eventDescription,
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
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/eurovision-party"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, faqJsonLd, event, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="gold"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.sections.what.title}>
          <p>
            {c.sections.what.intro}
            <strong className="text-white">{c.sections.what.b1}</strong>
            {c.sections.what.b1Suffix}
            <strong className="text-white">{c.sections.what.b2}</strong>
            {c.sections.what.b2Suffix}
            <strong className="text-white">{c.sections.what.b3}</strong>
            {c.sections.what.outro}
          </p>
        </Section>

        <Section title={c.sections.headcount.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.headcount.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
                {b.link && (
                  <>
                    <a
                      href="/dashboard"
                      className="text-euro-pink-light hover:text-white underline underline-offset-2"
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
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.theme.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.food.title}>
          <p>{c.sections.food.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.food.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
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
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              {c.sections.games.introLink}
            </a>
            {c.sections.games.introAfter}
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.games.bullets.map((b) => (
              <li key={b.href}>
                <strong className="text-white">
                  <a href={b.href} className="text-euro-pink-light hover:text-white underline underline-offset-2">
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

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/' }}
          secondary={{ label: c.cta.secondary, href: '/eurovision-night' }}
        />

        <RelatedCards heading={c.related.heading} items={c.related.items} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
