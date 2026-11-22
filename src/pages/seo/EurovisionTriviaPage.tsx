import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import { ArticleFrame } from '../../components/seo/LegalFrame';
import Section from '../../components/seo/Section';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { EurovisionTriviaContent } from '../../../supabase/functions/_shared/cms/schemas/eurovision-trivia';
import { PageContentFallback } from './PageContentFallback';

export default function EurovisionTriviaPage() {
  const locale = useLocale();
  const content = usePageContent<EurovisionTriviaContent>('eurovision-trivia');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.trivia, href: '/eurovision-trivia' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = '2026-04-30T00:00:00Z'; // fact: date the page copy was last edited

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
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('eurovision-trivia', locale) },
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
      <PageSeo
        pageId="eurovision-trivia"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, quizSchema, faqJsonLd, breadcrumbJsonLd(crumbs, locale)], c.extraBlocks)}
      />

      <ArticleFrame
        crumbs={crumbs}
        chip={c.hero.chip}
        title={c.hero.title}
        grad="dash"
        lede={c.hero.lede}
        actions={{ primary: { label: c.cta.primary, href: '/?action=create' }, secondary: { label: c.cta.secondary, href: '/how-to-play' } }}
      >

        <Section title={c.sections.whatIs.title}>
          <p>{c.sections.whatIs.body}</p>
        </Section>

        <Section title={c.sections.samples.title}>
          <p>{c.sections.samples.intro}</p>
          <ol className="tq-list">
            {c.questions.map((s, i) => (
              <li
                key={i}
                className="card card-pad tq"
              >
                <p className="tq-q">
                  <span className="tq-n">{c.sections.samples.questionPrefix}{i + 1}.</span>
                  {s.q}
                </p>
                <ul className="tq-opts">
                  {s.options.map((o) => (
                    <li
                      key={o}
                      className="tq-opt"
                    >
                      {o}
                    </li>
                  ))}
                </ul>
                <p className="t-small tq-a">
                  <em className="tq-a-k">{c.sections.samples.answerLabel} </em>
                  {s.answer}
                </p>
              </li>
            ))}
          </ol>
          {c.sections.disclaimer && (
            <p className="t-meta">{c.sections.disclaimer}</p>
          )}
        </Section>

        <Section title={c.sections.categories.title}>
          <ul className="legal-list">
            <li><strong>{c.sections.categories.easyLabel}</strong> {c.sections.categories.easyBody}</li>
            <li><strong>{c.sections.categories.mediumLabel}</strong> {c.sections.categories.mediumBody}</li>
            <li><strong>{c.sections.categories.hardLabel}</strong> {c.sections.categories.hardBody}</li>
          </ul>
        </Section>

        <Section title={c.sections.duels.title}>
          <p>
            {c.sections.duels.body1Pre}<em>{c.sections.duels.body1Em}</em>{c.sections.duels.body1Post}
          </p>
          <p>
            {c.sections.duels.body2Pre}
            <a href="/duels">{c.sections.duels.body2LinkLabel}</a>
            {c.sections.duels.body2Post}
          </p>
        </Section>

        <Section title={c.sections.play.title}>
          <p>
            {c.sections.play.pre}
            <a href="/">{c.sections.play.linkLabel}</a>
            {c.sections.play.post}
          </p>
        </Section>

        <Section title={c.sections.faqTitle}>
          <FaqAccordion items={c.faq} />
        </Section>

        <ExtraBlocks value={c.extraBlocks} />

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/duels', title: c.related.duels.title, blurb: c.related.duels.blurb },
            { href: '/eurovision-predictions', title: c.related.predictions.title, blurb: c.related.predictions.blurb },
            { href: '/how-to-play', title: c.related.howToPlay.title, blurb: c.related.howToPlay.blurb },
            { href: '/scoring', title: c.related.scoring.title, blurb: c.related.scoring.blurb },
            { href: '/rules', title: c.related.rules.title, blurb: c.related.rules.blurb },
            { href: '/eurovision-night', title: c.related.night.title, blurb: c.related.night.blurb },
          ]}
        />
      </ArticleFrame>
      <SiteFooter />
    </>
  );
}
