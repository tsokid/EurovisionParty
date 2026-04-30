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
import { copy as copyAll } from './content/eurovisionGamesCopy';

export default function EurovisionGamesPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/eurovision-games' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-games' },
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
        canonical="https://eurovision.games/eurovision-games"
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
        chipTone="pink"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.sections.inside.title}>
          <p>{c.sections.inside.intro}</p>
          <DataTable
            headers={c.sections.inside.tableHeaders}
            align={['left', 'left', 'left']}
            rows={c.sections.inside.rows.map((r) => [
              <a
                key={`g-${r.href}`}
                href={r.href}
                className="text-euro-pink-light hover:text-white underline underline-offset-2"
              >
                <strong>{r.game}</strong>
              </a>,
              r.when,
              r.scoring,
            ])}
          />
        </Section>

        <Section title={c.sections.predictions.title}>
          <p>{c.sections.predictions.p1}</p>
          <p>
            {c.sections.predictions.p2Before}
            <a href="/eurovision-2026-predictions" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              {c.sections.predictions.p2Link}
            </a>
            {c.sections.predictions.p2After}
          </p>
        </Section>

        <Section title={c.sections.quiz.title}>
          <p>{c.sections.quiz.p1}</p>
          <p>
            {c.sections.quiz.p2Before}
            <a href="/eurovision-trivia" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              {c.sections.quiz.p2Link}
            </a>
            {c.sections.quiz.p2After}
          </p>
        </Section>

        <Section title={c.sections.duels.title}>
          <p>
            {c.sections.duels.p1Pre}
            <strong className="text-white">{c.sections.duels.steal}</strong>
            {c.sections.duels.p1Mid}
            <strong className="text-white">{c.sections.duels.double}</strong>
            {c.sections.duels.p1Post}
          </p>
          <p>
            {c.sections.duels.p2Before}
            <a href="/duels" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              {c.sections.duels.p2Link}
            </a>
            {c.sections.duels.p2After}
          </p>
        </Section>

        <Section title={c.sections.dashboard.title}>
          <p>{c.sections.dashboard.p1}</p>
          <p>
            {c.sections.dashboard.p2Before}
            <a href="/dashboard" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              {c.sections.dashboard.p2Link}
            </a>
            {c.sections.dashboard.p2After}
          </p>
        </Section>

        <Section title={c.sections.trophies.title}>
          <p>{c.sections.trophies.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.trophies.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.free.title}>
          <p>{c.sections.free.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.free.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.faq.title}>
          <FaqAccordion items={c.faq} />
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards heading={c.related.heading} items={c.related.items} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
