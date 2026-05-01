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
import { copy as copyAll, recentWinners, leaderboard } from './content/winnersCopy';

export default function WinnersPage() {
  const locale = useLocale();
  const c = copyAll[locale];
  const winners = recentWinners[locale];
  const lb = leaderboard[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.history, href: '/eurovision-history' },
    { label: c.crumbs.winners, href: '/winners' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.schemaTitle,
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/winners' },
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
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/winners"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="gold"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.sections.recent.title}>
          <p>{c.sections.recent.intro}</p>
          <DataTable
            headers={[
              c.sections.recent.headers.year,
              c.sections.recent.headers.country,
              c.sections.recent.headers.artist,
              c.sections.recent.headers.song,
              c.sections.recent.headers.points,
            ]}
            align={['left', 'left', 'left', 'left', 'right']}
            rows={winners.map((row) => [
              <span key="y" className="font-mono text-white/70 text-xs">{row[0]}</span>,
              <strong key="c" className="text-white">{row[1]}</strong>,
              row[2],
              <em key="s" className="text-white/75">{row[3]}</em>,
              <strong key="p" className="text-euro-pink-light tabular-nums">{row[4]}</strong>,
            ])}
          />
        </Section>

        <Section title={c.sections.leaderboard.title}>
          <p>{c.sections.leaderboard.intro}</p>
          <DataTable
            headers={[
              c.sections.leaderboard.headers.country,
              c.sections.leaderboard.headers.wins,
              c.sections.leaderboard.headers.mostRecent,
            ]}
            align={['left', 'right', 'right']}
            rows={lb.map((row) => [
              <strong key="c" className="text-white">{row[0]}</strong>,
              <strong key="w" className="text-euro-gold tabular-nums">{row[1]}</strong>,
              <span key="r" className="font-mono text-white/65 text-xs">{row[2]}</span>,
            ])}
          />
        </Section>

        <Section title={c.sections.notable.title}>
          <p>{c.sections.notable.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.notable.bullets.map((b, i) => (
              <li key={i}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={locale === 'el' ? 'Συχνές ερωτήσεις' : 'Frequently asked questions'}>
          <FaqAccordion items={c.faq} />
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards
          heading={c.related.heading}
          items={c.related.items}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
