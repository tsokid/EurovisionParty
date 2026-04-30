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
import { copy as copyAll } from './content/duelsCopy';

export default function EurovisionDuelsPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.duels, href: '/duels' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/duels' },
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
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: c.meta.howToName,
    description: c.meta.howToDescription,
    totalTime: 'PT2M',
    step: c.howToSteps.map((s) => ({
      '@type': 'HowToStep',
      name: s.name,
      text: s.text,
    })),
  };

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/duels"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, howTo, faqJsonLd, breadcrumbJsonLd(crumbs)]}
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
          <p>
            {c.sections.whatIs.bodyPre}
            <em>{c.sections.whatIs.bodyEm}</em>
            {c.sections.whatIs.bodyPost}
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.whatIs.bullets.map((b, i) => (
              <li key={i}>
                <strong className="text-white">{b.strong}</strong>{b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.when.title}>
          <p>
            {c.sections.when.body1Pre}
            <strong className="text-white">{c.sections.when.body1Strong1}</strong>
            {c.sections.when.body1Mid}
            <strong className="text-white">{c.sections.when.body1Strong2}</strong>
            {c.sections.when.body1Post}
          </p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6 text-[16px]">
            <p className="text-white/85">
              <strong className="text-white">{c.sections.when.ruleOfThumbStrong}</strong>
              {c.sections.when.ruleOfThumbBody}
            </p>
          </div>
        </Section>

        <Section title={c.sections.scoring.title}>
          <p>{c.sections.scoring.intro}</p>
          <DataTable
            headers={[c.sections.scoring.headers.scenario, c.sections.scoring.headers.points]}
            align={['left', 'right']}
            rows={[
              [c.sections.scoring.rows.zeroToOne, <strong key="a" className="text-white">11–12</strong>],
              [c.sections.scoring.rows.five, <strong key="b" className="text-white">7</strong>],
              [c.sections.scoring.rows.eleven, <strong key="c" className="text-white">1</strong>],
              [c.sections.scoring.rows.wrong, <span key="d" className="text-white/50">0</span>],
              [c.sections.scoring.rows.winBonus, <strong key="e" className="text-euro-pink-light">+12</strong>],
            ]}
          />
          <p>
            {c.sections.scoring.winnerScorePre}
            <em>{c.sections.scoring.winnerScoreEm}</em>
            {c.sections.scoring.winnerScorePost}
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li>
              <strong className="text-white">{c.sections.scoring.stealLabel}</strong>
              {c.sections.scoring.stealBodyPre}
              <em>{c.sections.scoring.stealBodyEm}</em>
              {c.sections.scoring.stealBodyPost}
            </li>
            <li>
              <strong className="text-white">{c.sections.scoring.doubleLabel}</strong>
              {c.sections.scoring.doubleBodyPre}
              <em>{c.sections.scoring.doubleBodyEm}</em>
              {c.sections.scoring.doubleBodyPost}
            </li>
          </ul>
        </Section>

        <Section title={c.sections.stealVsDouble.title}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.05] p-6">
              <h3 className="text-white font-bold text-lg mb-2">{c.sections.stealVsDouble.stealHeading}</h3>
              <p className="text-white/80 text-[15px] leading-relaxed">
                {c.sections.stealVsDouble.stealBody}
              </p>
            </div>
            <div className="rounded-2xl border border-euro-purple-light/30 bg-euro-purple-light/[0.05] p-6">
              <h3 className="text-white font-bold text-lg mb-2">{c.sections.stealVsDouble.doubleHeading}</h3>
              <p className="text-white/80 text-[15px] leading-relaxed">
                {c.sections.stealVsDouble.doubleBodyPre}
                <em>{c.sections.stealVsDouble.doubleBodyEm}</em>
                {c.sections.stealVsDouble.doubleBodyPost}
              </p>
            </div>
          </div>
        </Section>

        <Section title={c.sections.trophies.title}>
          <p>{c.sections.trophies.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">{c.sections.trophies.duelistLabel}</strong>{c.sections.trophies.duelistBody}</li>
            <li><strong className="text-white">{c.sections.trophies.thiefLabel}</strong>{c.sections.trophies.thiefBody}</li>
          </ul>
          <p>
            {c.sections.trophies.seePre}
            <a href="/scoring" className="text-euro-pink-light hover:text-white underline underline-offset-2">{c.sections.trophies.scoringLink}</a>
            {c.sections.trophies.seeMid}
            <a href="/rules" className="text-euro-pink-light hover:text-white underline underline-offset-2">{c.sections.trophies.rulesLink}</a>
            {c.sections.trophies.seePost}
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
            { href: '/eurovision-trivia', title: c.related.trivia.title, blurb: c.related.trivia.blurb },
            { href: '/scoring', title: c.related.scoring.title, blurb: c.related.scoring.blurb },
            { href: '/eurovision-2026-predictions', title: c.related.predictions.title, blurb: c.related.predictions.blurb },
            { href: '/how-to-play', title: c.related.howToPlay.title, blurb: c.related.howToPlay.blurb },
            { href: '/rules', title: c.related.rules.title, blurb: c.related.rules.blurb },
            { href: '/faq#leave', title: c.related.leave.title, blurb: c.related.leave.blurb },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
