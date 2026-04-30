import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/triviaCopy';

export default function EurovisionTriviaPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.trivia, href: '/eurovision-trivia' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-trivia' },
  };
  const quizSchema = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: c.meta.quizName,
    about: c.meta.quizAbout,
    hasPart: c.questions.map((s) => ({
      '@type': 'Question',
      name: s.q,
      acceptedAnswer: { '@type': 'Answer', text: s.answer },
    })),
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
        canonical="https://eurovision.games/eurovision-trivia"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, quizSchema, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="purple"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.sections.whatIs.title}>
          <p>{c.sections.whatIs.body}</p>
        </Section>

        <Section title={c.sections.samples.title}>
          <p>{c.sections.samples.intro}</p>
          <ol className="space-y-4 list-none pl-0">
            {c.questions.map((s, i) => (
              <li
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
              >
                <p className="font-semibold text-white text-[16px] mb-3">
                  <span className="text-euro-pink-light mr-2">{c.sections.samples.questionPrefix}{i + 1}.</span>
                  {s.q}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 list-none pl-0">
                  {s.options.map((o) => (
                    <li
                      key={o}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80"
                    >
                      {o}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-white/70">
                  <em className="text-euro-pink-light not-italic font-semibold">{c.sections.samples.answerLabel} </em>
                  {s.answer}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title={c.sections.categories.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">{c.sections.categories.easyLabel}</strong> {c.sections.categories.easyBody}</li>
            <li><strong className="text-white">{c.sections.categories.mediumLabel}</strong> {c.sections.categories.mediumBody}</li>
            <li><strong className="text-white">{c.sections.categories.hardLabel}</strong> {c.sections.categories.hardBody}</li>
          </ul>
        </Section>

        <Section title={c.sections.duels.title}>
          <p>
            {c.sections.duels.body1Pre}<em>{c.sections.duels.body1Em}</em>{c.sections.duels.body1Post}
          </p>
          <p>
            {c.sections.duels.body2Pre}
            <a href="/duels" className="text-euro-pink-light hover:text-white underline underline-offset-2">{c.sections.duels.body2LinkLabel}</a>
            {c.sections.duels.body2Post}
          </p>
        </Section>

        <Section title={c.sections.play.title}>
          <p>
            {c.sections.play.pre}
            <a href="/" className="text-euro-pink-light hover:text-white underline underline-offset-2">{c.sections.play.linkLabel}</a>
            {c.sections.play.post}
          </p>
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
            { href: '/duels', title: c.related.duels.title, blurb: c.related.duels.blurb },
            { href: '/eurovision-2026-predictions', title: c.related.predictions.title, blurb: c.related.predictions.blurb },
            { href: '/how-to-play', title: c.related.howToPlay.title, blurb: c.related.howToPlay.blurb },
            { href: '/scoring', title: c.related.scoring.title, blurb: c.related.scoring.blurb },
            { href: '/rules', title: c.related.rules.title, blurb: c.related.rules.blurb },
            { href: '/eurovision-night', title: c.related.night.title, blurb: c.related.night.blurb },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
