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
import { COUNTRIES_2026 as CANON } from '../../lib/countries2026';
import { getLocalizedCountryName } from '../../lib/countryLocale';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/predictionsCopy';

export default function Predictions2026Page() {
  const locale = useLocale();
  const c = copyAll[locale];

  // Build the display list straight off the canonical participant table so the
  // SEO copy can never drift from the actual game line-up. Sorted alphabetically
  // and host (Austria) tagged inline for clarity.
  const COUNTRIES_2026 = [...CANON]
    .map((country) => {
      const name = getLocalizedCountryName(country);
      return country.semi === 'host' ? `${name}${c.sections.lineup.hostSuffix}` : name;
    })
    .sort((a, b) => a.localeCompare(b, locale));

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.predictions, href: '/eurovision-2026-predictions' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-2026-predictions' },
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
        canonical="https://eurovision.games/eurovision-2026-predictions"
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
        chipTone="purple"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.sections.lineup.title}>
          <p>{c.sections.lineup.intro(COUNTRIES_2026.length)}</p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-white/80">
            {COUNTRIES_2026.map((country) => (
              <li key={country}>{country}</li>
            ))}
          </ul>
          <p className="text-sm text-white/60">
            {c.sections.lineup.withdrawnPre}
            {c.withdrawn.join(', ')}
            {c.sections.lineup.withdrawnPost}
          </p>
          <p className="text-sm text-white/60">{c.sections.lineup.runningOrder}</p>
        </Section>

        <Section title={c.sections.format.title}>
          <p>{c.sections.format.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">{c.sections.format.top5Label}</strong> — {c.sections.format.top5Body}</li>
            <li><strong className="text-white">{c.sections.format.worst5Label}</strong> — {c.sections.format.worst5Body}</li>
          </ul>
          <p>
            {c.sections.format.orderedPre}
            <strong className="text-white">{c.sections.format.orderedEm}</strong>
            {c.sections.format.orderedPost}
          </p>
        </Section>

        <Section title={c.sections.scoringTop5.title}>
          <p>{c.sections.scoringTop5.intro}</p>
          <DataTable
            headers={[c.sections.scoringTop5.headers.result, c.sections.scoringTop5.headers.points]}
            align={['left', 'right']}
            rows={[
              [c.sections.scoringTop5.rows.exact, <strong key="a" className="text-white">50</strong>],
              [c.sections.scoringTop5.rows.inListWrong, <strong key="b" className="text-white">20</strong>],
              [c.sections.scoringTop5.rows.outside, <span key="c" className="text-white/50">0</span>],
            ]}
          />
          <p>
            {c.sections.scoringTop5.max.pre}
            <strong className="text-white">{c.sections.scoringTop5.max.post}</strong>.
          </p>
        </Section>

        <Section title={c.sections.scoringWorst5.title}>
          <p>{c.sections.scoringWorst5.intro}</p>
          <DataTable
            headers={[c.sections.scoringWorst5.headers.result, c.sections.scoringWorst5.headers.points]}
            align={['left', 'right']}
            rows={[
              [c.sections.scoringWorst5.rows.exact, <strong key="a" className="text-white">50</strong>],
              [c.sections.scoringWorst5.rows.inListWrong, <strong key="b" className="text-white">20</strong>],
              [c.sections.scoringWorst5.rows.outside, <span key="c" className="text-white/50">0</span>],
            ]}
          />
          <p>
            {c.sections.scoringWorst5.max.pre}
            <strong className="text-white">{c.sections.scoringWorst5.max.cap}</strong>.
          </p>
        </Section>

        <Section title={c.sections.strategy.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.strategy.tips.map((tip, i) => (
              <li key={i}>
                <strong className="text-white">{tip.strong}</strong>{tip.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.faqTitle}>
          <FaqAccordion items={c.faq} />
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-night', title: c.related.night.title, blurb: c.related.night.blurb },
            { href: '/eurovision-trivia', title: c.related.trivia.title, blurb: c.related.trivia.blurb },
            { href: '/duels', title: c.related.duels.title, blurb: c.related.duels.blurb },
            { href: '/scoring', title: c.related.scoring.title, blurb: c.related.scoring.blurb },
            { href: '/how-to-play', title: c.related.howToPlay.title, blurb: c.related.howToPlay.blurb },
            { href: '/faq', title: c.related.faq.title, blurb: c.related.faq.blurb },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
